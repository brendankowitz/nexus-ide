import { useEffect, useRef, useState, useCallback } from 'react';
import { useProjectStore, getProjectState } from '@/stores/projectStore';
import { useToastStore } from '@/stores/toastStore';
import type { Branch, Worktree, GitStatus, DiffFile } from '@/types';

const POLL_INTERVAL_MS = 3000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseGitReturn {
  loading: boolean;
  error: Error | null;
  diffFiles: DiffFile[];
  refresh: () => Promise<void>;
}

export function useGit(): UseGitReturn {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const { setBranches, setWorktrees, updateGitStatus } = useProjectStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [diffFiles, setDiffFiles] = useState<DiffFile[]>([]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  // Track the last error message shown so we don't toast on every poll cycle
  const lastErrorRef = useRef<string | null>(null);

  const fetchAll = useCallback(async (): Promise<void> => {
    if (!window.nexusAPI?.git) return; // No preload bridge
    const projectId = getProjectState().activeProjectId;
    if (projectId === null) return;

    console.log('[useGit] fetchAll for project:', projectId);

    setLoading(true);
    setError(null);

    try {
      const [branches, worktrees, status, diffs] = await Promise.all([
        window.nexusAPI.git.branches(projectId),
        window.nexusAPI.git.worktrees(projectId),
        window.nexusAPI.git.status(projectId),
        window.nexusAPI.git.diff(projectId),
      ]);

      if (!mountedRef.current) return;

      setBranches(projectId, branches);
      setWorktrees(projectId, worktrees);
      updateGitStatus(projectId, status);
      setDiffFiles(diffs);
      // Clear the error dedup ref on success
      lastErrorRef.current = null;
    } catch (err) {
      if (!mountedRef.current) return;
      // On error, keep previous state -- only log and surface the error
      const caught = err instanceof Error ? err : new Error(String(err));
      setError(caught);
      console.error('[useGit] fetch failed:', caught);
      // Only toast on the first occurrence of each unique error message
      if (caught.message !== lastErrorRef.current) {
        lastErrorRef.current = caught.message;
        useToastStore.getState().addToast(`Git: ${caught.message}`, 'error');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [setBranches, setWorktrees, updateGitStatus]);

  // Run on mount and whenever the active project changes
  useEffect(() => {
    mountedRef.current = true;

    console.log('[useGit] activeProjectId changed to:', activeProjectId);

    if (activeProjectId === null) return;

    void fetchAll();

    // Clear any existing poll
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      void fetchAll();
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeProjectId, fetchAll]);

  return { loading, error, diffFiles, refresh: fetchAll };
}
