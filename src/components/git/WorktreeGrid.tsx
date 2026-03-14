import { useState, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { useUIStore } from '@/stores/uiStore';
import { useGit } from '@/hooks/useGit';
import type { Worktree, TerminalSession } from '@/types';

// ── Empty State ──────────────────────────────────

const WorktreeEmptyState = (): React.JSX.Element => (
  <div className="flex h-full flex-col items-center justify-center gap-4 px-8">
    <div className="relative">
      <div
        className="absolute inset-0 rounded-2xl opacity-30 blur-2xl"
        style={{ background: 'var(--phase-execute)' }}
      />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-border-default bg-bg-surface">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      </div>
    </div>
    <div className="text-center">
      <p className="font-mono text-[13px] font-medium text-text-primary">No worktrees</p>
      <p className="mt-1 text-[11px] text-text-tertiary">Create a worktree to work on multiple branches simultaneously</p>
    </div>
  </div>
);

// ── Loading State ────────────────────────────────

const WorktreeLoading = (): React.JSX.Element => (
  <div className="flex h-full items-center justify-center">
    <div className="flex items-center gap-2.5">
      <div className="h-3 w-3 animate-spin rounded-full border border-text-ghost border-t-phase-execute" />
      <span className="font-mono text-[11px] text-text-tertiary">Loading worktrees...</span>
    </div>
  </div>
);

// ── WorktreeGrid ───────────────────────────────────

export const WorktreeGrid = (): React.JSX.Element => {
  const worktrees = useProjectStore((s) =>
    s.activeProjectId !== null ? (s.worktrees[s.activeProjectId] ?? undefined) : undefined,
  );
  const { loading, refresh } = useGit();
  const [showAddForm, setShowAddForm] = useState(false);

  // Loading: no data yet and actively loading
  if (worktrees === undefined && loading) {
    return <WorktreeLoading />;
  }

  // Empty: data loaded but no worktrees -- still show add card
  if (worktrees === undefined || worktrees.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-1">
          <WorktreeEmptyState />
        </div>
        <div className="p-4 px-5">
          {showAddForm ? (
            <AddWorktreeForm onClose={() => { setShowAddForm(false); }} refresh={refresh} />
          ) : (
            <AddWorktreeCard onClick={() => { setShowAddForm(true); }} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3 p-4 px-5">
      {worktrees.map((wt) => (
        <WorktreeCard key={wt.path} worktree={wt} refresh={refresh} />
      ))}
      {showAddForm ? (
        <AddWorktreeForm onClose={() => { setShowAddForm(false); }} refresh={refresh} />
      ) : (
        <AddWorktreeCard onClick={() => { setShowAddForm(true); }} />
      )}
    </div>
  );
};

// ── WorktreeCard ───────────────────────────────────

interface WorktreeCardProps {
  worktree: Worktree;
  refresh: () => Promise<void>;
}

const WorktreeCard = ({ worktree, refresh }: WorktreeCardProps): React.JSX.Element => {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const addSession = useTerminalStore((s) => s.addSession);
  const setActiveSession = useTerminalStore((s) => s.setActiveSession);
  const toggleAgentPanel = useUIStore((s) => s.toggleAgentPanel);
  const agentPanelExpanded = useUIStore((s) => s.agentPanelExpanded);

  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const showError = useCallback((msg: string): void => {
    setError(msg);
    setTimeout(() => { setError(null); }, 3000);
  }, []);

  const expandAgentPanel = useCallback((): void => {
    if (!agentPanelExpanded) {
      toggleAgentPanel();
    }
  }, [agentPanelExpanded, toggleAgentPanel]);

  const buildSession = useCallback((sessionId: string, label: string): TerminalSession => ({
    id: sessionId,
    projectId: activeProjectId ?? '',
    projectName: worktree.branch,
    agentType: 'shell',
    label,
    status: 'running',
    worktreePath: worktree.path,
    branch: worktree.branch,
    startedAt: new Date().toISOString(),
  }), [activeProjectId, worktree.branch, worktree.path]);

  const handleTerminal = useCallback(async (): Promise<void> => {
    if (activeProjectId === null) return;
    if (!window.nexusAPI?.terminal) return;
    try {
      const label = `Shell - ${worktree.branch}`;
      const sessionId = await window.nexusAPI.terminal.create({
        projectId: activeProjectId,
        worktreePath: worktree.path,
        label,
      });
      addSession(buildSession(sessionId, label));
      setActiveSession(sessionId);
      expandAgentPanel();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to open terminal');
    }
  }, [activeProjectId, worktree, addSession, setActiveSession, expandAgentPanel, buildSession, showError]);

  const handleAgent = useCallback(async (): Promise<void> => {
    if (activeProjectId === null) return;
    if (!window.nexusAPI?.terminal) return;
    try {
      const label = `Claude Code - ${worktree.branch}`;
      const sessionId = await window.nexusAPI.terminal.create({
        projectId: activeProjectId,
        worktreePath: worktree.path,
        command: 'claude',
        label,
      });
      addSession({ ...buildSession(sessionId, label), agentType: 'claude' });
      setActiveSession(sessionId);
      expandAgentPanel();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to open agent');
    }
  }, [activeProjectId, worktree, addSession, setActiveSession, expandAgentPanel, buildSession, showError]);

  const handleEditor = useCallback(async (): Promise<void> => {
    if (activeProjectId === null) return;
    if (!window.nexusAPI?.terminal) return;
    try {
      // Uses 'code' as default editor; configurable in Settings > General > Editor
      const label = `Editor - ${worktree.branch}`;
      const sessionId = await window.nexusAPI.terminal.create({
        projectId: activeProjectId,
        worktreePath: worktree.path,
        command: 'code',
        args: [worktree.path],
        label,
      });
      addSession(buildSession(sessionId, label));
      setActiveSession(sessionId);
      expandAgentPanel();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to open editor');
    }
  }, [activeProjectId, worktree, addSession, setActiveSession, expandAgentPanel, buildSession, showError]);

  const handleDelete = useCallback(async (): Promise<void> => {
    if (activeProjectId === null) return;
    if (!window.nexusAPI?.git) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => { setConfirmDelete(false); }, 4000);
      return;
    }
    try {
      await window.nexusAPI.git.removeWorktree(activeProjectId, worktree.path);
      await refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to remove worktree');
    } finally {
      setConfirmDelete(false);
    }
  }, [activeProjectId, worktree.path, confirmDelete, refresh, showError]);

  return (
    <div className="flex cursor-default flex-col gap-2.5 rounded-[var(--radius-lg)] border border-border-default bg-bg-surface p-3.5 px-4 transition-all duration-[150ms] ease-[var(--ease-out)] hover:-translate-y-px hover:border-border-strong hover:bg-bg-overlay hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[12px] font-medium text-text-primary">
            {worktree.branch}
          </div>
          <div className="mt-0.5 truncate font-mono text-[10px] text-text-tertiary">
            {worktree.path}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className={`mt-[3px] h-2 w-2 shrink-0 rounded-full ${
              worktree.isDirty ? 'bg-[var(--color-modified)]' : 'bg-[var(--color-clean)]'
            }`}
          />
          {/* Delete button */}
          <button
            onClick={() => { void handleDelete(); }}
            title={confirmDelete ? 'Click again to confirm' : 'Remove worktree'}
            className={`rounded px-1 py-0.5 font-mono text-[10px] transition-all duration-[var(--duration-fast)] ${
              confirmDelete
                ? 'bg-[var(--color-deleted)] text-white'
                : 'text-text-ghost hover:text-[var(--color-deleted)]'
            }`}
          >
            {confirmDelete ? 'confirm?' : '\u00d7'}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5">
        <WtButton label="terminal" onClick={() => { void handleTerminal(); }} />
        <WtButton label="agent" primary onClick={() => { void handleAgent(); }} />
        <WtButton label="editor" onClick={() => { void handleEditor(); }} />
      </div>

      {/* Inline error */}
      {error !== null && (
        <span className="text-[10px] text-[var(--color-deleted)]">{error}</span>
      )}
    </div>
  );
};

// ── WtButton ───────────────────────────────────────

interface WtButtonProps {
  label: string;
  primary?: boolean;
  onClick: () => void;
}

const WtButton = ({
  label,
  primary = false,
  onClick,
}: WtButtonProps): React.JSX.Element => (
  <button
    onClick={onClick}
    className={`flex-1 cursor-pointer rounded-[var(--radius-sm)] border py-[5px] text-center font-mono text-[10px] font-medium transition-all duration-[var(--duration-fast)] ${
      primary
        ? 'border-[var(--phase-execute-dim)] bg-[var(--phase-execute-dim)] text-phase-execute hover:bg-phase-execute hover:text-[var(--bg-void)]'
        : 'border-border-default bg-bg-raised text-text-secondary hover:border-border-strong hover:bg-bg-active hover:text-text-primary'
    }`}
  >
    {label}
  </button>
);

// ── AddWorktreeCard ────────────────────────────────

const AddWorktreeCard = ({ onClick }: { onClick: () => void }): React.JSX.Element => (
  <div
    role="button"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[var(--radius-lg)] border border-dashed border-border-strong bg-transparent text-text-tertiary transition-all duration-[150ms] ease-[var(--ease-out)] hover:border-text-tertiary hover:bg-bg-surface hover:text-text-secondary"
  >
    <span className="text-[20px] font-light leading-none">+</span>
    <span className="font-mono text-[10px] tracking-[0.5px]">new worktree</span>
  </div>
);

// ── AddWorktreeForm ────────────────────────────────

interface AddWorktreeFormProps {
  onClose: () => void;
  refresh: () => Promise<void>;
}

const AddWorktreeForm = ({ onClose, refresh }: AddWorktreeFormProps): React.JSX.Element => {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const [branch, setBranch] = useState('');
  const [path, setPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (activeProjectId === null || branch.trim() === '') return;
    if (!window.nexusAPI?.git) return;
    setLoading(true);
    setError(null);
    try {
      await window.nexusAPI.git.createWorktree(
        activeProjectId,
        branch.trim(),
        path.trim() !== '' ? path.trim() : undefined,
      );
      await refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create worktree');
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, branch, path, refresh, onClose]);

  return (
    <div className="flex min-h-[120px] flex-col gap-2 rounded-[var(--radius-lg)] border border-border-strong bg-bg-surface p-3.5 px-4">
      <span className="font-mono text-[11px] font-medium text-text-secondary">new worktree</span>
      <form onSubmit={(e) => { void handleSubmit(e); }} className="flex flex-col gap-1.5">
        <input
          autoFocus
          placeholder="branch name"
          value={branch}
          onChange={(e) => { setBranch(e.target.value); }}
          className="rounded-[var(--radius-sm)] border border-border-strong bg-bg-raised px-2 py-1 font-mono text-[11px] text-text-primary placeholder:text-text-ghost focus:outline-none focus:ring-1 focus:ring-border-strong"
        />
        <input
          placeholder="path (optional)"
          value={path}
          onChange={(e) => { setPath(e.target.value); }}
          className="rounded-[var(--radius-sm)] border border-border-strong bg-bg-raised px-2 py-1 font-mono text-[11px] text-text-primary placeholder:text-text-ghost focus:outline-none focus:ring-1 focus:ring-border-strong"
        />
        {error !== null && (
          <span className="text-[10px] text-[var(--color-deleted)]">{error}</span>
        )}
        <div className="flex gap-1.5">
          <button
            type="submit"
            disabled={loading || branch.trim() === ''}
            className="flex-1 cursor-pointer rounded-[var(--radius-sm)] border border-border-strong bg-bg-active py-[5px] font-mono text-[10px] font-medium text-text-primary transition-all duration-[var(--duration-fast)] hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? '...' : 'create'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-[var(--radius-sm)] border border-border-strong bg-transparent px-3 py-[5px] font-mono text-[10px] text-text-secondary transition-all duration-[var(--duration-fast)] hover:bg-bg-hover"
          >
            cancel
          </button>
        </div>
      </form>
    </div>
  );
};
