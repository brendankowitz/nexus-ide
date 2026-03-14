/**
 * electron/preload.ts
 *
 * Typed contextBridge preload script.
 *
 * Exposes the full NexusAPI surface to the renderer process via
 * window.nexusAPI. No Node.js APIs are directly exposed — all communication
 * goes through ipcRenderer.invoke (request/response) or ipcRenderer.on
 * (pushed events from main).
 *
 * Security baseline:
 *   - contextIsolation: true  (renderer has no direct access to Node)
 *   - nodeIntegration: false
 *   - sandbox: true
 *
 * Event-based APIs (onData, onExit, onGitChange, onPipelineUpdate) return a
 * cleanup function. The renderer must call it to prevent listener leaks.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type {
  Branch,
  Commit,
  DiffFile,
  DiffHunk,
  DiscoveredRepo,
  GitChangeEvent,
  GitStatus,
  NexusAPI,
  NexusPlugin,
  Phase,
  PipelineConfig,
  PipelineRun,
  PipelineUpdate,
  PluginContext,
  PluginOutput,
  Project,
  TerminalOptions,
  TerminalSession,
  Worktree,
} from '../src/types/index.js';

/* ─── IPC channel constants (must match handlers.ts exactly) ───────────────── */

const CH = {
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
  GIT_DIFF: 'git:diff',
  GIT_DIFF_HUNKS: 'git:diff-hunks',
  GIT_LOG: 'git:log',
  GIT_STAGE: 'git:stage',
  GIT_UNSTAGE: 'git:unstage',
  GIT_STAGE_ALL: 'git:stage-all',
  GIT_COMMIT: 'git:commit',

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

  PLUGINS_LIST: 'plugins:list',
  PLUGINS_LOAD_USER: 'plugins:load-user',

  SHELL_DETECT: 'shell:detect',
  DIALOG_OPEN_DIR: 'dialog:open-dir',
  SHELL_SHOW_IN_FOLDER: 'shell:show-in-folder',
} as const;

/* ─── Push-event channel builders ──────────────────────────────────────────── */

/** Per-session data channel. Main pushes: ipcMain.webContents.send(channel, data). */
function terminalDataChannel(sessionId: string): string {
  return `terminal:data:${sessionId}`;
}

/** Per-session exit channel. Main pushes: ipcMain.webContents.send(channel, exitCode). */
function terminalExitChannel(sessionId: string): string {
  return `terminal:exit:${sessionId}`;
}

/** Per-project git-change channel. Main pushes GitChangeEvent. */
function gitChangeChannel(projectId: string): string {
  return `watcher:git-change:${projectId}`;
}

/** Per-run pipeline update channel. Main pushes PipelineUpdate. */
function pipelineUpdateChannel(runId: string): string {
  return `pipeline:update:${runId}`;
}

/* ─── NexusAPI implementation ──────────────────────────────────────────────── */

