/**
 * electron/ipc/handlers.ts
 *
 * Central IPC handler registration.
 *
 * Call registerIpcHandlers() once in the main process (after app is ready) to
 * wire all ipcMain.handle channels. Every handler:
 *   - Delegates to the appropriate module (git, terminal, watcher, store).
 *   - Wraps execution in try/catch and throws on error (serialized by Electron IPC).
 *   - Uses the consistent channel naming convention: 'domain:method'.
 *
 * Channel registry (for documentation and type-checking):
 *   projects:list          → getProjects()
 *   projects:add           → addProject(path)
 *   projects:remove        → removeProject(id)
 *   projects:scan          → scanDirectory(directory)
 *   git:status             → getStatus(projectPath)
 *   git:branches           → getBranches(projectPath)
 *   git:worktrees          → getWorktrees(projectPath)
 *   git:worktree-create    → createWorktree(projectPath, branch, targetPath?)
 *   git:worktree-remove    → removeWorktree(projectPath, worktreePath)
 *   git:checkout           → checkout(projectPath, branch)
 *   git:diff               → getDiff(projectPath)
 *   git:diff-hunks         → getDiffHunks(projectPath, filePath)
 *   git:log                → getLog(projectPath, count?)
 *   terminal:create        → createSession(options)
 *   terminal:write         → writeToSession(sessionId, data)
 *   terminal:resize        → resizeSession(sessionId, cols, rows)
 *   terminal:kill          → killSession(sessionId)
 *   terminal:list          → listSessions()
 *   pipeline:create        → createPipelineRun(projectId, config)
 *   pipeline:start         → startPhase(runId, phase)
 *   pipeline:abort         → abortPipelineRun(runId)
 *   pipeline:list          → listPipelineRuns(projectId)
 *   plugins:list           → listPlugins(phase?)
 *   plugins:load-user      → (stub — future)
 */

import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import {
  getStatus,
  getBranches,
  getRemoteBranches,
  getWorktrees,
  createWorktree,
  removeWorktree,
  checkout,
  createBranch,
  fetchRemote,
  pullBranch,
  pushBranch,
  renameBranch,
  setUpstream,
  unsetUpstream,
  checkoutRemoteBranch,
  getDiff,
  getDiffHunks,
  getCommitDiff,
  getCommitFileHunks,
  getLog,
  stageFile,
  unstageFile,
  stageAll,
  commit,
  getFileContent,
  revertFile,
  deleteFile,
  launchExternalDiff,
} from './git.js';

import {
  createSession,
  writeToSession,
  resizeSession,
  killSession,
  listSessions,
  detectDefaultShell,
  onSessionData,
  onSessionClaudeStatus,
  onSessionExit,
} from './terminal.js';

import {
  getProjects,
  addProject,
  removeProject,
  getProjectPath,
  store,
} from '../store.js';

import type { NexusStoreSchema, ExternalDiffConfig } from '../store.js';

import { startWatching, stopWatching, onGitChange } from './watcher.js';

import {
  createPipelineRun,
  listPipelineRuns,
  startPhase,
  abortPipelineRun,
  runValidateStep,
} from './pipeline.js';

import { listPlugins } from './plugins.js';

import type {
  Branch,
  Commit,
  DiffFile,
  DiffHunk,
  DiscoveredRepo,
  GitStatus,
  NexusPlugin,
  Phase,
  PipelineConfig,
  PipelineRun,
  Project,
  RemoteBranch,
  TerminalOptions,
  TerminalSession,
  Worktree,
} from '../../src/types/index.js';


/* ─── Channel name constants ───────────────────────────────────────────────── */

