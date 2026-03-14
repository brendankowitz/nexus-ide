/**
 * electron/ipc/watcher.ts
 *
 * File watcher + git status poller.
 *
 * Architecture:
 *   - @parcel/watcher subscription for working-tree changes (excludes .git,
 *     node_modules, bin, obj, .vs to prevent event storms on Windows).
 *   - A setInterval-based git status poller that diffs the current status
 *     against the previous snapshot and emits GitChangeEvents only on real changes.
 *   - @parcel/watcher triggers immediate polls when files change, giving faster
 *     feedback than waiting for the next scheduled poll interval.
 *   - If @parcel/watcher fails to initialize (e.g., permissions), the watcher
 *     falls back to polling-only mode automatically.
 *
 * Windows notes:
 *   - EPERM errors (antivirus/indexer locks) are caught and retried with
 *     exponential backoff before giving up.
 *   - Do NOT watch .git directories — ReadDirectoryChangesW can deadlock with
 *     ongoing git operations and cause event storms.
 */

import * as parcelWatcher from '@parcel/watcher';
import { getStatus } from './git.js';
import type { GitChangeEvent, GitStatus } from '../../src/types/index.js';

/* ─── Constants ────────────────────────────────────────────────────────────── */

const DEFAULT_POLL_INTERVAL_MS = 3_000;

/** Directories never watched on the filesystem. */
const WATCHER_IGNORE = ['.git', 'node_modules', 'bin', 'obj', '.vs', 'dist', 'out'] as const;

/** Path segments that indicate noise events — skip them. */
const NOISE_SEGMENTS = ['.git', 'node_modules', 'bin', 'obj', '.vs'] as const;

/** Max EPERM retries before a watcher is considered failed. */
const MAX_EPERM_RETRIES = 3;

/* ─── Internal state ───────────────────────────────────────────────────────── */

interface WatcherEntry {
  readonly projectId: string;
  readonly projectPath: string;
  pollTimer: ReturnType<typeof setInterval> | null;
  /** Unsubscribe callback from @parcel/watcher (null when in polling-only mode). */
  unsubscribe: (() => Promise<void>) | null;
  previousStatus: GitStatus | null;
  epermRetries: number;
  /** Whether we failed to start @parcel/watcher and fell back to polling. */
  pollingOnly: boolean;
}

const watchers = new Map<string, WatcherEntry>();
const changeListeners: Array<(projectId: string, event: GitChangeEvent) => void> = [];

/* ─── Helper: emit change ──────────────────────────────────────────────────── */

function emitGitChange(projectId: string, projectPath: string, type: GitChangeEvent['type']): void {
  const event: GitChangeEvent = {
    projectPath,
    type,
    timestamp: Date.now(),
  };
  for (const listener of changeListeners) {
    try {
      listener(projectId, event);
    } catch (err) {
      console.error('[watcher] listener error:', err);
    }
  }
}

/* ─── Helper: detect status change type ───────────────────────────────────── */

function detectChangeType(
  prev: GitStatus,
  next: GitStatus,
): GitChangeEvent['type'] | null {
  if (prev.branch !== next.branch) return 'head';
  if (prev.ahead !== next.ahead || prev.behind !== next.behind) return 'refs';
  if (prev.staged !== next.staged) return 'index';
  if (prev.unstaged !== next.unstaged || prev.untracked !== next.untracked) return 'worktree';
  return null;
}

/* ─── Helper: start poll timer ─────────────────────────────────────────────── */

function startPollTimer(entry: WatcherEntry, intervalMs: number): ReturnType<typeof setInterval> {
  return setInterval(async () => {
    try {
      const current = await getStatus(entry.projectPath);

      if (entry.previousStatus !== null) {
        const changeType = detectChangeType(entry.previousStatus, current);
        if (changeType !== null) {
          emitGitChange(entry.projectId, entry.projectPath, changeType);
        }
      }

      entry.previousStatus = current;
      entry.epermRetries = 0;
    } catch (err: unknown) {
      const isEperm =
        err instanceof Error && (err as NodeJS.ErrnoException).code === 'EPERM';

      if (isEperm) {
        entry.epermRetries += 1;
        console.warn(
          `[watcher] EPERM on ${entry.projectPath} (attempt ${entry.epermRetries}/${MAX_EPERM_RETRIES})`,
        );

        if (entry.epermRetries >= MAX_EPERM_RETRIES) {
          console.error(
            `[watcher] giving up on ${entry.projectPath} after ${MAX_EPERM_RETRIES} EPERM errors`,
          );
          stopWatching(entry.projectId);
        }
      } else {
        console.error('[watcher] poll error:', err);
      }
    }
  }, intervalMs);
}

/* ─── Helper: initialize @parcel/watcher subscription ─────────────────────── */

