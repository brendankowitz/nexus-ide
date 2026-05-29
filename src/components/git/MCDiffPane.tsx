import { useEffect, useState } from 'react';
import { DiffHunk } from '@/components/git/DiffHunk';
import { useProjectStore, selectActiveProject } from '@/stores/projectStore';
import { useToastStore } from '@/stores/toastStore';
import type { DiffFile, DiffHunk as DiffHunkType } from '@/types';

type ReviewFileState = 'approved' | 'changesRequested' | 'skipped' | 'unreviewed';

interface MCDiffPaneProps {
  projectId: string | null;
  worktreePath: string | null;
  file: DiffFile | null;
  activeIndex: number;
  totalFiles: number;
  reviewState: ReviewFileState;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
  onRequestChanges: () => void;
  onApproveAndNext: () => void;
  onEdit: () => void;
}

const ghostBtn: React.CSSProperties = {
  border: '1px solid var(--v2-border)',
  background: 'transparent',
  color: 'var(--v2-text-dim)',
  padding: '5px 9px',
  borderRadius: 5,
  fontSize: 11,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
};

const approveBtn: React.CSSProperties = {
  border: '1px solid var(--v2-green)',
  background: 'transparent',
  color: 'var(--v2-green)',
  padding: '5px 10px',
  borderRadius: 5,
  fontSize: 11,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
  fontWeight: 500,
};

const approvedBtnFilled: React.CSSProperties = {
  ...approveBtn,
  background: 'var(--v2-green)',
  color: '#0e1115',
};

function CheckIcon(): React.JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function StateStatusPill({ state }: { state: ReviewFileState }): React.JSX.Element | null {
  if (state === 'unreviewed') return null;

  const config = {
    approved: { label: 'Approved', bg: 'rgba(95,180,122,0.15)', color: 'var(--v2-green)' },
    changesRequested: { label: 'Changes', bg: 'rgba(220,80,80,0.15)', color: 'var(--v2-red)' },
    skipped: { label: 'Skipped', bg: 'rgba(120,120,120,0.15)', color: 'var(--v2-text-faint)' },
  } as const;

  const { label, bg, color } = config[state];
  return (
    <span style={{ background: bg, color, fontSize: 10, borderRadius: 4, padding: '2px 6px', fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)' }}>
      {label}
    </span>
  );
}

export const MCDiffPane = ({
  projectId,
  worktreePath,
  file,
  activeIndex,
  totalFiles,
  reviewState,
  onPrev,
  onNext,
  onSkip,
  onRequestChanges,
  onApproveAndNext,
  onEdit,
}: MCDiffPaneProps): React.JSX.Element => {
  const [hunks, setHunks] = useState<DiffHunkType[]>([]);
  const [loading, setLoading] = useState(false);
  const addToast = useToastStore((s) => s.addToast);
  const activeProject = useProjectStore(selectActiveProject);
  const basePath = worktreePath ?? activeProject?.path ?? null;

  useEffect(() => {
    if (file === null) { setHunks([]); return; }
    if (file.hunks.length > 0) { setHunks(file.hunks); setLoading(false); return; }
    if (projectId === null) return;
    if (window.nexusAPI?.git === undefined) return;

    let cancelled = false;
    setLoading(true);
    window.nexusAPI.git
      .diffHunks(projectId, file.filePath, worktreePath ?? undefined)
      .then((result) => { if (!cancelled) setHunks(result); })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[MCDiffPane] failed to load hunks:', err);
          addToast(`Failed to load diff: ${msg}`, 'error');
          setHunks([]);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [file, projectId, worktreePath, addToast]);

  if (file === null) {
    return (
      <div style={{ display: 'flex', minHeight: 0, alignItems: 'center', justifyContent: 'center', background: 'var(--v2-bg0)', color: 'var(--v2-text-faint)', fontSize: 12, fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)' }}>
        Select a file to view its diff
      </div>
    );
  }

  const hunkCount = hunks.length > 0 ? hunks.length : file.hunks.length;

  const handleOpenInEditor = async (): Promise<void> => {
    if (window.nexusAPI?.shell === undefined || basePath === null) return;
    try {
      const absPath = `${basePath}/${file.filePath}`.replace(/\\/g, '/');
      const err = await window.nexusAPI.shell.openFile(absPath);
      if (err) addToast(`Failed to open in editor: ${err}`, 'error');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[MCDiffPane] openFile failed:', err);
      addToast(`Failed to open in editor: ${msg}`, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--v2-border)',
          background: 'var(--v2-bg1)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {/* File path + hunk count */}
        <div
          style={{
            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
            fontSize: 12, color: 'var(--v2-text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320,
          }}
          title={file.filePath}
        >
          {file.filePath}
        </div>
        <span style={{ color: 'var(--v2-text-faint)', fontSize: 10.5, fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)' }}>
          · {hunkCount} hunk{hunkCount === 1 ? '' : 's'}
        </span>

        <StateStatusPill state={reviewState} />

        <div style={{ flex: 1 }} />

        {/* Nav cluster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button type="button" onClick={onPrev} disabled={totalFiles === 0} style={ghostBtn} title="Previous file">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span style={{ fontSize: 10.5, color: 'var(--v2-text-faint)', fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)', minWidth: 36, textAlign: 'center' }}>
            {totalFiles > 0 ? `${activeIndex + 1} / ${totalFiles}` : '—'}
          </span>
          <button type="button" onClick={onNext} disabled={totalFiles === 0} style={ghostBtn} title="Next file">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: 'var(--v2-border)', margin: '0 2px' }} />

        {/* Action buttons */}
        <button type="button" onClick={onSkip} style={ghostBtn} title="Skip (S)">
          Skip
        </button>
        <button
          type="button"
          onClick={onRequestChanges}
          style={{
            ...ghostBtn,
            color: reviewState === 'changesRequested' ? '#0e1115' : 'var(--v2-red)',
            borderColor: 'var(--v2-red)',
            background: reviewState === 'changesRequested' ? 'var(--v2-red)' : 'transparent',
          }}
          title="Request changes (R)"
        >
          Changes
        </button>
        <button
          type="button"
          onClick={onApproveAndNext}
          style={reviewState === 'approved' ? approvedBtnFilled : approveBtn}
          title="Approve & go to next (A)"
        >
          <CheckIcon />
          {reviewState === 'approved' ? 'Approved' : 'Approve & Next'}
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: 'var(--v2-border)', margin: '0 2px' }} />

        <button type="button" onClick={onEdit} style={ghostBtn} title="Quick edit">
          Edit
        </button>
        <button
          type="button"
          onClick={() => { void handleOpenInEditor(); }}
          style={ghostBtn}
          title="Open in external editor"
        >
          Open ↗
        </button>
      </div>

      {/* Diff body */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--v2-bg0)', minHeight: 0 }}>
        {loading && hunks.length === 0 && (
          <div style={{ padding: '12px 14px', color: 'var(--v2-text-faint)', fontSize: 11, fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)' }}>
            Loading diff…
          </div>
        )}
        {!loading && hunks.length === 0 && (
          <div style={{ padding: '12px 14px', color: 'var(--v2-text-faint)', fontSize: 11, fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)' }}>
            No diff to display
          </div>
        )}
        {hunks.map((hunk, i) => (
          <DiffHunk key={`${hunk.header}-${i}`} hunk={hunk} filePath={file.filePath} />
        ))}
      </div>
    </div>
  );
};
