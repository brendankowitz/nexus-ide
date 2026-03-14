# Nexus — Developer Mission Control

## Vision

Nexus is an Electron-based developer IDE built around **project orchestration**, not file editing. It solves the problem of managing many concurrent projects, branches, worktrees, and AI agent sessions by making the **project** the primary unit of navigation — and by embedding an opinionated **Plan → Execute → Validate** pipeline for AI-assisted development workflows.

Nexus is not a code editor. It is a command center that sits alongside your editor (VS Code, Rider, etc.) and gives you:

- Instant context-switching between projects with full git state visibility
- First-class worktree management with per-worktree agent launching
- A plugin-based pipeline system for orchestrating AI agents across plan/execute/validate phases
- Integrated CLI terminals for interactive agent sessions (Claude Code, Copilot CLI, etc.)
- Rich diff viewing with inline hunk expansion

**Target user**: A principal+ engineer managing 5-15+ active repositories, using AI coding agents daily, and working across multiple branches/worktrees simultaneously.

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Shell | Electron 40+ | Cross-platform desktop, native OS integration, pty access |
| Build | electron-vite | Vite-based build for Electron; fast HMR, ESM support |
| Packaging | electron-builder (NSIS) | Superior Windows packaging, delta updates, code signing |
| Frontend | React 18+ with TypeScript | Component model, hooks, ecosystem |
| State | Zustand | Slice-shaped stores map directly to project/pipeline/terminal/ui domains |
| Styling | Tailwind CSS | Utility-first, rapid iteration, dark mode support |
| Terminal | xterm.js + @lydell/node-pty | Real terminal emulation via ConPTY; prebuilt binaries eliminate native compilation |
| Git | dugite | Bundles Git for Windows binary — no system git PATH dependency. Battle-tested by GitHub Desktop |
| IPC | Electron contextBridge + ipcMain.handle/ipcRenderer.invoke | Secure main↔renderer communication; invoke/handle for request-response |
| File watching | @parcel/watcher + git status polling | Native ReadDirectoryChangesW on Windows; no .git watching (causes event storms) |
| Storage | electron-store + safeStorage | Persist settings; DPAPI encryption for sensitive values (tokens, keys) |

### Project Structure

```
nexus/
├── package.json
├── electron/
│   ├── main.ts                    # Electron main process
│   ├── preload.ts                 # contextBridge API exposure
│   ├── ipc/
│   │   ├── git.ts                 # Git operations (dugite wrapper)
│   │   ├── terminal.ts            # @lydell/node-pty process management
│   │   ├── watcher.ts             # @parcel/watcher + git polling
│   │   ├── pipeline.ts            # Pipeline execution engine
│   │   └── plugins.ts             # Plugin discovery and loading
│   └── store.ts                   # electron-store for persistence
├── src/
│   ├── App.tsx
│   ├── main.tsx                   # React entry point
│   ├── stores/
│   │   ├── projectStore.ts        # Project list, active project
│   │   ├── pipelineStore.ts       # Pipeline runs, active phase
│   │   ├── terminalStore.ts       # Terminal sessions
│   │   └── uiStore.ts             # UI state (panels, tabs, etc.)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Shell.tsx          # Top-level layout: rail + main + bottom panel
│   │   │   ├── TitleBar.tsx       # Custom title bar (titleBarOverlay on Windows, traffic lights on macOS)
│   │   │   └── CommandPalette.tsx  # ⌘K palette overlay
│   │   ├── projects/
│   │   │   ├── ProjectRail.tsx    # Left sidebar with project list
│   │   │   ├── ProjectCard.tsx    # Individual project in the rail
│   │   │   └── AddProjectModal.tsx # Project discovery and import
│   │   ├── git/
│   │   │   ├── BranchList.tsx     # Branch listing with checkout actions
│   │   │   ├── WorktreeGrid.tsx   # Worktree cards with launch actions
│   │   │   ├── DiffViewer.tsx     # File list with expandable hunk diffs
│   │   │   ├── DiffHunk.tsx       # Individual hunk with line-level coloring
│   │   │   └── CommitLog.tsx      # Commit history with stats
│   │   ├── pipeline/
│   │   │   ├── PipelineView.tsx   # Full pipeline orchestration view
│   │   │   ├── PhaseHeader.tsx    # Plan/Execute/Validate tab bar
│   │   │   ├── PlanPhase.tsx      # Plan plugin output and config
│   │   │   ├── ExecutePhase.tsx   # Execution monitoring and stats
│   │   │   ├── ValidatePhase.tsx  # Validation chain management
│   │   │   ├── PluginSelector.tsx # Plugin picker for any phase
│   │   │   ├── RunSidebar.tsx     # Pipeline run list
│   │   │   └── ValidationChain.tsx # Ordered validation step config
│   │   ├── terminals/
│   │   │   ├── AgentPanel.tsx     # Bottom dock with all agent sessions
│   │   │   ├── TerminalTab.tsx    # Individual xterm.js instance
│   │   │   ├── AgentCard.tsx      # Agent status summary card
│   │   │   └── LaunchMenu.tsx     # Agent/CLI launch picker
│   │   └── shared/
│   │       ├── Badge.tsx
│   │       ├── StatusDot.tsx
│   │       └── Tooltip.tsx
│   ├── hooks/
│   │   ├── useGit.ts             # Git data fetching and subscriptions
│   │   ├── usePipeline.ts        # Pipeline run management
│   │   ├── useTerminal.ts        # Terminal session lifecycle
│   │   └── useWatcher.ts         # File system change subscriptions
│   ├── plugins/                   # Built-in plugin definitions
│   │   ├── types.ts              # Plugin interface definitions
│   │   ├── plan/
│   │   │   ├── fn-investigation.ts
│   │   │   ├── spec-kit.ts
│   │   │   ├── claude-planner.ts
│   │   │   └── custom-prompt.ts
│   │   ├── execute/
│   │   │   ├── fn-task.ts
│   │   │   ├── copilot-cli.ts
│   │   │   ├── aider.ts
│   │   │   └── manual.ts
│   │   └── validate/
│   │       ├── pr-summary.ts
│   │       ├── fn-review.ts
│   │       ├── ralph-loop.ts
│   │       ├── adversarial.ts
│   │       ├── test-suite.ts
│   │       └── build-deploy.ts
│   └── lib/
│       ├── git-helpers.ts         # Git data parsing utilities
│       ├── diff-parser.ts         # Unified diff → structured hunks
│       └── plugin-loader.ts       # Dynamic plugin loading
├── plugins/                       # User-defined plugins (loaded at runtime)
│   └── README.md
└── resources/
    └── icons/
```