const nexusAPIImpl = {
  /* ── Projects ──────────────────────────────────────────────────────────── */

  projects: {
    list(): Promise<Project[]> {
      return ipcRenderer.invoke(CH.PROJECTS_LIST) as Promise<Project[]>;
    },
    add(path: string): Promise<Project> {
      return ipcRenderer.invoke(CH.PROJECTS_ADD, path) as Promise<Project>;
    },
    remove(id: string): Promise<void> {
      return ipcRenderer.invoke(CH.PROJECTS_REMOVE, id) as Promise<void>;
    },
    scan(directory: string): Promise<DiscoveredRepo[]> {
      return ipcRenderer.invoke(CH.PROJECTS_SCAN, directory) as Promise<DiscoveredRepo[]>;
    },
  },

  /* ── Git ───────────────────────────────────────────────────────────────── */

  git: {
    status(projectId: string): Promise<GitStatus> {
      return ipcRenderer.invoke(CH.GIT_STATUS, projectId) as Promise<GitStatus>;
    },
    branches(projectId: string): Promise<Branch[]> {
      return ipcRenderer.invoke(CH.GIT_BRANCHES, projectId) as Promise<Branch[]>;
    },
    worktrees(projectId: string): Promise<Worktree[]> {
      return ipcRenderer.invoke(CH.GIT_WORKTREES, projectId) as Promise<Worktree[]>;
    },
    createWorktree(projectId: string, branch: string, path?: string): Promise<Worktree> {
      return ipcRenderer.invoke(CH.GIT_WORKTREE_CREATE, projectId, branch, path) as Promise<Worktree>;
    },
    removeWorktree(projectId: string, path: string): Promise<void> {
      return ipcRenderer.invoke(CH.GIT_WORKTREE_REMOVE, projectId, path) as Promise<void>;
    },
    checkout(projectId: string, branch: string): Promise<void> {
      return ipcRenderer.invoke(CH.GIT_CHECKOUT, projectId, branch) as Promise<void>;
    },
    diff(projectId: string): Promise<DiffFile[]> {
      return ipcRenderer.invoke(CH.GIT_DIFF, projectId) as Promise<DiffFile[]>;
    },
    diffHunks(projectId: string, filePath: string): Promise<DiffHunk[]> {
      return ipcRenderer.invoke(CH.GIT_DIFF_HUNKS, projectId, filePath) as Promise<DiffHunk[]>;
    },
    log(projectId: string, count?: number): Promise<Commit[]> {
      return ipcRenderer.invoke(CH.GIT_LOG, projectId, count) as Promise<Commit[]>;
    },
    stage(projectId: string, filePath: string): Promise<void> {
      return ipcRenderer.invoke(CH.GIT_STAGE, projectId, filePath) as Promise<void>;
    },
    unstage(projectId: string, filePath: string): Promise<void> {
      return ipcRenderer.invoke(CH.GIT_UNSTAGE, projectId, filePath) as Promise<void>;
    },
    stageAll(projectId: string): Promise<void> {
      return ipcRenderer.invoke(CH.GIT_STAGE_ALL, projectId) as Promise<void>;
    },
    commit(projectId: string, message: string): Promise<string> {
      return ipcRenderer.invoke(CH.GIT_COMMIT, projectId, message) as Promise<string>;
    },
  },

  /* ── Settings ──────────────────────────────────────────────────────────── */

  settings: {
    get(): Promise<Record<string, unknown>> {
      return ipcRenderer.invoke(CH.SETTINGS_GET) as Promise<Record<string, unknown>>;
    },
    set(settings: Record<string, unknown>): Promise<void> {
      return ipcRenderer.invoke(CH.SETTINGS_SET, settings) as Promise<void>;
    },
  },

  /* ── Terminal ──────────────────────────────────────────────────────────── */

  terminal: {
    create(options: TerminalOptions): Promise<string> {
      return ipcRenderer.invoke(CH.TERMINAL_CREATE, options) as Promise<string>;
    },
    write(sessionId: string, data: string): void {
      void ipcRenderer.invoke(CH.TERMINAL_WRITE, sessionId, data);
    },
    resize(sessionId: string, cols: number, rows: number): void {
      void ipcRenderer.invoke(CH.TERMINAL_RESIZE, sessionId, cols, rows);
    },
    kill(sessionId: string): Promise<void> {
      return ipcRenderer.invoke(CH.TERMINAL_KILL, sessionId) as Promise<void>;
    },
    list(): Promise<TerminalSession[]> {
      return ipcRenderer.invoke(CH.TERMINAL_LIST) as Promise<TerminalSession[]>;
    },
    onData(sessionId: string, callback: (data: string) => void): () => void {
      const channel = terminalDataChannel(sessionId);
      const listener = (_event: Electron.IpcRendererEvent, data: string): void => {
        callback(data);
      };
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
    onExit(sessionId: string, callback: (code: number) => void): () => void {
      const channel = terminalExitChannel(sessionId);
      const listener = (_event: Electron.IpcRendererEvent, code: number): void => {
        callback(code);
      };
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
  },

  /* ── Pipeline ──────────────────────────────────────────────────────────── */

  pipeline: {
    create(projectId: string, config: PipelineConfig): Promise<PipelineRun> {
      return ipcRenderer.invoke(CH.PIPELINE_CREATE, projectId, config) as Promise<PipelineRun>;
    },
    start(runId: string, phase: Phase): Promise<void> {
      return ipcRenderer.invoke(CH.PIPELINE_START, runId, phase) as Promise<void>;
    },
    abort(runId: string): Promise<void> {
      return ipcRenderer.invoke(CH.PIPELINE_ABORT, runId) as Promise<void>;
    },
    list(projectId: string): Promise<PipelineRun[]> {
      return ipcRenderer.invoke(CH.PIPELINE_LIST, projectId) as Promise<PipelineRun[]>;
    },
    onUpdate(runId: string, callback: (update: PipelineUpdate) => void): () => void {
      const channel = pipelineUpdateChannel(runId);
      const listener = (_event: Electron.IpcRendererEvent, update: PipelineUpdate): void => {
        callback(update);
      };
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
  },

  /* ── Plugins ───────────────────────────────────────────────────────────── */

  plugins: {
    list(phase?: Phase): Promise<NexusPlugin[]> {
      return ipcRenderer.invoke(CH.PLUGINS_LIST, phase) as Promise<NexusPlugin[]>;
    },
    loadUserPlugins(directory: string): Promise<void> {
      return ipcRenderer.invoke(CH.PLUGINS_LOAD_USER, directory) as Promise<void>;
    },
  },

  /* ── Dialog ────────────────────────────────────────────────────────────── */

  dialog: {
    openDirectory(): Promise<string | null> {
      return ipcRenderer.invoke(CH.DIALOG_OPEN_DIR) as Promise<string | null>;
    },
  },

  /* ── Shell / Platform utilities ────────────────────────────────────────── */

  shell: {
    showInFolder(path: string): Promise<void> {
      return ipcRenderer.invoke(CH.SHELL_SHOW_IN_FOLDER, path) as Promise<void>;
    },
  },

  /* ── Watcher (push events only) ────────────────────────────────────────── */

  watcher: {
    /**
     * Subscribe to git state changes for a specific project.
     * Main pushes events via: win.webContents.send(gitChangeChannel(projectId), event)
     *
     * @returns Unsubscribe function — call on component unmount to prevent leaks.
     */
    onGitChange(
      projectId: string,
      callback: (event: GitChangeEvent) => void,
    ): () => void {
      const channel = gitChangeChannel(projectId);
      const listener = (_event: Electron.IpcRendererEvent, event: GitChangeEvent): void => {
        callback(event);
      };
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
  },

  /* ── Legacy flat surface (backwards compat with scaffold preload) ───────── */

  getProjects(): Promise<Project[]> {
    return ipcRenderer.invoke(CH.PROJECTS_LIST) as Promise<Project[]>;
  },
  openProject(path: string): Promise<void> {
    return ipcRenderer.invoke(CH.PROJECTS_ADD, path) as Promise<void>;
  },
  discoverRepos(root: string): Promise<readonly DiscoveredRepo[]> {
    return ipcRenderer.invoke(CH.PROJECTS_SCAN, root) as Promise<readonly DiscoveredRepo[]>;
  },
  gitStatus(projectPath: string): Promise<GitStatus | undefined> {
    return ipcRenderer.invoke(CH.GIT_STATUS, projectPath) as Promise<GitStatus | undefined>;
  },
  gitBranches(projectPath: string): Promise<readonly Branch[]> {
    return ipcRenderer.invoke(CH.GIT_BRANCHES, projectPath) as Promise<readonly Branch[]>;
  },
  gitCheckout(projectPath: string, branch: string): Promise<void> {
    return ipcRenderer.invoke(CH.GIT_CHECKOUT, projectPath, branch) as Promise<void>;
  },
  gitDiff(projectPath: string): Promise<readonly DiffFile[]> {
    return ipcRenderer.invoke(CH.GIT_DIFF, projectPath) as Promise<readonly DiffFile[]>;
  },
  gitLog(projectPath: string, maxCount?: number): Promise<readonly Commit[]> {
    return ipcRenderer.invoke(CH.GIT_LOG, projectPath, maxCount) as Promise<readonly Commit[]>;
  },
  gitStage(projectPath: string, filePath: string): Promise<void> {
    return ipcRenderer.invoke(CH.GIT_STAGE, projectPath, filePath) as Promise<void>;
  },
  gitUnstage(projectPath: string, filePath: string): Promise<void> {
    return ipcRenderer.invoke(CH.GIT_UNSTAGE, projectPath, filePath) as Promise<void>;
  },
  gitStageAll(projectPath: string): Promise<void> {
    return ipcRenderer.invoke(CH.GIT_STAGE_ALL, projectPath) as Promise<void>;
  },
  gitCommit(projectPath: string, message: string): Promise<string> {
    return ipcRenderer.invoke(CH.GIT_COMMIT, projectPath, message) as Promise<string>;
  },
  gitWorktrees(projectPath: string): Promise<readonly Worktree[]> {
    return ipcRenderer.invoke(CH.GIT_WORKTREES, projectPath) as Promise<readonly Worktree[]>;
  },
  onGitChange(projectId: string, callback: (event: GitChangeEvent) => void): () => void {
    // Legacy flat API: delegates to the per-project channel.
    // Prefer watcher.onGitChange(projectId, cb) for new code.
    const channel = gitChangeChannel(projectId);
    const listener = (_event: Electron.IpcRendererEvent, event: GitChangeEvent): void => {
      callback(event);
    };
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  terminalCreate(options: TerminalOptions): Promise<string> {
    return ipcRenderer.invoke(CH.TERMINAL_CREATE, options) as Promise<string>;
  },
  terminalWrite(sessionId: string, data: string): Promise<void> {
    return ipcRenderer.invoke(CH.TERMINAL_WRITE, sessionId, data) as Promise<void>;
  },
  terminalResize(sessionId: string, cols: number, rows: number): Promise<void> {
    return ipcRenderer.invoke(CH.TERMINAL_RESIZE, sessionId, cols, rows) as Promise<void>;
  },
  terminalDispose(sessionId: string): Promise<void> {
    return ipcRenderer.invoke(CH.TERMINAL_KILL, sessionId) as Promise<void>;
  },
  onTerminalData(sessionId: string, callback: (sessionId: string, data: string) => void): () => void {
    // Legacy: delegates to the per-session channel.
    // Prefer terminal.onData(sessionId, cb) for new code.
    const channel = terminalDataChannel(sessionId);
    const listener = (_event: Electron.IpcRendererEvent, data: string): void => {
      callback(sessionId, data);
    };
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  pipelineRun(projectPath: string, config: PipelineConfig): Promise<PipelineRun> {
    return ipcRenderer.invoke(CH.PIPELINE_CREATE, projectPath, config) as Promise<PipelineRun>;
  },
  pipelineCancel(runId: string): Promise<void> {
    return ipcRenderer.invoke(CH.PIPELINE_ABORT, runId) as Promise<void>;
  },
  onPipelineUpdate(callback: (update: PipelineUpdate) => void): () => void {
    // Listen for pipeline updates on any run channel
    const listener = (_event: Electron.IpcRendererEvent, update: PipelineUpdate): void => {
      callback(update);
    };
    // Use a wildcard-style approach: register on a broadcast channel
    const channel = 'pipeline:update:broadcast';
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  pluginList(): Promise<readonly NexusPlugin[]> {
    return ipcRenderer.invoke(CH.PLUGINS_LIST) as Promise<readonly NexusPlugin[]>;
  },
  pluginExecute(_pluginId: string, _context: PluginContext): Promise<PluginOutput | undefined> {
    // TODO: delegate to plugins:execute handler
    return Promise.resolve(undefined);
  },
  getDefaultShell(): Promise<string> {
    return ipcRenderer.invoke(CH.SHELL_DETECT) as Promise<string>;
  },
  getPlatform(): NodeJS.Platform {
    return process.platform;
  },
} satisfies NexusAPI;

/* ─── Expose ───────────────────────────────────────────────────────────────── */

contextBridge.exposeInMainWorld('nexusAPI', nexusAPIImpl);
