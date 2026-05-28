# Investigation: Review Mode Redesign

**Status**: Implemented
**Source**: Design bundle `8zccet0xvBkT8-zHF4fWzA` · `prototype-mission-control.jsx` lines 485–976

## What the new design specifies

### MCReviewContextBar (replaces 4-tab header)
A single toolbar containing:
- **Repo pill** — folder icon + "Repo" label + project name (static, from active project)
- **Branch dropdown** — branch icon + "Branch" label + current branch, dropdown lists all
  branches with ↑ahead / ↓behind / ●dirty indicators
- **Worktree dropdown** — "wt" label + worktree name, dropdown shows path + branch + dirty
- **Worktree path** — plain text display of selected worktree's path
- **Tab toggle** — "Working changes {N}" | "History {N}" pill switcher

### Changes tab (left 280px | right fill)
Left: `MCChangedFiles`
- Header: "Changed files {N}" · vs {branch} · worktree {name} · total +adds −dels
- Rows: status badge (M/A/D colored) · file path (truncated) · +adds −dels
- Active row: amber left border (2px), bg2 background

Right: `MCDiffPane`
- Header: file path · "{N} hunks" · "by" author badge (CC=amber, human=gray) · "Approve" button · "Open in editor"
- Body: standard hunk view (line# col + sign col + code col) using existing DiffHunk/DiffViewer

### History tab (left 400px | right fill)
Left: `MCCommitLog`
- Timeline: colored dot (by CC=amber, human=gray) + vertical rule connecting commits
- Row: commit subject (truncated) + author badge + sha + time + agentRun tag
- Active row: amber left border + bg2
- Double-click → `MCCommitDrilldown`

Right: `MCCommitSummary`
- Author badge + sha + author name + time + agentRun (if agent)
- Subject (15px, font-weight 500)
- Stats: +adds −dels · N files · parent sha
- Action buttons: "View full diff" (amber) + "Copy sha"
- Files list: status + path + adds/dels per file (rows with bg1 border borderSoft)
- Tip box (dashed border)

### MCCommitDrilldown (replaces right pane entirely — full Review area)
- Header: ← Back button · author badge · sha · subject · author · time · stats · Approve/Cherry-pick/Revert
- Left 300px: files in commit list (active row amber border)
- Right: status + path header · hunk diff view

## Mapping to existing code

| New Component | Existing Component | Action |
|---|---|---|
| MCReviewContextBar | SCPanel tabs (Diffs/Branches/Worktrees/Log) | Replace top bar |
| MCChangedFiles | DiffViewer file list | Restyle, keep DiffViewer data layer |
| MCDiffPane | DiffViewer hunk expansion + FullDiffPanel | Restyle header, keep diff rendering |
| MCCommitLog | CommitLog + GitGraph | Replace GitGraph with timeline visual |
| MCCommitSummary | CommitDetailPanel | Simplify to match design |
| MCCommitDrilldown | CommitDetailPanel slide-in | Replace with full-pane view |
| MCDropdown | — | New shared component |

## Implementation steps

1. Create `MCDropdown` component (reusable styled dropdown with click-outside close)
2. Create `MCReviewContextBar` wired to `useProjectStore` (branches, worktrees, gitStatus)
3. Restyle `MCChangedFiles` (wrapper around existing DiffViewer data, new visual)
4. Restyle `MCCommitLog` — remove GitGraph SVG lane, replace with colored dot + vertical rule
5. Create `MCCommitSummary` (simplified CommitDetailPanel)
6. Create `MCCommitDrilldown` (full-pane commit view with file nav + diff)
7. Update `SCPanel.tsx` to use the new context bar and two-tab layout
8. Apply v2 amber left-border active pattern consistently

## Files to change
- `src/components/layout/SCPanel.tsx` — restructure layout
- `src/components/git/DiffViewer.tsx` — restyle header/file list
- `src/components/git/CommitLog.tsx` — replace GitGraph with timeline
- `src/components/git/CommitDetailPanel.tsx` — simplify to MCCommitSummary shape
- New: `src/components/git/MCDropdown.tsx`
- New: `src/components/git/MCCommitDrilldown.tsx`
