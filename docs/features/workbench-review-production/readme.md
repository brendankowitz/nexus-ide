# Feature: Workbench & Review — Production Ready

**Status**: In Progress
**Created**: 2026-05-27

## Problem Statement

The Nexus v2 UI has four modes (Workbench, Kanban, Agents, Review). Kanban and Agents are
prototype-only and not wired to real data. Workbench and Review are the two modes that are
fully functional end-to-end and should be polished to production quality.

The existing DevPane used old v1 color tokens and a card-strip session layout that didn't
match the Mission Control design spec. The Review mode (SCPanel) is functionally strong but
its visual design predates the MC v2 palette and the updated layout spec.

## Constraints

- Electron 33 + electron-vite + React 19 + TypeScript + Tailwind v4
- v2 warm palette: `--v2-bg0..bg3`, `--v2-amber`, `--v2-green`, `--v2-blue`, `--v2-red`, etc.
- Kanban and Agents modes are disabled (removed from TitleBar) — do not restore
- No mocked/seed data in production views — everything reads from real IPC or store
- xterm.js (WebGL) is the terminal renderer — do not replace it
- LaunchMenu, TerminalTab, TerminalHeader internals should be preserved

## Investigations

| Investigation | Status | Summary |
|--------------|--------|---------|
| [Workbench mode trace](investigations/workbench-trace.md) | Done | Full E2E trace complete; key bugs and gaps identified |
| [Review mode trace](investigations/review-trace.md) | Done | Full E2E trace complete; StageToggle bug, worktree path gaps |
| [Review redesign spec](investigations/review-redesign.md) | Pending | New design from 8zccet0xvBkT8-zHF4fWzA: MCReviewContextBar + History tab |

## Changes Made

### Workbench
- `DevPane.tsx` — Replaced 64px AgentCard strip with `MCSessionStrip` (full-width: provider badge,
  model, elapsed, context gradient bar, stop button) and compact `SessionTabStrip` for multi-session.
  Moved `onClaudeStatus` subscription into DevPane so TerminalHeader can be suppressed.
- `TerminalTab.tsx` — Added `hideHeader` prop; DevPane passes it to suppress redundant header.
- `ActivityPanel.tsx` — Fixed `tokensUsed` → `tokens` field name (token count was never displaying).
- `TitleBar.tsx` — Removed Kanban and Agents tabs.

### Review Mode Redesign — Completed
See [review-redesign.md](investigations/review-redesign.md) for full spec.

Implemented:
1. `MCReviewContextBar` — Repo pill + Branch/Worktree dropdowns + tab toggle with counts
2. `MCChangedFiles` — 280px left rail, status badges (M=blue/A=green/D=red/R=amber), amber active row
3. `MCDiffPane` — right diff pane reusing DiffHunk, WT badge, Approve + Open in editor
4. `MCCommitLog` — timeline visual (colored dots + vertical rule), author badges, amber active row
5. `MCCommitSummary` — commit header + stats + file list + tip box, "View full diff" (amber)
6. `MCCommitDrilldown` — full-pane commit view, 300px file nav, per-file diff, Back button
7. `MCDropdown` — reusable v2 dropdown with click-outside close, ahead/behind/dirty indicators
8. `SCPanel` — full-pane host wiring all MC* components, drilldown takeover

## Decision

*Both Workbench and Review modes are production-ready. Review redesign complete — all MC* components implemented and verified.*
