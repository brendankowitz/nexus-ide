import { useState, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { useGit } from '@/hooks/useGit';
import { useToastStore } from '@/stores/toastStore';
import type { Branch } from '@/types';

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
  const branches = useProjectStore((s) =>
    s.activeProjectId !== null ? (s.branches[s.activeProjectId] ?? undefined) : undefined,
  );
  const { loading, refresh } = useGit();

  // Loading: no data yet and actively loading
  if (branches === undefined && loading) {
    return <BranchLoading />;
  }

  // Empty: data loaded but no branches
  if (branches === undefined || branches.length === 0) {
    return <BranchEmptyState />;
  }

  const { topLevel, groups } = groupBranches(branches);
  const headPrefix = findHeadPrefix(branches);

  return <BranchListInner topLevel={topLevel} groups={groups} headPrefix={headPrefix} refresh={refresh} />;
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

  const toggleGroup = (prefix: string): void => {
    setCollapsed((prev) => ({ ...prev, [prefix]: !prev[prefix] }));
  };

  return (
    <div className="py-2">
      {topLevel.map((branch) => (
        <BranchRow key={branch.name} branch={branch} refresh={refresh} />
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
              <BranchRow key={branch.name} branch={branch} indented refresh={refresh} />
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
}

const BranchRow = ({ branch, indented = false, refresh }: BranchRowProps): React.JSX.Element => {
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