---

## Architecture

### Data Flow

```
┌──────────────────────────────────────────────────────────┐
│  Renderer Process (React)                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ Project  │  │ Pipeline │  │ Terminal  │               │
│  │ Store    │  │ Store    │  │ Store     │               │
│  │ (Zustand)│  │ (Zustand)│  │ (Zustand) │               │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘               │
│       │              │              │                     │
│       └──────────────┼──────────────┘                     │
│                      │ ipcRenderer.invoke()               │
├──────────────────────┼───────────────────────────────────┤
│  Main Process        │                                    │
│  ┌──────────┐  ┌─────┴────┐  ┌──────────┐               │
│  │ Git Ops  │  │ Pipeline │  │ Terminal  │               │
│  │ (dugite) │  │ Engine   │  │ Manager   │               │
│  │          │  │          │  │ (node-pty)│               │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘               │
│       │              │              │                     │
│  ┌────┴─────┐  ┌─────┴────┐        │                     │
│  │ Parcel   │  │ Plugin   │        │                     │
│  │ Watcher  │  │ Registry │        │                     │
│  │ + Git    │  │          │        │                     │
│  │ Poller   │  │          │        │                     │
│  └──────────┘  └──────────┘        │                     │
│                                     │                     │
│                              ┌──────┴──────┐             │
│                              │ Child       │             │
│                              │ Processes   │             │
│                              │ (claude,    │             │
│                              │  gh copilot,│             │
│                              │  dotnet,    │             │
│                              │  aider)     │             │
│                              └─────────────┘             │
└──────────────────────────────────────────────────────────┘
```

### IPC Contract (preload.ts)

The preload script exposes a typed API to the renderer via contextBridge:

```typescript
// electron/preload.ts
interface NexusAPI {
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
  };

  // Terminal / CLI sessions
  terminal: {
    create(options: TerminalOptions): Promise<string>; // returns session ID
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
    list(phase?: Phase): Promise<PluginDefinition[]>;
    loadUserPlugins(directory: string): Promise<void>;
  };

  // File system events (pushed from main → renderer)
  watcher: {
    onGitChange(projectId: string, callback: (event: GitChangeEvent) => void): () => void;
  };
}
```

---

## Core Features

### 1. Project Rail (Left Sidebar)

The project rail is the primary navigation element. It shows all registered projects with at-a-glance status.

**Each project card displays:**
- Project name (repo directory name)
- Current branch (truncated with ellipsis if > 20 chars)
- Change count or "clean" status
- Worktree count (if > 1)
- Active agent count (if > 0)
- Active pipeline run indicator (phase dot: plan/execute/validate)

**Behaviors:**
- Click to switch active project (all panels update)
- Right-click for context menu: open in editor, open in terminal, remove, reveal in Finder/Explorer
- Drag to reorder
- Projects persist across sessions via electron-store
- Badge pulse animation when git status changes (file watcher triggers)

**Add Project flow:**
- "+" button opens AddProjectModal
- Input accepts: local directory path OR git clone URL
- "Browse" button calls `dialog.showOpenDialog({ properties: ['openDirectory'] })`
- Auto-discovery: recursively scans entered parent directory for `.git/` up to 3 levels deep
- Multi-select: user can check multiple discovered repos and add them in batch
- Options: "auto-detect worktrees" (reads `.git/worktrees/`), "watch for changes" (enables @parcel/watcher + git polling)

### 2. Main Content Area (Tabbed Views)

When a project is selected, the main area shows four tabs:

#### 2a. Branches Tab

- Lists all local branches from `git branch`
- Current branch (HEAD) highlighted with accent color and "HEAD" badge
- Main/develop branches get green dot; feature branches get neutral dot
- Each branch row has:
  - "checkout" action (runs `git checkout <branch>`)
  - "new worktree" action (creates worktree from that branch)
  - "diff against..." dropdown to compare with another branch
  - Ahead/behind indicators relative to tracking branch

#### 2b. Worktrees Tab

- Grid layout of worktree cards (responsive: `repeat(auto-fill, minmax(220px, 1fr))`)
- Each card shows:
  - Branch name and path
  - "terminal" button — opens a new CLI session in that worktree directory
  - "agent" button — opens the LaunchMenu to pick an agent CLI to start in that worktree
  - "open in editor" button — launches configured editor (VS Code by default)
- "+" card to create a new worktree: select branch, optional custom path
- Delete worktree action with confirmation (runs `git worktree remove`)

#### 2c. Diffs Tab

- Lists all changed files from `git diff --stat` and `git diff --cached --stat`
- Each file row shows: status badge (M/A/D/R), file path, +additions, -deletions
- Click to expand inline hunk view (parsed from `git diff -U3 <file>`)
- Hunk display:
  - Header line (`@@ -45,7 +45,28 @@`) in muted style
  - Context lines: default text color
  - Added lines: green background, green text, "+" prefix
  - Deleted lines: red background, red text, "-" prefix
- Stage/unstage individual files or hunks
- "Stage all" and "Commit" actions in tab header

#### 2d. Log Tab

- Commit history from `git log --oneline --stat -n 50`
- Each commit shows: author avatar (initials circle), message, hash (linked), time ago, +/- stats
- Click commit to view its full diff
- Filter by branch, author, or date range

### 3. Agent Terminal Panel (Bottom Dock)

A collapsible bottom panel that aggregates all active CLI sessions across all projects.

**Panel header:**
- Chevron toggle to collapse/expand
- "Agent terminals" label
- Badge showing count of active (running) sessions
- "+" button to launch a new session

