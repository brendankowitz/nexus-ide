# Investigation: Syntax Highlighting in Diff Hunks

**Feature**: diff-viewer
**Status**: In Progress
**Created**: 2026-03-16

## Approach

Bundle **Shiki** with a curated set of built-in grammars covering the .NET and web languages the user works with daily. At render time, detect language from the file extension already present on `DiffFile.filePath`, tokenise the full file content (or the visible hunk lines), then replace the plain `{line.content}` span in `DiffHunk.tsx` with pre-tokenised `<span>` elements carrying Shiki's semantic colour tokens.

Shiki is chosen over alternatives because:
- It uses the same TextMate grammars as VS Code — output is visually familiar to developers.
- The highlighter is lazily initialised once and cached; subsequent calls are synchronous token lookups.
- Tree-shakeable: only the grammars you explicitly import are bundled.
- Works in Node (Electron main) or browser context (renderer) — no native bindings.

### Built-in languages (proposed bundle)

| Category | Languages |
|----------|-----------|
| .NET | `csharp`, `fsharp`, `vb` |
| Web frontend | `html`, `css`, `scss`, `javascript`, `typescript`, `tsx`, `jsx`, `json` |
| Config / markup | `xml`, `yaml`, `toml`, `markdown` |
| Shell / infra | `bash`, `powershell`, `dockerfile` |
| Other common | `sql`, `python`, `go` |

Extension → language mapping lives in a small static lookup table (e.g. `.cs → csharp`, `.ts → typescript`). Unknown extensions fall back to plain text (current behaviour).

### Rendering strategy

Two options within this approach:

**A — Tokenise hunk lines only (incremental)**
Shiki's `codeToTokens` accepts arbitrary text. Feed just the visible hunk lines as a single string; map tokens back to lines by newline index. Pro: never needs the full file. Con: tokens at the start of a hunk may be mis-coloured if they depend on multi-line context (e.g. an open `/*` comment above the hunk boundary).

**B — Tokenise from full file content (accurate)**
Before expanding a hunk, fetch the file content via `nexusAPI.git` (or read from disk), tokenise the whole thing, then slice the token array to the hunk's line range. Pro: fully accurate. Con: requires an extra IPC call per file open; large files (10 k+ lines) add latency.

**Recommendation**: Start with A (hunk-only). It covers > 95 % of practical cases and adds zero IPC overhead. Add an opt-in "full accuracy" path later if users report miscoloured multi-line constructs.

### Where changes land

1. **`src/lib/syntaxHighlight.ts`** — new module. Lazily initialises Shiki highlighter with the curated grammar list; exports `tokeniseLines(lines: string[], lang: string): TokenLine[][]`.
2. **`src/components/git/DiffHunk.tsx`** — accepts optional `filePath?: string` prop; calls `tokeniseLines` and renders token spans instead of raw `line.content`. Falls back to plain text if language unknown or highlighting fails.
3. **`src/components/git/FullDiffPanel.tsx`** — passes `filePath` down to each `DiffHunk`.
4. **`package.json`** — adds `shiki` dependency.

### Theme integration

Shiki supports VS Code colour themes. Wire it to the app's active theme token (already in CSS vars) so the highlight palette matches the current light/dark mode.

## Tradeoffs

| Pros | Cons |
|------|------|
| VS Code–quality, familiar colours | Adds ~300 kB to bundle (tree-shaken grammar set) |
| Zero native bindings — works in renderer process | First render of a new language has ~5–20 ms grammar parse cost (one-time per session) |
| Graceful fallback for unknown languages | Hunk-only tokenisation can miscolour lines after an unclosed block comment |
| Curated grammar list keeps bundle small | Another dependency to keep updated |
| Theme-aware via existing CSS token system | Token → CSS-var mapping needs a one-time setup shim |

## Alignment

- [x] Follows architectural layering rules — highlight logic in `src/lib/`, not inside components
- [x] Developer Experience — works with zero config; languages detected automatically from extension
- [x] Specification compliance — no spec constraint applies
- [x] Consistent with existing patterns — falls back to current plain-text rendering for unknown types

## Evidence

### Current state (from codebase exploration)

- `DiffHunk.tsx` renders `line.content` as a plain `<span className="whitespace-pre">` — no tokenisation.
- `DiffFile.filePath` (e.g. `"src/Api/Controllers/UserController.cs"`) is already available on the diff object passed to `FullDiffPanel`; it is **not** currently forwarded to `DiffHunk`.
- `package.json` has **no** existing syntax highlighting dependency (no shiki, highlight.js, prism).
- `DiffLine` type carries only `type`, `content`, `oldLineNumber`, `newLineNumber` — language info must come from the parent file path.

### Prior art

- **GitHub / GitLab web UI**: tokenise full file, slice to hunk. Accurate but requires full file fetch.
- **VS Code built-in diff editor**: uses TextMate grammars (same engine as Shiki) on full documents.
- **Gitoxide / lazygit**: plain text only — syntax highlighting is considered out of scope for TUI tools.
- **Shiki docs**: `codeToTokensBase` is the low-level API suitable for line-by-line work without full document context.

### Bundle size reference (Shiki 1.x, tree-shaken)

| Grammar set | Approx. gzipped |
|-------------|----------------|
| Core engine only | ~50 kB |
| + 20 grammars (proposed list) | ~280 kB |
| Full grammar set (all 200+) | ~1.8 MB |

## Other Approaches Worth Investigating

1. **`highlight.js` with auto-detect** — smaller API surface, auto-detects language from content rather than extension. Faster to integrate but colours are less VS Code–faithful and auto-detect adds CPU cost per hunk.
2. **Monaco editor as diff viewer** — replace `DiffHunk.tsx` entirely with Monaco's built-in diff view, getting syntax highlighting, minimap, and folding for free. High fidelity but significant bundle size increase (~2 MB) and loss of the custom view-mode system (list/tree/groups).
3. **Server-side highlighting via Electron main process** — run Shiki in the main process, return pre-rendered HTML over IPC. Keeps renderer bundle lean; adds IPC latency per file open.

## Verdict

*Pending evaluation*
