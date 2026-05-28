import { useEffect, useState } from 'react';
import { useToastStore } from '@/stores/toastStore';
import type { Commit, DiffFile } from '@/types';

interface MCCommitSummaryProps {
  commit: Commit | null;
  projectId: string | null;
  onOpen: () => void;
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
  >
    <path d="M21 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-3" />
    <polyline points="16 12 21 12 21 8" />
    <polyline points="16 16 21 16 21 12" />
    <line x1="8" y1="8" x2="13" y2="8" />
    <line x1="8" y1="12" x2="13" y2="12" />
    <line x1="8" y1="16" x2="13" y2="16" />
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

export const MCCommitSummary = ({
  commit,
  projectId,
  onOpen,
}: MCCommitSummaryProps): React.JSX.Element => {
  const [files, setFiles] = useState<DiffFile[]>([]);
  const [loading, setLoading] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    if (commit === null || projectId === null) {
      setFiles([]);
      return;
    }
    if (window.nexusAPI?.git === undefined) return;

    let cancelled = false;
    setLoading(true);
    window.nexusAPI.git
      .commitDiff(projectId, commit.hash)
      .then((result) => {
        if (!cancelled) setFiles(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[MCCommitSummary] commitDiff failed:', err);
          addToast(`Failed to load commit files: ${msg}`, 'error');
          setFiles([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [commit?.hash, projectId, addToast]);

  if (commit === null) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: 0,
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--v2-bg0)',
          color: 'var(--v2-text-faint)',
          fontSize: 12,
          fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
        }}
      >
        Select a commit to view its summary
      </div>
    );
  }

  const initials = initialsOf(commit);
  const badgeColor = authorColor(initials, commit.isAIGenerated);
  const sha = commit.hash.slice(0, 7);
  const parentSha = commit.parents[0]?.slice(0, 7) ?? null;

  const handleCopySha = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(commit.hash);
      addToast(`Copied ${commit.hash.slice(0, 7)}`, 'success');
    } catch (err) {
      console.error('[MCCommitSummary] copy sha failed:', err);
      addToast('Failed to copy SHA to clipboard', 'error');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: 'var(--v2-bg0)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 18px 12px',
          borderBottom: '1px solid var(--v2-border)',
          background: 'var(--v2-bg1)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
            flexWrap: 'wrap',
          }}
        >
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
          <span style={{ color: 'var(--v2-text-dim)', fontSize: 12 }}>
            {commit.author}
          </span>
          <span style={{ color: 'var(--v2-text-faint)', fontSize: 11 }}>
            · {commit.timeAgo}
          </span>
          {commit.isAIGenerated && (
            <span
              style={{
                marginLeft: 'auto',
                color: 'var(--v2-amber)',
                fontSize: 11,
                fontFamily:
                  'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
              }}
            >
              agent commit
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 500,
            lineHeight: 1.35,
            color: 'var(--v2-text)',
            marginBottom: 10,
          }}
        >
          {commit.message}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 11,
            fontFamily:
              'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
            color: 'var(--v2-text-faint)',
            flexWrap: 'wrap',
          }}
        >
          <span>
            <span style={{ color: 'var(--v2-green)' }}>+{commit.additions}</span>{' '}
            <span style={{ color: 'var(--v2-red)' }}>−{commit.deletions}</span>
          </span>
          <span>· {files.length} files</span>
          {parentSha !== null && <span>· parent {parentSha}</span>}
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onOpen}
            style={{
              ...ghostButtonStyle,
              color: 'var(--v2-amber)',
              borderColor: 'var(--v2-amber)',
            }}
          >
            <DiffIcon /> View full diff
          </button>
          <button
            type="button"
            onClick={() => {
              void handleCopySha();
            }}
            style={ghostButtonStyle}
          >
            Copy sha
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '12px 18px',
          minHeight: 0,
        }}
      >
        <div
          style={{
            color: 'var(--v2-text-faint)',
            fontSize: 10.5,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: 8,
          }}
        >
          Files in this commit ({files.length})
        </div>
        {loading && files.length === 0 && (
          <div
            style={{
              color: 'var(--v2-text-faint)',
              fontSize: 11,
              fontFamily:
                'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
              padding: '8px 0',
            }}
          >
            Loading files…
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {files.map((f) => {
            const sc = STATUS_COLOR[f.status] ?? 'var(--v2-text-dim)';
            return (
              <div
                key={f.filePath}
                onDoubleClick={onOpen}
                title="double-click to open full diff"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  background: 'var(--v2-bg1)',
                  border: '1px solid var(--v2-border-soft)',
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    fontFamily:
                      'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                    fontSize: 10,
                    color: sc,
                    width: 12,
                    flexShrink: 0,
                    textAlign: 'center',
                  }}
                >
                  {f.status}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontFamily:
                      'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                    color: 'var(--v2-text-dim)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={f.filePath}
                >
                  {f.filePath}
                </span>
                <span
                  style={{
                    fontFamily:
                      'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                    fontSize: 10.5,
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
                      fontSize: 10.5,
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

        <div
          style={{
            marginTop: 18,
            padding: 14,
            border: '1px dashed var(--v2-border)',
            borderRadius: 7,
            color: 'var(--v2-text-faint)',
            fontSize: 11.5,
            lineHeight: 1.55,
            background: 'var(--v2-bg1)',
          }}
        >
          <span style={{ color: 'var(--v2-text-dim)', fontWeight: 600 }}>
            Tip
          </span>{' '}
          · double-click any commit (or any file row above) to open the per-file
          diff. Use the worktree picker in the header to compare what the same
          branch looks like in a different checkout.
        </div>
      </div>
    </div>
  );
};
