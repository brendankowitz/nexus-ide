# Nexus v2 UI — Design Spec

_Branch: `feature/nexus-v2-ui` · 2026-05-24_

---

## Source material

- Design bundle: `https://api.anthropic.com/v1/design/h/yFAp8QIM7OCagHzgAwiugw` (Nexus v2.html)
- Icon bundle: `https://api.anthropic.com/v1/design/h/NmtLLQtUCce9wCA3SoUJbQ` (Knot-N studies)
- Design directions referenced: A (Mission Control) for IA, B (Swarm) for kanban + runs strip

---

## Scope — what is in this spec

| # | Feature | Notes |
|---|---|---|
| 1 | Provider Weave icon | V8 variant from icon design |
| 2 | Mode tabs in TitleBar | Workbench · Kanban · Agents · Review |
| 3 | Kanban board | New view, 5 lanes, drag-drop, provider chips |
| 4 | Provider picker UI | Visual chip selector, no real CLI wiring |
| 5 | Active runs strip | Horizontal live-runs bar above Kanban |
| 6 | Color system alignment | Warm dark slate + amber tokens alongside existing |

## Scope — deferred to a later spec

- Atelier spec-first workflow
- Cockpit / Superpowers integration
- Actual multi-provider CLI wiring
- Tauri migration

---

## 1 · Provider Weave icon

**Component:** `src/components/shared/NexusLogo.tsx` (new)

SVG implementation of `V8_ProviderWeave` from the icon design. Two vertical strokes (the N bars) in the current foreground ink color, with the diagonal stroke rendered as a linear gradient carrying 5 provider colors in equal bands:

```
CC orange  #d97757
GH indigo  #7c8cff
CX green   #10a37f
GM blue    #4a90ff
SP purple  #b87bff
```

The weave overlay paints the upper-left and lower-right segments of the verticals on top of the diagonal, creating the interlaced knot effect. The icon accepts `size` (number, default 20) and `light` (boolean) props.

Used in:
- `TitleBar.tsx` — replaces the current conic-gradient rounded square logo
- `electron-builder.yml` assets — existing `.ico`/`.png` files remain unchanged (icon export is a separate task)

---

## 2 · Mode tabs

**File:** `TitleBar.tsx` (modify)

The title bar gains a 4-tab strip replacing the current layout approach. Tabs are rendered as pill buttons in a no-drag region:

| Tab ID | Label | Icon | Maps to |
|---|---|---|---|
| `workbench` | Workbench | terminal icon | Current DevPane (unchanged) |
| `kanban` | Kanban | kanban icon | New KanbanBoard component |
| `agents` | Agents | inbox icon | New AgentsInbox component |
| `review` | Review | diff icon | Current SCPanel diffs view |

Active tab stored in `uiStore` as `activeMode: 'workbench' | 'kanban' | 'agents' | 'review'`.

**Shell layout change:** When `activeMode !== 'workbench'`, the SCPanel is hidden (the new Kanban/Agents/Review views are full-width). When `activeMode === 'workbench'`, Shell renders the existing 3-column layout unchanged.

---

## 3 · Kanban board

**File:** `src/components/kanban/KanbanBoard.tsx` (new)

Five lanes, horizontally arranged, each a flex column with a fixed header and scrollable card area.

### Lanes

```
backlog → planning → executing → review → done
```

Each lane header shows: color dot · label · card count · "+" button.

### Cards

Each card shows:
- Provider chip (2-char monospace pill, tinted by provider color) — top-right
- Story/task ID — top-left in monospace, muted
- Title — main text, 2-line clamp
- Project name + token count + ETA — footer in monospace
- Left border: 2px solid in provider tint color
- `executing` cards have an animated progress bar at the bottom

Cards are draggable between lanes (HTML drag-and-drop API, matching the design prototype).

### Data

`src/stores/kanbanStore.ts` (new Zustand store):
- `cards: KanbanCard[]` — id, lane, title, project, provider, story, tokens, eta, age
- `move(cardId, lane)` — moves card between lanes
- No persistence in this iteration (in-memory seed data)