export const IPC_CHANNELS = {
  PROJECTS_LIST: 'projects:list',
  PROJECTS_ADD: 'projects:add',
  PROJECTS_REMOVE: 'projects:remove',
  PROJECTS_SCAN: 'projects:scan',

  GIT_STATUS: 'git:status',
  GIT_BRANCHES: 'git:branches',
  GIT_WORKTREES: 'git:worktrees',
  GIT_WORKTREE_CREATE: 'git:worktree-create',
  GIT_WORKTREE_REMOVE: 'git:worktree-remove',
  GIT_CHECKOUT: 'git:checkout',
  GIT_BRANCH_CREATE: 'git:branch-create',
  GIT_REMOTE_BRANCHES: 'git:remote-branches',
  GIT_FETCH: 'git:fetch',
  GIT_PULL: 'git:pull',
  GIT_PUSH: 'git:push',
  GIT_BRANCH_RENAME: 'git:branch-rename',
  GIT_BRANCH_SET_UPSTREAM: 'git:branch-set-upstream',
  GIT_BRANCH_UNSET_UPSTREAM: 'git:branch-unset-upstream',
  GIT_CHECKOUT_REMOTE: 'git:checkout-remote',
  GIT_DIFF: 'git:diff',
  GIT_DIFF_HUNKS: 'git:diff-hunks',
  GIT_COMMIT_DIFF: 'git:commit-diff',
  GIT_COMMIT_FILE_HUNKS: 'git:commit-file-hunks',
  GIT_LOG: 'git:log',
  GIT_STAGE: 'git:stage',
  GIT_UNSTAGE: 'git:unstage',
  GIT_STAGE_ALL: 'git:stage-all',
  GIT_COMMIT: 'git:commit',
  GIT_FILE_CONTENT: 'git:file-content',
  GIT_REVERT_FILE: 'git:revert-file',
  GIT_DELETE_FILE: 'git:delete-file',
  GIT_LAUNCH_EXTERNAL_DIFF: 'git:launch-external-diff',

  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_KILL: 'terminal:kill',
  TERMINAL_LIST: 'terminal:list',

  PIPELINE_CREATE: 'pipeline:create',
  PIPELINE_START: 'pipeline:start',
  PIPELINE_ABORT: 'pipeline:abort',
  PIPELINE_LIST: 'pipeline:list',
  PIPELINE_RUN_VALIDATE_STEP: 'pipeline:run-validate-step',

  PLUGINS_LIST: 'plugins:list',
  PLUGINS_LOAD_USER: 'plugins:load-user',

  SHELL_DETECT: 'shell:detect',
  DIALOG_OPEN_DIR: 'dialog:open-dir',
  SHELL_SHOW_IN_FOLDER: 'shell:show-in-folder',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/* ─── Structured error helper ──────────────────────────────────────────────── */

function throwIpcError(code: string, err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  throw new Error(`${code}: ${message}`);
}

/* ─── Directory scanner (projects:scan) ────────────────────────────────────── */

/**
 * Recursively scan a directory up to `depth` levels for .git subdirectories.
 * Returns discovered repos in sorted path order.
 */
async function scanDirectory(
  directory: string,
  depth = 3,
): Promise<DiscoveredRepo[]> {
  const results: DiscoveredRepo[] = [];

  async function walk(dir: string, remaining: number): Promise<void> {
    if (remaining <= 0) return;

    let entryNames: string[];
    try {
      entryNames = await fs.readdir(dir);
    } catch {
      return; // permission denied or path gone — skip silently
    }

    if (entryNames.includes('.git')) {
      // Verify it is actually a directory
      try {
        const stat = await fs.stat(join(dir, '.git'));
        if (stat.isDirectory()) {
          const normalized = dir.replace(/\\/g, '/');
          results.push({
            path: normalized,
            name: normalized.split('/').at(-1) ?? normalized,
          });
          return; // don't recurse into a repo — worktrees handled separately
        }
      } catch {
        // ignore stat errors
      }
    }

    const subdirs = entryNames.filter(
      name => name !== 'node_modules' && !name.startsWith('.'),
    );

    await Promise.all(
      subdirs.map(async name => {
        try {
          const stat = await fs.stat(join(dir, name));
          if (stat.isDirectory()) {
            await walk(join(dir, name), remaining - 1);
          }
        } catch {
          // skip unreadable entries
        }
      }),
    );
  }

  await walk(directory, depth);
  results.sort((a, b) => a.path.localeCompare(b.path));
  return results;
}

/* ─── Project path resolver ────────────────────────────────────────────────── */

/**
 * Resolve a projectId to its filesystem path, throwing if not found.
 * Always looks up in the project store first. Only treats the argument as a
 * raw path if no project matches AND the string contains a path separator
 * (legacy / direct-path callers). This prevents arbitrary filesystem access
 * via untrusted projectId strings.
 */
function resolveProjectPath(projectIdOrPath: string): string {
  // Always try the store first — this is the authoritative source.
  const storedPath = getProjectPath(projectIdOrPath);
  if (storedPath) return storedPath;

  // Legacy fallback: only accept if it looks like an absolute path and is
  // within a known project directory.
  if (projectIdOrPath.includes('/') || projectIdOrPath.includes('\\')) {
    const normalized = projectIdOrPath.replace(/\\/g, '/');
    // Verify the path is actually registered as a known project root.
    const knownProjects = getProjects();
    const isKnown = knownProjects.some(
      p => normalized === p.path || normalized.startsWith(p.path + '/'),
    );
    if (!isKnown) {
      throw new Error(`Path is not within a known project directory: ${normalized}`);
    }
    return normalized;
  }

  throw new Error(`Unknown project: ${projectIdOrPath}`);
}

/* ─── Registration ─────────────────────────────────────────────────────────── */

/**
 * Register all IPC handlers. Call once after `app.whenReady()`.
 * Safe to call multiple times — ipcMain.removeHandler is called first.
 */
export function registerIpcHandlers(): void {
  /* ── Projects ─────────────────────────────────────────────────────────── */

  ipcMain.handle(IPC_CHANNELS.PROJECTS_LIST, async (): Promise<Project[]> => {
    try {
      return getProjects();
    } catch (err) {
      throwIpcError('PROJECTS_LIST_FAILED', err);
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.PROJECTS_ADD,
    async (_event, path: string): Promise<Project> => {
      try {
        const project = addProject(path);
        startWatching(project.id, project.path);
        return project;
      } catch (err) {
        throwIpcError('PROJECT_ADD_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PROJECTS_REMOVE,
    async (_event, id: string): Promise<void> => {
      try {
        stopWatching(id);
        removeProject(id);
      } catch (err) {
        throwIpcError('PROJECT_REMOVE_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PROJECTS_SCAN,
    async (_event, directory: string): Promise<DiscoveredRepo[]> => {
      try {
        return await scanDirectory(directory);
      } catch (err) {
        throwIpcError('PROJECT_SCAN_FAILED', err);
      }
    },
  );

  /* ── Git ──────────────────────────────────────────────────────────────── */

  ipcMain.handle(
    IPC_CHANNELS.GIT_STATUS,
    async (_event, projectId: string, worktreePath?: string): Promise<GitStatus> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        return await getStatus(worktreePath ?? projectPath);
      } catch (err) {
        throwIpcError('GIT_STATUS_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_BRANCHES,
    async (_event, projectId: string, worktreePath?: string): Promise<Branch[]> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        return await getBranches(worktreePath ?? projectPath);
      } catch (err) {
        throwIpcError('GIT_BRANCHES_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_WORKTREES,
    async (_event, projectId: string): Promise<Worktree[]> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        return await getWorktrees(projectPath);
      } catch (err) {
        throwIpcError('GIT_WORKTREES_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_WORKTREE_CREATE,
    async (
      _event,
      projectId: string,
      branch: string,
      targetPath?: string,
    ): Promise<Worktree> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        return await createWorktree(projectPath, branch, targetPath);
      } catch (err) {
        throwIpcError('GIT_WORKTREE_CREATE_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_WORKTREE_REMOVE,
    async (
      _event,
      projectId: string,
      worktreePath: string,
    ): Promise<void> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        await removeWorktree(projectPath, worktreePath);
      } catch (err) {
        throwIpcError('GIT_WORKTREE_REMOVE_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_CHECKOUT,
    async (
      _event,
      projectId: string,
      branch: string,
    ): Promise<void> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        await checkout(projectPath, branch);
      } catch (err) {
        throwIpcError('GIT_CHECKOUT_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_BRANCH_CREATE,
    async (_event, projectId: string, branchName: string): Promise<void> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        await createBranch(projectPath, branchName);
      } catch (err) {
        throwIpcError('GIT_BRANCH_CREATE_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_REMOTE_BRANCHES,
    async (_event, projectId: string): Promise<RemoteBranch[]> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        return await getRemoteBranches(projectPath);
      } catch (err) {
        throwIpcError('GIT_REMOTE_BRANCHES_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_FETCH,
    async (_event, projectId: string, remote?: string, branch?: string): Promise<void> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        await fetchRemote(projectPath, remote, branch);
      } catch (err) {
        throwIpcError('GIT_FETCH_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_PULL,
    async (_event, projectId: string): Promise<void> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        await pullBranch(projectPath);
      } catch (err) {
        throwIpcError('GIT_PULL_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_PUSH,
    async (
      _event,
      projectId: string,
      branchName: string,
      force?: boolean,
      setUpstreamFlag?: boolean,
    ): Promise<void> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        await pushBranch(projectPath, branchName, { force, setUpstream: setUpstreamFlag });
      } catch (err) {
        throwIpcError('GIT_PUSH_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_BRANCH_RENAME,
    async (_event, projectId: string, oldName: string, newName: string): Promise<void> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        await renameBranch(projectPath, oldName, newName);
      } catch (err) {
        throwIpcError('GIT_BRANCH_RENAME_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_BRANCH_SET_UPSTREAM,
    async (_event, projectId: string, branchName: string, upstream: string): Promise<void> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        await setUpstream(projectPath, branchName, upstream);
      } catch (err) {
        throwIpcError('GIT_BRANCH_SET_UPSTREAM_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_BRANCH_UNSET_UPSTREAM,
    async (_event, projectId: string, branchName: string): Promise<void> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        await unsetUpstream(projectPath, branchName);
      } catch (err) {
        throwIpcError('GIT_BRANCH_UNSET_UPSTREAM_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_CHECKOUT_REMOTE,
    async (_event, projectId: string, remoteRef: string): Promise<void> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        await checkoutRemoteBranch(projectPath, remoteRef);
      } catch (err) {
        throwIpcError('GIT_CHECKOUT_REMOTE_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_DIFF,
    async (_event, projectId: string, worktreePath?: string): Promise<DiffFile[]> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        return await getDiff(worktreePath ?? projectPath);
      } catch (err) {
        throwIpcError('GIT_DIFF_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_DIFF_HUNKS,
    async (
      _event,
      projectId: string,
      filePath: string,
      worktreePath?: string,
    ): Promise<DiffHunk[]> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        return await getDiffHunks(worktreePath ?? projectPath, filePath);
      } catch (err) {
        throwIpcError('GIT_DIFF_HUNKS_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_COMMIT_DIFF,
    async (
      _event,
      projectId: string,
      commitHash: string,
    ): Promise<DiffFile[]> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        return await getCommitDiff(projectPath, commitHash);
      } catch (err) {
        throwIpcError('GIT_COMMIT_DIFF_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_COMMIT_FILE_HUNKS,
    async (
      _event,
      projectId: string,
      commitHash: string,
      filePath: string,
    ): Promise<DiffHunk[]> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        return await getCommitFileHunks(projectPath, commitHash, filePath);
      } catch (err) {
        throwIpcError('GIT_COMMIT_FILE_HUNKS_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_LOG,
    async (
      _event,
      projectId: string,
      count?: number,
      worktreePath?: string,
    ): Promise<Commit[]> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        return await getLog(worktreePath ?? projectPath, count);
      } catch (err) {
        throwIpcError('GIT_LOG_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_STAGE,
    async (_event, projectId: string, filePath: string, worktreePath?: string): Promise<void> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        await stageFile(worktreePath ?? projectPath, filePath);
      } catch (err) {
        throwIpcError('GIT_STAGE_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_UNSTAGE,
    async (_event, projectId: string, filePath: string, worktreePath?: string): Promise<void> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        await unstageFile(worktreePath ?? projectPath, filePath);
      } catch (err) {
        throwIpcError('GIT_UNSTAGE_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_REVERT_FILE,
    async (_event, projectId: string, filePath: string, worktreePath?: string): Promise<void> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        await revertFile(worktreePath ?? projectPath, filePath);
      } catch (err) {
        throwIpcError('GIT_REVERT_FILE_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_DELETE_FILE,
    async (_event, projectId: string, filePath: string, worktreePath?: string): Promise<void> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        await deleteFile(worktreePath ?? projectPath, filePath);
      } catch (err) {
        throwIpcError('GIT_DELETE_FILE_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_STAGE_ALL,
    async (_event, projectId: string, worktreePath?: string): Promise<void> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        await stageAll(worktreePath ?? projectPath);
      } catch (err) {
        throwIpcError('GIT_STAGE_ALL_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_COMMIT,
    async (_event, projectId: string, message: string, worktreePath?: string): Promise<string> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        return await commit(worktreePath ?? projectPath, message);
      } catch (err) {
        throwIpcError('GIT_COMMIT_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_FILE_CONTENT,
    async (
      _event,
      projectId: string,
      filePath: string,
    ): Promise<{ head: string | null; working: string }> => {
      try {
        const projectPath = resolveProjectPath(projectId);
        return await getFileContent(projectPath, filePath);
      } catch (err) {
        throwIpcError('GIT_FILE_CONTENT_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.GIT_LAUNCH_EXTERNAL_DIFF,
    async (
      _event,
      projectId: string,
      filePath: string,
      fileStatus: 'M' | 'A' | 'D' | 'R',
      worktreePath?: string,
    ): Promise<void> => {
      try {
        const command = (store.get('externalDiff') as ExternalDiffConfig).command;
        if (!command.trim()) {
          throw new Error('No external diff tool configured');
        }
        const projectPath = resolveProjectPath(projectId);
        await launchExternalDiff(worktreePath ?? projectPath, filePath, fileStatus, command);
      } catch (err) {
        throwIpcError('GIT_LAUNCH_EXTERNAL_DIFF_FAILED', err);
      }
    },
  );

  /* ── Settings ─────────────────────────────────────────────────────────── */

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_GET,
    async (): Promise<NexusStoreSchema> => {
      try {
        const keys: Array<keyof NexusStoreSchema> = [
          'editor', 'theme', 'terminal', 'git', 'pipeline', 'agents', 'projects', 'projectGroups', 'resolvedShell', 'externalDiff',
        ];
        const result = {} as Record<string, unknown>;
        for (const key of keys) {
          result[key] = store.get(key);
        }
        return result as unknown as NexusStoreSchema;
      } catch (err) {
        throwIpcError('SETTINGS_GET_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SET,
    async (_event, settings: Partial<NexusStoreSchema>): Promise<void> => {
      try {
        for (const key of Object.keys(settings) as Array<keyof NexusStoreSchema>) {
          const value = settings[key];
          if (value !== undefined) {
            store.set(key, value as NexusStoreSchema[typeof key]);
          }
        }
      } catch (err) {
        throwIpcError('SETTINGS_SET_FAILED', err);
      }
    },
  );

  /* ── Terminal ─────────────────────────────────────────────────────────── */

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_CREATE,
    async (_event, options: TerminalOptions): Promise<string> => {
      try {
        const sessionId = createSession(options);
        onSessionData(sessionId, (data) => {
          const windows = BrowserWindow.getAllWindows();
          for (const win of windows) {
            win.webContents.send(`terminal:data:${sessionId}`, data);
          }
        });
        onSessionClaudeStatus(sessionId, (status) => {
          const windows = BrowserWindow.getAllWindows();
          for (const win of windows) {
            win.webContents.send(`terminal:claude-status:${sessionId}`, status);
          }
        });
        onSessionExit(sessionId, () => {
          const windows = BrowserWindow.getAllWindows();
          for (const win of windows) {
            win.webContents.send(`terminal:exit:${sessionId}`);
          }
        });
        return sessionId;
      } catch (err) {
        throwIpcError('TERMINAL_CREATE_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_WRITE,
    async (_event, sessionId: string, data: string): Promise<void> => {
      try {
        writeToSession(sessionId, data);
      } catch (err) {
        throwIpcError('TERMINAL_WRITE_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_RESIZE,
    async (_event, sessionId: string, cols: number, rows: number): Promise<void> => {
      try {
        resizeSession(sessionId, cols, rows);
      } catch (err) {
        throwIpcError('TERMINAL_RESIZE_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_KILL,
    async (_event, sessionId: string): Promise<void> => {
      try {
        await killSession(sessionId);
      } catch (err) {
        throwIpcError('TERMINAL_KILL_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_LIST,
    async (): Promise<TerminalSession[]> => {
      return listSessions();
    },
  );

  /* ── Pipeline ─────────────────────────────────────────────────────────── */

  ipcMain.handle(
    IPC_CHANNELS.PIPELINE_CREATE,
    async (
      _event,
      projectId: string,
      config: PipelineConfig,
    ): Promise<PipelineRun> => {
      try {
        return createPipelineRun(projectId, config);
      } catch (err) {
        throwIpcError('PIPELINE_CREATE_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PIPELINE_START,
    async (_event, runId: string, phase: Phase): Promise<void> => {
      try {
        await startPhase(runId, phase);
      } catch (err) {
        throwIpcError('PIPELINE_START_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PIPELINE_ABORT,
    async (_event, runId: string): Promise<void> => {
      try {
        abortPipelineRun(runId);
      } catch (err) {
        throwIpcError('PIPELINE_ABORT_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PIPELINE_LIST,
    async (_event, projectId: string): Promise<PipelineRun[]> => {
      try {
        return listPipelineRuns(projectId);
      } catch (err) {
        throwIpcError('PIPELINE_LIST_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PIPELINE_RUN_VALIDATE_STEP,
    async (_event, runId: string, stepIndex: number): Promise<void> => {
      try {
        await runValidateStep(runId, stepIndex);
      } catch (err) {
        throwIpcError('PIPELINE_RUN_VALIDATE_STEP_FAILED', err);
      }
    },
  );

  /* ── Plugins ───────────────────────────────────────────────────────────── */

  ipcMain.handle(
    IPC_CHANNELS.PLUGINS_LIST,
    async (_event, phase?: Phase): Promise<NexusPlugin[]> => {
      try {
        return listPlugins(phase);
      } catch (err) {
        throwIpcError('PLUGINS_LIST_FAILED', err);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PLUGINS_LOAD_USER,
    async (_event, _directory: string): Promise<void> => {
      // User-defined plugin loading is future work
      throw new Error('NOT_IMPLEMENTED: Plugin loader not yet implemented');
    },
  );

  /* ── Shell / Platform utilities ───────────────────────────────────────── */

  ipcMain.handle(IPC_CHANNELS.SHELL_DETECT, async (): Promise<string> => {
    return detectDefaultShell();
  });

  ipcMain.handle(
    IPC_CHANNELS.DIALOG_OPEN_DIR,
    async (): Promise<string | null> => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select project directory',
      });
      return result.canceled || result.filePaths.length === 0
        ? null
        : result.filePaths[0]!.replace(/\\/g, '/');
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.SHELL_SHOW_IN_FOLDER,
    async (_event, path: string): Promise<void> => {
      shell.showItemInFolder(path.replace(/\//g, '\\'));
    },
  );

  /* ── Watcher → renderer push ──────────────────────────────────────────── */

  onGitChange((projectId, event) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send(`watcher:git-change:${projectId}`, event);
    }
  });
}

/**
 * Remove all registered handlers (useful for testing / hot-reload).
 */
export function unregisterIpcHandlers(): void {
  for (const channel of Object.values(IPC_CHANNELS)) {
    ipcMain.removeHandler(channel);
  }
}
