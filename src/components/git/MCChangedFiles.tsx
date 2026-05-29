import { useMemo } from 'react';
import { useUIStore } from '@/stores/uiStore';
import type { DiffFile } from '@/types';

type ReviewFileState = 'approved' | 'changesRequested' | 'skipped' | 'unreviewed';

interface MCChangedFilesProps {
  files: DiffFile[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onNextUnreviewed: () => void;
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

function ReviewCircle({ state }: { state: ReviewFileState }): React.JSX.Element {
  if (state === 'approved') {
    return (
      <span
        style={{
          width: 13, height: 13, borderRadius: 7, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--v2-green)',
        }}
      >
        <svg width="7" height="7" viewBox="0 0 12 12" fill="none" stroke="#0e1115" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2 6 5 9 10 3" />
        </svg>
      </span>
    );
  }
  if (state === 'changesRequested') {
    return (
      <span
        style={{
          width: 13, height: 13, borderRadius: 7, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--v2-red)',
        }}
      >
        <svg width="7" height="7" viewBox="0 0 12 12" fill="none" stroke="#0e1115" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <line x1="2" y1="2" x2="10" y2="10" /><line x1="10" y1="2" x2="2" y2="10" />
        </svg>
      </span>
    );
  }
  if (state === 'skipped') {
    return (
      <span
        style={{
          width: 13, height: 13, borderRadius: 7, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--v2-border)',
        }}
      >
        <svg width="7" height="3" viewBox="0 0 7 3" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round">
          <line x1="0" y1="1.5" x2="7" y2="1.5" />
        </svg>
      </span>
    );
  }
  return (
    <span
      style={{
        width: 13, height: 13, borderRadius: 7, flexShrink: 0,
        border: '1px solid var(--v2-border)',
      }}
    />
  );
}

function borderColorForState(state: ReviewFileState, isActive: boolean): string {
  if (isActive) return 'var(--v2-amber)';
  if (state === 'approved') return 'var(--v2-green)';
  if (state === 'changesRequested') return 'var(--v2-red)';
  if (state === 'skipped') return 'var(--v2-border)';
  return 'transparent';
}

