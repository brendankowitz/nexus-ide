import { useMemo } from 'react';
import {
  useProjectStore,
  selectActiveProject,
  selectActiveBranches,
  selectActiveWorktrees,
  selectActiveStatus,
} from '@/stores/projectStore';
import { useUIStore, type ReviewTab } from '@/stores/uiStore';
import { useToastStore } from '@/stores/toastStore';
import { MCDropdown, type MCDropdownOption } from '@/components/git/MCDropdown';

// ── Inline icons (kept local to avoid coupling) ───────────────────────────────

const FolderIcon = (): React.JSX.Element => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ color: 'var(--v2-text-faint)' }}
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const BranchIcon = (): React.JSX.Element => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ color: 'var(--v2-text-faint)' }}
  >
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);

const DiffIcon = (): React.JSX.Element => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ color: 'currentColor' }}
  >
    <path d="M21 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-3" />
    <polyline points="16 12 21 12 21 8" />
    <polyline points="16 16 21 16 21 12" />
    <line x1="8" y1="8" x2="13" y2="8" />
    <line x1="8" y1="12" x2="13" y2="12" />
    <line x1="8" y1="16" x2="13" y2="16" />
  </svg>
);

interface MCReviewContextBarProps {
  changedFileCount: number;
  commitCount: number;
}

/** Shorten the prefix on branch refs for display. */
function stripBranchRef(ref: string): string {
  return ref.replace(/^refs\/heads\//, '');
}

/** Get a stable, short worktree label from a worktree path. */
function worktreeLabel(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] ?? path;
}

