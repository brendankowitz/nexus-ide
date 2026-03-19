import { useState } from 'react';
import { useProjectStore, selectActiveProject, selectActiveWorktrees } from '@/stores/projectStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { useUIStore } from '@/stores/uiStore';
import { useGit } from '@/hooks/useGit';
import { useToastStore } from '@/stores/toastStore';

export const WorktreeGrid = (): React.JSX.Element => {
  const activeProject = useProjectStore(selectActiveProject);
  const worktrees = useProjectStore(selectActiveWorktrees);
  const activeWorktreePath = useProjectStore((s) => s.activeWorktreePath);
  const setActiveWorktreePath = useProjectStore((s) => s.setActiveWorktreePath);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const sessions = useTerminalStore((s) => s.sessions);
  const { refresh } = useGit();

  const [showForm, setShowForm] = useState(false);
  const [branch, setBranch] = useState('');
  const [path, setPath] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!activeProject || !branch.trim()) return;
    setCreating(true);
    try {
      await window.nexusAPI.git.createWorktree(
        activeProject.id,
        branch.trim(),
        path.trim() || undefined,
      );
      await refresh();
      setBranch('');
      setPath('');
      setShowForm(false);
    } catch (err) {
      useToastStore.getState().addToast(
        `Create worktree failed: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    } finally {
      setCreating(false);
    }
  };

  const handleRemove = async (worktreePath: string) => {
    if (!activeProject) return;
    try {
      await window.nexusAPI.git.removeWorktree(activeProject.id, worktreePath);
      if (activeWorktreePath === worktreePath) {
        setActiveWorktreePath(null);
      }
      await refresh();
    } catch (err) {
      useToastStore.getState().addToast(
        `Remove worktree failed: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    }
  };

  if (!activeProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="font-mono text-[11px] text-text-ghost">No project selected</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
        <span className="font-mono text-[11px] text-text-secondary">
          {worktrees.length} worktree{worktrees.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setShowForm((prev) => !prev)}
          className="cursor-pointer rounded-[var(--radius-sm)] border border-phase-execute px-2 py-1 font-mono text-[11px] text-phase-execute transition-colors duration-[var(--duration-fast)] hover:bg-[var(--phase-execute-glow)]"
        >
          + new
        </button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="flex flex-col gap-1.5 border-b border-border-subtle bg-bg-raised px-4 py-2">
          <input
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="branch name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate();
              if (e.key === 'Escape') { setShowForm(false); setBranch(''); setPath(''); }
            }}
            className="w-full rounded-[var(--radius-sm)] border border-border-default bg-bg-surface px-2 py-1 font-mono text-[11px] text-text-primary outline-none focus:border-phase-execute"
          />
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="path (optional)"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate();
              if (e.key === 'Escape') { setShowForm(false); setBranch(''); setPath(''); }
            }}
            className="w-full rounded-[var(--radius-sm)] border border-border-default bg-bg-surface px-2 py-1 font-mono text-[11px] text-text-primary outline-none focus:border-phase-execute"
          />
          <div className="flex gap-2">
            <button
              onClick={() => void handleCreate()}
              disabled={creating || !branch.trim()}
              className="flex-1 cursor-pointer rounded-[var(--radius-sm)] bg-phase-execute px-2 py-1 font-mono text-[11px] font-medium text-bg-void disabled:cursor-not-allowed disabled:opacity-40"
            >
              {creating ? 'creating…' : 'create'}
            </button>
            <button
              onClick={() => { setShowForm(false); setBranch(''); setPath(''); }}
              className="cursor-pointer rounded-[var(--radius-sm)] border border-border-default px-2 py-1 font-mono text-[11px] text-text-tertiary transition-colors duration-[var(--duration-fast)] hover:text-text-secondary"
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {/* Workspace cards */}
      <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-1.5">
        {worktrees.length === 0 ? (
          <div className="flex h-24 items-center justify-center">
            <span className="font-mono text-[11px] text-text-ghost">no worktrees</span>
          </div>
        ) : (
          worktrees.map((wt) => {
            const isActive = wt.path === activeWorktreePath;
            // Running terminals in this worktree
            const normPath = wt.path.replace(/\\/g, '/');
            const runningHere = sessions.filter(
              (s) => s.worktreePath?.replace(/\\/g, '/') === normPath && s.status === 'running',
            );
            const totalHere = sessions.filter(
              (s) => s.worktreePath?.replace(/\\/g, '/') === normPath,
            );
            // Shorten path: last 2 segments
            const shortPath = wt.path.replace(/\\/g, '/').split('/').slice(-2).join('/');
            // Strip refs/heads/ prefix if present
            const branchDisplay = wt.branch.replace(/^refs\/heads\//, '');
            // Accent color: active=teal, dirty+inactive=amber, clean=subtle
            const accentColor = isActive
              ? 'var(--phase-execute)'
              : wt.isDirty
              ? 'var(--color-warning)'
              : 'var(--border-strong)';

            return (
              <div
                key={wt.path}
                onClick={() => { setActiveWorktreePath(wt.path); setActiveTab('diffs'); }}
                className="group relative cursor-pointer rounded-[var(--radius-md)] border transition-all duration-[var(--duration-fast)] overflow-hidden"
                style={{
                  borderColor: isActive ? 'var(--phase-execute)' : 'var(--border-default)',
                  background: isActive ? 'var(--bg-surface)' : 'var(--bg-raised)',
                  boxShadow: isActive
                    ? '0 0 0 1px var(--phase-execute-dim), inset 0 0 16px var(--phase-execute-glow)'
                    : undefined,
                }}
              >
                {/* Ambient glow fill for active */}
                {isActive && (
                  <div
                    className="pointer-events-none absolute inset-0 opacity-[0.04]"
                    style={{ background: 'var(--phase-execute)' }}
                  />
                )}

                {/* Left accent strip */}
                <div
                  className="absolute left-0 top-0 h-full w-[2.5px] transition-all duration-[var(--duration-fast)]"
                  style={{ background: accentColor }}
                />

                <div className="relative px-3 py-2.5 pl-4">
                  {/* Row 1: branch name + tags */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="flex-1 truncate font-mono text-[11px] font-medium"
                      style={{ color: isActive ? 'var(--phase-execute)' : 'var(--text-primary)' }}
                    >
                      {branchDisplay}
                    </span>

                    {/* Main badge */}
                    {wt.isMainWorktree && (
                      <span className="shrink-0 rounded-[2px] border border-border-strong px-[5px] py-px font-mono text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                        main
                      </span>
                    )}

                    {/* Dirty indicator */}
                    {wt.isDirty && (
                      <span
                        className="shrink-0 font-mono text-[9px] font-semibold"
                        style={{ color: 'var(--color-warning)' }}
                        title="Uncommitted changes"
                      >
                        △
                      </span>
                    )}

                    {/* Remove button — non-main only */}
                    {!wt.isMainWorktree && (
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleRemove(wt.path); }}
                        title="Remove worktree"
                        className="ml-1 shrink-0 cursor-pointer font-mono text-[13px] leading-none text-text-tertiary opacity-0 transition-all duration-[var(--duration-fast)] hover:text-[var(--color-danger)] group-hover:opacity-100"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Row 2: path + terminal count */}
                  <div className="mt-1 flex items-center gap-2">
                    <span className="flex-1 truncate font-mono text-[9px] text-text-ghost">
                      {shortPath}
                    </span>

                    {/* Terminal indicators */}
                    {totalHere.length > 0 && (
                      <div className="flex items-center gap-1 shrink-0">
                        {runningHere.length > 0 ? (
                          <span
                            className="flex items-center gap-0.5 font-mono text-[9px]"
                            style={{ color: 'var(--phase-execute)' }}
                          >
                            <span
                              className="inline-block h-[5px] w-[5px] rounded-full animate-pulse"
                              style={{ background: 'var(--phase-execute)' }}
                            />
                            {runningHere.length}
                          </span>
                        ) : (
                          <span className="font-mono text-[9px] text-text-ghost">
                            {totalHere.length} term
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
