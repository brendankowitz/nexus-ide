import { useState, useCallback, useEffect, useRef } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { DiffHunk } from '@/components/git/DiffHunk';
import { FullDiffPanel } from '@/components/git/FullDiffPanel';
import type { DiffFile, DiffHunk as DiffHunkType } from '@/types';

// ── Empty State ──────────────────────────────────

const DiffCleanState = (): React.JSX.Element => (
  <div className="flex h-full flex-col items-center justify-center gap-4 px-8">
    <div className="relative">
      <div
        className="absolute inset-0 rounded-2xl opacity-30 blur-2xl"
        style={{ background: 'var(--phase-execute)' }}
      />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-border-default bg-bg-surface">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-clean)]">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    </div>
    <div className="text-center">
      <p className="font-mono text-[13px] font-medium text-text-primary">Working tree clean</p>
      <p className="mt-1 text-[11px] text-text-tertiary">No uncommitted changes</p>
    </div>
  </div>
);

// ── Loading State ────────────────────────────────

const DiffLoading = (): React.JSX.Element => (
  <div className="flex h-full items-center justify-center">
    <div className="flex items-center gap-2.5">
      <div className="h-3 w-3 animate-spin rounded-full border border-text-ghost border-t-phase-execute" />
      <span className="font-mono text-[11px] text-text-tertiary">Loading changes...</span>
    </div>
  </div>
);

