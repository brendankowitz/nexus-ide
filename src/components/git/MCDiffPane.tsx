import { useEffect, useState } from 'react';
import { DiffHunk } from '@/components/git/DiffHunk';
import { useUIStore } from '@/stores/uiStore';
import { useToastStore } from '@/stores/toastStore';
import type { DiffFile, DiffHunk as DiffHunkType } from '@/types';

interface MCDiffPaneProps {
  projectId: string | null;
  worktreePath: string | null;
  file: DiffFile | null;
}

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

/** Format an authored-by string. We don't have author metadata per-file in the
 * uncommitted diff IPC, so we render a neutral "local" badge. */
function buildAuthorBadge(): React.JSX.Element {
  return (
    <span
      style={{
        background: 'var(--v2-text-faint)',
        color: '#0e1115',
        fontSize: 10,
        fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: 3,
      }}
    >
      WT
    </span>
  );
}

export const MCDiffPane = ({
  projectId,
  worktreePath,
  file,
}: MCDiffPaneProps): React.JSX.Element => {
  const [hunks, setHunks] = useState<DiffHunkType[]>([]);
  const [loading, setLoading] = useState(false);
  const reviewFile = useUIStore((s) => s.reviewFile);
  const isReviewedAndUnchanged = useUIStore((s) => s.isReviewedAndUnchanged);
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    if (file === null) {
      setHunks([]);
      return;
    }

    // If hunks were already provided inline, use them.
    if (file.hunks.length > 0) {
      setHunks(file.hunks);
      setLoading(false);
      return;
    }

    if (projectId === null) return;
    if (window.nexusAPI?.git === undefined) return;

    let cancelled = false;
    setLoading(true);

    window.nexusAPI.git
      .diffHunks(projectId, file.filePath, worktreePath ?? undefined)
      .then((result) => {
        if (!cancelled) setHunks(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[MCDiffPane] failed to load hunks:', err);
          addToast(`Failed to load diff: ${msg}`, 'error');
          setHunks([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [file, projectId, worktreePath, addToast]);

  if (file === null) {
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
        Select a file to view its diff
      </div>
    );
  }

  const hunkCount = hunks.length > 0 ? hunks.length : file.hunks.length;
  const signature = `${file.additions}-${file.deletions}`;
  const isApproved = isReviewedAndUnchanged(file.filePath, signature);

  const handleApprove = (): void => {
    reviewFile(file.filePath, signature);
  };

  const handleOpenInEditor = async (): Promise<void> => {
    if (window.nexusAPI?.shell === undefined) return;
    try {
      await window.nexusAPI.shell.showInFolder(file.filePath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[MCDiffPane] showInFolder failed:', err);
      addToast(`Failed to open in editor: ${msg}`, 'error');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
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
        <div
          style={{
            fontFamily:
              'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
            fontSize: 12,
            color: 'var(--v2-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 480,
          }}
          title={file.filePath}
        >
          {file.filePath}
        </div>
        <span
          style={{
            color: 'var(--v2-text-faint)',
            fontSize: 11,
            fontFamily:
              'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
          }}
        >
          · {hunkCount} hunk{hunkCount === 1 ? '' : 's'}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--v2-text-faint)' }}>by</span>
        {buildAuthorBadge()}
        <span style={{ fontSize: 11, color: 'var(--v2-text-dim)' }}>
          working tree
        </span>
        <button
          type="button"
          onClick={handleApprove}
          style={{
            ...ghostButtonStyle,
            color: isApproved ? '#0e1115' : 'var(--v2-green)',
            borderColor: 'var(--v2-green)',
            background: isApproved ? 'var(--v2-green)' : 'transparent',
          }}
        >
          <CheckIcon /> {isApproved ? 'Approved' : 'Approve'}
        </button>
        <button
          type="button"
          onClick={() => {
            void handleOpenInEditor();
          }}
          style={ghostButtonStyle}
        >
          Open in editor
        </button>
      </div>

      {/* Diff body */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          background: 'var(--v2-bg0)',
          minHeight: 0,
        }}
      >
        {loading && hunks.length === 0 && (
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
        {!loading && hunks.length === 0 && (
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
        {hunks.map((hunk, i) => (
          <DiffHunk key={`${hunk.header}-${i}`} hunk={hunk} filePath={file.filePath} />
        ))}
      </div>
    </div>
  );
};
