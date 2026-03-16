# Feature: Diff Viewer

**Area**: `src/components/git/`
**Status**: Active

## Overview

The diff viewer shows git working-tree changes across three view modes (list, tree, groups). File hunks are expanded inline in `FullDiffPanel` via `DiffHunk.tsx`, which currently renders all diff lines as plain monospace text with basic added/deleted background colours.

## Key Files

| File | Role |
|------|------|
| `src/components/git/DiffViewer.tsx` | Orchestration: loads diff data, mode switching, staging/commit |
| `src/components/git/DiffHunk.tsx` | Renders individual hunks line-by-line |
| `src/components/git/FullDiffPanel.tsx` | Expanded single-file diff panel |
| `src/components/git/DiffListView.tsx` | List-mode file rows |
| `src/components/git/DiffTreeView.tsx` | Tree-mode file rows |
| `src/components/git/DiffGroupsView.tsx` | AI-groups-mode file rows |
| `src/components/git/diffViewUtils.ts` | Shared utilities |
| `src/types/index.ts` | `DiffFile`, `DiffHunk`, `DiffLine` types |

## Investigations

| Topic | File | Status |
|-------|------|--------|
| Syntax highlighting (built-in .NET/web languages) | `investigations/syntax-highlighting.md` | In Progress |