async function initParcelWatcher(
  entry: WatcherEntry,
  retryCount = 0,
): Promise<(() => Promise<void>) | null> {
  const normalizedPath = entry.projectPath.replace(/\\/g, '/');

  try {
    const subscription = await parcelWatcher.subscribe(
      normalizedPath,
      (err, events) => {
        if (err) {
          console.error(`[watcher] @parcel/watcher error for ${entry.projectId}:`, err);
          return;
        }

        // Filter out noise — only care about source file changes
        const relevant = events.filter(e =>
          !NOISE_SEGMENTS.some(seg => e.path.includes(seg)),
        );

        if (relevant.length > 0) {
          // Trigger an immediate git status poll for snappy UI feedback
          void triggerImmediatePoll(entry.projectId);
        }
      },
      {
        ignore: [...WATCHER_IGNORE],
      },
    );

    console.info(`[watcher] @parcel/watcher active for ${entry.projectPath}`);
    return () => subscription.unsubscribe();
  } catch (err: unknown) {
    const isEperm =
      err instanceof Error && (err as NodeJS.ErrnoException).code === 'EPERM';

    if (isEperm && retryCount < MAX_EPERM_RETRIES) {
      const backoffMs = 500 * Math.pow(2, retryCount);
      console.warn(
        `[watcher] EPERM initializing @parcel/watcher for ${entry.projectPath}, ` +
        `retry ${retryCount + 1}/${MAX_EPERM_RETRIES} in ${backoffMs}ms`,
      );
      await new Promise<void>(resolve => setTimeout(resolve, backoffMs));
      return initParcelWatcher(entry, retryCount + 1);
    }

    console.warn(
      `[watcher] @parcel/watcher failed for ${entry.projectPath}, falling back to polling-only:`,
      err,
    );
    return null;
  }
}

/* ─── Public API ───────────────────────────────────────────────────────────── */

/**
 * Start watching a project. Idempotent — calling again for the same projectId
 * is a no-op (stop first if you need to restart with new settings).
 *
 * @param projectId   Stable project identifier.
 * @param projectPath Absolute path to the project root.
 * @param pollIntervalMs Git status poll cadence in milliseconds (default 3 s).
 */
export function startWatching(
  projectId: string,
  projectPath: string,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
): void {
  if (watchers.has(projectId)) return;

  const entry: WatcherEntry = {
    projectId,
    projectPath,
    pollTimer: null,
    unsubscribe: null,
    previousStatus: null,
    epermRetries: 0,
    pollingOnly: false,
  };

  // Register the entry before the async watcher init so triggerImmediatePoll
  // can find it immediately.
  watchers.set(projectId, entry);

  // Start the poll timer first so we have coverage during watcher init.
  entry.pollTimer = startPollTimer(entry, pollIntervalMs);

  // Start @parcel/watcher asynchronously; fall back to polling-only on failure.
  void initParcelWatcher(entry).then(unsubscribeFn => {
    if (!watchers.has(projectId)) {
      // Watcher was stopped before initialization finished — clean up.
      if (unsubscribeFn) {
        unsubscribeFn().catch((err: unknown) => {
          console.error('[watcher] late unsubscribe error:', err);
        });
      }
      return;
    }

    if (unsubscribeFn) {
      entry.unsubscribe = unsubscribeFn;
    } else {
      entry.pollingOnly = true;
      console.info(`[watcher] ${projectPath} running in polling-only mode`);
    }
  });

  console.info(`[watcher] started watching ${projectPath} (id=${projectId})`);
}

/**
 * Stop watching a project and clean up all resources.
 */
export function stopWatching(projectId: string): void {
  const entry = watchers.get(projectId);
  if (!entry) return;

  if (entry.pollTimer !== null) {
    clearInterval(entry.pollTimer);
  }

  if (entry.unsubscribe !== null) {
    entry.unsubscribe().catch((err: unknown) => {
      console.error('[watcher] unsubscribe error:', err);
    });
  }

  watchers.delete(projectId);
  console.info(`[watcher] stopped watching project ${projectId}`);
}

/**
 * Register a callback invoked whenever a git state change is detected in any
 * watched project.
 *
 * @returns Unsubscribe function.
 */
export function onGitChange(
  callback: (projectId: string, event: GitChangeEvent) => void,
): () => void {
  changeListeners.push(callback);
  return () => {
    const idx = changeListeners.indexOf(callback);
    if (idx !== -1) changeListeners.splice(idx, 1);
  };
}

/**
 * Trigger an immediate git status poll for a project (e.g., after a
 * Nexus-initiated git operation). This keeps the UI snappy without waiting for
 * the next scheduled poll.
 */
export async function triggerImmediatePoll(projectId: string): Promise<void> {
  const entry = watchers.get(projectId);
  if (!entry) return;

  try {
    const current = await getStatus(entry.projectPath);
    if (entry.previousStatus !== null) {
      const changeType = detectChangeType(entry.previousStatus, current);
      if (changeType !== null) {
        emitGitChange(entry.projectId, entry.projectPath, changeType);
      }
    }
    entry.previousStatus = current;
  } catch (err) {
    console.error('[watcher] immediate poll error:', err);
  }
}

/**
 * List all currently watched project IDs.
 */
export function listWatched(): string[] {
  return Array.from(watchers.keys());
}
