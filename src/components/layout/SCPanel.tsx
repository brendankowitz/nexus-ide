import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useProjectStore,
  selectActiveProject,
  selectActiveBranches,
  selectActiveWorktrees,
  selectActiveStatus,
} from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { MCReviewContextBar } from '@/components/git/MCReviewContextBar';
import { MCChangedFiles } from '@/components/git/MCChangedFiles';
import { MCDiffPane } from '@/components/git/MCDiffPane';
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

/**
 * SCPanel — Review mode shell. Mounts MCReview full-pane: context bar on top,
 * split content below (changed files | diff) or (commit log | summary). Commit
 * drilldown replaces the entire content area when active.
 */
export const SCPanel = (): React.JSX.Element => {
  const activeProject = useProjectStore(selectActiveProject);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const branches = useProjectStore(selectActiveBranches);
  const worktrees = useProjectStore(selectActiveWorktrees);
  const gitStatus = useProjectStore(selectActiveStatus);
  const activeWorktreePath = useProjectStore((s) => s.activeWorktreePath);

  const reviewTab = useUIStore((s) => s.reviewTab);

  // ── Changed files (working tree) ─────────────────
  const [changedFiles, setChangedFiles] = useState<DiffFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  const loadDiff = useCallback(async (): Promise<void> => {
    if (activeProjectId === null) return;
    if (window.nexusAPI?.git === undefined) return;
    setFilesLoading(true);
    try {
      const result = await window.nexusAPI.git.diff(
        activeProjectId,
        activeWorktreePath ?? undefined,
      );
      setChangedFiles(result);
      setActiveFileIndex((idx) => (idx >= result.length ? 0 : idx));
    } catch (err) {
      console.error('[SCPanel] failed to load diff:', err);
    } finally {
      setFilesLoading(false);
    }
  }, [activeProjectId, activeWorktreePath]);

  // Refresh whenever project / worktree / tab changes; also when gitStatus changes
  // (the global poller updates this), which gives us cheap reactive refresh.
  useEffect(() => {
    void loadDiff();
  }, [loadDiff, gitStatus?.changeCount, reviewTab]);

  // ── Commit log ───────────────────────────────────
  const [commits, setCommits] = useState<Commit[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [activeCommitIndex, setActiveCommitIndex] = useState(0);
  const [drilldownIndex, setDrilldownIndex] = useState<number | null>(null);

  const loadCommits = useCallback(async (): Promise<void> => {
    if (activeProjectId === null) return;
    if (window.nexusAPI?.git === undefined) return;
    setCommitsLoading(true);
    try {
      const result = await window.nexusAPI.git.log(
        activeProjectId,
        undefined,
        activeWorktreePath ?? undefined,
      );
      setCommits(result);
      setActiveCommitIndex((idx) => (idx >= result.length ? 0 : idx));
    } catch (err) {
      console.error('[SCPanel] failed to load commits:', err);
    } finally {
      setCommitsLoading(false);
    }
  }, [activeProjectId, activeWorktreePath]);

  useEffect(() => {
    void loadCommits();
  }, [loadCommits, gitStatus?.branch, reviewTab]);

  // Reset drilldown when project or worktree changes.
  useEffect(() => {
    setDrilldownIndex(null);
  }, [activeProjectId, activeWorktreePath]);

  // ── Derived display values ───────────────────────
  const currentBranchName = useMemo(() => {
    if (gitStatus !== null) return stripBranchRef(gitStatus.branch);
    const head = branches.find((b) => b.isHead);
    if (head !== undefined) return stripBranchRef(head.name);
    return branches[0]?.name !== undefined ? stripBranchRef(branches[0].name) : '—';
  }, [branches, gitStatus]);

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

  // ── Drilldown takeover ───────────────────────────
  if (drilldownIndex !== null) {
    const commit = commits[drilldownIndex];
    if (commit !== undefined) {
      return (
        <div
          className="h-full w-full"
          style={{ background: 'var(--v2-bg0)', display: 'flex', flexDirection: 'column', minHeight: 0 }}
        >
          <MCCommitDrilldown
            commit={commit}
            projectId={activeProjectId}
            onBack={() => setDrilldownIndex(null)}
          />
        </div>
      );
    }
  }

  const activeFile =
    changedFiles.length > 0
      ? (changedFiles[Math.min(activeFileIndex, changedFiles.length - 1)] ?? null)
      : null;

  const activeCommit =
    commits.length > 0
      ? (commits[Math.min(activeCommitIndex, commits.length - 1)] ?? null)
      : null;

  return (
    <div
      className="h-full w-full"
      style={{
        background: 'var(--v2-bg0)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <MCReviewContextBar
        changedFileCount={changedFiles.length}
        commitCount={commits.length}
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
              onSelect={setActiveFileIndex}
              branchName={currentBranchName}
              worktreeLabel={worktreeLabel}
              loading={filesLoading}
            />
            <MCDiffPane
              projectId={activeProjectId}
              worktreePath={activeWorktreePath}
              file={activeFile}
            />
          </>
        ) : (
          <>
            <MCCommitLog
              commits={commits}
              activeIndex={activeCommitIndex}
              onSelect={setActiveCommitIndex}
              onOpen={setDrilldownIndex}
              branchName={currentBranchName}
              loading={commitsLoading}
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
