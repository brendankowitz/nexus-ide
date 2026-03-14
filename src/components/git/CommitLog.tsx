import { useState, useCallback } from 'react';
import { mockCommits } from '@/lib/mock-data';
import type { Commit } from '@/types';

export const CommitLog = (): React.JSX.Element => {
  return (
    <div className="py-2">
      {mockCommits.map((commit) => (
        <CommitEntry key={commit.hash} commit={commit} />
      ))}
    </div>
  );
};

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
    <div className="flex cursor-pointer items-start gap-2.5 px-5 py-[7px] transition-colors duration-[var(--duration-fast)] hover:bg-bg-hover">
      {/* Avatar */}
      <div
        className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold ${avatarStyle}`}
      >
        {commit.authorInitials}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[12px] text-text-primary">
          {commit.message}
        </div>
        <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-text-tertiary">
          <span
            onClick={handleHashClick}
            className="relative cursor-pointer text-phase-plan hover:underline"
            title="Click to copy hash"
          >
            {commit.hash}
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
