/**
 * Mock data for development and testing only.
 * These are NOT used in production -- all data comes from IPC.
 * Keep for reference and potential offline/demo mode.
 */

import type {
  Project,
  Branch,
  Worktree,
  GitStatus,
  DiffFile,
  Commit,
  PipelineRun,
  TerminalSession,
  PaletteItem,
} from '@/types';

// ── Projects ─────────────────────────────────────

export const mockProjects: Project[] = [
  { id: 'proj-1', name: 'ignixa-fhir', path: 'E:/data/src/ignixa-fhir', addedAt: '2025-12-01T00:00:00Z' },
  { id: 'proj-2', name: 'roslyn-mcp-server', path: 'E:/data/src/roslyn-mcp-server', addedAt: '2025-12-05T00:00:00Z' },
  { id: 'proj-3', name: 'food-app-api', path: 'E:/data/src/food-app-api', addedAt: '2025-12-10T00:00:00Z' },
  { id: 'proj-4', name: 'soccer-analytics', path: 'E:/data/src/soccer-analytics', addedAt: '2026-01-01T00:00:00Z' },
  { id: 'proj-5', name: 'claude-plugins', path: 'E:/data/src/claude-plugins', addedAt: '2026-01-15T00:00:00Z' },
  { id: 'proj-6', name: 'nexus-ide', path: 'E:/data/src/nexus-ide', addedAt: '2026-02-01T00:00:00Z' },
  { id: 'proj-7', name: 'dotnet-templates', path: 'E:/data/src/dotnet-templates', addedAt: '2026-02-10T00:00:00Z' },
];

// ── Git Status (per-project) ─────────────────────

export const mockGitStatuses: Record<string, GitStatus> = {
  'proj-1': { branch: 'feat/streaming-bundles', changeCount: 14, staged: 8, unstaged: 4, untracked: 2, ahead: 3, behind: 0 },
  'proj-2': { branch: 'main', changeCount: 0, staged: 0, unstaged: 0, untracked: 0, ahead: 0, behind: 0 },
  'proj-3': { branch: 'fix/auth-flow', changeCount: 3, staged: 1, unstaged: 2, untracked: 0, ahead: 1, behind: 0 },
  'proj-4': { branch: 'main', changeCount: 0, staged: 0, unstaged: 0, untracked: 0, ahead: 0, behind: 0 },
  'proj-5': { branch: 'feat/journal', changeCount: 7, staged: 3, unstaged: 4, untracked: 0, ahead: 2, behind: 1 },
  'proj-6': { branch: 'main', changeCount: 1, staged: 0, unstaged: 1, untracked: 0, ahead: 0, behind: 0 },
  'proj-7': { branch: 'main', changeCount: 0, staged: 0, unstaged: 0, untracked: 0, ahead: 0, behind: 0 },
};

export const mockWorktreeCounts: Record<string, number> = {
  'proj-1': 3,
  'proj-7': 2,
};

export const mockAgentCounts: Record<string, number> = {
  'proj-3': 1,
};

export const mockActivePhases: Record<string, 'plan' | 'execute' | 'validate'> = {
  'proj-1': 'execute',
  'proj-5': 'plan',
};

// ── Branches (for ignixa-fhir) ───────────────────

export const mockBranches: Branch[] = [
  { name: 'feat/streaming-bundles', isHead: true, upstream: 'origin/feat/streaming-bundles', ahead: 3, behind: 0 },
  { name: 'main', isHead: false, upstream: 'origin/main', ahead: 0, behind: 0 },
  { name: 'develop', isHead: false, upstream: 'origin/develop', ahead: 2, behind: 1 },
  { name: 'feat/fml-r5-mapping', isHead: false, upstream: 'origin/feat/fml-r5-mapping', ahead: 12, behind: 4 },
  { name: 'feat/patient-search', isHead: false, upstream: 'origin/feat/patient-search', ahead: 5, behind: 2 },
  { name: 'fix/bundle-validation', isHead: false, upstream: 'origin/fix/bundle-validation', ahead: 1, behind: 0 },
  { name: 'chore/upgrade-firely-sdk', isHead: false, upstream: 'origin/chore/upgrade-firely-sdk', ahead: 8, behind: 6 },
];

