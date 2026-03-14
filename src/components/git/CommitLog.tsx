import { useState, useCallback, useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useToastStore } from '@/stores/toastStore';
import type { Commit } from '@/types';
import { GitGraph, RefBadges } from './GitGraph';

// ── Empty State ──────────────────────────────────

const CommitEmptyState = (): React.JSX.Element => (
  <div className="flex h-full flex-col items-center justify-center gap-4 px-8">
    <div className="relative">
      <div
        className="absolute inset-0 rounded-2xl opacity-30 blur-2xl"
        style={{ background: 'var(--phase-plan)' }}
      />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-border-default bg-bg-surface">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
          <circle cx="12" cy="12" r="4" />
          <line x1="1.05" y1="12" x2="7" y2="12" />
          <line x1="17.01" y1="12" x2="22.96" y2="12" />
        </svg>
      </div>
    </div>
    <div className="text-center">
      <p className="font-mono text-[13px] font-medium text-text-primary">No commit history</p>
      <p className="mt-1 text-[11px] text-text-tertiary">Commits will appear here once you start working</p>
    </div>
  </div>
);

// ── Loading State ────────────────────────────────

const CommitLoading = (): React.JSX.Element => (
  <div className="flex h-full items-center justify-center">
    <div className="flex items-center gap-2.5">
      <div className="h-3 w-3 animate-spin rounded-full border border-text-ghost border-t-phase-plan" />
      <span className="font-mono text-[11px] text-text-tertiary">Loading commits...</span>
    </div>
  </div>
);

// ── Error State ──────────────────────────────────

const CommitError = ({ message }: { message: string }): React.JSX.Element => (
  <div className="flex h-full flex-col items-center justify-center gap-4 px-8">
    <div className="relative">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-border-default bg-bg-surface">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-deleted)]">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
    </div>
    <div className="text-center">
      <p className="font-mono text-[13px] font-medium text-text-primary">Failed to load commits</p>
      <p className="mt-1 text-[11px] text-text-tertiary">{message}</p>
    </div>
  </div>
);

// ── CommitLog ─────────────────────────────────────

export const CommitLog = (): React.JSX.Element => {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCommits = useCallback(async (): Promise<void> => {
    if (activeProjectId === null) return;
    if (!window.nexusAPI?.git) return;

    setLoading(true);
    setError(null);
    try {
      const result = await window.nexusAPI.git.log(activeProjectId);
      setCommits(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error('[CommitLog] failed to load commits:', err);
      useToastStore.getState().addToast(`Log: ${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    void loadCommits();
  }, [loadCommits]);

  if (loading && commits.length === 0) {
    return <CommitLoading />;
  }

  if (error !== null && commits.length === 0) {
    return <CommitError message={error} />;
  }

  if (commits.length === 0) {
    return <CommitEmptyState />;
  }

  return (
    <div className="py-2">
      <div className="flex">
        {/* Graph column */}
        <GitGraph commits={commits} />
        {/* Commit details column */}
        <div className="min-w-0 flex-1">
          {commits.map((commit) => (
            <CommitEntry key={commit.hash} commit={commit} />
          ))}
        </div>
      </div>
    </div>
  );
};

// ── CommitEntry ───────────────────────────────────

const CommitEntry = ({ commit }: { commit: Commit }): React.JSX.Element => {
  const [copied, setCopied] = useState(false);

  const handleHashClick = useCallback((e: React.MouseEvent): void => {
    e.stopPropagation();
    void navigator.clipboard.writeText(commit.hash).then(() => {
      setCopied(true);
      setTimeout(() => { setCopied(false); }, 2000);
    });
  }, [commit.hash]);

  const avatarStyle = commit.isAIGenerated
    ? 'bg-[var(--phase-plan-glow)] text-phase-plan'
    : 'bg-bg-active text-text-secondary';

  return (
    <div className="flex cursor-pointer items-center gap-2.5 px-3 transition-colors duration-[var(--duration-fast)] hover:bg-bg-hover" style={{ height: 44 }}>
      {/* Avatar */}
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold ${avatarStyle}`}
      >
        {commit.authorInitials}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center truncate font-mono text-[12px] text-text-primary">
          <span className="truncate">{commit.message}</span>
          <RefBadges refs={commit.refs} />
        </div>
        <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-text-tertiary">
          <span
            onClick={handleHashClick}
            className="relative cursor-pointer text-phase-plan hover:underline"
            title="Click to copy hash"
          >
            {commit.hash.slice(0, 7)}
            {copied && (
              <span className="absolute -top-5 left-0 rounded-[3px] border border-border-strong bg-bg-overlay px-1.5 py-px text-[9px] text-text-secondary shadow-md">
                Copied!
              </span>
            )}
          </span>
          <span>{commit.timeAgo}</span>
          <span>{commit.author}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex shrink-0 gap-1 font-mono text-[10px]">
        {commit.additions > 0 && (
          <span className="text-[var(--color-added)]">+{commit.additions}</span>
        )}
        {commit.deletions > 0 && (
          <span className="text-[var(--color-deleted)]">-{commit.deletions}</span>
        )}
      </div>
    </div>
  );
};