**Panel body (when expanded):**
- Horizontal strip of agent cards, each showing:
  - Agent type (Claude Code, Copilot CLI, Aider, custom)
  - Project name it's attached to
  - Status indicator: running (green pulse), idle (gray), exited (red)
  - Current task summary (if available)
- Click a card to focus that terminal (expands to show xterm.js view)
- Double-click to pop out into a separate floating window

#### 3a. Terminal Sessions (xterm.js)

Each terminal session is a real PTY (pseudo-terminal) managed by node-pty in the main process:

```typescript
// electron/ipc/terminal.ts
interface TerminalOptions {
  projectId: string;
  worktreePath?: string;       // Working directory (defaults to project root)
  command?: string;            // e.g., "claude", "gh copilot", "aider"
  args?: string[];             // CLI arguments
  env?: Record<string, string>;// Additional environment variables
  label?: string;              // Display label in the panel
}
```

**Default launch configurations:**

| Agent | Command | Args | Notes |
|-------|---------|------|-------|
| Interactive shell | User's default shell (pwsh/zsh) | — | Plain terminal in project dir |
| Claude Code | `claude` | — | Interactive REPL mode |
| Claude Code (task) | `claude` | `-p "task description"` | One-shot task mode |
| Copilot CLI | `gh copilot` | — | GitHub Copilot in terminal |
| Aider | `aider` | `--model claude-3-5-sonnet` | Aider pair programming |
| dotnet test | `dotnet` | `test --verbosity normal` | Run test suite |
| dotnet build | `dotnet` | `build` | Build project |
| Custom | (user-defined) | (user-defined) | From plugin or manual entry |

#### 3b. Launch Menu

The LaunchMenu appears when clicking "agent" on a worktree card or "+" on the agent panel. It is a dropdown/popover with:

- **Quick launch section**: preconfigured agents (Claude Code interactive, Claude Code task, Copilot CLI, shell)
- **Pipeline agents section**: shows plan/execute/validate plugins that can be launched standalone
- **Recent section**: last 3 agent launches for quick re-launch
- **Custom command**: text input for arbitrary command entry

Each launch option shows the command that will be run and the working directory.

### 4. Command Palette (⌘K / Ctrl+K)

A fuzzy-search overlay inspired by VS Code's command palette and Raycast:

**Searchable entities:**
- Projects by name → switches active project
- Branches by name → checkouts or creates worktree
- Pipeline runs by name → opens pipeline view
- Commands: "new terminal", "new worktree", "launch claude code", "launch copilot", "run pipeline", "add project", "open in editor", "open in finder"
- Recent actions

**Compound commands** (parsed from natural language):
- "claude code ignixa feat/fml-r5" → launch Claude Code in ignixa-fhir on feat/fml-r5 worktree
- "terminal roslyn main" → open shell in roslyn-mcp-server main worktree
- "diff ignixa" → switch to ignixa-fhir diffs tab
- "pipeline ignixa streaming" → open pipeline run "streaming" in ignixa-fhir

---

## Pipeline System (Plan → Execute → Validate)

### Overview

The pipeline system is the defining feature of Nexus. It embeds an opinionated workflow for AI-assisted development:

1. **Plan**: Investigate the codebase, understand the change, produce a structured spec
2. **Execute**: Hand the spec to an agent that implements the change
3. **Validate**: Run a chain of validation steps to verify correctness

Each phase is **plugin-based** — the user selects which tool/agent handles each phase. Validation is a **chain** (ordered list of plugins that run sequentially).

### Data Model

```typescript
type Phase = 'plan' | 'execute' | 'validate';
type RunStatus = 'draft' | 'planning' | 'executing' | 'validating' | 'complete' | 'failed' | 'aborted';

interface PipelineConfig {
  name: string;                    // e.g., "Bundle streaming implementation"
  projectId: string;
  branch: string;                  // Target branch for this pipeline
  worktreePath?: string;           // Specific worktree to use
  plan: {
    pluginId: string;              // e.g., "fn-investigation"
    config?: Record<string, any>;  // Plugin-specific config
  };
  execute: {
    pluginId: string;              // e.g., "fn-task"
    config?: Record<string, any>;
  };
  validate: {
    chain: Array<{
      pluginId: string;            // e.g., "fn-review"
      config?: Record<string, any>;
      continueOnFail?: boolean;    // Default false — halt chain on failure
    }>;
    maxRetries?: number;           // For self-correcting loops (default 1 = no retry)
  };
}

interface PipelineRun {
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

interface PhaseResult {
  status: 'pending' | 'running' | 'complete' | 'failed' | 'skipped';
  pluginId: string;
  startedAt?: string;
  completedAt?: string;
  output?: string;                 // Structured output from plugin (markdown/JSON)
  terminalSessionId?: string;      // Link to terminal for live output
  artifacts?: string[];            // File paths produced
  metrics?: {
    filesChanged?: number;
    additions?: number;
    deletions?: number;
    duration?: number;             // milliseconds
    commits?: string[];            // Commit hashes created
  };
}

interface ValidateResult {
  status: 'pending' | 'running' | 'complete' | 'failed';
  steps: Array<{
    pluginId: string;
    status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
    iteration?: number;            // For ralph-loop: current iteration
    maxIterations?: number;
    output?: string;
    terminalSessionId?: string;
  }>;
}
```

### Plugin Interface

```typescript
// src/plugins/types.ts

interface NexusPlugin {
  id: string;                      // Unique identifier (e.g., "fn-investigation")
  name: string;                    // Display name (e.g., "fn-investigation")
  description: string;             // One-line description
  phase: Phase;                    // Which phase this plugin serves
  icon?: string;                   // Optional icon identifier

  // Plugin capabilities
  capabilities: {
    interactive: boolean;          // Does it need a terminal? (true for CLI agents)
    streaming: boolean;            // Does it produce streaming output?
    configurable: boolean;         // Does it accept user config?
  };

  // Configuration schema (displayed in PluginSelector)
  configSchema?: {
    fields: Array<{
      key: string;
      label: string;
      type: 'string' | 'number' | 'boolean' | 'select';
      default?: any;
      options?: string[];          // For select type
    }>;
  };

  // How to launch this plugin
  launch: {
    command: string;               // CLI command (e.g., "claude")
    args: (context: PluginContext) => string[];  // Dynamic arg builder
    env?: Record<string, string>;
  };

  // Output parsing (optional — for structured results)
  parseOutput?(raw: string): PluginOutput;
}

interface PluginContext {
  projectPath: string;
  branch: string;
  worktreePath: string;
  planOutput?: string;             // Available in execute/validate phases
  executeOutput?: string;          // Available in validate phase
  priorValidateOutputs?: Array<{   // Outputs from earlier steps in the validation chain
    pluginId: string;
    output: string;
  }>;
  pipelineName: string;
  config?: Record<string, any>;    // User-provided plugin config
}

interface PluginOutput {
  summary: string;
  status: 'success' | 'failure' | 'partial';
  details?: string;                // Markdown content
  metrics?: Record<string, number>;
  artifacts?: string[];
}
```

