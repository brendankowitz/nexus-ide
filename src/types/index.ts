// ═══════════════════════════════════════════════════
// Nexus IDE — Core Type Definitions
// ═══════════════════════════════════════════════════

export type Phase = 'plan' | 'execute' | 'validate';

export type RunStatus =
  | 'draft'
  | 'planning'
  | 'executing'
  | 'validating'
  | 'complete'
  | 'failed'
  | 'aborted';

// ── Project ──────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  path: string;
  addedAt: string;
}

// ── Git ──────────────────────────────────────────

export interface Branch {
  name: string;
  isHead: boolean;
  upstream?: string;
  ahead: number;
  behind: number;
}

export interface Worktree {
  path: string;
  branch: string;
  isMainWorktree: boolean;
  isDirty: boolean;
}

export interface GitStatus {
  branch: string;
  changeCount: number;
  staged: number;
  unstaged: number;
  untracked: number;
  ahead: number;
  behind: number;
}

export interface DiffFile {
  filePath: string;
  status: 'M' | 'A' | 'D' | 'R';
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
  oldPath?: string;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'context' | 'added' | 'deleted';
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}

export interface Commit {
  hash: string;
  message: string;
  author: string;
  authorInitials: string;
  timestamp: string;
  timeAgo: string;
  additions: number;
  deletions: number;
  isAIGenerated: boolean;
  parents: string[];
  refs: string[];
}

// ── Pipeline ─────────────────────────────────────

export interface PipelineConfig {
  name: string;
  projectId: string;
  branch: string;
  worktreePath?: string;
  plan: { pluginId: string; config?: Record<string, unknown> };
  execute: { pluginId: string; config?: Record<string, unknown> };
  validate: {
    chain: Array<{
      pluginId: string;
      config?: Record<string, unknown>;
      continueOnFail?: boolean;
    }>;
    maxRetries?: number;
  };
}

export interface PhaseResult {
  status: 'pending' | 'running' | 'complete' | 'failed' | 'skipped';
  pluginId: string;
  startedAt?: string;
  completedAt?: string;
  output?: string;
  terminalSessionId?: string;
  artifacts?: string[];
  metrics?: {
    filesChanged?: number;
    additions?: number;
    deletions?: number;
    duration?: number;
    commits?: string[];
  };
}

export interface ValidateStepResult {
  pluginId: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  iteration?: number;
  maxIterations?: number;
  output?: string;
  terminalSessionId?: string;
}

export interface ValidateResult {
  status: 'pending' | 'running' | 'complete' | 'failed';
  steps: ValidateStepResult[];
}

export interface PipelineRun {
  id: string;
  config: PipelineConfig;
  status: RunStatus;
  createdAt: string;
  phases: {
    plan: PhaseResult | null;
    execute: PhaseResult | null;
    validate: ValidateResult | null;
  };
}

// ── Terminal ─────────────────────────────────────

export interface TerminalSession {
  id: string;
  projectId: string;
  projectName: string;
  agentType: string;
  label: string;
  status: 'running' | 'idle' | 'exited';
  worktreePath?: string;
  branch?: string;
  command?: string;
  startedAt: string;
}

// ── Command Palette ──────────────────────────────

export interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  group: 'projects' | 'commands' | 'branches';
  icon: 'project' | 'command' | 'branch';
}

// ── Project discovery ─────────────────────────────

export interface DiscoveredRepo {
  path: string;
  name: string;
  gitRemote?: string;
  defaultBranch?: string;
}

// ── File system events ────────────────────────────

export interface GitChangeEvent {
  projectPath: string;
  type: 'index' | 'worktree' | 'head' | 'refs';
  timestamp: number;
}

// ── Plugin system ─────────────────────────────────

export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  phases?: Phase[];
  entry: string;
}

export interface PluginContext {
  projectPath: string;
  branch: string;
  phase?: Phase;
  env: Record<string, string>;
}

export interface PluginOutput {
  success: boolean;
  data?: unknown;
  error?: string;
  logs: string[];
}

export interface NexusPluginConfigField {
  key: string;
  label: string;
  type: 'string' | 'select' | 'boolean' | 'number';
  default?: string | boolean | number;
  options?: string[];
}

export interface NexusPluginConfigSchema {
  fields: NexusPluginConfigField[];
}

export interface NexusPluginCapabilities {
  interactive: boolean;
  streaming: boolean;
  configurable: boolean;
}

/**
 * First-class plugin descriptor used by the Nexus plugin registry.
 * Richer than PluginDefinition — carries phase affinity, capability flags,
 * and an optional JSON-schema-like config descriptor.
 */
export interface NexusPlugin {
  id: string;
  name: string;
  description: string;
  phase: Phase;
  capabilities: NexusPluginCapabilities;
  configSchema?: NexusPluginConfigSchema;
}

// ── Terminal options ──────────────────────────────

export interface TerminalOptions {
  projectId: string;
  worktreePath?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  label?: string;
  cols?: number;
  rows?: number;
  cwd?: string;
  shell?: string;
}