// ── Worktrees (for ignixa-fhir) ──────────────────

export const mockWorktrees: Worktree[] = [
  { path: 'E:/data/src/ignixa-fhir', branch: 'feat/streaming-bundles', isMainWorktree: true, isDirty: true },
  { path: 'E:/data/src/ignixa-fhir-fml', branch: 'feat/fml-r5-mapping', isMainWorktree: false, isDirty: false },
  { path: 'E:/data/src/ignixa-fhir-fix', branch: 'fix/bundle-validation', isMainWorktree: false, isDirty: true },
];

// ── Diff Files (for ignixa-fhir) ─────────────────

export const mockDiffFiles: DiffFile[] = [
  {
    filePath: 'src/Streaming/BundleStreamProcessor.cs',
    status: 'M',
    additions: 47,
    deletions: 12,
    hunks: [
      {
        header: '@@ -23,7 +23,18 @@ public class BundleStreamProcessor',
        lines: [
          { type: 'context', content: '    private readonly IFhirClient _client;', oldLineNumber: 23, newLineNumber: 23 },
          { type: 'context', content: '    private readonly BundleOptions _options;', oldLineNumber: 24, newLineNumber: 24 },
          { type: 'deleted', content: '-   private readonly List<Resource> _buffer = new();', oldLineNumber: 25, newLineNumber: null },
          { type: 'added', content: '+   private readonly Channel<Resource> _channel;', oldLineNumber: null, newLineNumber: 25 },
          { type: 'added', content: '+   private readonly int _maxConcurrency;', oldLineNumber: null, newLineNumber: 26 },
          { type: 'added', content: '+   private readonly SemaphoreSlim _throttle;', oldLineNumber: null, newLineNumber: 27 },
          { type: 'context', content: '', oldLineNumber: 26, newLineNumber: 28 },
          { type: 'context', content: '    public BundleStreamProcessor(IFhirClient client, BundleOptions options)', oldLineNumber: 27, newLineNumber: 29 },
          { type: 'context', content: '    {', oldLineNumber: 28, newLineNumber: 30 },
          { type: 'deleted', content: '-       _buffer = new List<Resource>();', oldLineNumber: 29, newLineNumber: null },
          { type: 'added', content: '+       _channel = Channel.CreateBounded<Resource>(options.BufferSize);', oldLineNumber: null, newLineNumber: 31 },
          { type: 'added', content: '+       _maxConcurrency = options.MaxConcurrency;', oldLineNumber: null, newLineNumber: 32 },
          { type: 'added', content: '+       _throttle = new SemaphoreSlim(_maxConcurrency);', oldLineNumber: null, newLineNumber: 33 },
        ],
      },
    ],
  },
  { filePath: 'src/Streaming/StreamingPipeline.cs', status: 'A', additions: 124, deletions: 0, hunks: [] },
  { filePath: 'src/Streaming/BundleOptions.cs', status: 'M', additions: 18, deletions: 2, hunks: [] },
  { filePath: 'src/DependencyInjection.cs', status: 'M', additions: 6, deletions: 1, hunks: [] },
  { filePath: 'tests/Streaming/BundleStreamProcessorTests.cs', status: 'A', additions: 89, deletions: 0, hunks: [] },
  { filePath: 'tests/Streaming/StreamingPipelineTests.cs', status: 'A', additions: 56, deletions: 0, hunks: [] },
  { filePath: 'src/Streaming/LegacyBatchProcessor.cs', status: 'D', additions: 0, deletions: 67, hunks: [] },
  { filePath: 'src/Config/StreamingConfig.cs', status: 'R', additions: 2, deletions: 7, oldPath: 'src/Config/BatchConfig.cs', hunks: [] },
];

// ── Commits (for ignixa-fhir) ────────────────────

