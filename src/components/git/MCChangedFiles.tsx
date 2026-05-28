import { useMemo } from 'react';
import type { DiffFile } from '@/types';

interface MCChangedFilesProps {
  files: DiffFile[];
  activeIndex: number;
  onSelect: (index: number) => void;
  branchName: string;
  worktreeLabel: string;
  loading: boolean;
  error?: string | null;
}

const STATUS_COLOR: Record<DiffFile['status'], string> = {
  M: 'var(--v2-blue)',
  A: 'var(--v2-green)',
  D: 'var(--v2-red)',
  R: 'var(--v2-amber)',
};

export const MCChangedFiles = ({
  files,
  activeIndex,
  onSelect,
  branchName,
  worktreeLabel,
  loading,
  error,
}: MCChangedFilesProps): React.JSX.Element => {
  const [totalAdds, totalDels] = useMemo(() => {
    let a = 0;
    let d = 0;
    for (const f of files) {
      a += f.additions;
      d += f.deletions;
    }
    return [a, d];
  }, [files]);

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
          padding: '10px 12px 4px',
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
          Changed files
        </span>
        <span
          style={{
            color: 'var(--v2-text-faint)',
            fontSize: 11,
            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
          }}
        >
          {files.length}
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            color: 'var(--v2-green)',
            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
            fontSize: 11,
          }}
        >
          +{totalAdds}
        </span>
        <span
          style={{
            color: 'var(--v2-red)',
            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
            fontSize: 11,
          }}
        >
          −{totalDels}
        </span>
      </div>

      {/* Sub-header */}
      <div
        style={{
          padding: '0 12px 8px',
          color: 'var(--v2-text-faint)',
          fontSize: 10.5,
          fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
        }}
      >
        vs <span style={{ color: 'var(--v2-blue)' }}>{branchName}</span> · worktree{' '}
        <span style={{ color: 'var(--v2-text-dim)' }}>{worktreeLabel}</span>
      </div>

      {/* States */}
      {loading && files.length === 0 && (
        <div
          style={{
            padding: '12px',
            color: 'var(--v2-text-faint)',
            fontSize: 11,
            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
          }}
        >
          Loading changes…
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
          Failed to load changes
        </div>
      )}
      {!loading && (error === null || error === undefined) && files.length === 0 && (
        <div
          style={{
            padding: '12px',
            color: 'var(--v2-text-faint)',
            fontSize: 11,
            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
          }}
        >
          Working tree clean
        </div>
      )}

      {/* File rows */}
      {files.map((f, i) => {
        const isActive = i === activeIndex;
        const sc = STATUS_COLOR[f.status] ?? 'var(--v2-text-dim)';
        return (
          <div
            key={f.filePath}
            onClick={() => onSelect(i)}
            style={{
              padding: '7px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderLeft: `2px solid ${isActive ? 'var(--v2-amber)' : 'transparent'}`,
              background: isActive ? 'var(--v2-bg2)' : 'transparent',
              cursor: 'pointer',
              fontSize: 12,
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = 'var(--v2-bg2)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = 'transparent';
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
                color: isActive ? 'var(--v2-text)' : 'var(--v2-text-dim)',
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
  );
};