// ── Pipeline updates ──────────────────────────────

export interface PipelineUpdate {
  runId: string;
  type: 'phase-start' | 'phase-end' | 'output' | 'error' | 'complete';
  phase?: Phase;
  data?: string;
  result?: PhaseResult;
  run?: PipelineRun;
}

// ── Top-level API surface ─────────────────────────

export interface NexusAPI {
  // Project management
  projects: {
    list(): Promise<Project[]>;
    add(path: string): Promise<Project>;
    remove(id: string): Promise<void>;
    scan(directory: string): Promise<DiscoveredRepo[]>;
  };

  // Git operations
  git: {
    branches(projectId: string): Promise<Branch[]>;
    worktrees(projectId: string): Promise<Worktree[]>;
    createWorktree(projectId: string, branch: string, path?: string): Promise<Worktree>;
    removeWorktree(projectId: string, path: string): Promise<void>;
    checkout(projectId: string, branch: string): Promise<void>;
    diff(projectId: string): Promise<DiffFile[]>;
    diffHunks(projectId: string, filePath: string): Promise<DiffHunk[]>;
    log(projectId: string, count?: number): Promise<Commit[]>;
    status(projectId: string): Promise<GitStatus>;
    stage(projectId: string, filePath: string): Promise<void>;
    unstage(projectId: string, filePath: string): Promise<void>;
    stageAll(projectId: string): Promise<void>;
    commit(projectId: string, message: string): Promise<string>;
  };

  // Settings persistence
  settings: {
    get(): Promise<Record<string, unknown>>;
    set(settings: Record<string, unknown>): Promise<void>;
  };

  // Terminal / CLI sessions
  terminal: {
    create(options: TerminalOptions): Promise<string>;
    write(sessionId: string, data: string): void;
    resize(sessionId: string, cols: number, rows: number): void;
    kill(sessionId: string): Promise<void>;
    list(): Promise<TerminalSession[]>;
    onData(sessionId: string, callback: (data: string) => void): () => void;
    onExit(sessionId: string, callback: (code: number) => void): () => void;
  };

  // Pipeline engine
  pipeline: {
    create(projectId: string, config: PipelineConfig): Promise<PipelineRun>;
    start(runId: string, phase: Phase): Promise<void>;
    abort(runId: string): Promise<void>;
    list(projectId: string): Promise<PipelineRun[]>;
    onUpdate(runId: string, callback: (update: PipelineUpdate) => void): () => void;
  };

  // Plugin system
  plugins: {
    list(phase?: Phase): Promise<NexusPlugin[]>;
    loadUserPlugins(directory: string): Promise<void>;
  };

  // Dialog operations
  dialog: {
    openDirectory(): Promise<string | null>;
  };

  // Shell / Platform utilities
  shell: {
    showInFolder(path: string): Promise<void>;
  };

  // File system events (pushed from main → renderer)
  watcher: {
    onGitChange(projectId: string, callback: (event: GitChangeEvent) => void): () => void;
  };

  // Legacy flat surface (backwards compat with scaffold preload)
  getProjects(): Promise<Project[]>;
  openProject(path: string): Promise<void>;
  discoverRepos(root: string): Promise<readonly DiscoveredRepo[]>;
  gitStatus(projectPath: string): Promise<GitStatus | undefined>;
  gitBranches(projectPath: string): Promise<readonly Branch[]>;
  gitCheckout(projectPath: string, branch: string): Promise<void>;
  gitDiff(projectPath: string): Promise<readonly DiffFile[]>;
  gitLog(projectPath: string, maxCount?: number): Promise<readonly Commit[]>;
  gitStage(projectPath: string, filePath: string): Promise<void>;
  gitUnstage(projectPath: string, filePath: string): Promise<void>;
  gitStageAll(projectPath: string): Promise<void>;
  gitCommit(projectPath: string, message: string): Promise<string>;
  gitWorktrees(projectPath: string): Promise<readonly Worktree[]>;
  onGitChange(projectId: string, callback: (event: GitChangeEvent) => void): () => void;
  terminalCreate(options: TerminalOptions): Promise<string>;
  terminalWrite(sessionId: string, data: string): Promise<void>;
  terminalResize(sessionId: string, cols: number, rows: number): Promise<void>;
  terminalDispose(sessionId: string): Promise<void>;
  onTerminalData(sessionId: string, callback: (sessionId: string, data: string) => void): () => void;
  pipelineRun(projectPath: string, config: PipelineConfig): Promise<PipelineRun>;
  pipelineCancel(runId: string): Promise<void>;
  onPipelineUpdate(callback: (update: PipelineUpdate) => void): () => void;
  pluginList(): Promise<readonly NexusPlugin[]>;
  pluginExecute(pluginId: string, context: PluginContext): Promise<PluginOutput | undefined>;
  getDefaultShell(): Promise<string>;
  getPlatform(): NodeJS.Platform;
}