### Built-in Plugin Definitions

#### Plan Plugins

**fn-investigation** — Deep codebase analysis using Claude Code's investigation mode:
```typescript
{
  id: 'fn-investigation',
  name: 'fn-investigation',
  phase: 'plan',
  description: 'Deep codebase analysis and impact assessment via Claude Code',
  capabilities: { interactive: true, streaming: true, configurable: true },
  configSchema: {
    fields: [
      { key: 'scope', label: 'Investigation scope', type: 'string', default: '' },
      { key: 'depth', label: 'Analysis depth', type: 'select', default: 'thorough', options: ['quick', 'thorough', 'exhaustive'] },
    ]
  },
  launch: {
    command: 'claude',
    args: (ctx) => ['-p', `Investigate the codebase for: ${ctx.pipelineName}. Scope: ${ctx.config?.scope || 'auto-detect'}. Produce a structured plan with file list, steps, risks, and acceptance criteria. Depth: ${ctx.config?.depth || 'thorough'}.`],
  }
}
```

**spec-kit** — Structured spec generation with acceptance criteria:
```typescript
{
  id: 'spec-kit',
  name: 'Spec Kit',
  phase: 'plan',
  description: 'Generate a structured spec with acceptance criteria and test plan',
  capabilities: { interactive: true, streaming: true, configurable: true },
  launch: {
    command: 'claude',
    args: (ctx) => ['-p', `Generate a detailed implementation spec for: ${ctx.pipelineName}. Include: 1) Problem statement 2) Proposed changes with file paths 3) Acceptance criteria 4) Test plan 5) Risk assessment. Output as markdown.`],
  }
}
```

**claude-planner** — Built-in Claude planning with TodoWrite:
```typescript
{
  id: 'claude-planner',
  name: 'Claude planner',
  phase: 'plan',
  description: 'Claude Code built-in planning with TodoWrite task breakdown',
  capabilities: { interactive: true, streaming: true, configurable: false },
  launch: {
    command: 'claude',
    args: (ctx) => ['-p', `Plan the implementation for: ${ctx.pipelineName}. Use TodoWrite to create a detailed task breakdown.`],
  }
}
```

**custom-prompt** — User's own planning prompt:
```typescript
{
  id: 'custom-prompt',
  name: 'Custom prompt',
  phase: 'plan',
  description: 'Run a custom planning prompt template',
  capabilities: { interactive: true, streaming: true, configurable: true },
  configSchema: {
    fields: [
      { key: 'prompt', label: 'Custom prompt', type: 'string', default: '' },
    ]
  },
  launch: {
    command: 'claude',
    args: (ctx) => ['-p', ctx.config?.prompt || 'Plan this task.'],
  }
}
```

#### Execute Plugins

**fn-task** — Claude Code task runner consuming plan output:
```typescript
{
  id: 'fn-task',
  name: 'fn-task',
  phase: 'execute',
  description: 'Claude Code task execution with plan context',
  capabilities: { interactive: true, streaming: true, configurable: true },
  launch: {
    command: 'claude',
    args: (ctx) => {
      const args = ['-p'];
      let prompt = `Execute the following plan for "${ctx.pipelineName}":\n\n${ctx.planOutput}\n\nImplement all changes. Commit after each logical step.`;
      if (ctx.config?.maxCommits) prompt += `\nLimit to ${ctx.config.maxCommits} commits.`;
      args.push(prompt);
      return args;
    },
  },
  configSchema: {
    fields: [
      { key: 'maxCommits', label: 'Max commits', type: 'number', default: 0 },
      { key: 'autoCommit', label: 'Auto-commit each step', type: 'boolean', default: true },
    ]
  },
}
```

**copilot-cli** — GitHub Copilot:
```typescript
{
  id: 'copilot-cli',
  name: 'Copilot CLI',
  phase: 'execute',
  description: 'GitHub Copilot agent execution',
  capabilities: { interactive: true, streaming: true, configurable: false },
  launch: {
    command: 'gh',
    args: () => ['copilot'],
  }
}
```

**aider** — Aider pair programming:
```typescript
{
  id: 'aider',
  name: 'Aider',
  phase: 'execute',
  description: 'Aider pair programming with plan context',
  capabilities: { interactive: true, streaming: true, configurable: true },
  configSchema: {
    fields: [
      { key: 'model', label: 'Model', type: 'select', default: 'claude-sonnet-4-20250514', options: ['claude-sonnet-4-20250514', 'claude-opus-4-20250115', 'gpt-4o'] },
    ]
  },
  launch: {
    command: 'aider',
    args: (ctx) => ['--model', ctx.config?.model || 'claude-sonnet-4-20250514', '--message', ctx.planOutput || ''],
  }
}
```

**manual** — User codes manually, Nexus watches:
```typescript
{
  id: 'manual',
  name: 'Manual',
  phase: 'execute',
  description: 'You code it — Nexus watches for changes and tracks progress',
  capabilities: { interactive: false, streaming: false, configurable: false },
  launch: {
    command: '', // No command — just monitors git status
    args: () => [],
  }
}
```

#### Validate Plugins

