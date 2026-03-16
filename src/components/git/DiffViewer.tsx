import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { FullDiffPanel } from '@/components/git/FullDiffPanel';
import { DiffListView } from '@/components/git/DiffListView';
import { DiffTreeView } from '@/components/git/DiffTreeView';
import { DiffGroupsView } from '@/components/git/DiffGroupsView';
import type { DiffFile, DiffHunk as DiffHunkType, DiffViewMode } from '@/types';

// ── SVG Icons for View Mode Toggle ───────────────

const ListIcon = (): React.JSX.Element => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
    <line x1="1" y1="2.5" x2="11" y2="2.5" />
    <line x1="1" y1="6" x2="11" y2="6" />
    <line x1="1" y1="9.5" x2="11" y2="9.5" />
    <circle cx="2" cy="2.5" r="0.6" fill="currentColor" stroke="none" />
    <circle cx="2" cy="6" r="0.6" fill="currentColor" stroke="none" />
    <circle cx="2" cy="9.5" r="0.6" fill="currentColor" stroke="none" />
  </svg>
);

const TreeIcon = (): React.JSX.Element => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
    <line x1="2" y1="1.5" x2="2" y2="10.5" />
    <line x1="2" y1="3" x2="6" y2="3" />
    <line x1="2" y1="6" x2="6" y2="6" />
    <line x1="2" y1="9" x2="6" y2="9" />
    <line x1="6" y1="6" x2="6" y2="7.5" />
    <line x1="6" y1="7.5" x2="9" y2="7.5" />
    <rect x="6" y="1.5" width="4" height="2" rx="0.5" />
    <rect x="6" y="4.5" width="4" height="2" rx="0.5" />
    <rect x="9" y="7.5" width="2" height="2" rx="0.5" />
  </svg>
);

const GroupsIcon = (): React.JSX.Element => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="1" width="4.5" height="4.5" rx="1" />
    <rect x="6.5" y="1" width="4.5" height="4.5" rx="1" />
    <rect x="1" y="6.5" width="4.5" height="4.5" rx="1" />
    <rect x="6.5" y="6.5" width="4.5" height="4.5" rx="1" />
  </svg>
);

// ── Empty State ──────────────────────────────────

const DiffCleanState = (): React.JSX.Element => (
  <div className="flex h-full flex-col items-center justify-center gap-4 px-8">
    <div className="relative">
      <div
        className="absolute inset-0 rounded-2xl opacity-30 blur-2xl"
        style={{ background: 'var(--phase-execute)' }}
      />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-border-default bg-bg-surface">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-clean)]">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    </div>
    <div className="text-center">
      <p className="font-mono text-[13px] font-medium text-text-primary">Working tree clean</p>
      <p className="mt-1 text-[11px] text-text-tertiary">No uncommitted changes</p>
    </div>
  </div>
);

// ── Loading State ────────────────────────────────

const DiffLoading = (): React.JSX.Element => (
  <div className="flex h-full items-center justify-center">
    <div className="flex items-center gap-2.5">
      <div className="h-3 w-3 animate-spin rounded-full border border-text-ghost border-t-phase-execute" />
      <span className="font-mono text-[11px] text-text-tertiary">Loading changes...</span>
    </div>
  </div>
);

// ── View Mode Toggle ─────────────────────────────

interface ViewModeToggleProps {
  mode: DiffViewMode;
  onChange: (mode: DiffViewMode) => void;
}

const VIEW_MODES: { key: DiffViewMode; label: string; Icon: () => React.JSX.Element }[] = [
  { key: 'list', label: 'List details', Icon: ListIcon },
  { key: 'tree', label: 'Tree structure', Icon: TreeIcon },
  { key: 'groups', label: 'AI groups', Icon: GroupsIcon },
];

const ViewModeToggle = ({ mode, onChange }: ViewModeToggleProps): React.JSX.Element => (
  <div className="flex overflow-hidden rounded-[var(--radius-sm)] border border-border-default">
    {VIEW_MODES.map(({ key, label, Icon }) => (
      <button
        key={key}
        title={label}
        onClick={() => onChange(key)}
        className={`flex h-[22px] w-[26px] cursor-pointer items-center justify-center transition-colors duration-[var(--duration-fast)] ${
          mode === key
            ? 'bg-bg-active text-text-primary'
            : 'bg-transparent text-text-ghost hover:text-text-secondary'
        } ${key !== 'list' ? 'border-l border-border-default' : ''}`}
      >
        <Icon />
      </button>
    ))}
  </div>
);

// ── Main DiffViewer ──────────────────────────────

