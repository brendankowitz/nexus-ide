import { useState, useCallback } from 'react';
import { useProjectStore, selectActiveWorktrees } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { useGit } from '@/hooks/useGit';
import { useToastStore } from '@/stores/toastStore';
import type { Branch, Worktree } from '@/types';

// ── Types ─────────────────────────────────────────

interface BranchGroup {
  prefix: string;
  branches: Branch[];
}

interface GroupedBranches {
  topLevel: Branch[];
  groups: BranchGroup[];
}

// ── Helpers ───────────────────────────────────────

function groupBranches(branches: Branch[]): GroupedBranches {
  const topLevel: Branch[] = [];
  const groupMap = new Map<string, Branch[]>();

  for (const branch of branches) {
    const slashIndex = branch.name.indexOf('/');
    if (slashIndex === -1) {
      topLevel.push(branch);
    } else {
      const prefix = branch.name.slice(0, slashIndex);
      const existing = groupMap.get(prefix);
      if (existing) {
        existing.push(branch);
      } else {
        groupMap.set(prefix, [branch]);
      }
    }
  }

  const groups: BranchGroup[] = Array.from(groupMap.entries()).map(
    ([prefix, groupBranchList]) => ({ prefix, branches: groupBranchList }),
  );

  return { topLevel, groups };
}

function findHeadPrefix(branches: Branch[]): string | null {
  for (const branch of branches) {
    if (branch.isHead) {
      const slashIndex = branch.name.indexOf('/');
      return slashIndex !== -1 ? branch.name.slice(0, slashIndex) : null;
    }
  }
  return null;
}

function initCollapsedState(groups: BranchGroup[], headPrefix: string | null): Record<string, boolean> {
  const state: Record<string, boolean> = {};
  for (const group of groups) {
    state[group.prefix] = group.prefix !== headPrefix;
  }
  return state;
}

// ── Empty State ──────────────────────────────────

const BranchEmptyState = (): React.JSX.Element => (
  <div className="flex h-full flex-col items-center justify-center gap-4 px-8">
    <div className="relative">
      <div
        className="absolute inset-0 rounded-2xl opacity-30 blur-2xl"
        style={{ background: 'var(--phase-plan)' }}
      />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-border-default bg-bg-surface">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
          <line x1="6" y1="3" x2="6" y2="15" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 9a9 9 0 0 1-9 9" />
        </svg>
      </div>
    </div>
    <div className="text-center">
      <p className="font-mono text-[13px] font-medium text-text-primary">No branches found</p>
      <p className="mt-1 text-[11px] text-text-tertiary">Branches will appear once git data is loaded</p>
    </div>
  </div>
);

// ── Loading State ────────────────────────────────

const BranchLoading = (): React.JSX.Element => (
  <div className="flex h-full items-center justify-center">
    <div className="flex items-center gap-2.5">
      <div className="h-3 w-3 animate-spin rounded-full border border-text-ghost border-t-phase-plan" />
      <span className="font-mono text-[11px] text-text-tertiary">Loading branches...</span>
    </div>
  </div>
);

