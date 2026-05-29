<div align="center">
  <img src="build/icon.png" alt="Nexus IDE Logo" width="120"/>
  <h1>Nexus IDE</h1>
  <p>
    <b>Developer Mission Control for AI-Assisted Engineering</b>
  </p>

[![Electron](https://img.shields.io/badge/Electron-39+-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Docs](https://img.shields.io/badge/Docs-GitHub%20Pages-blue)](https://brendankowitz.github.io/nexus-ide/)

</div>

---

> **Project Status:** Early Development / Personal Project. Nexus is an opinionated developer tool exploring "mission control" UX for AI-assisted software engineering. Built for power users managing many repos, branches, worktrees, and agent sessions simultaneously. This project heavily uses the most advanced coding AI agents (with manual validation and code reviews) to implement and iterate quickly.

---

## Overview

**Nexus** is an Electron desktop application built around **project orchestration**, not file editing. It solves the problem of managing many concurrent repositories, branches, worktrees, and AI agent runs by making the **project** the primary unit of navigation.

You describe a task in plain language, dispatch it to an agent in an isolated worktree, watch it run with live status, and review what comes back — all from one window, across every repo you've registered.

Nexus is not a code editor. It is a **command center** that sits beside your editor and handles the orchestration layer above it.

**Target user**: A principal+ engineer managing 5–15+ active repositories, using AI coding agents daily, and working across multiple branches and worktrees simultaneously.

<div align="center">
  <br/>
  <img src="docs/screenshot.jpg" alt="Nexus IDE Screenshot" width="900"/>
  <br/>
  <em>Nexus IDE — Workbench mode: dispatch a run, watch it live, review what comes back</em>
  <br/><br/>
</div>

---

## ✨ Key Features

### 🖥️ Two Modes: Workbench & Review

The app has two top-level surfaces, switchable from the title bar:

| Mode | What it's for |
|------|--------------|
| **Workbench** | Launch runs, watch live agent sessions, and manage the Project Rail, branches, and worktrees |
| **Review** | Move through an agent's changed files hunk by hunk — approve, request changes, or skip |

---

### 📁 Project Rail

The persistent left sidebar gives at-a-glance visibility across every registered repo:

- **Live git state** per project — current branch, change count, worktree count, active agent sessions
- **One-click context switching** — select a project and the entire UI pivots to its state
- **Project groups** — create, rename, collapse/expand, and drag-to-reorder to manage density across many repos
- **Directory scanning** — scan a root folder to discover all `.git` repos up to 3 levels deep (skips `node_modules`)
- **Native file watching** via `@parcel/watcher` — git state refreshes automatically when files change on disk

---

### 🚀 Workbench — Start a Run

The Workbench run launcher turns a plain-language task into a running agent:

- Type what you want done, pick a **provider**, and press **Start run** — the agent launches in an isolated worktree
- **Quick starts** — intent presets (Fix a bug, Add a feature, Write tests, Investigate, Refactor, Document) seed the prompt box
- **Task templates** — worked example tasks tagged `feature`, `test`, `refactor`, `bug` you can dispatch directly or adapt
- **Repo readiness check** — surfaces whether `CLAUDE.md` exists and whether worktrees are configured before the first run
- **Live session** — once running, the agent streams into a real PTY terminal with status telemetry

#### Providers

| Provider | Status |
|----------|--------|
| <img src="https://img.shields.io/badge/CC-Claude%20Code-d97757"/> | ✅ Available — model and live status parsed from terminal output |
| <img src="https://img.shields.io/badge/GH-Copilot-7c8cff"/> | ✅ Available — smart PTY sizing so Copilot's TUI renders correctly |
| <img src="https://img.shields.io/badge/CX-Codex-10a37f"/> | 🔜 Coming soon |
| <img src="https://img.shields.io/badge/GM-Gemini-4a90ff"/> | 🔜 Coming soon |
| Custom CLI | 🔜 Coming soon |

---

### 🔀 Branches & Worktrees

Full branch and worktree management without dropping to a terminal:

- List local branches with upstream tracking (ahead/behind remote)
- List remote branches in a hierarchical `origin/*` tree
- Checkout, create, rename, delete, fetch, pull, and push from the UI
- Push with `--force-with-lease` (safe force), with `--set-upstream` on first push
- Set and unset upstream tracking per branch; check out remote branches directly
- **Worktree grid** — visualize all worktrees, create new ones (auto-creates the branch), remove with confirmation
- The active worktree is shown as a pill in both the session header and the Review toolbar

All git operations are powered by [dugite](https://github.com/desktop/dugite) — a bundled Git binary, so no system `git` in PATH is required.

---

### 🔍 Code Review

A keyboard-driven review queue that works through an agent's output file by file:

**Viewing changes:**

| View | What it shows |
|------|--------------|
| **List** | Flat file list with status badges (M/A/D/R) and additions/deletions |
| **Tree** | Hierarchical directory tree with aggregated stats per folder |
| **Groups** | AI-generated thematic groupings — files clustered by feature area |

**Inspecting diffs:**
- Per-hunk diffs inline with syntax highlighting via [Shiki](https://shiki.style/)
- **Monaco Editor full-diff panel** — side-by-side old/new comparison for larger changes
- External diff tool support — configure any tool with `{original}` / `{modified}` placeholders

**Review queue — keyboard-driven:**

| Key | Action |
|-----|--------|
| `J` / `K` | Navigate between files and hunks |
| `A` | Approve & advance to next |
| `R` | Request changes & advance |
| `S` | Skip this file |
| `N` | Jump to next unreviewed |

**Staging & committing:**
- Stage or unstage individual files, or stage everything at once
- Revert a file (discard working-tree changes, restore from HEAD)
- Commit with a message from the UI — worktree-aware throughout

**Commit history:**
- Browse commits with per-file numstat (additions/deletions)
- Drill into any commit to inspect its diff hunks
- AI-authored commit detection via `Co-authored-by` trailers and bot keyword heuristics

---

### ⚡ Live Terminal & Telemetry

Sessions are genuine PTY terminals — not a fake shell:

- Real terminal emulation via [xterm.js](https://xtermjs.org/) (WebGL renderer, canvas fallback)
- PTY managed by `@lydell/node-pty` (ConPTY on Windows)
- Shell auto-detection: `pwsh.exe` → `powershell.exe` → `cmd.exe` (Windows); `$SHELL` / `/bin/zsh` (macOS/Linux)
- **Smart PTY sizing** — dimensions estimated from container at spawn so TUI agents render correctly on first frame
- **Full system PATH** — resolved from the Windows Registry or login shell at launch and merged into every PTY session; `CLAUDE_CODE_GIT_BASH_PATH` auto-detected on Windows

**Live Claude Code telemetry** (parsed from terminal output, no API calls):
- Model chip (e.g. `sonnet`, `opus`) in a color-coded badge on the session header
- LIVE / IDLE state indicator and elapsed run time
- Global agents-running count and CPU load in the status bar

---

## 🏗️ Architecture

Nexus follows a strict **Electron main/renderer split** with typed IPC and Zustand stores:

```
┌──────────────────────────────────────────────────────┐
│  Renderer Process (React 19 + Zustand + Tailwind)    │
│                                                      │
│   projectStore · terminalStore · uiStore             │
│   kanbanStore · toastStore                           │
│           │                                          │
│           │  ipcRenderer.invoke()                    │
├───────────┼──────────────────────────────────────────┤
│  Main Process                                        │
│                                                      │
│   Git (dugite) · Terminals (node-pty)                │
│   File watching (@parcel/watcher)                    │
│   Settings (electron-store + safeStorage)            │
└──────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Shell | Electron 39+ |
| Build | electron-vite |
| Packaging | electron-builder (NSIS / DMG) |
| Frontend | React 19 + TypeScript 6 |
| State | Zustand with Immer |
| Styling | Tailwind CSS 4 |
| Terminal | xterm.js + @lydell/node-pty (ConPTY) |
| Git | dugite (bundled binary) |
| File watching | @parcel/watcher |
| Diff / editor | Monaco Editor |
| Syntax highlight | Shiki |
| Storage | electron-store + safeStorage (DPAPI on Windows) |

---

## 🛠️ Quick Start

### Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [npm 10+](https://www.npmjs.com/)
- An agent CLI — [Claude Code](https://claude.ai/code) or [GitHub Copilot](https://cli.github.com/) (optional; required to launch runs)

> **Note:** Git is bundled via dugite — no system `git` in PATH required.

### Development

```bash
# 1. Clone
git clone https://github.com/brendankowitz/nexus-ide.git
cd nexus-ide

# 2. Install
npm install

# 3. Start with hot reload
npm run dev
```

### Build & Package

```bash
npm run typecheck      # type check
npm run build          # production build
npm run package:win    # Windows NSIS installer
npm run package:mac    # macOS DMG + ZIP
```

### Testing

```bash
npm test               # run the suite
npm run test:watch     # watch mode
```

---

## 📂 Project Structure

```
nexus-ide/
├── electron/                  # Main process
│   ├── main.ts               # Electron entry point
│   ├── preload.ts            # contextBridge (window.nexusAPI)
│   └── ipc/
│       ├── handlers.ts       # IPC channel registry
│       ├── git.ts            # Git operations (dugite)
│       └── terminal.ts       # PTY session management + PATH
├── src/                       # Renderer (React)
│   ├── components/
│   │   ├── layout/           # Shell, TitleBar, ActivityPanel, StatusBar
│   │   ├── projects/         # ProjectRail, ProjectCard
│   │   ├── git/              # MCChangedFiles, MCCommitLog, MCDiffPane,
│   │   │                     # MCQuickEditor, MCReviewContextBar
│   │   ├── kanban/           # KanbanBoard, DispatchPanel, RunsStrip
│   │   ├── agents/           # AgentsInbox
│   │   ├── terminals/        # TerminalTab
│   │   └── shared/           # NexusLogo, ProviderPicker, Badge
│   └── stores/               # projectStore · terminalStore · uiStore
│                             # kanbanStore · toastStore
├── site/                      # Astro docs site (→ GitHub Pages)
├── docs/                      # Specification and design docs
└── build/                     # App icons and build resources
```

---

## 🤝 Contributing

Contributions are welcome! See the `docs/` folder for architecture details and design decisions.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit: `git commit -m 'feat: add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <b>Nexus</b> — Command the swarm, not the windows.
</p>
