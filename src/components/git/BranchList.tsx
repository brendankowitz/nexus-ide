import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useProjectStore, selectActiveWorktrees } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { useGit } from '@/hooks/useGit';
import { useToastStore } from '@/stores/toastStore';
import {
  groupBranches,
  findHeadPrefix,
  initCollapsedState,
  isPushRejectedNeedingForce,
  buildRemoteTree,
  collectTreeKeys,
} from '@/utils/branchUtils';
import type { BranchGroup, RemoteTreeNode, RemoteLeaf } from '@/utils/branchUtils';
import type { Branch, RemoteBranch, Worktree } from '@/types';

// ── Local types ────────────────────────────────────

type BranchOp = 'checkout' | 'push' | 'force' | 'pull' | 'rename' | 'track' | 'untrack' | 'worktree';

// ── Loading / Empty ────────────────────────────────

const BranchLoading = (): React.JSX.Element => (
  <div className="flex h-full items-center justify-center">
    <div className="flex items-center gap-2.5">
      <div className="h-3 w-3 animate-spin rounded-full border border-text-ghost border-t-phase-plan" />
      <span className="font-mono text-[11px] text-text-tertiary">loading…</span>
    </div>
  </div>
);

const BranchEmptyState = (): React.JSX.Element => (
  <div className="flex h-full flex-col items-center justify-center gap-4 px-8">
    <div className="relative">
      <div className="absolute inset-0 rounded-2xl opacity-30 blur-2xl" style={{ background: 'var(--phase-plan)' }} />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-border-default bg-bg-surface">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
          <line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" />
        </svg>
      </div>
    </div>
    <div className="text-center">
      <p className="font-mono text-[13px] font-medium text-text-primary">No branches</p>
      <p className="mt-1 text-[11px] text-text-tertiary">Branches will appear once git data loads</p>
    </div>
  </div>
);

// ── Dropdown menu portal ───────────────────────────

interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