**pr-summary** — Changeset summarization and grouping (runs before review):
```typescript
{
  id: 'pr-summary',
  name: 'PR summary',
  phase: 'validate',
  description: 'Group changes into logical features, generate narrative summary, flag plan drift',
  capabilities: { interactive: true, streaming: true, configurable: true },
  configSchema: {
    fields: [
      { key: 'groupingStrategy', label: 'Grouping', type: 'select', default: 'auto', options: ['auto', 'by-feature', 'by-layer', 'by-directory'] },
      { key: 'compareBranch', label: 'Compare against', type: 'string', default: 'main' },
    ]
  },
  launch: {
    command: 'claude',
    args: (ctx) => ['-p', [
      `Analyze all changes on branch ${ctx.branch} compared to ${ctx.config?.compareBranch || 'main'}.`,
      ``,
      `Produce a structured PR summary with these sections:`,
      ``,
      `## 1. Narrative Summary`,
      `One paragraph explaining what this changeset does and why.`,
      ``,
      `## 2. Change Groups`,
      `Organize all changed files into logical groups (${ctx.config?.groupingStrategy || 'auto-detect the best grouping'}).`,
      `Each group should have: a short title, a description of what the group accomplishes, and the list of files with a one-line note per file.`,
      `Suggest a reading order across groups (most important first).`,
      ``,
      `## 3. Plan Alignment`,
      ctx.planOutput
        ? `Compare the changes against this plan and report:\n- Plan items with corresponding changes (covered)\n- Plan items with NO corresponding changes (gaps)\n- Changes that exist but are NOT in the plan (drift)\n\nPlan:\n${ctx.planOutput}`
        : `No plan available — skip this section.`,
      ``,
      `## 4. Review Guidance`,
      `Flag which groups/files need careful human review vs which are mechanical/generated.`,
      `Estimate review effort per group (trivial / moderate / careful).`,
      ``,
      `Output as markdown.`,
    ].join('\n')],
  }
}
```

**fn-review** — Structured code review:
```typescript
{
  id: 'fn-review',
  name: 'fn-review',
  phase: 'validate',
  description: 'Structured code review with scoring and issue categorization',
  capabilities: { interactive: true, streaming: true, configurable: true },
  configSchema: {
    fields: [
      { key: 'strictness', label: 'Review strictness', type: 'select', default: 'standard', options: ['lenient', 'standard', 'strict', 'adversarial'] },
    ]
  },
  launch: {
    command: 'claude',
    args: (ctx) => {
      const summaryOutput = ctx.priorValidateOutputs?.find(v => v.pluginId === 'pr-summary')?.output;
      let prompt = `Review the changes on branch ${ctx.branch}.`;
      if (summaryOutput) {
        prompt += `\n\nA PR summary with change groupings has already been produced. Use it to structure your review — review each group in the suggested reading order rather than file-by-file:\n\n${summaryOutput}`;
      }
      if (ctx.planOutput) {
        prompt += `\n\nOriginal plan:\n${ctx.planOutput}`;
      }
      prompt += `\n\nCheck: correctness, edge cases, performance, naming, test coverage. Strictness: ${ctx.config?.strictness || 'standard'}. Output a structured review with pass/fail verdict per group.`;
      return ['-p', prompt];
    },
  }
}
```

**ralph-loop** — Self-correcting build-fix-retry cycle:
```typescript
{
  id: 'ralph-loop',
  name: 'Ralph loop',
  phase: 'validate',
  description: 'Self-correcting cycle: build → detect failures → fix → retry',
  capabilities: { interactive: true, streaming: true, configurable: true },
  configSchema: {
    fields: [
      { key: 'maxIterations', label: 'Max iterations', type: 'number', default: 5 },
      { key: 'buildCommand', label: 'Build command', type: 'string', default: 'dotnet build' },
      { key: 'testCommand', label: 'Test command', type: 'string', default: 'dotnet test' },
    ]
  },
  launch: {
    command: 'claude',
    args: (ctx) => ['-p', `Run a self-correcting loop (max ${ctx.config?.maxIterations || 5} iterations):\n1. Run: ${ctx.config?.buildCommand || 'dotnet build'}\n2. Run: ${ctx.config?.testCommand || 'dotnet test'}\n3. If failures, analyze and fix\n4. Repeat until green or max iterations\nReport each iteration's result.`],
  }
}
```

**adversarial** — Adversarial testing agent:
```typescript
{
  id: 'adversarial',
  name: 'Adversarial agent',
  phase: 'validate',
  description: 'Fuzz testing, edge case discovery, security probing',
  capabilities: { interactive: true, streaming: true, configurable: true },
  configSchema: {
    fields: [
      { key: 'focus', label: 'Focus area', type: 'select', default: 'general', options: ['general', 'security', 'concurrency', 'memory', 'input-validation'] },
    ]
  },
  launch: {
    command: 'claude',
    args: (ctx) => ['-p', `Act as an adversarial tester for the changes on ${ctx.branch}. Focus: ${ctx.config?.focus || 'general'}. Try to break the code: write fuzz tests, probe edge cases, test concurrent access, check for resource leaks, validate error handling. Report all findings with severity ratings.`],
  }
}
```

**test-suite** — Run and analyze test results:
```typescript
{
  id: 'unit-test',
  name: 'Test suite',
  phase: 'validate',
  description: 'Run dotnet test and analyze results',
  capabilities: { interactive: false, streaming: true, configurable: true },
  configSchema: {
    fields: [
      { key: 'command', label: 'Test command', type: 'string', default: 'dotnet test --verbosity normal' },
      { key: 'filter', label: 'Test filter', type: 'string', default: '' },
    ]
  },
  launch: {
    command: 'dotnet',
    args: (ctx) => {
      const args = ['test', '--verbosity', 'normal'];
      if (ctx.config?.filter) args.push('--filter', ctx.config.filter);
      return args;
    },
  }
}
```

**build-deploy** — Build and deploy to test environment:
```typescript
{
  id: 'build-deploy',
  name: 'Build & launch',
  phase: 'validate',
  description: 'Build, deploy to test environment, run smoke tests',
  capabilities: { interactive: false, streaming: true, configurable: true },
  configSchema: {
    fields: [
      { key: 'buildCommand', label: 'Build command', type: 'string', default: 'dotnet build -c Release' },
      { key: 'launchCommand', label: 'Launch command', type: 'string', default: 'dotnet run' },
      { key: 'smokeTestUrl', label: 'Smoke test URL', type: 'string', default: 'http://localhost:5000/health' },
    ]
  },
  launch: {
    // Uses the platform's default shell (pwsh on Windows, bash on macOS/Linux)
    command: process.platform === 'win32' ? 'pwsh' : 'bash',
    args: (ctx) => process.platform === 'win32'
      ? ['-Command', `${ctx.config?.buildCommand || 'dotnet build -c Release'}; if ($LASTEXITCODE -eq 0) { ${ctx.config?.launchCommand || 'dotnet run'} }`]
      : ['-c', `${ctx.config?.buildCommand || 'dotnet build -c Release'} && ${ctx.config?.launchCommand || 'dotnet run'}`],
  }
}
```

### User-Defined Plugins

Users can create plugins by adding `.nexus-plugin.json` files to the `plugins/` directory or to any project's `.nexus/plugins/` directory:

```json
{
  "id": "my-custom-linter",
  "name": "Custom linter",
  "description": "Run my team's custom linting rules",
  "phase": "validate",
  "capabilities": { "interactive": false, "streaming": true, "configurable": true },
  "configSchema": {
    "fields": [
      { "key": "ruleset", "label": "Ruleset", "type": "select", "default": "strict", "options": ["relaxed", "standard", "strict"] }
    ]
  },
  "launch": {
    "command": "dotnet",
    "args": ["run", "--project", "tools/CustomLinter", "--", "--ruleset", "${config.ruleset}"]
  }
}
```

Variable interpolation in args: `${config.<key>}`, `${project.path}`, `${branch}`, `${planOutput}`, `${executeOutput}`, `${worktree.path}`. In validate plugins: `${priorValidateOutputs.<pluginId>}` to reference output from an earlier chain step.

### Pipeline Execution Engine

The pipeline engine in the main process orchestrates phase execution:

```typescript
// electron/ipc/pipeline.ts (pseudocode)

