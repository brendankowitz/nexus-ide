import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useProjectStore,
  selectActiveProject,
  selectActiveBranches,
  selectActiveWorktrees,
  selectActiveStatus,
} from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { useToastStore } from '@/stores/toastStore';
import { MCReviewContextBar } from '@/components/git/MCReviewContextBar';
import { MCChangedFiles } from '@/components/git/MCChangedFiles';
import { MCDiffPane } from '@/components/git/MCDiffPane';
import { MCQuickEditor } from '@/components/git/MCQuickEditor';
import { MCCommitLog } from '@/components/git/MCCommitLog';
import { MCCommitSummary } from '@/components/git/MCCommitSummary';
import { MCCommitDrilldown } from '@/components/git/MCCommitDrilldown';
import type { Commit, DiffFile } from '@/types';

function stripBranchRef(ref: string): string {
  return ref.replace(/^refs\/heads\//, '');
}

function worktreeBasename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] ?? path;
}

export const SCPanel = (): React.JSX.Element => {
  const activeProject = useProjectStore(selectActiveProject);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const branches = useProjectStore(selectActiveBranches);
  const worktrees = useProjectStore(selectActiveWorktrees);
  const gitStatus = useProjectStore(selectActiveStatus);
  const activeWorktreePath = useProjectStore((s) => s.activeWorktreePath);

  const reviewTab = useUIStore((s) => s.reviewTab);
  const reviewFile = useUIStore((s) => s.reviewFile);
  const skipFile = useUIStore((s) => s.skipFile);
  const requestChangesForFile = useUIStore((s) => s.requestChangesForFile);
  const getFileReviewState = useUIStore((s) => s.getFileReviewState);

  // ── Derived display values ───────────────────────────────────────────────────
  const currentBranchName = useMemo(() => {
    if (gitStatus !== null) return stripBranchRef(gitStatus.branch);
    const head = branches.find((b) => b.isHead);
    if (head !== undefined) return stripBranchRef(head.name);
    return branches[0]?.name !== undefined ? stripBranchRef(branches[0].name) : '—';
  }, [branches, gitStatus]);

  const [selectedBranch, setSelectedBranch] = useState(currentBranchName);
  useEffect(() => { setSelectedBranch(currentBranchName); }, [currentBranchName]);

  // ── Changed files ────────────────────────────────────────────────────────────
  const [changedFiles, setChangedFiles] = useState<DiffFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [editingFilePath, setEditingFilePath] = useState<string | null>(null);

  const loadDiff = useCallback(async (): Promise<void> => {
    if (activeProjectId === null) return;
    if (window.nexusAPI?.git === undefined) return;
    setFilesLoading(true);
    setDiffError(null);
    try {
      const result = await window.nexusAPI.git.diff(activeProjectId, activeWorktreePath ?? undefined);
      setChangedFiles(result);
      setActiveFileIndex((idx) => (idx >= result.length ? 0 : idx));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[SCPanel] failed to load diff:', err);
      setDiffError(msg);
      useToastStore.getState().addToast(`Failed to load diff: ${msg}`, 'error');
    } finally {
      setFilesLoading(false);
    }
  }, [activeProjectId, activeWorktreePath]);

  useEffect(() => { void loadDiff(); }, [loadDiff, gitStatus?.changeCount, reviewTab]);

  // ── Commit log ───────────────────────────────────────────────────────────────
  const [commits, setCommits] = useState<Commit[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [commitsError, setCommitsError] = useState<string | null>(null);
  const [activeCommitIndex, setActiveCommitIndex] = useState(0);
  const [drilldownIndex, setDrilldownIndex] = useState<number | null>(null);

  const loadCommits = useCallback(async (): Promise<void> => {
    if (activeProjectId === null) return;
    if (window.nexusAPI?.git === undefined) return;
    setCommitsLoading(true);
    setCommitsError(null);
    try {
      const result = await window.nexusAPI.git.log(
        activeProjectId, undefined, activeWorktreePath ?? undefined, selectedBranch || undefined,
      );
      setCommits(result);
      setActiveCommitIndex((idx) => (idx >= result.length ? 0 : idx));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[SCPanel] failed to load commits:', err);
      setCommitsError(msg);
      useToastStore.getState().addToast(`Failed to load commits: ${msg}`, 'error');
    } finally {
      setCommitsLoading(false);
    }
  }, [activeProjectId, activeWorktreePath, selectedBranch]);

  useEffect(() => { void loadCommits(); }, [loadCommits, reviewTab]);

  useEffect(() => { setDrilldownIndex(null); }, [activeProjectId, activeWorktreePath, reviewTab]);

  // Reset editing when file selection changes
  useEffect(() => { setEditingFilePath(null); }, [activeFileIndex, activeProjectId, activeWorktreePath]);

  const activeWorktree = useMemo(() => {
    if (activeWorktreePath !== null) {
      const wt = worktrees.find((w) => w.path === activeWorktreePath);
      if (wt !== undefined) return wt;
    }
    return worktrees.find((w) => w.isMainWorktree) ?? worktrees[0] ?? null;
  }, [worktrees, activeWorktreePath]);

  const worktreeLabel =
    activeWorktree !== null
      ? worktreeBasename(activeWorktree.path)
      : activeProject !== null
        ? worktreeBasename(activeProject.path)
        : '—';

  const basePath = activeWorktreePath ?? activeProject?.path ?? null;

  // ── Review file actions ──────────────────────────────────────────────────────
  const activeFile =
    changedFiles.length > 0
      ? (changedFiles[Math.min(activeFileIndex, changedFiles.length - 1)] ?? null)
      : null;

  const activeFileSig = activeFile !== null
    ? `${activeFile.additions}-${activeFile.deletions}`
    : '';

  const currentReviewState = activeFile !== null
    ? getFileReviewState(activeFile.filePath, activeFileSig)
    : 'unreviewed';

  const handleApproveAndNext = (): void => {
    if (activeFile === null) return;
    reviewFile(activeFile.filePath, activeFileSig);
    setActiveFileIndex((i) => (i < changedFiles.length - 1 ? i + 1 : i));
  };

  const handleSkip = (): void => {
    if (activeFile === null) return;
    skipFile(activeFile.filePath, activeFileSig);
    setActiveFileIndex((i) => (i < changedFiles.length - 1 ? i + 1 : i));
  };

  const handleRequestChanges = (): void => {
    if (activeFile === null) return;
    requestChangesForFile(activeFile.filePath, activeFileSig);
  };

  const handleNextUnreviewed = (): void => {
    const reviewedFiles = useUIStore.getState().reviewedFiles;
    const total = changedFiles.length;
    for (let offset = 1; offset <= total; offset++) {
      const i = (activeFileIndex + offset) % total;
      const f = changedFiles[i];
      if (f === undefined) continue;
      const sig = `${f.additions}-${f.deletions}`;
      const entry = reviewedFiles[f.filePath];
      if (entry === undefined || entry.signature !== sig) {
        setActiveFileIndex(i);
        return;
      }
    }
  };

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    if (reviewTab !== 'changes') return;
    const handler = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'j' || e.key === 'J') {
        setActiveFileIndex((i) => (i < changedFiles.length - 1 ? i + 1 : 0));
      } else if (e.key === 'k' || e.key === 'K') {
        setActiveFileIndex((i) => (i > 0 ? i - 1 : changedFiles.length - 1));
      } else if (e.key === 'a' || e.key === 'A') {
        handleApproveAndNext();
      } else if (e.key === 'r' || e.key === 'R') {
        handleRequestChanges();
      } else if (e.key === 's' || e.key === 'S') {
        handleSkip();
      } else if (e.key === 'n' || e.key === 'N') {
        handleNextUnreviewed();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewTab, changedFiles, activeFileIndex, activeFile, activeFileSig]);

  // ── Drilldown takeover ───────────────────────────────────────────────────────
  if (drilldownIndex !== null) {
    const commit = commits[drilldownIndex];
    if (commit !== undefined) {
      return (
        <div className="h-full w-full" style={{ background: 'var(--v2-bg0)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <MCCommitDrilldown commit={commit} projectId={activeProjectId} onBack={() => setDrilldownIndex(null)} />
        </div>
      );
    }
  }

  const activeCommit =
    commits.length > 0
      ? (commits[Math.min(activeCommitIndex, commits.length - 1)] ?? null)
      : null;

  return (
    <div
      className="h-full w-full"
      style={{ background: 'var(--v2-bg0)', display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <MCReviewContextBar
        changedFileCount={changedFiles.length}
        commitCount={commits.length}
        selectedBranch={selectedBranch}
        onBranchSelect={setSelectedBranch}
      />

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: reviewTab === 'changes' ? '280px 1fr' : '400px 1fr',
          minHeight: 0,
        }}
      >
        {reviewTab === 'changes' ? (
          <>
            <MCChangedFiles
              files={changedFiles}
              activeIndex={activeFileIndex}
              onSelect={(i) => { setActiveFileIndex(i); setEditingFilePath(null); }}
              onPrev={() => { setActiveFileIndex((i) => (i > 0 ? i - 1 : changedFiles.length - 1)); setEditingFilePath(null); }}
              onNext={() => { setActiveFileIndex((i) => (i < changedFiles.length - 1 ? i + 1 : 0)); setEditingFilePath(null); }}
              onNextUnreviewed={handleNextUnreviewed}
              branchName={selectedBranch}
              worktreeLabel={worktreeLabel}
              loading={filesLoading}
              error={diffError}
            />
            {editingFilePath !== null && activeFile !== null && activeFile.filePath === editingFilePath ? (
              <MCQuickEditor
                projectId={activeProjectId}
                basePath={basePath}
                file={activeFile}
                onBack={() => setEditingFilePath(null)}
              />
            ) : (
              <MCDiffPane
                projectId={activeProjectId}
                worktreePath={activeWorktreePath}
                file={activeFile}
                activeIndex={activeFileIndex}
                totalFiles={changedFiles.length}
                reviewState={currentReviewState}
                onPrev={() => setActiveFileIndex((i) => (i > 0 ? i - 1 : changedFiles.length - 1))}
                onNext={() => setActiveFileIndex((i) => (i < changedFiles.length - 1 ? i + 1 : 0))}
                onSkip={handleSkip}
                onRequestChanges={handleRequestChanges}
                onApproveAndNext={handleApproveAndNext}
                onEdit={() => { if (activeFile !== null) setEditingFilePath(activeFile.filePath); }}
              />
            )}
          </>
        ) : (
          <>
            <MCCommitLog
              commits={commits}
              activeIndex={activeCommitIndex}
              onSelect={setActiveCommitIndex}
              onOpen={setDrilldownIndex}
              branchName={selectedBranch}
              loading={commitsLoading}
              error={commitsError}
            />
            <MCCommitSummary
              commit={activeCommit}
              projectId={activeProjectId}
              onOpen={() => setDrilldownIndex(activeCommitIndex)}
            />
          </>
        )}
      </div>
    </div>
  );
};