export const DiffViewer = (): React.JSX.Element => {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  const [diffFiles, setDiffFiles] = useState<DiffFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [fullDiffEntry, setFullDiffEntry] = useState<{ file: DiffFile; hunks: DiffHunkType[] } | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [commitError, setCommitError] = useState<string | null>(null);
  const commitInputRef = useRef<HTMLInputElement>(null);

  const loadDiff = useCallback(async (): Promise<void> => {
    if (activeProjectId === null) return;
    if (!window.nexusAPI?.git) return;
    setLoading(true);
    try {
      const files = await window.nexusAPI.git.diff(activeProjectId);
      setDiffFiles(files);
    } catch (err) {
      console.error('[DiffViewer] failed to load diff:', err);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    void loadDiff();
  }, [loadDiff]);

  // Focus the commit input when the inline form appears
  useEffect(() => {
    if (isCommitting) {
      commitInputRef.current?.focus();
    }
  }, [isCommitting]);

  // Loading state on initial load
  if (loading && diffFiles.length === 0) {
    return <DiffLoading />;
  }

  // Clean working tree
  if (!loading && diffFiles.length === 0) {
    return <DiffCleanState />;
  }

  const totalFiles = diffFiles.length;
  const totalAdded = diffFiles.reduce((sum, f) => sum + f.additions, 0);
  const totalDeleted = diffFiles.reduce((sum, f) => sum + f.deletions, 0);

  const handleStageAll = async (): Promise<void> => {
    if (activeProjectId === null) return;
    if (!window.nexusAPI?.git) return;
    try {
      await window.nexusAPI.git.stageAll(activeProjectId);
      await loadDiff();
    } catch (err) {
      console.error('[DiffViewer] stage all failed:', err);
    }
  };

  const handleCommitOpen = (): void => {
    setCommitMessage('');
    setCommitError(null);
    setIsCommitting(true);
  };

  const handleCommitCancel = (): void => {
    setIsCommitting(false);
    setCommitMessage('');
    setCommitError(null);
  };

  const handleCommitSubmit = async (): Promise<void> => {
    if (activeProjectId === null) return;
    if (!window.nexusAPI?.git) return;
    const msg = commitMessage.trim();
    if (!msg) {
      setCommitError('Commit message is required');
      return;
    }
    try {
      setCommitError(null);
      await window.nexusAPI.git.commit(activeProjectId, msg);
      setIsCommitting(false);
      setCommitMessage('');
      await loadDiff();
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCommitKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      void handleCommitSubmit();
    } else if (e.key === 'Escape') {
      handleCommitCancel();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-border-subtle bg-bg-void">
        <div className="flex items-center gap-2 px-5 py-2">
          <div className="font-mono text-[10px] text-text-tertiary">
            {totalFiles} files &middot;{' '}
            <span className="text-[var(--color-added)]">+{totalAdded}</span>{' '}
            <span className="text-[var(--color-deleted)]">-{totalDeleted}</span>
          </div>
          <div className="ml-auto flex gap-1.5">
            <DiffButton label="stage all" onClick={handleStageAll} />
            {isCommitting ? (
              <DiffButton label="cancel" onClick={handleCommitCancel} />
            ) : (
              <DiffButton label="commit" primary onClick={handleCommitOpen} />
            )}
          </div>
        </div>

        {/* Inline commit form */}
        {isCommitting && (
          <div className="flex flex-col gap-1.5 border-t border-border-subtle px-5 py-2">
            <div className="flex items-center gap-2">
              <input
                ref={commitInputRef}
                type="text"
                value={commitMessage}
                onChange={(e) => { setCommitMessage(e.target.value); setCommitError(null); }}
                onKeyDown={handleCommitKeyDown}
                placeholder="commit message..."
                className="flex-1 rounded-[var(--radius-sm)] border border-border-default bg-bg-surface px-2.5 py-[5px] font-mono text-[11px] text-text-primary placeholder:text-text-ghost outline-none focus:border-border-strong transition-colors duration-[var(--duration-fast)]"
              />
              <DiffButton label="commit" primary onClick={handleCommitSubmit} />
            </div>
            {commitError !== null && (
              <p className="font-mono text-[10px] text-sem-danger">{commitError}</p>
            )}
          </div>
        )}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-auto">
        {diffFiles.map((file) => (
          <DiffFileRow
            key={file.filePath}
            file={file}
            activeProjectId={activeProjectId}
            onRefresh={loadDiff}
            onOpenFullDiff={(f, hunks) => setFullDiffEntry({ file: f, hunks })}
          />
        ))}
      </div>

      {/* Full-panel diff overlay */}
      {fullDiffEntry !== null && (
        <FullDiffPanel
          file={fullDiffEntry.file}
          hunks={fullDiffEntry.hunks}
          onClose={() => setFullDiffEntry(null)}
        />
      )}
    </div>
  );
};

interface DiffFileRowProps {
  file: DiffFile;
  activeProjectId: string | null;
  onRefresh: () => Promise<void>;
  onOpenFullDiff: (file: DiffFile, hunks: DiffHunkType[]) => void;
}

const DiffFileRow = ({ file, activeProjectId, onRefresh, onOpenFullDiff }: DiffFileRowProps): React.JSX.Element => {
  const expandedFiles = useUIStore((s) => s.expandedDiffFiles);
  const toggleDiffFile = useUIStore((s) => s.toggleDiffFile);
  const isExpanded = !!expandedFiles[file.filePath];

  const [hunks, setHunks] = useState<DiffHunkType[]>(file.hunks);
  const [loadingHunks, setLoadingHunks] = useState(false);

  // Load hunks on expand when not yet fetched
  useEffect(() => {
    if (!isExpanded) return;
    if (hunks.length > 0) return;
    if (!window.nexusAPI?.git || !activeProjectId) return;

    setLoadingHunks(true);
    window.nexusAPI.git.diffHunks(activeProjectId, file.filePath)
      .then(setHunks)
      .catch((err: unknown) => console.error('[DiffFileRow] failed to load hunks:', err))
      .finally(() => setLoadingHunks(false));
  }, [isExpanded, hunks.length, activeProjectId, file.filePath]);

  // Split path into directory and filename
  const lastSlash = file.filePath.lastIndexOf('/');
  const dir = lastSlash >= 0 ? file.filePath.slice(0, lastSlash + 1) : '';
  const filename = lastSlash >= 0 ? file.filePath.slice(lastSlash + 1) : file.filePath;

  const statusStyles: Record<string, string> = {
    M: 'bg-[var(--color-modified)] text-[var(--bg-void)]',
    A: 'bg-[var(--color-added)] text-[var(--bg-void)]',
    D: 'bg-[var(--color-deleted)] text-white',
    R: 'bg-[var(--color-info)] text-[var(--bg-void)]',
  };

  const handleStage = useCallback(
    async (e: React.MouseEvent): Promise<void> => {
      e.stopPropagation();
      if (activeProjectId === null) return;
      if (!window.nexusAPI?.git) return;
      try {
        await window.nexusAPI.git.stage(activeProjectId, file.filePath);
        await onRefresh();
      } catch (err) {
        console.error('[DiffFileRow] stage failed:', err);
      }
    },
    [activeProjectId, file.filePath, onRefresh],
  );

  const handleUnstage = useCallback(
    async (e: React.MouseEvent): Promise<void> => {
      e.stopPropagation();
      if (activeProjectId === null) return;
      if (!window.nexusAPI?.git) return;
      try {
        await window.nexusAPI.git.unstage(activeProjectId, file.filePath);
        await onRefresh();
      } catch (err) {
        console.error('[DiffFileRow] unstage failed:', err);
      }
    },
    [activeProjectId, file.filePath, onRefresh],
  );

  const handleOpenFullDiff = useCallback(
    async (e: React.MouseEvent): Promise<void> => {
      e.stopPropagation();
      if (!activeProjectId || !window.nexusAPI?.git) return;

      // Reuse already-loaded hunks or fetch if needed
      if (hunks.length > 0) {
        onOpenFullDiff(file, hunks);
        return;
      }

      try {
        const loaded = await window.nexusAPI.git.diffHunks(activeProjectId, file.filePath);
        setHunks(loaded);
        onOpenFullDiff(file, loaded);
      } catch (err) {
        console.error('[DiffFileRow] failed to load hunks for full diff:', err);
      }
    },
    [activeProjectId, file, hunks, onOpenFullDiff],
  );

  return (
    <div className="border-b border-border-subtle">
      {/* File row */}
      <div
        onClick={() => toggleDiffFile(file.filePath)}
        className="flex cursor-pointer items-center gap-2.5 px-5 py-[7px] font-mono text-[12px] transition-colors duration-[var(--duration-fast)] hover:bg-bg-hover"
      >
        {/* Expand icon */}
        <span
          className={`w-3 shrink-0 text-center text-[10px] text-text-ghost transition-transform duration-[var(--duration-fast)] ${
            isExpanded ? 'rotate-90' : ''
          }`}
        >
          &#9656;
        </span>

        {/* Status badge */}
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] text-[10px] font-bold ${statusStyles[file.status] ?? ''}`}
        >
          {file.status}
        </span>

        {/* File path */}
        <span className="flex-1 truncate text-text-primary">
          {dir !== '' && <span className="text-text-tertiary">{dir}</span>}
          {filename}
          {file.status === 'R' && file.oldPath !== undefined && (
            <span className="text-text-tertiary"> &larr; {file.oldPath.split('/').pop()}</span>
          )}
        </span>

        {/* Stats */}
        <div className="flex shrink-0 gap-1.5 text-[10px]">
          {file.additions > 0 && (
            <span className="text-[var(--color-added)]">+{file.additions}</span>
          )}
          {file.deletions > 0 && (
            <span className="text-[var(--color-deleted)]">-{file.deletions}</span>
          )}
        </div>

        {/* Full diff panel button */}
        <button
          title="Open full diff"
          onClick={(e) => { void handleOpenFullDiff(e); }}
          className="ml-0.5 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-[3px] border border-border-default bg-transparent text-text-ghost transition-all duration-[var(--duration-fast)] hover:border-border-strong hover:text-text-primary"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <rect x="0.5" y="0.5" width="8" height="8" rx="1" />
            <polyline points="5.5,0.5 8.5,0.5 8.5,3.5" />
            <line x1="4.5" y1="4.5" x2="8.5" y2="0.5" />
          </svg>
        </button>

        {/* Stage / Unstage toggle */}
        <StageToggle
          filePath={file.filePath}
          onStage={handleStage}
          onUnstage={handleUnstage}
        />
      </div>

      {/* Hunks */}
      {isExpanded && (
        <div className="border-t border-border-subtle bg-bg-void">
          {loadingHunks && (
            <div className="flex items-center gap-2 px-5 py-3">
              <div className="h-2.5 w-2.5 animate-spin rounded-full border border-text-ghost border-t-phase-plan" />
              <span className="font-mono text-[10px] text-text-tertiary">Loading diff...</span>
            </div>
          )}
          {!loadingHunks && hunks.length === 0 && (
            <div className="px-5 py-3 font-mono text-[10px] text-text-ghost">No changes to display</div>
          )}
          {hunks.map((hunk) => (
            <DiffHunk key={hunk.header} hunk={hunk} />
          ))}
        </div>
      )}
    </div>
  );
};

interface StageToggleProps {
  filePath: string;
  onStage: (e: React.MouseEvent) => Promise<void>;
  onUnstage: (e: React.MouseEvent) => Promise<void>;
}

const StageToggle = ({ filePath, onStage, onUnstage }: StageToggleProps): React.JSX.Element => {
  // Track optimistic staged state locally; the parent refresh will confirm it
  const [staged, setStaged] = useState(false);

  const handleClick = useCallback(
    async (e: React.MouseEvent): Promise<void> => {
      const wasStaged = staged;
      setStaged(!wasStaged);
      try {
        if (wasStaged) {
          await onUnstage(e);
        } else {
          await onStage(e);
        }
      } catch {
        // Revert optimistic update on failure
        setStaged(wasStaged);
      }
    },
    [staged, onStage, onUnstage],
  );

  return (
    <button
      title={staged ? `Unstage ${filePath}` : `Stage ${filePath}`}
      onClick={(e) => { void handleClick(e); }}
      className={`ml-1 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-[3px] border text-[9px] transition-all duration-[var(--duration-fast)] ${
        staged
          ? 'border-phase-execute bg-phase-execute text-bg-void hover:brightness-90'
          : 'border-border-default bg-transparent text-text-ghost hover:border-border-strong hover:text-text-secondary'
      }`}
    >
      {staged ? '\u2713' : '+'}
    </button>
  );
};

interface DiffButtonProps {
  label: string;
  primary?: boolean;
  onClick: (() => void) | (() => Promise<void>);
}

const DiffButton = ({
  label,
  primary = false,
  onClick,
}: DiffButtonProps): React.JSX.Element => (
  <button
    onClick={() => { void (onClick as () => Promise<void> | void)(); }}
    className={`cursor-pointer rounded-[var(--radius-sm)] border px-2.5 py-1 font-mono text-[10px] font-medium transition-all duration-[var(--duration-fast)] ${
      primary
        ? 'border-phase-execute bg-phase-execute font-semibold text-[var(--bg-void)] hover:brightness-110'
        : 'border-border-strong bg-transparent text-text-secondary hover:bg-bg-active hover:text-text-primary'
    }`}
  >
    {label}
  </button>
);