export const DiffViewer = (): React.JSX.Element => {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeWorktreePath = useProjectStore((s) => s.activeWorktreePath);
  const purgeStaleReviews = useUIStore((s) => s.purgeStaleReviews);
  const reviewedFiles = useUIStore((s) => s.reviewedFiles);

  const [diffFiles, setDiffFiles] = useState<DiffFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [fullDiffEntry, setFullDiffEntry] = useState<{ file: DiffFile; hunks: DiffHunkType[] } | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [commitError, setCommitError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<DiffViewMode>('list');
  const commitInputRef = useRef<HTMLInputElement>(null);

  const [hideReviewed, setHideReviewed] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [externalDiffCommand, setExternalDiffCommand] = useState('');

  const loadDiff = useCallback(async (): Promise<void> => {
    if (activeProjectId === null) return;
    if (!window.nexusAPI?.git) return;
    setLoading(true);
    try {
      const files = await window.nexusAPI.git.diff(activeProjectId, activeWorktreePath ?? undefined);
      setDiffFiles(files);
      purgeStaleReviews(files.map((f) => ({ filePath: f.filePath, signature: `${f.additions}-${f.deletions}` })));
    } catch (err) {
      console.error('[DiffViewer] failed to load diff:', err);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, activeWorktreePath, purgeStaleReviews]);

  useEffect(() => {
    void loadDiff();
  }, [loadDiff]);

  useEffect(() => {
    if (!window.nexusAPI?.settings) return;
    void window.nexusAPI.settings.get().then((data) => {
      const ed = data['externalDiff'] as Record<string, unknown> | undefined;
      if (typeof ed?.['command'] === 'string') setExternalDiffCommand(ed['command']);
    });
  }, []);

  useEffect(() => {
    if (isCommitting) {
      commitInputRef.current?.focus();
    }
  }, [isCommitting]);

  // Compute visible files (filtering out reviewed when hideReviewed is on)
  const visibleFiles = useMemo(() => {
    if (!hideReviewed) return diffFiles;
    return diffFiles.filter((f) => {
      const entry = reviewedFiles[f.filePath];
      return !entry || entry.signature !== `${f.additions}-${f.deletions}`;
    });
  }, [diffFiles, hideReviewed, reviewedFiles]);

  const handleToggleSelect = useCallback((filePath: string): void => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback((): void => {
    setSelectedFiles((prev) => {
      if (prev.size === visibleFiles.length && visibleFiles.length > 0) {
        return new Set();
      }
      return new Set(visibleFiles.map((f) => f.filePath));
    });
  }, [visibleFiles]);

  if (loading && diffFiles.length === 0) {
    return <DiffLoading />;
  }

  if (!loading && diffFiles.length === 0) {
    return <DiffCleanState />;
  }

  const totalFiles = diffFiles.length;
  const totalAdded = diffFiles.reduce((sum, f) => sum + f.additions, 0);
  const totalDeleted = diffFiles.reduce((sum, f) => sum + f.deletions, 0);

  const handleStageAll = async (): Promise<void> => {
    if (activeProjectId === null) return;
    if (!window.nexusAPI?.git) return;
    try {
      await window.nexusAPI.git.stageAll(activeProjectId, activeWorktreePath ?? undefined);
      await loadDiff();
    } catch (err) {
      console.error('[DiffViewer] stage all failed:', err);
    }
  };

  const handleCommitOpen = (): void => {
    setCommitMessage('');
    setCommitError(null);
    setIsCommitting(true);
  };

  const handleCommitCancel = (): void => {
    setIsCommitting(false);
    setCommitMessage('');
    setCommitError(null);
  };

  const handleCommitSubmit = async (): Promise<void> => {
    if (activeProjectId === null) return;
    if (!window.nexusAPI?.git) return;
    const msg = commitMessage.trim();
    if (!msg) {
      setCommitError('Commit message is required');
      return;
    }
    try {
      setCommitError(null);
      await window.nexusAPI.git.commit(activeProjectId, msg, activeWorktreePath ?? undefined);
      setIsCommitting(false);
      setCommitMessage('');
      await loadDiff();
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCommitKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      void handleCommitSubmit();
    } else if (e.key === 'Escape') {
      handleCommitCancel();
    }
  };

  const handleOpenFullDiff = (file: DiffFile, hunks: DiffHunkType[]): void => {
    setFullDiffEntry({ file, hunks });
  };

  const renderFileList = (): React.JSX.Element => {
    switch (viewMode) {
      case 'list':
        return (
          <DiffListView
            files={visibleFiles}
            activeProjectId={activeProjectId}
            onRefresh={loadDiff}
            onOpenFullDiff={handleOpenFullDiff}
            selectedFiles={selectedFiles}
            onToggleSelect={handleToggleSelect}
            externalDiffCommand={externalDiffCommand}
          />
        );
      case 'tree':
        return (
          <DiffTreeView
            files={visibleFiles}
            activeProjectId={activeProjectId}
            onRefresh={loadDiff}
            onOpenFullDiff={handleOpenFullDiff}
            selectedFiles={selectedFiles}
            onToggleSelect={handleToggleSelect}
            externalDiffCommand={externalDiffCommand}
          />
        );
      case 'groups':
        return (
          <DiffGroupsView
            files={visibleFiles}
            activeProjectId={activeProjectId}
            onRefresh={loadDiff}
            onOpenFullDiff={handleOpenFullDiff}
            selectedFiles={selectedFiles}
            onToggleSelect={handleToggleSelect}
            externalDiffCommand={externalDiffCommand}
          />
        );
    }
  };

  const allSelected = selectedFiles.size === visibleFiles.length && visibleFiles.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-border-subtle bg-bg-void">
        {/* Row 1: file summary + actions */}
        <div className="flex items-center gap-2 px-4 py-1.5">
          {/* Select all checkbox */}
          <button
            title={allSelected ? 'Deselect all' : 'Select all'}
            onClick={handleToggleSelectAll}
            className={`flex h-3.5 w-3.5 shrink-0 cursor-pointer items-center justify-center rounded-[2px] border text-[8px] transition-all duration-[var(--duration-fast)] ${
              allSelected
                ? 'border-phase-execute bg-phase-execute text-bg-void'
                : selectedFiles.size > 0
                  ? 'border-phase-execute bg-transparent text-phase-execute'
                  : 'border-border-default bg-transparent text-transparent hover:border-border-strong'
            }`}
          >
            {allSelected ? '\u2713' : selectedFiles.size > 0 ? '\u2012' : ''}
          </button>

          <div className="font-mono text-[10px] text-text-tertiary">
            <span>{totalFiles}f</span>{' '}
            <span className="text-[var(--color-added)]">+{totalAdded}</span>{' '}
            <span className="text-[var(--color-deleted)]">-{totalDeleted}</span>
          </div>

          <div className="ml-auto flex gap-1.5">
            <DiffButton label="stage all" onClick={handleStageAll} />
            {isCommitting ? (
              <DiffButton label="cancel" onClick={handleCommitCancel} />
            ) : (
              <DiffButton label="commit" primary onClick={handleCommitOpen} />
            )}
          </div>
        </div>

        {/* Row 2: view controls */}
        <div className="flex items-center gap-2 border-t border-border-subtle px-4 py-1">
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />

          <button
            title={hideReviewed ? 'Show reviewed files' : 'Hide reviewed files'}
            onClick={() => setHideReviewed((h) => !h)}
            className={`cursor-pointer rounded-[var(--radius-sm)] border px-1.5 py-0.5 font-mono text-[9px] transition-all duration-[var(--duration-fast)] ${
              hideReviewed
                ? 'border-[var(--color-clean)] bg-[var(--color-clean)] text-[var(--bg-void)]'
                : 'border-border-default bg-transparent text-text-ghost hover:border-border-strong hover:text-text-secondary'
            }`}
          >
            hide reviewed
          </button>
        </div>

        {/* Inline commit form */}
        {isCommitting && (
          <div className="flex flex-col gap-1.5 border-t border-border-subtle px-4 py-2">
            <div className="flex items-center gap-2">
              <input
                ref={commitInputRef}
                type="text"
                value={commitMessage}
                onChange={(e) => { setCommitMessage(e.target.value); setCommitError(null); }}
                onKeyDown={handleCommitKeyDown}
                placeholder="commit message..."
                className="flex-1 rounded-[var(--radius-sm)] border border-border-default bg-bg-surface px-2.5 py-[5px] font-mono text-[11px] text-text-primary placeholder:text-text-ghost outline-none focus:border-border-strong transition-colors duration-[var(--duration-fast)]"
              />
              <DiffButton label="commit" primary onClick={handleCommitSubmit} />
            </div>
            {commitError !== null && (
              <p className="font-mono text-[10px] text-sem-danger">{commitError}</p>
            )}
          </div>
        )}
      </div>

      {/* File list -- view mode dependent */}
      <div className="flex-1 overflow-auto">
        {renderFileList()}
      </div>

      {/* Full-panel diff overlay */}
      {fullDiffEntry !== null && (
        <FullDiffPanel
          file={fullDiffEntry.file}
          hunks={fullDiffEntry.hunks}
          activeProjectId={activeProjectId}
          onClose={() => setFullDiffEntry(null)}
        />
      )}
    </div>
  );
};

// ── DiffButton (shared) ──────────────────────────

interface DiffButtonProps {
  label: string;
  primary?: boolean;
  onClick: (() => void) | (() => Promise<void>);
}

const DiffButton = ({
  label,
  primary = false,
  onClick,
}: DiffButtonProps): React.JSX.Element => (
  <button
    onClick={() => { void (onClick as () => Promise<void> | void)(); }}
    className={`cursor-pointer rounded-[var(--radius-sm)] border px-2.5 py-1 font-mono text-[10px] font-medium transition-all duration-[var(--duration-fast)] ${
      primary
        ? 'border-phase-execute bg-phase-execute font-semibold text-[var(--bg-void)] hover:brightness-110'
        : 'border-border-strong bg-transparent text-text-secondary hover:bg-bg-active hover:text-text-primary'
    }`}
  >
    {label}
  </button>
);
