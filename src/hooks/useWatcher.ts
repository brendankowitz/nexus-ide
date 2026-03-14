import { useEffect, useRef } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useGit } from '@/hooks/useGit';
import type { GitChangeEvent } from '@/types';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Subscribes to file-system git change events for the active project via real
 * IPC. When a change is detected the git data is refreshed via `useGit`.
 *
 * The subscription is cleaned up on unmount to prevent listener leaks.
 */
export function useWatcher(): void {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProjectPath = useProjectStore((s) =>
    s.activeProjectId !== null
      ? (s.projects.find((p) => p.id === s.activeProjectId)?.path ?? null)
      : null
  );
  const { refresh } = useGit();

  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Tear down any previous subscription
    if (cleanupRef.current !== null) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (activeProjectId === null || activeProjectPath === null) return;

    function handleChange(event: GitChangeEvent): void {
      if (event.projectPath !== activeProjectPath) return;
      void refresh();
    }

    try {
      cleanupRef.current = window.nexusAPI.watcher.onGitChange(
        activeProjectId,
        handleChange,
      );
    } catch (err) {
      console.error('[useWatcher] failed to subscribe to git changes:', err);
    }

    return () => {
      if (cleanupRef.current !== null) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [activeProjectId, activeProjectPath, refresh]);
}
