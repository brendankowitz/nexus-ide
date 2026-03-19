import { useEffect, useState, useCallback } from 'react';
import { DiffHunk } from '@/components/git/DiffHunk';
import type { Commit, DiffFile, DiffHunk as DiffHunkType } from '@/types';

interface CommitDetailPanelProps {
  commit: Commit;
  activeProjectId: string;
  onClose: () => void;
}

// ── Status badge styles (shared with FullDiffPanel) ───────────────────────────

const STATUS_STYLES: Record<string, string> = {
  M: 'bg-[var(--color-modified)] text-[var(--bg-void)]',
  A: 'bg-[var(--color-added)] text-[var(--bg-void)]',
  D: 'bg-[var(--color-deleted)] text-white',
  R: 'bg-[var(--color-info)] text-[var(--bg-void)]',
};

// ── File row ──────────────────────────────────────────────────────────────────

interface FileRowProps {
  file: DiffFile;
  projectId: string;
  commitHash: string;
}

const FileRow = ({ file, projectId, commitHash }: FileRowProps): React.JSX.Element => {
  const [expanded, setExpanded] = useState(false);
  const [hunks, setHunks] = useState<DiffHunkType[] | null>(null);
  const [loading, setLoading] = useState(false);

  const lastSlash = file.filePath.lastIndexOf('/');
  const dir = lastSlash >= 0 ? file.filePath.slice(0, lastSlash + 1) : '';
  const filename = lastSlash >= 0 ? file.filePath.slice(lastSlash + 1) : file.filePath;

  const handleToggle = useCallback(async (): Promise<void> => {
    const next = !expanded;
    setExpanded(next);
    if (next && hunks === null && !loading) {
      setLoading(true);
      try {
        const result = await window.nexusAPI?.git.commitFileHunks(projectId, commitHash, file.filePath);
        setHunks(result ?? []);
      } catch {
        setHunks([]);
      } finally {
        setLoading(false);
      }
    }
  }, [expanded, hunks, loading, projectId, commitHash, file.filePath]);

  return (
    <div className="border-b border-border-subtle last:border-b-0">
      {/* File header row */}
      <div
        className="flex cursor-pointer items-center gap-2.5 px-5 py-2.5 transition-colors duration-[var(--duration-fast)] hover:bg-bg-hover"
        onClick={() => { void handleToggle(); }}
      >
        {/* Chevron */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-text-ghost transition-transform duration-[var(--duration-fast)] ${expanded ? 'rotate-90' : ''}`}
        >
          <polyline points="3,2 7,5 3,8" />
        </svg>

        {/* Status badge */}
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] font-mono text-[10px] font-bold ${STATUS_STYLES[file.status] ?? ''}`}
        >
          {file.status}
        </span>

        {/* File path */}
        <span className="flex-1 truncate font-mono text-[12px] text-text-primary">
          {dir !== '' && <span className="text-text-tertiary">{dir}</span>}
          {filename}
          {file.status === 'R' && file.oldPath !== undefined && (
            <span className="text-text-tertiary"> &larr; {file.oldPath.split('/').pop()}</span>
          )}
        </span>

        {/* Stats */}
        <div className="flex shrink-0 gap-1.5 font-mono text-[10px]">
          {file.additions > 0 && (
            <span className="text-[var(--color-added)]">+{file.additions}</span>
          )}
          {file.deletions > 0 && (
            <span className="text-[var(--color-deleted)]">-{file.deletions}</span>
          )}
        </div>
      </div>

      {/* Expanded hunks */}
      {expanded && (
        <div className="border-t border-border-subtle bg-bg-base">
          {loading ? (
            <div className="flex items-center gap-2 px-5 py-3 font-mono text-[10px] text-text-ghost">
              <div className="h-2.5 w-2.5 animate-spin rounded-full border border-text-ghost border-t-phase-plan" />
              Loading diff...
            </div>
          ) : hunks !== null && hunks.length === 0 ? (
            <div className="px-5 py-3 font-mono text-[10px] text-text-ghost">No changes to display</div>
          ) : (
            hunks?.map((hunk) => (
              <DiffHunk key={hunk.header} hunk={hunk} />
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ── CommitDetailPanel ─────────────────────────────────────────────────────────

export const CommitDetailPanel = ({
  commit,
  activeProjectId,
  onClose,
}: CommitDetailPanelProps): React.JSX.Element => {
  const [files, setFiles] = useState<DiffFile[] | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [copied, setCopied] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Load changed files on mount
  useEffect(() => {
    if (!window.nexusAPI?.git) return;
    setLoadingFiles(true);
    window.nexusAPI.git
      .commitDiff(activeProjectId, commit.hash)
      .then((result) => { setFiles(result); })
      .catch(() => { setFiles([]); })
      .finally(() => { setLoadingFiles(false); });
  }, [activeProjectId, commit.hash]);

  const handleCopyHash = useCallback((): void => {
    void navigator.clipboard.writeText(commit.hash).then(() => {
      setCopied(true);
      setTimeout(() => { setCopied(false); }, 2000);
    });
  }, [commit.hash]);

  const totalFiles = files?.length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop — left 20% — click to close */}
      <div
        className="w-[20%] shrink-0 bg-bg-void/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel — right 80% */}
      <div
        className="flex w-[80%] flex-col border-l border-border-subtle bg-bg-raised"
        style={{ animation: 'commitDetailSlideIn 200ms ease-out' }}
      >
        {/* ── Header ── */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border-subtle px-5 py-3">
          {/* Commit icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-phase-plan"
          >
            <circle cx="12" cy="12" r="4" />
            <line x1="1.05" y1="12" x2="7" y2="12" />
            <line x1="17.01" y1="12" x2="22.96" y2="12" />
          </svg>

          <span className="flex-1 truncate font-mono text-[13px] font-semibold text-text-primary">
            {commit.message}
          </span>

          {/* Close button */}
          <button
            onClick={onClose}
            title="Close (Escape)"
            className="ml-1 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-[3px] border border-border-default bg-transparent text-text-tertiary transition-all duration-[var(--duration-fast)] hover:border-border-strong hover:text-text-primary"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="1" y1="1" x2="9" y2="9" />
              <line x1="9" y1="1" x2="1" y2="9" />
            </svg>
          </button>
        </div>

        {/* ── Commit metadata ── */}
        <div className="shrink-0 border-b border-border-subtle px-5 py-4">
          {/* Hash row */}
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-text-ghost">commit</span>
            <span className="text-phase-plan">{commit.hash}</span>
            <button
              onClick={handleCopyHash}
              title="Copy full hash"
              className="relative flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-[3px] border border-border-default bg-transparent text-text-tertiary transition-all duration-[var(--duration-fast)] hover:border-border-strong hover:text-text-primary"
            >
              {copied ? (
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1,5 4,8 9,2" />
                </svg>
              ) : (
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="6" height="6" rx="1" />
                  <path d="M1 7V1h6" />
                </svg>
              )}
            </button>
          </div>

          {/* Author + date */}
          <div className="mt-1.5 font-mono text-[11px] text-text-secondary">
            <span className="text-text-ghost">Author: </span>
            {commit.author}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-text-secondary">
            <span className="text-text-ghost">Date:   </span>
            <span title={commit.timestamp}>{commit.timeAgo}</span>
            <span className="ml-2 text-text-ghost">({commit.timestamp})</span>
          </div>

          {/* Stats summary */}
          {files !== null && (
            <div className="mt-3 flex items-center gap-2 font-mono text-[11px]">
              {commit.additions > 0 && (
                <span className="text-[var(--color-added)]">+{commit.additions}</span>
              )}
              {commit.deletions > 0 && (
                <span className="text-[var(--color-deleted)]">-{commit.deletions}</span>
              )}
              <span className="text-text-ghost">
                across {totalFiles} {totalFiles === 1 ? 'file' : 'files'}
              </span>
            </div>
          )}
        </div>

        {/* ── File list ── */}
        <div className="flex-1 overflow-auto">
          {loadingFiles ? (
            <div className="flex items-center gap-2.5 px-5 py-4">
              <div className="h-3 w-3 animate-spin rounded-full border border-text-ghost border-t-phase-plan" />
              <span className="font-mono text-[11px] text-text-ghost">Loading changed files...</span>
            </div>
          ) : files !== null && files.length === 0 ? (
            <div className="px-5 py-4 font-mono text-[11px] text-text-ghost">No file changes found</div>
          ) : (
            files?.map((file) => (
              <FileRow
                key={file.filePath}
                file={file}
                projectId={activeProjectId}
                commitHash={commit.hash}
              />
            ))
          )}
        </div>
      </div>

      <style>{`
        @keyframes commitDetailSlideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};