export const mockCommits: Commit[] = [
  { hash: 'a3f8c21', message: 'feat: add channel-based streaming to BundleStreamProcessor', author: 'Brendan K', authorInitials: 'BK', timestamp: '2026-03-14T12:23:00Z', timeAgo: '2 hours ago', additions: 171, deletions: 19, isAIGenerated: false },
  { hash: 'e91b44f', message: 'feat: implement StreamingPipeline with backpressure support', author: 'Claude Code', authorInitials: 'CC', timestamp: '2026-03-14T11:23:00Z', timeAgo: '3 hours ago', additions: 124, deletions: 0, isAIGenerated: true },
  { hash: '7cd2e08', message: 'test: add unit tests for BundleStreamProcessor and StreamingPipeline', author: 'Claude Code', authorInitials: 'CC', timestamp: '2026-03-14T11:00:00Z', timeAgo: '3 hours ago', additions: 145, deletions: 0, isAIGenerated: true },
  { hash: 'f45a1bc', message: 'chore: remove LegacyBatchProcessor, rename config', author: 'Brendan K', authorInitials: 'BK', timestamp: '2026-03-14T10:23:00Z', timeAgo: '4 hours ago', additions: 2, deletions: 74, isAIGenerated: false },
  { hash: '31ee9a0', message: 'refactor: extract BundleOptions into dedicated config class', author: 'Brendan K', authorInitials: 'BK', timestamp: '2026-03-14T09:23:00Z', timeAgo: '5 hours ago', additions: 42, deletions: 8, isAIGenerated: false },
  { hash: '9b83c12', message: 'fix: handle empty bundle entries in validation step', author: 'Brendan K', authorInitials: 'BK', timestamp: '2026-03-13T14:23:00Z', timeAgo: 'yesterday', additions: 11, deletions: 3, isAIGenerated: false },
];

// ── Pipeline Runs ────────────────────────────────

export const mockPipelineRuns: PipelineRun[] = [
  {
    id: 'run-1',
    config: {
      name: 'Bundle streaming',
      projectId: 'proj-1',
      branch: 'feat/streaming-bundles',
      plan: { pluginId: 'fn-investigation' },
      execute: { pluginId: 'fn-task' },
      validate: {
        chain: [
          { pluginId: 'pr-summary' },
          { pluginId: 'fn-review' },
          { pluginId: 'test-suite' },
          { pluginId: 'ralph-loop', config: { maxIterations: 3 } },
        ],
      },
    },
    status: 'executing',
    createdAt: '2026-03-14T12:00:00Z',
    phases: {
      plan: { status: 'complete', pluginId: 'fn-investigation', startedAt: '2026-03-14T12:00:00Z', completedAt: '2026-03-14T12:04:12Z', output: 'Investigation complete. 4 steps identified.', metrics: { duration: 252000 } },
      execute: { status: 'running', pluginId: 'fn-task', startedAt: '2026-03-14T12:04:12Z', output: 'Step 4/4: Update DI registration and cleanup...', metrics: { filesChanged: 6, additions: 342, deletions: 89, duration: 754000 } },
      validate: {
        status: 'pending',
        steps: [
          { pluginId: 'pr-summary', status: 'pending' },
          { pluginId: 'fn-review', status: 'pending' },
          { pluginId: 'test-suite', status: 'pending' },
          { pluginId: 'ralph-loop', status: 'pending', maxIterations: 3 },
        ],
      },
    },
  },
  {
    id: 'run-2',
    config: {
      name: 'FML R5 mapping',
      projectId: 'proj-1',
      branch: 'feat/fml-r5-mapping',
      plan: { pluginId: 'fn-investigation' },
      execute: { pluginId: 'fn-task' },
      validate: { chain: [{ pluginId: 'test-suite' }] },
    },
    status: 'complete',
    createdAt: '2026-03-13T10:00:00Z',
    phases: {
      plan: { status: 'complete', pluginId: 'fn-investigation' },
      execute: { status: 'complete', pluginId: 'fn-task' },
      validate: { status: 'complete', steps: [{ pluginId: 'test-suite', status: 'passed' }] },
    },
  },
  {
    id: 'run-3',
    config: {
      name: 'Patient search v2',
      projectId: 'proj-1',
      branch: 'feat/patient-search',
      plan: { pluginId: 'fn-investigation' },
      execute: { pluginId: 'fn-task' },
      validate: { chain: [{ pluginId: 'fn-review' }, { pluginId: 'test-suite' }] },
    },
    status: 'validating',
    createdAt: '2026-03-12T08:00:00Z',
    phases: {
      plan: { status: 'complete', pluginId: 'fn-investigation' },
      execute: { status: 'complete', pluginId: 'fn-task' },
      validate: { status: 'running', steps: [{ pluginId: 'fn-review', status: 'passed' }, { pluginId: 'test-suite', status: 'running' }] },
    },
  },
];