class PipelineEngine {
  async runPhase(run: PipelineRun, phase: Phase): Promise<void> {
    // 1. Resolve the plugin
    const plugin = this.pluginRegistry.get(run.config[phase].pluginId);

    // 2. Build context (includes output from previous phases)
    const context: PluginContext = {
      projectPath: run.config.projectPath,
      branch: run.config.branch,
      worktreePath: run.config.worktreePath || run.config.projectPath,
      planOutput: run.phases.plan?.output,
      executeOutput: run.phases.execute?.output,
      pipelineName: run.config.name,
      config: run.config[phase].config,
    };

    // 3. Launch terminal session if plugin is interactive
    if (plugin.capabilities.interactive) {
      const sessionId = await this.terminalManager.create({
        projectId: run.config.projectId,
        worktreePath: context.worktreePath,
        command: plugin.launch.command,
        args: plugin.launch.args(context),
        env: plugin.launch.env,
        label: `${phase}: ${plugin.name}`,
      });

      // 4. Stream output, parse results when process exits
      // ... attach output parser, update run state
    }

    // 5. For validate chains, run each step sequentially
    //    Each step receives outputs from all prior steps (e.g., pr-summary → fn-review)
    if (phase === 'validate') {
      const completedSteps: Array<{ pluginId: string; output: string }> = [];

      for (const step of run.config.validate.chain) {
        const stepPlugin = this.pluginRegistry.get(step.pluginId);
        const stepContext = { ...context, priorValidateOutputs: [...completedSteps] };
        const result = await this.runValidateStep(run, stepPlugin, stepContext);

        // Accumulate output for downstream steps
        if (result.output) {
          completedSteps.push({ pluginId: step.pluginId, output: result.output });
        }

        if (result.status === 'failed' && !step.continueOnFail) {
          if (run.config.validate.maxRetries > 1) {
            await this.retryFromExecute(run);
          } else {
            break;
          }
        }
      }
    }
  }
}
```

### Pipeline Persistence

Pipeline configurations and run history are stored per-project in `.nexus/pipelines.json`:

```json
{
  "defaultConfig": {
    "plan": { "pluginId": "fn-investigation" },
    "execute": { "pluginId": "fn-task" },
    "validate": {
      "chain": [
        { "pluginId": "pr-summary", "continueOnFail": true },
        { "pluginId": "fn-review" },
        { "pluginId": "unit-test" },
        { "pluginId": "ralph-loop", "config": { "maxIterations": 3 } }
      ]
    }
  },
  "runs": [
    {
      "id": "run-001",
      "name": "Bundle streaming",
      "branch": "feat/streaming-bundles",
      "status": "validating",
      "createdAt": "2026-03-14T10:00:00Z",
      "config": { /* ... */ },
      "phases": { /* ... */ }
    }
  ]
}
```

---

## UI Layout Specification

### Window Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Title Bar  NEXUS  ignixa-fhir  feat/streaming   [— □ ✕]  │
├──────────┬──────────────────────────────────────────────────┤
│          │  [branches] [worktrees] [diffs 14] [log]         │
│ PROJECTS │  ┌──────────────────────────────────────────────┐│
│          │  │                                              ││
│ ignixa ◄ │  │  Main content area                          ││
│ roslyn   │  │  (branch list / worktree grid /             ││
│ food-app │  │   diff viewer / commit log)                 ││
│ soccer   │  │                                              ││
│          │  │                                              ││
│          │  └──────────────────────────────────────────────┘│
│          ├──────────────────────────────────────────────────┤
│          │  [pipeline] [branches] [worktrees] [diffs] [log] │
│          │  (context-dependent: pipeline tab appears when    │
│          │   pipeline runs exist for active project)        │
│          ├──────────────────────────────────────────────────┤
│ + add    │  ▲ Agent terminals                    2 active   │
│          │  ┌──────────┐ ┌──────────┐ ┌─────────┐          │
│          │  │ Claude   │ │ Copilot  │ │ + launch│          │
│          │  │ ignixa   │ │ food-app │ │  agent  │          │
│          │  └──────────┘ └──────────┘ └─────────┘          │
└──────────┴──────────────────────────────────────────────────┘
```