export const MCReviewContextBar = ({
  changedFileCount,
  commitCount,
}: MCReviewContextBarProps): React.JSX.Element => {
  const activeProject = useProjectStore(selectActiveProject);
  const branches = useProjectStore(selectActiveBranches);
  const worktrees = useProjectStore(selectActiveWorktrees);
  const gitStatus = useProjectStore(selectActiveStatus);
  const activeWorktreePath = useProjectStore((s) => s.activeWorktreePath);
  const setActiveWorktreePath = useProjectStore((s) => s.setActiveWorktreePath);

  const reviewTab = useUIStore((s) => s.reviewTab);
  const setReviewTab = useUIStore((s) => s.setReviewTab);
  const addToast = useToastStore((s) => s.addToast);

  // Determine the currently checked-out branch (from git status, fallback to HEAD branch).
  const currentBranchName = useMemo(() => {
    if (gitStatus !== null) return stripBranchRef(gitStatus.branch);
    const head = branches.find((b) => b.isHead);
    if (head !== undefined) return stripBranchRef(head.name);
    return branches[0]?.name !== undefined ? stripBranchRef(branches[0].name) : '—';
  }, [branches, gitStatus]);

  // Currently active worktree (defaults to the main project root if not selected).
  const activeWorktree = useMemo(() => {
    if (activeWorktreePath !== null) {
      const wt = worktrees.find((w) => w.path === activeWorktreePath);
      if (wt !== undefined) return wt;
    }
    return worktrees.find((w) => w.isMainWorktree) ?? worktrees[0] ?? null;
  }, [worktrees, activeWorktreePath]);

  const activeWorktreeKey =
    activeWorktreePath !== null ? activeWorktreePath : (activeWorktree?.path ?? '');
  const activeWorktreeDisplayPath = activeWorktree?.path ?? activeProject?.path ?? '';

  // ── Branch dropdown options ─────────────────────
  const branchOptions: MCDropdownOption[] = useMemo(
    () =>
      branches.map((b) => {
        const name = stripBranchRef(b.name);
        const ahead = b.ahead;
        const behind = b.behind;
        return {
          value: name,
          label: name,
          right: (
            <span
              style={{
                color: 'var(--v2-text-faint)',
                fontFamily:
                  'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                fontSize: 10.5,
                display: 'inline-flex',
                gap: 6,
                alignItems: 'center',
              }}
            >
              {ahead > 0 && (
                <span style={{ color: 'var(--v2-green)' }}>↑{ahead}</span>
              )}
              {behind > 0 && (
                <span style={{ color: 'var(--v2-amber)' }}>↓{behind}</span>
              )}
              {b.isHead && (
                <span style={{ color: 'var(--v2-yellow)' }}>●</span>
              )}
            </span>
          ),
        };
      }),
    [branches],
  );

  // ── Worktree dropdown options ───────────────────
  const worktreeOptions: MCDropdownOption[] = useMemo(
    () =>
      worktrees.map((w) => {
        const label = worktreeLabel(w.path);
        return {
          value: w.path,
          label,
          sub: w.path,
          right: (
            <span
              style={{
                color: 'var(--v2-text-faint)',
                fontFamily:
                  'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                fontSize: 10.5,
                display: 'inline-flex',
                gap: 6,
                alignItems: 'center',
              }}
            >
              <span style={{ color: 'var(--v2-blue)' }}>
                {stripBranchRef(w.branch)}
              </span>
              {w.isDirty && (
                <span style={{ color: 'var(--v2-yellow)' }}>●</span>
              )}
            </span>
          ),
        };
      }),
    [worktrees],
  );

  const handleBranchChange = async (branchName: string): Promise<void> => {
    if (activeProject === null) return;
    if (window.nexusAPI?.git === undefined) return;
    try {
      await window.nexusAPI.git.checkout(activeProject.id, branchName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[MCReviewContextBar] checkout failed:', err);
      addToast(`Checkout failed: ${msg}`, 'error');
    }
  };

  const handleWorktreeChange = (worktreePath: string): void => {
    const wt = worktrees.find((w) => w.path === worktreePath);
    if (wt !== undefined && wt.isMainWorktree) {
      setActiveWorktreePath(null);
    } else {
      setActiveWorktreePath(worktreePath);
    }
  };

  return (
    <div
      style={{
        borderBottom: '1px solid var(--v2-border)',
        background: 'var(--v2-bg1)',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
      }}
    >
      {/* Repo pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          background: 'var(--v2-bg2)',
          border: '1px solid var(--v2-border)',
          borderRadius: 6,
          color: 'var(--v2-text)',
          fontSize: 12,
        }}
      >
        <FolderIcon />
        <span
          style={{
            color: 'var(--v2-text-faint)',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
        >
          Repo
        </span>
        <span style={{ fontWeight: 500 }}>{activeProject?.name ?? '—'}</span>
      </div>

      <MCDropdown
        icon={<BranchIcon />}
        label="Branch"
        value={currentBranchName}
        options={branchOptions}
        onChange={(v) => {
          void handleBranchChange(v);
        }}
      />

      <MCDropdown
        icon={
          <span
            style={{
              fontFamily:
                'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
              fontSize: 10.5,
              color: 'var(--v2-text-faint)',
            }}
          >
            wt
          </span>
        }
        label="Worktree"
        value={
          activeWorktree !== null
            ? worktreeLabel(activeWorktree.path)
            : '—'
        }
        options={worktreeOptions}
        onChange={handleWorktreeChange}
      />

      <span
        style={{
          color: 'var(--v2-text-faint)',
          fontSize: 10.5,
          fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 360,
        }}
        title={activeWorktreeKey}
      >
        {activeWorktreeDisplayPath}
      </span>

      <div style={{ flex: 1 }} />

      <div
        style={{
          display: 'flex',
          gap: 2,
          background: 'var(--v2-bg2)',
          border: '1px solid var(--v2-border)',
          borderRadius: 6,
          padding: 2,
        }}
      >
        {(
          [
            { id: 'changes', label: 'Working changes', icon: <DiffIcon />, badge: changedFileCount },
            { id: 'history', label: 'History', icon: <BranchIcon />, badge: commitCount },
          ] as Array<{
            id: ReviewTab;
            label: string;
            icon: React.JSX.Element;
            badge: number;
          }>
        ).map((t) => {
          const on = reviewTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setReviewTab(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 12,
                borderRadius: 4,
                background: on ? 'var(--v2-bg3)' : 'transparent',
                color: on ? 'var(--v2-text)' : 'var(--v2-text-dim)',
              }}
            >
              {t.icon} {t.label}
              <span
                style={{
                  color: 'var(--v2-text-faint)',
                  fontSize: 10.5,
                  fontFamily:
                    'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                }}
              >
                {t.badge}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
