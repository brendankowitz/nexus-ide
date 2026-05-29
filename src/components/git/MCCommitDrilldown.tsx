import { useEffect, useState } from 'react';
import { DiffHunk } from '@/components/git/DiffHunk';
import { useToastStore } from '@/stores/toastStore';
import type { Commit, DiffFile, DiffHunk as DiffHunkType } from '@/types';

interface MCCommitDrilldownProps {
  commit: Commit;
  projectId: string | null;
  onBack: () => void;
}

const STATUS_COLOR: Record<DiffFile['status'], string> = {
  M: 'var(--v2-blue)',
  A: 'var(--v2-green)',
  D: 'var(--v2-red)',
  R: 'var(--v2-amber)',
};

const ghostButtonStyle: React.CSSProperties = {
  border: '1px solid var(--v2-border)',
  background: 'transparent',
  color: 'var(--v2-text-dim)',
  padding: '6px 10px',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontFamily: 'inherit',
};

const CheckIcon = (): React.JSX.Element => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const BackIcon = (): React.JSX.Element => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

function initialsOf(commit: Commit): string {
  if (commit.isAIGenerated) return 'CC';
  if (commit.authorInitials.length > 0)
    return commit.authorInitials.slice(0, 2).toUpperCase();
  const a = commit.author.trim();
  if (a.length === 0) return '??';
  const parts = a.split(/\s+/);
  if (parts.length === 1) return a.slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function authorColor(initials: string, isAI: boolean): string {
  if (isAI) return 'var(--v2-amber)';
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

export const MCCommitDrilldown = ({
  commit,
  projectId,
  onBack,
}: MCCommitDrilldownProps): React.JSX.Element => {
  const [files, setFiles] = useState<DiffFile[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [filesLoading, setFilesLoading] = useState(false);

  const [hunks, setHunks] = useState<DiffHunkType[]>([]);
  const [hunksLoading, setHunksLoading] = useState(false);

  const addToast = useToastStore((s) => s.addToast);

  // Load file list for this commit.
  useEffect(() => {
    if (projectId === null) {
      setFiles([]);
      return;
    }
    if (window.nexusAPI?.git === undefined) return;

    let cancelled = false;
    setFilesLoading(true);
    window.nexusAPI.git
      .commitDiff(projectId, commit.hash)
      .then((result) => {
        if (cancelled) return;
        setFiles(result);
        setActiveIndex(0);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[MCCommitDrilldown] commitDiff failed:', err);
          addToast(`Failed to load commit files: ${msg}`, 'error');
          setFiles([]);
        }
      })
      .finally(() => {
        if (!cancelled) setFilesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, commit.hash, addToast]);

  // Load hunks for the active file.
  const activeFile =
    files.length > 0 ? files[Math.min(activeIndex, files.length - 1)] : undefined;

  useEffect(() => {
    if (activeFile === undefined) {
      setHunks([]);
      return;
    }
    if (projectId === null) return;
    if (window.nexusAPI?.git === undefined) return;

    let cancelled = false;
    setHunksLoading(true);
    window.nexusAPI.git
      .commitFileHunks(projectId, commit.hash, activeFile.filePath)
      .then((result) => {
        if (!cancelled) setHunks(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[MCCommitDrilldown] commitFileHunks failed:', err);
          addToast(`Failed to load diff: ${msg}`, 'error');
          setHunks([]);
        }
      })
      .finally(() => {
        if (!cancelled) setHunksLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, commit.hash, activeFile?.filePath, addToast]);

  const initials = initialsOf(commit);
  const badgeColor = authorColor(initials, commit.isAIGenerated);
  const sha = commit.hash.slice(0, 7);
  const activeStatusColor =
    activeFile !== undefined
      ? STATUS_COLOR[activeFile.status]
      : 'var(--v2-text-dim)';

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: 'var(--v2-bg0)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--v2-border)',
          background: 'var(--v2-bg1)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{ ...ghostButtonStyle, padding: '4px 8px' }}
        >
          <BackIcon /> Back to log
        </button>
        <span
          style={{
            background: badgeColor,
            color: '#0e1115',
            fontSize: 10,
            fontFamily:
              'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 3,
          }}
        >
          {initials}
        </span>
        <span
          style={{
            fontFamily:
              'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
            fontSize: 11.5,
            color: 'var(--v2-text-dim)',
          }}
        >
          {sha}
        </span>
        <span style={{ color: 'var(--v2-text-faint)', fontSize: 11 }}>·</span>
        <span
          style={{
            color: 'var(--v2-text)',
            fontSize: 13,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 520,
          }}
          title={commit.message}
        >
          {commit.message}
        </span>
        <span
          style={{
            color: 'var(--v2-text-faint)',
            fontSize: 11,
            fontFamily:
              'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
          }}
        >
          · {commit.author} · {commit.timeAgo}
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 11,
            fontFamily:
              'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
          }}
        >
          <span style={{ color: 'var(--v2-green)' }}>+{commit.additions}</span>{' '}
          <span style={{ color: 'var(--v2-red)' }}>−{commit.deletions}</span>{' '}
          <span style={{ color: 'var(--v2-text-faint)' }}>
            · {files.length} files
          </span>
        </span>
        <button
          type="button"
          style={{
            ...ghostButtonStyle,
            color: 'var(--v2-green)',
            borderColor: 'var(--v2-green)',
          }}
          title="Approve (not yet implemented)"
        >
          <CheckIcon /> Approve
        </button>
        <button type="button" style={ghostButtonStyle} title="Cherry-pick (not yet implemented)">
          Cherry-pick
        </button>
        <button type="button" style={ghostButtonStyle} title="Revert (not yet implemented)">
          Revert
        </button>
      </div>

      {/* Content grid */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '300px 1fr',
          minHeight: 0,
        }}
      >
        {/* Left: file list */}
        <div
          style={{
            background: 'var(--v2-bg1)',
            borderRight: '1px solid var(--v2-border)',
            overflow: 'auto',
            minHeight: 0,
          }}
        >
          <div
            style={{
              padding: '10px 12px 6px',
              color: 'var(--v2-text-faint)',
              fontSize: 10.5,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}
          >
            Files in commit · {files.length}
          </div>
          {filesLoading && files.length === 0 && (
            <div
              style={{
                padding: '8px 12px',
                color: 'var(--v2-text-faint)',
                fontSize: 11,
                fontFamily:
                  'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
              }}
            >
              Loading…
            </div>
          )}
          {files.map((f, i) => {
            const isA = i === activeIndex;
            const sc = STATUS_COLOR[f.status] ?? 'var(--v2-text-dim)';
            return (
              <div
                key={f.filePath}
                onClick={() => setActiveIndex(i)}
                style={{
                  padding: '7px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  borderLeft: `2px solid ${
                    isA ? 'var(--v2-amber)' : 'transparent'
                  }`,
                  background: isA ? 'var(--v2-bg2)' : 'transparent',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
                onMouseEnter={(e) => {
                  if (!isA) e.currentTarget.style.background = 'var(--v2-bg2)';
                }}
                onMouseLeave={(e) => {
                  if (!isA) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span
                  style={{
                    fontFamily:
                      'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                    fontSize: 10,
                    color: sc,
                    width: 12,
                    textAlign: 'center',
                    flexShrink: 0,
                  }}
                >
                  {f.status}
                </span>
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: isA ? 'var(--v2-text)' : 'var(--v2-text-dim)',
                  }}
                  title={f.filePath}
                >
                  {f.filePath}
                </span>
                <span
                  style={{
                    fontFamily:
                      'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                    fontSize: 10,
                    color: 'var(--v2-green)',
                  }}
                >
                  +{f.additions}
                </span>
                {f.deletions > 0 && (
                  <span
                    style={{
                      fontFamily:
                        'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                      fontSize: 10,
                      color: 'var(--v2-red)',
                    }}
                  >
                    −{f.deletions}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: hunk diff */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            minWidth: 0,
          }}
        >
          {activeFile !== undefined && (
            <div
              style={{
                padding: '8px 14px',
                borderBottom: '1px solid var(--v2-border-soft)',
                background: 'var(--v2-bg1)',
                fontFamily:
                  'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                fontSize: 12,
                color: 'var(--v2-text-dim)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ color: activeStatusColor }}>{activeFile.status}</span>
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={activeFile.filePath}
              >
                {activeFile.filePath}
              </span>
              <span style={{ marginLeft: 'auto', color: 'var(--v2-text-faint)' }}>
                <span style={{ color: 'var(--v2-green)' }}>
                  +{activeFile.additions}
                </span>{' '}
                <span style={{ color: 'var(--v2-red)' }}>
                  −{activeFile.deletions}
                </span>
              </span>
            </div>
          )}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              minHeight: 0,
              background: 'var(--v2-bg0)',
            }}
          >
            {hunksLoading && hunks.length === 0 && (
              <div
                style={{
                  padding: '12px 14px',
                  color: 'var(--v2-text-faint)',
                  fontSize: 11,
                  fontFamily:
                    'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                }}
              >
                Loading diff…
              </div>
            )}
            {!hunksLoading && hunks.length === 0 && activeFile !== undefined && (
              <div
                style={{
                  padding: '12px 14px',
                  color: 'var(--v2-text-faint)',
                  fontSize: 11,
                  fontFamily:
                    'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                }}
              >
                No diff to display
              </div>
            )}
            {activeFile !== undefined &&
              hunks.map((hunk, i) => (
                <DiffHunk
                  key={`${hunk.header}-${i}`}
                  hunk={hunk}
                  filePath={activeFile.filePath}
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
