import type { Commit } from '@/types';

interface MCCommitLogProps {
  commits: Commit[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onOpen: (index: number) => void;
  branchName: string;
  loading: boolean;
  error?: string | null;
}

/** Hash a string deterministically to one of the v2 palette colors for author badges. */
function authorColor(initials: string, isAI: boolean): string {
  if (isAI) return 'var(--v2-amber)';
  // Stable hash → pick from a small palette of non-amber colors.
  const palette = [
    'var(--v2-blue)',
    'var(--v2-green)',
    'var(--v2-yellow)',
    'var(--v2-text-dim)',
  ];
  let h = 0;
  for (let i = 0; i < initials.length; i++) {
    h = (h * 31 + initials.charCodeAt(i)) >>> 0;
  }
  return palette[h % palette.length] ?? 'var(--v2-text-dim)';
}

/** Author badge initials (max 2 chars). */
function initialsOf(commit: Commit): string {
  if (commit.isAIGenerated) return 'CC';
  if (commit.authorInitials.length > 0) {
    return commit.authorInitials.slice(0, 2).toUpperCase();
  }
  const a = commit.author.trim();
  if (a.length === 0) return '??';
  const parts = a.split(/\s+/);
  if (parts.length === 1) return a.slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export const MCCommitLog = ({
  commits,
  activeIndex,
  onSelect,
  onOpen,
  branchName,
  loading,
  error,
}: MCCommitLogProps): React.JSX.Element => {
  return (
    <div
      style={{
        background: 'var(--v2-bg1)',
        borderRight: '1px solid var(--v2-border)',
        overflow: 'auto',
        minHeight: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px 2px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span
          style={{
            color: 'var(--v2-text-faint)',
            fontSize: 10.5,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
        >
          Commit log
        </span>
        <span
          style={{
            color: 'var(--v2-blue)',
            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
            fontSize: 11,
          }}
        >
          {branchName}
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            color: 'var(--v2-text-faint)',
            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
            fontSize: 11,
          }}
        >
          {commits.length}
        </span>
      </div>

      {/* Sub-header */}
      <div
        style={{
          padding: '2px 12px 8px',
          color: 'var(--v2-text-faint)',
          fontSize: 10.5,
          fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
        }}
      >
        click to select · double-click to open full diff
      </div>

      {loading && commits.length === 0 && (
        <div
          style={{
            padding: '12px',
            color: 'var(--v2-text-faint)',
            fontSize: 11,
            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
          }}
        >
          Loading commits…
        </div>
      )}
      {!loading && error !== null && error !== undefined && (
        <div
          style={{
            padding: '12px',
            color: 'var(--v2-red)',
            fontSize: 11,
            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
          }}
        >
          Failed to load commit history
        </div>
      )}
      {!loading && (error === null || error === undefined) && commits.length === 0 && (
        <div
          style={{
            padding: '12px',
            color: 'var(--v2-text-faint)',
            fontSize: 11,
            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
          }}
        >
          No commits to display
        </div>
      )}

      {commits.map((c, i) => {
        const isActive = i === activeIndex;
        const initials = initialsOf(c);
        const dotColor = authorColor(initials, c.isAIGenerated);
        const sha = c.hash.slice(0, 7);
        const isLast = i === commits.length - 1;

        return (
          <div
            key={c.hash}
            onClick={() => onSelect(i)}
            onDoubleClick={() => onOpen(i)}
            title="double-click to open full diff"
            style={{
              padding: '9px 12px',
              display: 'grid',
              gridTemplateColumns: '14px 1fr auto',
              columnGap: 8,
              borderLeft: `2px solid ${isActive ? 'var(--v2-amber)' : 'transparent'}`,
              background: isActive ? 'var(--v2-bg2)' : 'transparent',
              cursor: 'pointer',
              borderBottom: '1px solid var(--v2-border-soft)',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = 'var(--v2-bg2)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = 'transparent';
            }}
          >
            {/* Timeline column: dot + rule */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: 4,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: dotColor,
                  boxShadow: `0 0 0 2px var(--v2-bg1), 0 0 0 3px ${dotColor}`,
                }}
              />
              {!isLast && (
                <div
                  style={{
                    flex: 1,
                    width: 1,
                    background: 'var(--v2-border)',
                    marginTop: 4,
                    alignSelf: 'center',
                  }}
                />
              )}
            </div>

            {/* Message + metadata */}
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12.5,
                  color: isActive ? 'var(--v2-text)' : 'var(--v2-text-dim)',
                  lineHeight: 1.35,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={c.message}
              >
                {c.message}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 3,
                  fontSize: 10.5,
                  fontFamily:
                    'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                  color: 'var(--v2-text-faint)',
                }}
              >
                <span
                  style={{
                    background: dotColor,
                    color: '#0e1115',
                    padding: '0 4px',
                    borderRadius: 3,
                    fontWeight: 700,
                  }}
                >
                  {initials}
                </span>
                <span>{sha}</span>
                <span>· {c.timeAgo}</span>
                {c.isAIGenerated && (
                  <span style={{ color: 'var(--v2-amber)' }}>· agent</span>
                )}
              </div>
            </div>

            {/* Right stats */}
            <div
              style={{
                textAlign: 'right',
                fontFamily:
                  'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                fontSize: 10.5,
                alignSelf: 'start',
                paddingTop: 2,
              }}
            >
              <span style={{ color: 'var(--v2-green)' }}>+{c.additions}</span>{' '}
              <span style={{ color: 'var(--v2-red)' }}>−{c.deletions}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