### Provider color map

```ts
const PROVIDER_TINTS = {
  claude:  '#d97757',
  copilot: '#7c8cff',
  codex:   '#10a37f',
  gemini:  '#4a90ff',
  custom:  '#9aa0a8',
};
```

---

## 4 · Provider picker

**File:** `src/components/shared/ProviderPicker.tsx` (new)

A compact segmented control: `CC | GH | CX | GM | ··`

Each segment is a button with monospace text. Active segment has the provider's tint as background with dark text. Inactive segments are transparent with muted text.

Used in:
- `TitleBar.tsx` context bar area (right of branch info)
- `KanbanBoard.tsx` lane header "+" button (pre-selects provider for new card)

State stored in `uiStore` as `activeProvider: string` (default: `'claude'`).

No real CLI wiring — the picker is UI-only; it sets context for future dispatch plumbing.

---

## 5 · Active runs strip

**File:** `src/components/kanban/RunsStrip.tsx` (new)

A horizontal scrollable strip rendered above the KanbanBoard (visible when `activeMode === 'kanban'`).

Shows only cards in `executing` or `review` lanes. Each card is a fixed-width button (240px) showing:
- Provider chip + story ID + status badge (`running` / `review`)
- Title (2-line clamp)
- Project + ETA footer
- Animated progress bar for running cards
- Highlight border when selected

Clicking a card scrolls the kanban board to that card and highlights it.

Strip header: "Active runs · N" label + time-range toggles (5min · 1hr · today — visual only for now).

---

## 6 · Color system alignment

**File:** `src/styles/globals.css` (modify — additive only)

Add a new token group for the v2 warm palette without removing any existing tokens:

```css
/* Nexus v2 warm palette — used by kanban + new components */
--v2-bg0: #0e1115;
--v2-bg1: #13171c;
--v2-bg2: #181d24;
--v2-bg3: #202732;
--v2-border: #252b35;
--v2-border-soft: #1e242d;
--v2-text: #e6e7ea;
--v2-text-dim: #a8aeb8;
--v2-text-faint: #6c7280;
--v2-amber: #d97757;
--v2-amber-dim: #8b4a2a;
--v2-green: #5fb47a;
--v2-blue: #7c9cff;
--v2-red: #e26b6b;
--v2-yellow: #e6c168;
```

Existing components continue to use their current tokens. New kanban components use `--v2-*` tokens. This avoids a risky token rename across the whole codebase.

---

## Component tree (new components only)

```
src/
  components/
    shared/
      NexusLogo.tsx          # V8 provider-weave SVG icon
      ProviderPicker.tsx     # CC|GH|CX|GM|·· segmented control
    kanban/
      KanbanBoard.tsx        # 5-lane board with drag-drop
      KanbanCard.tsx         # Individual card component
      KanbanLane.tsx         # Lane column (header + scrollable cards)
      RunsStrip.tsx          # Horizontal live-runs bar
    agents/
      AgentsInbox.tsx        # Grouped inbox: needs-input/running/queued/done
  stores/
    kanbanStore.ts           # Zustand store for kanban cards
```

---

## Modified files

| File | Change |
|---|---|
| `src/components/layout/TitleBar.tsx` | Add mode tabs, NexusLogo, ProviderPicker |
| `src/components/layout/Shell.tsx` | Render KanbanBoard/AgentsInbox/Review based on activeMode |
| `src/stores/uiStore.ts` | Add `activeMode` + `activeProvider` |
| `src/styles/globals.css` | Add `--v2-*` token block |

---

## What is explicitly not in scope

- KanbanCard persistence (no IPC, no electron-store write)
- Actual provider CLI spawning from the provider picker
- Atelier spec-first view
- Cockpit / Superpowers panel
- Tauri migration

---

## Open questions (for later specs)

1. Should kanban cards eventually map 1:1 to terminal sessions in the Workbench?
2. Does "Review" mode replace the SCPanel entirely or coexist with it?
3. Provider picker: should the active provider persist to disk, or always default to claude?