const DropdownMenu = ({
  anchorRect,
  items,
  onClose,
}: {
  anchorRect: DOMRect;
  items: MenuItem[];
  onClose: () => void;
}): React.JSX.Element => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    // Use setTimeout to avoid immediately closing on the click that opened it
    const id = setTimeout(() => document.addEventListener('mousedown', handle), 0);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handle); };
  }, [onClose]);

  // Position below the anchor, aligned to its right edge
  const top = anchorRect.bottom + 4;
  const right = window.innerWidth - anchorRect.right;

  return createPortal(
    <div
      ref={menuRef}
      style={{ position: 'fixed', top, right, zIndex: 9999 }}
      className="min-w-[140px] overflow-hidden rounded-[var(--radius-md)] border border-border-strong bg-bg-overlay shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
    >
      {items.map((item, i) => (
        <button
          key={i}
          disabled={item.disabled}
          onClick={(e) => { e.stopPropagation(); if (!item.disabled) { item.onClick(); onClose(); } }}
          className={`flex w-full cursor-pointer items-center px-3 py-1.5 font-mono text-[11px] transition-colors duration-[var(--duration-fast)] disabled:cursor-not-allowed disabled:opacity-40 ${
            item.danger
              ? 'text-[var(--color-danger)] hover:bg-[#f8514910]'
              : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
};

// ── Force push confirmation (inline) ──────────────

const ForcePushConfirm = ({
  onConfirm,
  onCancel,
  busy,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}): React.JSX.Element => (
  <div className="mt-1 flex items-center gap-2 pl-[19px]">
    <span className="font-mono text-[10px] text-text-secondary">push rejected —</span>
    <button
      onClick={onConfirm}
      disabled={busy}
      className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-danger)] px-2 py-1 font-mono text-[10px] text-[var(--color-danger)] transition-colors hover:bg-[#f8514910] disabled:opacity-40"
    >
      {busy ? 'pushing…' : 'force push?'}
    </button>
    <button
      onClick={onCancel}
      className="cursor-pointer font-mono text-[10px] text-text-tertiary hover:text-text-secondary"
    >
      cancel
    </button>
  </div>
);

// ── BranchList (outer) ─────────────────────────────

export const BranchList = (): React.JSX.Element => {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const branches = useProjectStore((s) =>
    s.activeProjectId !== null ? (s.branches[s.activeProjectId] ?? undefined) : undefined,
  );
  const worktrees = useProjectStore(selectActiveWorktrees);
  const { loading, refresh } = useGit();

  const [showWorktreeBranches, setShowWorktreeBranches] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [remoteBranches, setRemoteBranches] = useState<RemoteBranch[]>([]);
  const [remoteOpen, setRemoteOpen] = useState(true);
  const [fetchingAll, setFetchingAll] = useState(false);

  const [filter, setFilter] = useState('');

  const [expandAllGen, setExpandAllGen] = useState(0);
  const [collapseAllGen, setCollapseAllGen] = useState(0);

  // Auto-expand all groups when a filter is active
  useEffect(() => {
    if (!filter.trim()) return;
    setRemoteOpen(true);
    setExpandAllGen((v) => v + 1);
  }, [filter]);

  const handleExpandAll = useCallback(() => {
    setRemoteOpen(true);
    setExpandAllGen((v) => v + 1);
  }, []);

  const handleCollapseAll = useCallback(() => {
    setRemoteOpen(false);
    setCollapseAllGen((v) => v + 1);
  }, []);

  const loadRemotes = useCallback(async () => {
    if (!activeProjectId || !window.nexusAPI?.git?.remoteBranches) return;
    try {
      const remotes = await window.nexusAPI.git.remoteBranches(activeProjectId);
      setRemoteBranches(remotes);
    } catch { setRemoteBranches([]); }
  }, [activeProjectId]);

  useEffect(() => { void loadRemotes(); }, [loadRemotes]);

  const refreshAll = useCallback(async () => {
    await refresh();
    await loadRemotes();
  }, [refresh, loadRemotes]);

  const handleCreate = useCallback(async (): Promise<void> => {
    const name = newBranchName.trim();
    if (!name || activeProjectId === null || !window.nexusAPI?.git) return;
    setCreating(true); setCreateError(null);
    try {
      await window.nexusAPI.git.createBranch(activeProjectId, name);
      await refreshAll();
      setNewBranchName(''); setShowForm(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create branch';
      setCreateError(msg);
      useToastStore.getState().addToast(`Branch: ${msg}`, 'error');
    } finally { setCreating(false); }
  }, [activeProjectId, newBranchName, refreshAll]);

  const handleFetchAll = useCallback(async (): Promise<void> => {
    if (!activeProjectId || !window.nexusAPI?.git?.fetch) return;
    setFetchingAll(true);
    try {
      await window.nexusAPI.git.fetch(activeProjectId);
      await refreshAll();
      useToastStore.getState().addToast('Fetched from origin', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fetch failed';
      useToastStore.getState().addToast(`Fetch: ${msg}`, 'error');
    } finally { setFetchingAll(false); }
  }, [activeProjectId, refreshAll]);

  if (branches === undefined && loading) return <BranchLoading />;
  if (branches === undefined || branches.length === 0) return <BranchEmptyState />;

  const inWorktree = (b: Branch): boolean =>
    worktrees.some((wt) => !wt.isMainWorktree && (wt.branch === b.name || wt.branch === 'refs/heads/' + b.name));

  const filterLc = filter.toLowerCase();

  const visibleBranches = showWorktreeBranches ? branches : branches.filter((b) => !inWorktree(b));
  const hiddenCount = branches.length - visibleBranches.length;

  const filteredLocal = filterLc ? visibleBranches.filter((b) => b.name.toLowerCase().includes(filterLc)) : visibleBranches;
  const filteredRemotes = filterLc ? remoteBranches.filter((rb) => rb.shortName.toLowerCase().includes(filterLc)) : remoteBranches;

  const { topLevel, groups } = groupBranches(filteredLocal);
  const headPrefix = findHeadPrefix(filteredLocal);

  const remotesByName = new Map<string, RemoteBranch[]>();
  for (const rb of filteredRemotes) {
    const list = remotesByName.get(rb.remoteName);
    if (list) list.push(rb); else remotesByName.set(rb.remoteName, [rb]);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border-subtle px-4 py-2">
        <span className="font-mono text-[11px] text-text-secondary">
          {filterLc
            ? `${filteredLocal.length} of ${visibleBranches.length}`
            : `${visibleBranches.length} branch${visibleBranches.length !== 1 ? 'es' : ''}`}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExpandAll}
            title="expand all"
            className="cursor-pointer rounded-[var(--radius-sm)] px-1.5 py-1 font-mono text-[10px] text-text-tertiary transition-colors hover:text-text-secondary"
          >▾▾</button>
          <button
            onClick={handleCollapseAll}
            title="collapse all"
            className="cursor-pointer rounded-[var(--radius-sm)] px-1.5 py-1 font-mono text-[10px] text-text-tertiary transition-colors hover:text-text-secondary"
          >▸▸</button>
          <button
            onClick={() => { setShowForm((v) => !v); setCreateError(null); }}
            className="cursor-pointer rounded-[var(--radius-sm)] border border-phase-plan px-2 py-1 font-mono text-[11px] text-phase-plan transition-colors duration-[var(--duration-fast)] hover:bg-[var(--phase-plan-glow)]"
          >
            + new
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-border-subtle px-4 py-1.5">
        <span className="shrink-0 font-mono text-[11px] text-text-ghost">⌕</span>
        <input
          type="text" value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') setFilter(''); }}
          placeholder="filter…"
          className="flex-1 bg-transparent font-mono text-[11px] text-text-primary placeholder:text-text-ghost outline-none"
        />
        {filter && (
          <button onClick={() => setFilter('')}
            className="cursor-pointer font-mono text-[11px] text-text-tertiary transition-colors hover:text-text-secondary">
            ×
          </button>
        )}
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="flex flex-shrink-0 flex-col gap-1.5 border-b border-border-subtle bg-bg-raised px-4 py-2">
          <input
            type="text" value={newBranchName}
            onChange={(e) => { setNewBranchName(e.target.value); setCreateError(null); }}
            placeholder="branch name" autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate();
              if (e.key === 'Escape') { setShowForm(false); setNewBranchName(''); setCreateError(null); }
            }}
            className="w-full rounded-[var(--radius-sm)] border border-border-default bg-bg-surface px-2 py-1 font-mono text-[11px] text-text-primary outline-none focus:border-phase-plan"
          />
          {createError !== null && <p className="font-mono text-[10px] text-[var(--color-danger)]">{createError}</p>}
          <div className="flex gap-2">
            <button onClick={() => void handleCreate()} disabled={creating || !newBranchName.trim()}
              className="flex-1 cursor-pointer rounded-[var(--radius-sm)] bg-phase-plan px-2 py-1 font-mono text-[11px] font-medium text-bg-void disabled:cursor-not-allowed disabled:opacity-40">
              {creating ? 'creating…' : 'create'}
            </button>
            <button onClick={() => { setShowForm(false); setNewBranchName(''); setCreateError(null); }}
              className="cursor-pointer rounded-[var(--radius-sm)] border border-border-default px-2 py-1 font-mono text-[11px] text-text-tertiary transition-colors hover:text-text-secondary">
              cancel
            </button>
          </div>
        </div>
      )}

      {/* Main scroll area */}
      <div className="flex-1 overflow-y-auto">
        <BranchListInner topLevel={topLevel} groups={groups} headPrefix={headPrefix} refresh={refreshAll} worktrees={worktrees} expandAllGen={expandAllGen} collapseAllGen={collapseAllGen} />

        {hiddenCount > 0 && !filterLc && (
          <div className="border-t border-border-subtle px-5 py-2">
            <button onClick={() => setShowWorktreeBranches((v) => !v)}
              className="cursor-pointer font-mono text-[10px] text-text-tertiary transition-colors hover:text-text-secondary">
              {showWorktreeBranches ? 'hide worktree branches' : `${hiddenCount} in worktrees — show`}
            </button>
          </div>
        )}

        {/* Remote section */}
        <div className="border-t border-border-subtle">
          <div role="button" tabIndex={0}
            onClick={() => setRemoteOpen((v) => !v)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRemoteOpen((v) => !v); } }}
            className="flex cursor-pointer items-center gap-2 px-4 py-2 transition-colors hover:bg-bg-hover">
            <span className="font-mono text-[9px] text-text-ghost">{remoteOpen ? '▾' : '▸'}</span>
            <span className="font-mono text-[10px] font-semibold tracking-[1.5px] text-text-tertiary">REMOTE</span>
            {remoteBranches.length > 0 && (
              <span className="rounded-[3px] border border-border-strong px-1 py-px font-mono text-[9px] text-text-ghost">{remoteBranches.length}</span>
            )}
            <div className="flex-1" />
            <button
              onClick={(e) => { e.stopPropagation(); void handleFetchAll(); }}
              disabled={fetchingAll}
              className="flex cursor-pointer items-center gap-1 rounded-[var(--radius-sm)] border border-border-strong px-2 py-1 font-mono text-[10px] text-text-tertiary transition-colors hover:border-phase-execute hover:text-phase-execute disabled:opacity-40"
            >
              {fetchingAll
                ? <span className="flex items-center gap-1"><span className="h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />fetching…</span>
                : '↓ fetch all'}
            </button>
          </div>
          {remoteOpen && (
            <div className="pb-2">
              {Array.from(remotesByName.entries()).map(([remoteName, rBranches]) => (
                <RemoteRemoteGroup key={remoteName} remoteName={remoteName} branches={rBranches} refresh={refreshAll} projectId={activeProjectId} expandAllGen={expandAllGen} collapseAllGen={collapseAllGen} />
              ))}
              {remoteBranches.length === 0 && (
                <p className="px-5 py-2 font-mono text-[11px] text-text-ghost">no remote branches — run fetch all</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Remote tree helpers ────────────────────────────

function countLeaves(node: RemoteTreeNode): number {
  return node.leaves.length + node.children.reduce((s, c) => s + countLeaves(c), 0);
}

const BRANCH_BASE = 32; // px from left for depth-0 branch items
const GROUP_BASE  = 20; // px from left for depth-0 group headers
const DEPTH_STEP  = 14; // px added per depth level

// ── RemoteRemoteGroup ──────────────────────────────

const RemoteRemoteGroup = ({
  remoteName, branches, refresh, projectId, expandAllGen, collapseAllGen,
}: { remoteName: string; branches: RemoteBranch[]; refresh: () => Promise<void>; projectId: string | null; expandAllGen: number; collapseAllGen: number; }): React.JSX.Element => {
  const tree = useMemo(() => buildRemoteTree(remoteName, branches), [remoteName, branches]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const treeKeysRef = useRef<string[]>([]);
  treeKeysRef.current = useMemo(() => collectTreeKeys(tree), [tree]);

  useEffect(() => { if (expandAllGen === 0) return; setCollapsed({}); }, [expandAllGen]);
  useEffect(() => {
    if (collapseAllGen === 0) return;
    setCollapsed(Object.fromEntries(treeKeysRef.current.map((k) => [k, true])));
  }, [collapseAllGen]);

  const toggle = useCallback((key: string) => setCollapsed((p) => ({ ...p, [key]: !p[key] })), []);
  const rootCollapsed = collapsed[tree.key] ?? false;

  return (
    <div>
      {/* Origin-level collapsible header */}
      <div role="button" tabIndex={0}
        onClick={() => toggle(tree.key)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(tree.key); } }}
        className="flex cursor-pointer items-center gap-2 px-5 py-1.5 font-mono transition-colors hover:bg-bg-hover">
        <span className="text-[9px] text-text-ghost">{rootCollapsed ? '▸' : '▾'}</span>
        <span className="text-[11px] font-medium text-text-secondary">{remoteName}</span>
        <span className="rounded-[3px] border border-border-strong px-1 py-px font-mono text-[9px] text-text-ghost">{branches.length}</span>
      </div>
      {!rootCollapsed && (
        <RemoteTreeLevel node={tree} collapsed={collapsed} toggle={toggle} refresh={refresh} projectId={projectId} depth={0} />
      )}
    </div>
  );
};

// ── RemoteTreeLevel ────────────────────────────────

const RemoteTreeLevel = ({
  node, collapsed, toggle, refresh, projectId, depth,
}: { node: RemoteTreeNode; collapsed: Record<string, boolean>; toggle: (k: string) => void; refresh: () => Promise<void>; projectId: string | null; depth: number; }): React.JSX.Element => (
  <>
    {node.leaves.map((leaf) => (
      <RemoteBranchRow key={leaf.branch.name} leaf={leaf} depth={depth} refresh={refresh} projectId={projectId} />
    ))}
    {node.children.map((child) => (
      <RemoteTreeGroupNode key={child.key} node={child} collapsed={collapsed} toggle={toggle} refresh={refresh} projectId={projectId} depth={depth} />
    ))}
  </>
);

// ── RemoteTreeGroupNode ────────────────────────────

const RemoteTreeGroupNode = ({
  node, collapsed, toggle, refresh, projectId, depth,
}: { node: RemoteTreeNode; collapsed: Record<string, boolean>; toggle: (k: string) => void; refresh: () => Promise<void>; projectId: string | null; depth: number; }): React.JSX.Element => {
  const isCollapsed = collapsed[node.key] ?? false;
  return (
    <div>
      <div role="button" tabIndex={0}
        onClick={() => toggle(node.key)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(node.key); } }}
        style={{ paddingLeft: `${GROUP_BASE + depth * DEPTH_STEP}px` }}
        className="flex cursor-pointer items-center gap-2 py-1.5 pr-5 font-mono transition-colors hover:bg-bg-hover">
        <span className="text-[9px] text-text-ghost">{isCollapsed ? '▸' : '▾'}</span>
        <span className="flex-1 text-[11px] font-medium text-text-tertiary">{node.label}</span>
        <span className="rounded-[3px] border border-border-strong px-1.5 py-px text-[10px] font-medium text-text-ghost">{countLeaves(node)}</span>
      </div>
      {!isCollapsed && (
        <RemoteTreeLevel node={node} collapsed={collapsed} toggle={toggle} refresh={refresh} projectId={projectId} depth={depth + 1} />
      )}
    </div>
  );
};

// ── RemoteBranchRow ────────────────────────────────

const RemoteBranchRow = ({
  leaf, depth, refresh, projectId,
}: { leaf: RemoteLeaf; depth: number; refresh: () => Promise<void>; projectId: string | null; }): React.JSX.Element => {
  const { branch, label } = leaf;
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const showFeedback = (type: 'ok' | 'err', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleCheckout = useCallback(async () => {
    if (!projectId || !window.nexusAPI?.git?.checkoutRemote) return;
    setBusy(true);
    try {
      await window.nexusAPI.git.checkoutRemote(projectId, branch.name);
      await refresh();
      showFeedback('ok', 'checked out');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Checkout failed';
      showFeedback('err', msg);
      useToastStore.getState().addToast(`Checkout: ${msg}`, 'error');
    } finally { setBusy(false); }
  }, [projectId, branch.name, refresh]);

  return (
    <div style={{ paddingLeft: `${BRANCH_BASE + depth * DEPTH_STEP}px` }}
      className="group flex flex-col py-1.5 pr-5 font-mono text-[12px] transition-colors hover:bg-bg-hover">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="h-[6px] w-[6px] shrink-0 rounded-full bg-text-ghost" />
        <span className="min-w-0 flex-1 truncate text-text-secondary">{label}</span>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <PrimaryBtn label={busy ? '…' : 'checkout'} onClick={() => void handleCheckout()} disabled={busy} />
        </div>
      </div>
      {feedback !== null && (
        <span className={`mt-0.5 pl-[19px] text-[10px] ${feedback.type === 'ok' ? 'text-[var(--color-added)]' : 'text-[var(--color-deleted)]'}`}>{feedback.msg}</span>
      )}
    </div>
  );
};

// ── BranchListInner ────────────────────────────────

const BranchListInner = ({
  topLevel, groups, headPrefix, refresh, worktrees, expandAllGen, collapseAllGen,
}: { topLevel: Branch[]; groups: BranchGroup[]; headPrefix: string | null; refresh: () => Promise<void>; worktrees: Worktree[]; expandAllGen: number; collapseAllGen: number; }): React.JSX.Element => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => initCollapsedState(groups, headPrefix));
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  useEffect(() => {
    if (expandAllGen === 0) return;
    setCollapsed(Object.fromEntries(groupsRef.current.map((g) => [g.prefix, false])));
  }, [expandAllGen]);
  useEffect(() => {
    if (collapseAllGen === 0) return;
    setCollapsed(Object.fromEntries(groupsRef.current.map((g) => [g.prefix, true])));
  }, [collapseAllGen]);
  return (
    <div className="py-2">
      {topLevel.map((b) => <BranchRow key={b.name} branch={b} refresh={refresh} worktrees={worktrees} />)}
      {groups.map((group) => (
        <div key={group.prefix}>
          <GroupHeader prefix={group.prefix} count={group.branches.length}
            isCollapsed={collapsed[group.prefix] ?? true}
            onToggle={() => setCollapsed((p) => ({ ...p, [group.prefix]: !p[group.prefix] }))} />
          {!collapsed[group.prefix] && group.branches.map((b) => (
            <BranchRow key={b.name} branch={b} indented refresh={refresh} worktrees={worktrees} />
          ))}
        </div>
      ))}
    </div>
  );
};

// ── GroupHeader ────────────────────────────────────

const GroupHeader = ({ prefix, count, isCollapsed, onToggle }: { prefix: string; count: number; isCollapsed: boolean; onToggle: () => void; }): React.JSX.Element => (
  <div role="button" tabIndex={0} onClick={onToggle}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
    className="flex cursor-pointer items-center gap-2.5 px-5 py-1.5 font-mono text-[12px] transition-colors hover:bg-bg-hover">
    <span className="flex h-[7px] w-[7px] shrink-0 items-center justify-center text-[9px] leading-none text-text-tertiary">{isCollapsed ? '›' : '‹'}</span>
    <span className="flex-1 font-medium text-text-secondary">{prefix}</span>
    <span className="rounded-[3px] border border-border-strong px-1.5 py-px text-[10px] font-medium text-text-tertiary">{count}</span>
  </div>
);

// ── BranchRow ──────────────────────────────────────

const BranchRow = ({
  branch, indented = false, refresh, worktrees,
}: { branch: Branch; indented?: boolean; refresh: () => Promise<void>; worktrees: Worktree[]; }): React.JSX.Element => {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  const [activeOp, setActiveOp] = useState<BranchOp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmForce, setConfirmForce] = useState(false);

  // Rename state
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const renameRef = useRef<HTMLInputElement>(null);

  // Overflow menu
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const showError = useCallback((msg: string) => { setError(msg); setTimeout(() => setError(null), 5000); }, []);
  const showSuccess = useCallback((msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 2500); }, []);

  const run = useCallback(async (op: BranchOp, fn: () => Promise<void>) => {
    if (!activeProjectId) return;
    setActiveOp(op);
    try { await fn(); await refresh(); }
    catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showError(msg);
      useToastStore.getState().addToast(`${op}: ${msg}`, 'error');
    }
    finally { setActiveOp(null); }
  }, [activeProjectId, refresh, showError]);

  const handleCheckout = useCallback(() => void run('checkout', async () => {
    await window.nexusAPI!.git.checkout(activeProjectId!, branch.name);
  }), [run, activeProjectId, branch.name]);

  const handlePush = useCallback(async () => {
    if (!activeProjectId) return;
    setActiveOp('push');
    setConfirmForce(false);
    setError(null);
    try {
      const noUpstream = branch.upstream === undefined;
      await window.nexusAPI!.git.push(activeProjectId, branch.name, false, noUpstream);
      await refresh();
      showSuccess(noUpstream ? 'pushed & tracking set' : 'pushed');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isPushRejectedNeedingForce(msg)) {
        setConfirmForce(true); // show inline confirmation instead of error
      } else {
        showError(msg);
        useToastStore.getState().addToast(`push: ${msg}`, 'error');
      }
    } finally { setActiveOp(null); }
  }, [activeProjectId, branch.name, branch.upstream, refresh, showSuccess, showError]);

  const handleForcePush = useCallback(() => void run('force', async () => {
    setConfirmForce(false);
    await window.nexusAPI!.git.push(activeProjectId!, branch.name, true, false);
    showSuccess('force pushed');
  }), [run, activeProjectId, branch.name, showSuccess]);

  const handlePull = useCallback(() => void run('pull', async () => {
    await window.nexusAPI!.git.pull(activeProjectId!);
    showSuccess('pulled');
  }), [run, activeProjectId, showSuccess]);

  const handleWorktree = useCallback(() => void run('worktree', async () => {
    await window.nexusAPI!.git.createWorktree(activeProjectId!, branch.name);
    showSuccess('worktree created');
  }), [run, activeProjectId, branch.name, showSuccess]);

  const handleTrack = useCallback(() => void run('track', async () => {
    await window.nexusAPI!.git.setUpstream(activeProjectId!, branch.name, `origin/${branch.name}`);
    showSuccess('tracking origin/' + branch.name);
  }), [run, activeProjectId, branch.name, showSuccess]);

  const handleUntrack = useCallback(() => void run('untrack', async () => {
    await window.nexusAPI!.git.unsetUpstream(activeProjectId!, branch.name);
    showSuccess('upstream removed');
  }), [run, activeProjectId, branch.name, showSuccess]);

  const startRename = useCallback(() => {
    setRenameValue(branch.name);
    setRenaming(true);
    setTimeout(() => renameRef.current?.focus(), 30);
  }, [branch.name]);

  const confirmRename = useCallback(async () => {
    const newName = renameValue.trim();
    if (!newName || newName === branch.name || !activeProjectId) { setRenaming(false); return; }
    setRenaming(false);
    setActiveOp('rename');
    try {
      await window.nexusAPI!.git.renameBranch(activeProjectId, branch.name, newName);
      await refresh();
      showSuccess(`renamed → ${newName}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Rename failed';
      showError(msg);
      useToastStore.getState().addToast(`rename: ${msg}`, 'error');
    } finally { setActiveOp(null); }
  }, [renameValue, branch.name, activeProjectId, refresh, showSuccess, showError]);

  const openMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = menuBtnRef.current?.getBoundingClientRect() ?? null;
    setMenuAnchor(rect);
    setMenuOpen(true);
  }, []);

  const hasWorktree = worktrees.some(
    (wt) => !wt.isMainWorktree && (wt.branch === branch.name || wt.branch === 'refs/heads/' + branch.name),
  );

  const indicatorStyle =
    branch.isHead ? 'bg-phase-plan shadow-[0_0_8px_var(--phase-plan-dim)]' :
    branch.name === 'main' || branch.name === 'develop' ? 'bg-[var(--color-clean)]' :
    'bg-text-ghost';

  const slashIndex = branch.name.indexOf('/');
  const displayName = indented && slashIndex !== -1 ? branch.name.slice(slashIndex + 1) : branch.name;

  const menuItems: MenuItem[] = [
    { label: 'rename', onClick: startRename },
    ...(branch.upstream === undefined
      ? [{ label: 'track origin/' + branch.name, onClick: handleTrack }]
      : [{ label: 'untrack upstream', onClick: handleUntrack, danger: true }]),
    { label: 'create worktree', onClick: handleWorktree },
    { label: 'view diff', onClick: () => setActiveTab('diffs') },
  ];

  return (
    <div
      className={`group flex cursor-default flex-col py-1.5 font-mono text-[12px] transition-colors ${
        indented ? 'pl-[36px] pr-5' : 'px-5'
      } ${branch.isHead ? 'bg-bg-surface' : 'hover:bg-bg-hover'}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className={`h-[7px] w-[7px] shrink-0 rounded-full ${indicatorStyle}`} />

        {/* Branch name / rename input */}
        {renaming ? (
          <input
            ref={renameRef} type="text" value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void confirmRename(); if (e.key === 'Escape') setRenaming(false); }}
            onBlur={() => void confirmRename()}
            className="flex-1 min-w-0 rounded-[var(--radius-sm)] border border-phase-plan bg-bg-surface px-1.5 py-0.5 font-mono text-[12px] text-text-primary outline-none"
          />
        ) : (
          <span className={`flex-1 min-w-0 truncate text-text-primary ${branch.isHead ? 'font-medium' : 'font-normal'}`}>
            {displayName}
          </span>
        )}

        {!renaming && (
          <>
            {/* Badges */}
            {branch.isHead && (
              <span className="shrink-0 rounded-[3px] border border-[var(--phase-plan-dim)] bg-[var(--phase-plan-glow)] px-1.5 py-px text-[10px] font-semibold tracking-[1px] text-phase-plan">HEAD</span>
            )}
            {hasWorktree && !branch.isHead && (
              <span className="shrink-0 rounded-[2px] px-[5px] py-px font-mono text-[9px] font-semibold"
                style={{ color: 'var(--phase-execute)', background: 'var(--phase-execute-glow)', border: '1px solid var(--phase-execute-dim)' }}>
                ⊞ wt
              </span>
            )}

            {/* Upstream & ahead/behind */}
            <div className="flex shrink-0 items-center gap-1.5 text-[10px]">
              {branch.upstream !== undefined ? (
                <span className="max-w-[70px] truncate font-mono text-[9px] text-text-ghost" title={branch.upstream}>
                  {branch.upstream}
                </span>
              ) : (
                <span className="font-mono text-[9px] italic text-text-ghost">no upstream</span>
              )}
              <span className={branch.ahead > 0 ? 'text-[var(--color-added)]' : 'text-text-ghost'}>&uarr;{branch.ahead}</span>
              <span className={branch.behind > 0 ? 'text-[var(--color-deleted)]' : 'text-text-ghost'}>&darr;{branch.behind}</span>
            </div>

            {/* Primary actions + overflow menu (hover) */}
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              {!branch.isHead && (
                <PrimaryBtn label={activeOp === 'checkout' ? '…' : 'checkout'} onClick={handleCheckout} disabled={activeOp !== null} />
              )}
              <PrimaryBtn label={activeOp === 'push' ? '…' : 'push'} onClick={() => void handlePush()} disabled={activeOp !== null} />
              {branch.upstream !== undefined && (
                <PrimaryBtn label={activeOp === 'pull' ? '…' : 'pull'} onClick={handlePull} disabled={activeOp !== null} />
              )}
              {/* Overflow menu button */}
              <button
                ref={menuBtnRef}
                onClick={openMenu}
                className="cursor-pointer rounded-[var(--radius-sm)] border border-border-strong px-1.5 py-1 font-mono text-[11px] text-text-secondary transition-all hover:bg-bg-active hover:text-text-primary"
              >
                ···
              </button>
            </div>
          </>
        )}

        {/* Rename confirm/cancel */}
        {renaming && (
          <div className="flex shrink-0 gap-1">
            <button onClick={() => void confirmRename()} className="cursor-pointer rounded-[var(--radius-sm)] bg-phase-plan px-2 py-1 font-mono text-[10px] text-bg-void">✓</button>
            <button onClick={() => setRenaming(false)} className="cursor-pointer rounded-[var(--radius-sm)] border border-border-strong px-2 py-1 font-mono text-[10px] text-text-tertiary hover:text-text-secondary">✕</button>
          </div>
        )}
      </div>

      {/* Force push confirmation */}
      {confirmForce && (
        <ForcePushConfirm
          onConfirm={() => void handleForcePush()}
          onCancel={() => setConfirmForce(false)}
          busy={activeOp === 'force'}
        />
      )}

      {/* Feedback */}
      {error !== null && <span className="mt-0.5 pl-[19px] text-[10px] text-[var(--color-deleted)]">{error}</span>}
      {successMsg !== null && <span className="mt-0.5 pl-[19px] text-[10px] text-[var(--color-added)]">{successMsg}</span>}

      {/* Dropdown portal */}
      {menuOpen && menuAnchor !== null && (
        <DropdownMenu anchorRect={menuAnchor} items={menuItems} onClose={() => setMenuOpen(false)} />
      )}
    </div>
  );
};

// ── Shared button primitives ───────────────────────

const PrimaryBtn = ({
  label, onClick, disabled,
}: { label: string; onClick: () => void; disabled: boolean; }): React.JSX.Element => (
  <button
    onClick={(e) => { e.stopPropagation(); if (!disabled) onClick(); }}
    disabled={disabled}
    className="cursor-pointer rounded-[var(--radius-sm)] border border-border-strong px-1.5 py-1 font-mono text-[11px] text-text-secondary transition-all duration-[var(--duration-fast)] hover:bg-bg-active hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
  >
    {label}
  </button>
);