### Theming

Nexus uses a monospace-forward aesthetic:
- **Primary font**: JetBrains Mono (with `'SF Mono', 'Cascadia Code', 'Fira Code', monospace` fallback)
- **UI font**: Inter for non-code UI labels
- **Color scheme**: Dark by default with light mode toggle
- **Accent colors per phase**: Plan = purple (#7F77DD), Execute = teal (#1D9E75), Validate = coral (#D85A30)
- **Borders**: 0.5px solid, muted colors
- **Border radius**: 6px for small elements, 8px for cards
- **Animations**: 150ms ease for transitions, minimal — no gratuitous motion

---

## Keyboard Shortcuts

Uses `Ctrl` on Windows/Linux, `⌘` on macOS. Shown as `Mod+` below.

| Shortcut | Action |
|----------|--------|
| Mod+K | Open command palette |
| Mod+1-9 | Switch to project by index |
| Mod+B | Toggle branches tab |
| Mod+W | Toggle worktrees tab |
| Mod+D | Toggle diffs tab |
| Mod+L | Toggle log tab |
| Mod+P | Toggle pipeline view |
| Mod+T | New terminal session |
| Mod+` | Toggle agent panel |
| Mod+Shift+N | New pipeline run |
| Mod+Shift+A | Launch Claude Code in active project |
| Mod+Shift+C | Launch Copilot CLI in active project |
| Mod+, | Settings |
| Mod+Shift+P | Cycle to next project |

---

## Settings & Configuration

Stored in `app.getPath('userData')/config.json` (Windows: `%APPDATA%/nexus/config.json`, macOS: `~/Library/Application Support/nexus/config.json`):

```json
{
  "editor": {
    "command": "code",
    "args": ["--goto"]
  },
  "theme": "dark",
  "terminal": {
    "shell": "auto",
    "fontSize": 13,
    "fontFamily": "JetBrains Mono"
  },
  "git": {
    "statusPollInterval": 3000,
    "autoFetchInterval": 60000
  },
  "pipeline": {
    "defaultPlan": "fn-investigation",
    "defaultExecute": "fn-task",
    "defaultValidateChain": ["pr-summary", "fn-review", "unit-test"]
  },
  "agents": {
    "claudeCode": { "command": "claude", "available": true },
    "copilotCli": { "command": "gh", "args": ["copilot"], "available": true },
    "aider": { "command": "aider", "available": false }
  },
  "projects": [
    {
      "id": "ignixa-fhir",
      "name": "ignixa-fhir",
      "path": "E:/data/src/ignixa-fhir",
      "watchEnabled": true,
      "editorWorkspace": "E:/data/src/ignixa-fhir/.vscode/ignixa.code-workspace"
    }
  ]
}
```

**Shell resolution** (`"shell": "auto"`): On Windows, detect in order: `pwsh.exe` (PowerShell 7), `powershell.exe` (Windows PowerShell), `cmd.exe`. On macOS/Linux, use `$SHELL` or fall back to `/bin/zsh`. User can override with an explicit path.

**Path storage convention**: All paths in config use forward slashes. Normalize with `path.resolve()` on read.

---

## Windows Platform Support

Nexus targets Windows 11 (and Windows 10 1809+) as the primary platform, without WSL dependency.

### Terminal (ConPTY)

- **Package**: `@lydell/node-pty` — a maintained fork shipping prebuilt binaries for `win32-x64` and `win32-arm64`. No node-gyp, no Visual Studio Build Tools, no Python required at install time.
- **Backend**: Windows ConPTY API exclusively (winpty removed in node-pty 1.0+). Requires Windows 10 build 18309+.
- **Transport**: Electron IPC (`ipcMain.handle` / `ipcRenderer.invoke`), not WebSockets. No open localhost port, no serialization overhead.
- **Rendering**: `@xterm/xterm` + `@xterm/addon-fit` + `@xterm/addon-webgl` in the renderer process.
- **Shell detection**: Resolve default shell at startup: `pwsh.exe` > `powershell.exe` > `cmd.exe`. Store in config; user can override.
- **ASAR packaging**: `@lydell/node-pty` native `.node` files must be unpacked. Configure `asarUnpack` in electron-builder:
  ```json
  { "asarUnpack": ["node_modules/@lydell/node-pty/**"] }
  ```
- **Console window suppression**: All `child_process.spawn` calls use `windowsHide: true` to prevent console window flash.

### Git Operations (dugite)

- **Package**: `dugite` — bundles a complete Git for Windows binary (`dugite-native`, ~30-50MB). This is the same library powering GitHub Desktop on millions of Windows machines.
- **No system git dependency**: Eliminates `spawn git ENOENT` errors from PATH issues in packaged Electron apps.
- **API pattern**: Low-level `git.exec(repoPath, args, options)` returning stdout/stderr. Wrap with typed high-level methods:
  ```typescript
  // electron/ipc/git.ts
  async function branches(repoPath: string): Promise<Branch[]> {
    const result = await GitProcess.exec(['branch', '--format=%(refname:short)%(HEAD)', '-l'], repoPath);
    // Parse result.stdout...
  }
  ```
- **Worktree operations**: Use raw git commands (`worktree add`, `worktree list --porcelain`, `worktree remove`). No JS library has high-level worktree APIs.
- **Long paths**: At startup, check and enable `core.longpaths`:
  ```typescript
  await GitProcess.exec(['config', '--global', 'core.longpaths', 'true'], repoPath);
  ```
- **CRLF handling**: All git output parsing uses `\r?\n` regex for line splitting. Projects should use `.gitattributes` with `* text=auto`.
- **Path normalization**: Convert all paths to forward slashes before passing to git (`path.replace(/\\/g, '/')`). Git accepts forward slashes on Windows.

### File Watching Strategy

**Do NOT watch `.git` directories.** On Windows, git operations write many temporary files rapidly, causing event storms. File locking issues with `ReadDirectoryChangesW` can also prevent git operations from completing.

Instead, use a two-tier approach:

1. **Working tree changes** — `@parcel/watcher` with ignore rules:
   ```typescript
   const subscription = await watcher.subscribe(projectPath, (err, events) => {
     // Filter and debounce events, then trigger UI refresh
   }, {
     ignore: ['.git', 'node_modules', 'bin', 'obj', '.vs']
   });
   ```
   `@parcel/watcher` uses native `ReadDirectoryChangesW` on Windows — faster and more reliable than chokidar's `fs.watch` wrapper. No polling needed.

2. **Git state changes** (branch, HEAD, index) — poll `git status --porcelain` on a timer:
   ```typescript
   // Every 3 seconds (configurable via settings.git.statusPollInterval)
   setInterval(async () => {
     const status = await GitProcess.exec(['status', '--porcelain', '-b'], repoPath);
     // Compare with previous state, emit change events if different
   }, 3000);
   ```
   Also trigger an immediate poll after any Nexus-initiated git operation (checkout, commit, worktree create, etc.).

### Window Chrome

Use `titleBarStyle: 'hidden'` with `titleBarOverlay` instead of a fully frameless window:

```typescript
const win = new BrowserWindow({
  titleBarStyle: 'hidden',
  titleBarOverlay: {
    color: '#0f0f17',           // Match app background
    symbolColor: '#9ca3af',     // Muted window control icons
    height: 36,
  },
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    preload: path.join(__dirname, 'preload.js'),
  }
});
```

This preserves native window controls (minimize/maximize/close), Windows 11 snap layouts (Win+Z), and accessibility settings. The draggable title bar region is CSS:

```css
.titlebar { -webkit-app-region: drag; }
.titlebar button, .titlebar input { -webkit-app-region: no-drag; }
```

### Build & Packaging

- **electron-builder** with NSIS target for Windows installers
- **electron-updater** for auto-updates with delta support
- **Code signing**: EV certificate recommended to avoid SmartScreen warnings for new publishers
- **`asarUnpack`** for native modules (`@lydell/node-pty`, `dugite-native` git binaries)
- **Single instance lock**: `app.requestSingleInstanceLock()` to prevent concurrent config file access

### Security Baseline

```typescript
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
  allowRunningInsecureContent: false,
}
```

- Sensitive config values (API tokens, secrets) encrypted via `safeStorage.encryptString()` (uses Windows DPAPI)
- Strict CSP headers via `session.defaultSession.webRequest.onHeadersReceived`
- Navigation blocked via `will-navigate` handler; popups denied via `setWindowOpenHandler`
- DevTools stripped or gated behind a flag in production builds

### Windows-Specific Hardening Checklist

- [ ] `windowsHide: true` on all `child_process.spawn` calls
- [ ] `core.longpaths` enabled at startup
- [ ] All paths normalized to forward slashes before git operations
- [ ] Git output parsed with `\r?\n` for line splitting
- [ ] `EPERM` errors handled gracefully (antivirus/indexer file locks — retry with backoff)
- [ ] `asarUnpack` configured for `@lydell/node-pty` and `dugite`
- [ ] `app.requestSingleInstanceLock()` prevents multiple instances
- [ ] Default shell resolved at startup (pwsh > powershell > cmd)
- [ ] File watcher ignores `.git`, `node_modules`, `bin`, `obj`, `.vs`

---

## Implementation Phases

### Phase 1: Shell & Project Management (MVP)
- Electron app with React + Vite (electron-vite)
- Windows platform foundation: titleBarOverlay, shell detection, path normalization
- dugite integration with typed git wrapper
- @parcel/watcher + git status polling
- Project rail with add/remove/switch
- Git branch list and status display
- Basic diff viewer with hunk expansion
- Commit log
- Settings persistence (electron-store)

### Phase 2: Worktrees & Terminals
- Worktree grid with create/delete
- xterm.js + @lydell/node-pty terminal integration (ConPTY)
- Agent panel with session management
- Launch menu for CLI agents
- Command palette (Ctrl+K / Cmd+K)

### Phase 3: Pipeline System
- Pipeline data model and persistence
- Plan/Execute/Validate phase views
- Built-in plugin definitions
- Plugin selector UI
- Validation chain configuration
- Phase output display and handoff (plan output → execute context)

### Phase 4: Pipeline Execution Engine
- Terminal-based plugin execution
- Output streaming and parsing
- Ralph loop (self-correcting) implementation
- Pipeline run history and status tracking
- Cross-phase context passing

### Phase 5: Polish & Extensions
- User-defined plugin loading (`.nexus-plugin.json`)
- Keyboard shortcut system
- Pop-out terminal windows
- Dark/light theme toggle
- Auto-fetch and background git operations
- Notification system for pipeline completions
- Project grouping / workspaces

---

## Resolved Design Decisions

1. **Output parsing**: **Exit code** is the universal pass/fail signal. Exit 0 = success, non-zero = failure. Optionally, plugins can emit a JSON summary as the last line of stdout (convention: line starting with `{"nexus":`) for structured metrics. Raw output is always captured regardless.

2. **Plan → Execute handoff format**: **Free-form markdown** that the execute plugin interprets. Structured schemas would force all plan plugins into a rigid format. The plan output is stored as a string and injected into the execute plugin's prompt context. If a plugin wants to produce structured data, it can embed JSON blocks in the markdown.

3. **Multi-agent orchestration**: **Sequential only** for v1. Parallel validation adds complexity around terminal multiplexing, failure ordering, and retry semantics. Revisit after the sequential chain is solid.

4. **State management**: **Zustand** — slice-shaped stores (project, pipeline, terminal, ui) map directly to Zustand's pattern. Jotai's atomic model would fight this structure.

5. **File watching**: **@parcel/watcher** for working tree changes + **git status polling** for repo state. Do NOT watch `.git` directories — causes event storms and file locking issues on Windows.

6. **Title bar**: **`titleBarOverlay`** on Windows for native window controls + snap layouts. Fully custom traffic lights on macOS.

## Open Questions

1. **Remote projects**: Support for SSH-based remotes where the agent runs on a remote machine?
2. **Plugin marketplace**: Future concept — shared plugin registry for teams?
3. **Manual execute plugin**: Should it be modeled as a `type: 'watcher'` instead of a command plugin? It's conceptually different — it monitors git state rather than launching a process.