export const MCChangedFiles = ({
  files,
  activeIndex,
  onSelect,
  onPrev,
  onNext,
  onNextUnreviewed,
  branchName,
  worktreeLabel,
  loading,
  error,
}: MCChangedFilesProps): React.JSX.Element => {
  const reviewedFiles = useUIStore((s) => s.reviewedFiles);
  const getFileReviewState = useUIStore((s) => s.getFileReviewState);

  const fileStates = useMemo<ReviewFileState[]>(
    () => files.map((f) => getFileReviewState(f.filePath, `${f.additions}-${f.deletions}`)),
    [files, reviewedFiles, getFileReviewState],
  );

  const reviewedCount = useMemo(
    () => fileStates.filter((s) => s !== 'unreviewed').length,
    [fileStates],
  );

  const hasUnreviewed = fileStates.some((s) => s === 'unreviewed');

  const [totalAdds, totalDels] = useMemo(() => {
    let a = 0, d = 0;
    for (const f of files) { a += f.additions; d += f.deletions; }
    return [a, d];
  }, [files]);

  const progressPct = files.length > 0 ? Math.round((reviewedCount / files.length) * 100) : 0;
  const progressColor = progressPct === 100 ? 'var(--v2-green)' : 'var(--v2-amber)';

  return (
    <div
      style={{
        background: 'var(--v2-bg1)',
        borderRight: '1px solid var(--v2-border)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '10px 12px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ color: 'var(--v2-text-faint)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Changed files
          </span>
          <span style={{ color: 'var(--v2-text-faint)', fontSize: 11, fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)' }}>
            {files.length}
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ color: 'var(--v2-green)', fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)', fontSize: 11 }}>
            +{totalAdds}
          </span>
          <span style={{ color: 'var(--v2-red)', fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)', fontSize: 11 }}>
            −{totalDels}
          </span>
          <div style={{ display: 'flex', gap: 2, marginLeft: 4 }}>
            <button type="button" onClick={onPrev} disabled={files.length === 0} title="Previous file (K)" style={navBtnStyle}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
            <button type="button" onClick={onNext} disabled={files.length === 0} title="Next file (J)" style={navBtnStyle}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {files.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ fontSize: 10, color: reviewedCount === files.length ? 'var(--v2-green)' : 'var(--v2-text-faint)', fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)' }}>
                {reviewedCount}/{files.length} reviewed
              </span>
              {hasUnreviewed && (
                <button
                  type="button"
                  onClick={onNextUnreviewed}
                  style={{
                    marginLeft: 'auto',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--v2-amber)',
                    fontSize: 10,
                    cursor: 'pointer',
                    padding: '0 2px',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  next unreviewed
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              )}
            </div>
            <div style={{ height: 3, background: 'var(--v2-bg3)', borderRadius: 2, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${progressPct}%`,
                  background: progressColor,
                  borderRadius: 2,
                  transition: 'width 0.2s ease, background 0.2s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Sub-header */}
        <div style={{ paddingBottom: 6, color: 'var(--v2-text-faint)', fontSize: 10.5, fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)' }}>
          vs <span style={{ color: 'var(--v2-blue)' }}>{branchName}</span> · wt{' '}
          <span style={{ color: 'var(--v2-text-dim)' }}>{worktreeLabel}</span>
        </div>
      </div>

      {/* States */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading && files.length === 0 && (
          <div style={{ padding: '12px', color: 'var(--v2-text-faint)', fontSize: 11, fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)' }}>
            Loading changes…
          </div>
        )}
        {!loading && error !== null && error !== undefined && (
          <div style={{ padding: '12px', color: 'var(--v2-red)', fontSize: 11, fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)' }}>
            Failed to load changes
          </div>
        )}
        {!loading && (error === null || error === undefined) && files.length === 0 && (
          <div style={{ padding: '12px', color: 'var(--v2-text-faint)', fontSize: 11, fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)' }}>
            Working tree clean
          </div>
        )}

        {/* File rows */}
        {files.map((f, i) => {
          const isActive = i === activeIndex;
          const sc = STATUS_COLOR[f.status] ?? 'var(--v2-text-dim)';
          const state = fileStates[i] ?? 'unreviewed';
          const borderColor = borderColorForState(state, isActive);
          const isDimmed = state !== 'unreviewed' && !isActive;
          return (
            <div
              key={f.filePath}
              onClick={() => onSelect(i)}
              style={{
                padding: '5px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderLeft: `2px solid ${borderColor}`,
                background: isActive ? 'var(--v2-bg2)' : 'transparent',
                cursor: 'pointer',
                fontSize: 12,
                opacity: isDimmed ? 0.5 : 1,
                transition: 'opacity 0.1s',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--v2-bg2)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <ReviewCircle state={state} />
              <span style={{ fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)', fontSize: 10, color: sc, width: 12, textAlign: 'center', flexShrink: 0 }}>
                {f.status}
              </span>
              <span
                style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isActive ? 'var(--v2-text)' : 'var(--v2-text-dim)' }}
                title={f.filePath}
              >
                {f.filePath}
              </span>
              <span style={{ fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)', fontSize: 10, color: 'var(--v2-green)' }}>
                +{f.additions}
              </span>
              {f.deletions > 0 && (
                <span style={{ fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)', fontSize: 10, color: 'var(--v2-red)' }}>
                  −{f.deletions}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Keyboard hints footer */}
      {files.length > 0 && (
        <div
          style={{
            flexShrink: 0,
            borderTop: '1px solid var(--v2-border)',
            padding: '5px 12px',
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          {[
            ['J/K', 'navigate'],
            ['A', 'approve'],
            ['R', 'changes'],
            ['S', 'skip'],
            ['N', 'next new'],
          ].map(([key, label]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <kbd style={{ background: 'var(--v2-bg3)', border: '1px solid var(--v2-border)', borderRadius: 3, padding: '1px 4px', fontSize: 9, fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)', color: 'var(--v2-text-dim)' }}>
                {key}
              </kbd>
              <span style={{ fontSize: 9.5, color: 'var(--v2-text-faint)' }}>{label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const navBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 20, height: 20,
  border: '1px solid var(--v2-border)', borderRadius: 4,
  background: 'transparent', color: 'var(--v2-text-faint)',
  cursor: 'pointer', padding: 0,
};