// ── Components ────────────────────────────────────

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

  const handleCreate = useCallback(async (): Promise<void> => {
    const name = newBranchName.trim();
    if (!name || activeProjectId === null) return;
    if (!window.nexusAPI?.git) return;
    setCreating(true);
    setCreateError(null);
    try {
      await window.nexusAPI.git.createBranch(activeProjectId, name);
      await refresh();
      setNewBranchName('');
      setShowForm(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create branch';
      setCreateError(msg);
      useToastStore.getState().addToast(`Branch: ${msg}`, 'error');
    } finally {
      setCreating(false);
    }
  }, [activeProjectId, newBranchName, refresh]);

  // Loading: no data yet and actively loading
  if (branches === undefined && loading) {
    return <BranchLoading />;
  }

  // Empty: data loaded but no branches
  if (branches === undefined || branches.length === 0) {
    return <BranchEmptyState />;
  }

  const inWorktree = (b: Branch): boolean =>
    worktrees.some(
      (wt) => !wt.isMainWorktree && (wt.branch === b.name || wt.branch === 'refs/heads/' + b.name),
    );

  const visibleBranches = showWorktreeBranches ? branches : branches.filter((b) => !inWorktree(b));
  const hiddenCount = branches.length - visibleBranches.length;

  const { topLevel, groups } = groupBranches(visibleBranches);
  const headPrefix = findHeadPrefix(visibleBranches);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
        <span className="font-mono text-[11px] text-text-secondary">
          {visibleBranches.length} branch{visibleBranches.length !== 1 ? 'es' : ''}
        </span>
        <button
          onClick={() => { setShowForm((v) => !v); setCreateError(null); }}
          className="cursor-pointer rounded-[var(--radius-sm)] border border-phase-plan px-2 py-0.5 font-mono text-[10px] text-phase-plan transition-colors duration-[var(--duration-fast)] hover:bg-[var(--phase-plan-glow)]"
        >
          + new
        </button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="flex flex-col gap-1.5 border-b border-border-subtle bg-bg-raised px-4 py-2">
          <input
            type="text"
            value={newBranchName}
            onChange={(e) => { setNewBranchName(e.target.value); setCreateError(null); }}
            placeholder="branch name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate();
              if (e.key === 'Escape') { setShowForm(false); setNewBranchName(''); setCreateError(null); }
            }}
            className="w-full rounded-[var(--radius-sm)] border border-border-default bg-bg-surface px-2 py-1 font-mono text-[11px] text-text-primary outline-none focus:border-phase-plan"
          />
          {createError !== null && (
            <p className="font-mono text-[10px] text-[var(--color-danger)]">{createError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => void handleCreate()}
              disabled={creating || !newBranchName.trim()}
              className="flex-1 cursor-pointer rounded-[var(--radius-sm)] bg-phase-plan px-2 py-1 font-mono text-[10px] font-medium text-bg-void disabled:cursor-not-allowed disabled:opacity-40"
            >
              {creating ? 'creating…' : 'create'}
            </button>
            <button
              onClick={() => { setShowForm(false); setNewBranchName(''); setCreateError(null); }}
              className="cursor-pointer rounded-[var(--radius-sm)] border border-border-default px-2 py-1 font-mono text-[10px] text-text-tertiary transition-colors duration-[var(--duration-fast)] hover:text-text-secondary"
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {/* Branch list */}
      <div className="flex-1 overflow-y-auto">
        <BranchListInner topLevel={topLevel} groups={groups} headPrefix={headPrefix} refresh={refresh} />
        {hiddenCount > 0 && (
          <div className="border-t border-border-subtle px-5 py-2">
            <button
              onClick={() => { setShowWorktreeBranches((v) => !v); }}
              className="cursor-pointer font-mono text-[11px] text-text-tertiary transition-colors duration-[var(--duration-fast)] hover:text-text-secondary"
            >
              {showWorktreeBranches
                ? 'hide worktree branches'
                : `${hiddenCount} in worktrees — show`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Extracted inner to avoid re-computing collapsed state on every render
const BranchListInner = ({
  topLevel,
  groups,
  headPrefix,
  refresh,
}: {
  topLevel: Branch[];
  groups: BranchGroup[];
  headPrefix: string | null;
  refresh: () => Promise<void>;
}): React.JSX.Element => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    initCollapsedState(groups, headPrefix),
  );
  const worktrees = useProjectStore(selectActiveWorktrees);

  const toggleGroup = (prefix: string): void => {
    setCollapsed((prev) => ({ ...prev, [prefix]: !prev[prefix] }));
  };

  return (
    <div className="py-2">
      {topLevel.map((branch) => (
        <BranchRow key={branch.name} branch={branch} refresh={refresh} worktrees={worktrees} />
      ))}
      {groups.map((group) => (
        <div key={group.prefix}>
          <GroupHeader
            prefix={group.prefix}
            count={group.branches.length}
            isCollapsed={collapsed[group.prefix] ?? true}
            onToggle={() => { toggleGroup(group.prefix); }}
          />
          {!collapsed[group.prefix] &&
            group.branches.map((branch) => (
              <BranchRow key={branch.name} branch={branch} indented refresh={refresh} worktrees={worktrees} />
            ))}
        </div>
      ))}
    </div>
  );
};

// ── GroupHeader ───────────────────────────────────

interface GroupHeaderProps {
  prefix: string;
  count: number;
  isCollapsed: boolean;
  onToggle: () => void;
}

const GroupHeader = ({ prefix, count, isCollapsed, onToggle }: GroupHeaderProps): React.JSX.Element => (
  <div
    role="button"
    tabIndex={0}
    onClick={onToggle}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
    className="flex cursor-pointer items-center gap-2.5 px-5 py-1.5 font-mono text-[12px] transition-colors duration-[var(--duration-fast)] hover:bg-bg-hover"
  >
    {/* Chevron in place of indicator dot */}
    <span className="flex h-[7px] w-[7px] shrink-0 items-center justify-center text-[9px] leading-none text-text-tertiary">
      {isCollapsed ? '\u203A' : '\u2039'}
    </span>

    {/* Group name */}
    <span className="flex-1 font-medium text-text-secondary">{prefix}</span>

    {/* Branch count badge */}
    <span className="rounded-[3px] border border-border-strong px-1.5 py-px text-[10px] font-medium text-text-tertiary">
      {count}
    </span>
  </div>
);

// ── BranchRow ─────────────────────────────────────

interface BranchRowProps {
  branch: Branch;
  indented?: boolean;
  refresh: () => Promise<void>;
  worktrees: Worktree[];
}

const BranchRow = ({ branch, indented = false, refresh, worktrees }: BranchRowProps): React.JSX.Element => {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showError = useCallback((msg: string): void => {
    setError(msg);
    setTimeout(() => { setError(null); }, 3000);
  }, []);

  const showSuccess = useCallback((msg: string): void => {
    setSuccessMsg(msg);
    setTimeout(() => { setSuccessMsg(null); }, 3000);
  }, []);

  const handleCheckout = useCallback(async (): Promise<void> => {
    if (activeProjectId === null) return;
    if (!window.nexusAPI?.git) return;
    try {
      await window.nexusAPI.git.checkout(activeProjectId, branch.name);
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Checkout failed';
      showError(msg);
      useToastStore.getState().addToast(`Checkout: ${msg}`, 'error');
    }
  }, [activeProjectId, branch.name, refresh, showError]);

  const handleWorktree = useCallback(async (): Promise<void> => {
    if (activeProjectId === null) return;
    if (!window.nexusAPI?.git) return;
    try {
      await window.nexusAPI.git.createWorktree(activeProjectId, branch.name);
      await refresh();
      showSuccess('Worktree created');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create worktree';
      showError(msg);
      useToastStore.getState().addToast(`Worktree: ${msg}`, 'error');
    }
  }, [activeProjectId, branch.name, refresh, showError, showSuccess]);

  const handleDiff = useCallback((): void => {
    // Phase 5: branch comparison. For now, navigate to the diffs tab.
    setActiveTab('diffs');
  }, [setActiveTab]);

  const hasWorktree = worktrees.some(
    (wt) => !wt.isMainWorktree && (wt.branch === branch.name || wt.branch === 'refs/heads/' + branch.name),
  );

  const indicatorType = branch.isHead
    ? 'head'
    : branch.name === 'main' || branch.name === 'develop'
      ? 'main'
      : 'feature';

  const indicatorStyles: Record<string, string> = {
    head: 'bg-phase-plan shadow-[0_0_8px_var(--phase-plan-dim)]',
    main: 'bg-[var(--color-clean)]',
    feature: 'bg-text-ghost',
  };

  const slashIndex = branch.name.indexOf('/');
  const displayName = indented && slashIndex !== -1
    ? branch.name.slice(slashIndex + 1)
    : branch.name;

  return (
    <div
      className={`group flex cursor-pointer flex-col py-1.5 font-mono text-[12px] transition-colors duration-[var(--duration-fast)] ${
        indented ? 'pl-[36px] pr-5' : 'px-5'
      } ${branch.isHead ? 'bg-bg-surface' : 'hover:bg-bg-hover'}`}
    >
      <div className="flex items-center gap-2.5">
        {/* Indicator dot */}
        <div
          className={`h-[7px] w-[7px] shrink-0 rounded-full ${indicatorStyles[indicatorType]}`}
        />

        {/* Branch name */}
        <span
          className={`flex-1 text-text-primary ${branch.isHead ? 'font-medium' : 'font-normal'}`}
        >
          {displayName}
        </span>

        {/* HEAD badge */}
        {branch.isHead && (
          <span className="rounded-[3px] border border-[var(--phase-plan-dim)] bg-[var(--phase-plan-glow)] px-1.5 py-px text-[10px] font-semibold tracking-[1px] text-phase-plan">
            HEAD
          </span>
        )}

        {/* Worktree badge — shown when this branch has an active worktree checkout */}
        {hasWorktree && !branch.isHead && (
          <span
            className="shrink-0 rounded-[2px] px-[5px] py-px font-mono text-[9px] font-semibold"
            style={{
              color: 'var(--phase-execute)',
              background: 'var(--phase-execute-glow)',
              border: '1px solid var(--phase-execute-dim)',
            }}
            title="Active worktree checkout"
          >
            ⊞ wt
          </span>
        )}

        {/* Tracking indicators */}
        <div className="flex gap-1.5 text-[10px] text-text-tertiary">
          <span className={branch.ahead > 0 ? 'text-[var(--color-added)]' : ''}>
            &uarr;{branch.ahead}
          </span>
          <span className={branch.behind > 0 ? 'text-[var(--color-deleted)]' : ''}>
            &darr;{branch.behind}
          </span>
        </div>

        {/* Hover actions */}
        <div className="flex gap-1 opacity-0 transition-opacity duration-[var(--duration-fast)] group-hover:opacity-100">
          {!branch.isHead && (
            <BranchAction label="checkout" onClick={() => { void handleCheckout(); }} />
          )}
          <BranchAction label="worktree" onClick={() => { void handleWorktree(); }} />
          <BranchAction label="diff..." onClick={handleDiff} />
        </div>
      </div>

      {/* Inline feedback */}
      {error !== null && (
        <span className="mt-0.5 pl-[19px] text-[10px] text-[var(--color-deleted)]">{error}</span>
      )}
      {successMsg !== null && (
        <span className="mt-0.5 pl-[19px] text-[10px] text-[var(--color-added)]">{successMsg}</span>
      )}
    </div>
  );
};

// ── BranchAction ──────────────────────────────────

interface BranchActionProps {
  label: string;
  onClick: () => void;
}

const BranchAction = ({ label, onClick }: BranchActionProps): React.JSX.Element => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className="cursor-pointer rounded-[var(--radius-sm)] border border-border-strong bg-transparent px-2 py-0.5 font-mono text-[10px] text-text-secondary transition-all duration-[var(--duration-fast)] hover:bg-bg-active hover:text-text-primary"
  >
    {label}
  </button>
);
