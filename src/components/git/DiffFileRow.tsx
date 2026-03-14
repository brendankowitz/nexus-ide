import { useState, useCallback, useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { DiffHunk } from '@/components/git/DiffHunk';
import type { DiffFile, DiffHunk as DiffHunkType } from '@/types';

export interface DiffFileRowProps {
  file: DiffFile;
  activeProjectId: string | null;
  onRefresh: () => Promise<void>;
  onOpenFullDiff: (file: DiffFile, hunks: DiffHunkType[]) => void;
  /** 'default' = current style, 'table' = list details columns, 'compact' = tree mode minimal */
  layout?: 'default' | 'table' | 'compact';
}

const STATUS_STYLES: Record<string, string> = {
  M: 'bg-[var(--color-modified)] text-[var(--bg-void)]',
  A: 'bg-[var(--color-added)] text-[var(--bg-void)]',
  D: 'bg-[var(--color-deleted)] text-white',
  R: 'bg-[var(--color-info)] text-[var(--bg-void)]',
};

export const DiffFileRow = ({
  file,
  activeProjectId,
  onRefresh,
  onOpenFullDiff,
  layout = 'default',
}: DiffFileRowProps): React.JSX.Element => {
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
    window.nexusAPI.git
      .diffHunks(activeProjectId, file.filePath)
      .then(setHunks)
      .catch((err: unknown) =>
        console.error('[DiffFileRow] failed to load hunks:', err),
      )
      .finally(() => setLoadingHunks(false));
  }, [isExpanded, hunks.length, activeProjectId, file.filePath]);

  // Split path into directory and filename
  const lastSlash = file.filePath.lastIndexOf('/');
  const dir = lastSlash >= 0 ? file.filePath.slice(0, lastSlash + 1) : '';
  const filename =
    lastSlash >= 0 ? file.filePath.slice(lastSlash + 1) : file.filePath;

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

      if (hunks.length > 0) {
        onOpenFullDiff(file, hunks);
        return;
      }

      try {
        const loaded = await window.nexusAPI.git.diffHunks(
          activeProjectId,
          file.filePath,
        );
        setHunks(loaded);
        onOpenFullDiff(file, loaded);
      } catch (err) {
        console.error(
          '[DiffFileRow] failed to load hunks for full diff:',
          err,
        );
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
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] text-[10px] font-bold ${STATUS_STYLES[file.status] ?? ''}`}
        >
          {file.status}
        </span>

        {layout === 'table' ? (
          <>
            {/* Table layout: separate columns */}
            <span className="min-w-0 flex-1 truncate text-text-primary">
              {filename}
              {file.status === 'R' && file.oldPath !== undefined && (
                <span className="text-text-tertiary">
                  {' '}
                  &larr; {file.oldPath.split('/').pop()}
                </span>
              )}
            </span>
            <span className="w-[140px] shrink-0 truncate text-[11px] text-text-tertiary">
              {dir}
            </span>
            <span className="w-[60px] shrink-0 text-center">
              <span className="inline-block rounded-[3px] bg-bg-surface px-1.5 py-[1px] text-[9px] text-text-ghost">
                unstaged
              </span>
            </span>
            <div className="flex w-[60px] shrink-0 justify-end gap-1.5 text-[10px]">
              {file.additions > 0 && (
                <span className="text-[var(--color-added)]">
                  +{file.additions}
                </span>
              )}
              {file.deletions > 0 && (
                <span className="text-[var(--color-deleted)]">
                  -{file.deletions}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Default / compact layout */}
            <span className="flex-1 truncate text-text-primary">
              {layout === 'compact' ? (
                <>
                  {filename}
                  {file.status === 'R' && file.oldPath !== undefined && (
                    <span className="text-text-tertiary">
                      {' '}
                      &larr; {file.oldPath.split('/').pop()}
                    </span>
                  )}
                </>
              ) : (
                <>
                  {dir !== '' && (
                    <span className="text-text-tertiary">{dir}</span>
                  )}
                  {filename}
                  {file.status === 'R' && file.oldPath !== undefined && (
                    <span className="text-text-tertiary">
                      {' '}
                      &larr; {file.oldPath.split('/').pop()}
                    </span>
                  )}
                </>
              )}
            </span>

            {/* Stats */}
            <div className="flex shrink-0 gap-1.5 text-[10px]">
              {file.additions > 0 && (
                <span className="text-[var(--color-added)]">
                  +{file.additions}
                </span>
              )}
              {file.deletions > 0 && (
                <span className="text-[var(--color-deleted)]">
                  -{file.deletions}
                </span>
              )}
            </div>
          </>
        )}

        {/* Full diff panel button */}
        <button
          title="Open full diff"
          onClick={(e) => {
            void handleOpenFullDiff(e);
          }}
          className="ml-0.5 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-[3px] border border-border-default bg-transparent text-text-ghost transition-all duration-[var(--duration-fast)] hover:border-border-strong hover:text-text-primary"
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 9 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
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
              <span className="font-mono text-[10px] text-text-tertiary">
                Loading diff...
              </span>
            </div>
          )}
          {!loadingHunks && hunks.length === 0 && (
            <div className="px-5 py-3 font-mono text-[10px] text-text-ghost">
              No changes to display
            </div>
          )}
          {hunks.map((hunk) => (
            <DiffHunk key={hunk.header} hunk={hunk} />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Stage Toggle ─────────────────────────────────

interface StageToggleProps {
  filePath: string;
  onStage: (e: React.MouseEvent) => Promise<void>;
  onUnstage: (e: React.MouseEvent) => Promise<void>;
}

const StageToggle = ({
  filePath,
  onStage,
  onUnstage,
}: StageToggleProps): React.JSX.Element => {
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
        setStaged(wasStaged);
      }
    },
    [staged, onStage, onUnstage],
  );

  return (
    <button
      title={staged ? `Unstage ${filePath}` : `Stage ${filePath}`}
      onClick={(e) => {
        void handleClick(e);
      }}
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