// ── Terminal Sessions ────────────────────────────

export const mockTerminalSessions: TerminalSession[] = [
  { id: 'term-1', projectId: 'proj-1', projectName: 'ignixa-fhir', agentType: 'Claude Code', label: 'Claude Code', status: 'running', branch: 'feat/streaming', worktreePath: 'E:/data/src/ignixa-fhir', command: 'claude', startedAt: '2026-03-14T12:04:12Z' },
  { id: 'term-2', projectId: 'proj-3', projectName: 'food-app-api', agentType: 'Claude Code', label: 'Claude Code', status: 'idle', branch: 'fix/auth', worktreePath: 'E:/data/src/food-app-api', command: 'claude', startedAt: '2026-03-14T10:00:00Z' },
];

// ── Command Palette Items ────────────────────────

export const mockPaletteItems: PaletteItem[] = [
  { id: 'p-1', label: 'ignixa-fhir', hint: 'feat/streaming-bundles', group: 'projects', icon: 'project' },
  { id: 'p-2', label: 'roslyn-mcp-server', hint: 'main', group: 'projects', icon: 'project' },
  { id: 'p-3', label: 'food-app-api', hint: 'fix/auth-flow', group: 'projects', icon: 'project' },
  { id: 'c-1', label: 'New terminal', hint: 'Ctrl+T', group: 'commands', icon: 'command' },
  { id: 'c-2', label: 'Launch Claude Code', hint: 'Ctrl+Shift+A', group: 'commands', icon: 'command' },
  { id: 'c-3', label: 'New pipeline run', hint: 'Ctrl+Shift+N', group: 'commands', icon: 'command' },
  { id: 'c-4', label: 'New worktree', hint: '', group: 'commands', icon: 'command' },
  { id: 'b-1', label: 'feat/fml-r5-mapping', hint: 'checkout', group: 'branches', icon: 'branch' },
  { id: 'b-2', label: 'feat/patient-search', hint: 'checkout', group: 'branches', icon: 'branch' },
];

export const mockExecuteOutput =
  '\u25b6 Implementing channel-based streaming for BundleStreamProcessor...\n' +
  '\n' +
  'Step 1/4: Replace List<Resource> buffer with Channel<Resource>\n' +
  '  \u2713 Modified src/Streaming/BundleStreamProcessor.cs\n' +
  '  \u2713 Added Channel and SemaphoreSlim fields\n' +
  '  \u2713 Updated constructor\n' +
  '\n' +
  'Step 2/4: Implement StreamingPipeline class\n' +
  '  \u2713 Created src/Streaming/StreamingPipeline.cs\n' +
  '  \u2713 Added backpressure support via BoundedChannelOptions\n' +
  '\n' +
  'Step 3/4: Write unit tests\n' +
  '  \u2713 Created tests/Streaming/BundleStreamProcessorTests.cs\n' +
  '  \u2713 Created tests/Streaming/StreamingPipelineTests.cs\n' +
  '\n' +
  '\u25b6 Step 4/4: Update DI registration and cleanup...\n' +
  '  \u22ef Running...';
