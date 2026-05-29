# Kanban ↔ Pipeline Dispatch — Design Spec

_Branch: `feature/nexus-v2-ui` · 2026-05-24_

---

## Scope

Wire the v2 kanban board to the existing pipeline engine so that dispatching a card creates a real `PipelineRun`, spawns a terminal session via the active provider, and auto-advances the card's lane when the agent finishes.

Also wires: AgentsInbox action buttons (Approve / Iterate / Reject), `activeProvider` persistence to settings.

### In scope

| # | Feature |
|---|---|
| 1 | `DispatchPanel` — create-and-dispatch or promote existing card |
| 2 | Kanban card ↔ PipelineRun link (`runId`, `sessionId` on card) |
| 3 | Claude Code + Copilot CLI wired; others show "provider not configured" toast |
| 4 | Terminal exit → card auto-advances to `review` lane |
| 5 | "View in terminal" button on executing cards |
| 6 | AgentsInbox: Approve → done, Iterate → planning, Reject → remove |
| 7 | `activeProvider` persisted to settings (load on init, save on change) |

### Out of scope

- Settings UI for provider command paths
- Pipeline plan/validate phases (execute phase only)
- Codex/Gemini/Custom actual wiring (stubs)
- Token count / ETA wired from real terminal output

---

## Architecture

```
KanbanCard  ──runId──►  PipelineRun  ──sessionId──►  TerminalSession
     │                       │                              │
     │            pipeline.onUpdate                 terminal.onExit
     │                       │                              │
     └───────────────────────▼──────────────────────────────┘
                     kanbanStore.move(cardId, 'review')
```

**Kanban-centric model.** The `KanbanCard` is the work item for its entire lifecycle. A `PipelineRun` is the execution record created at dispatch time. They are linked by `card.runId`. The pipeline's execute phase carries the terminal session ID via `phases.execute.terminalSessionId`.

No new IPC channels are needed. The existing API surface covers everything:
- `window.nexus.pipeline.create / start / onUpdate`
- `window.nexus.terminal.onExit`
- `window.nexus.settings.get / set`

---

## 1 · KanbanCard — extended fields

`src/stores/kanbanStore.ts` — extend `KanbanCard`:

```ts
export interface KanbanCard {
  id: string;
  lane: KanbanLane;
  title: string;
  project: string;       // project name (display)
  projectId: string;     // project id (for API calls) — NEW
  provider: ProviderId;
  story: string;
  tokens: number;
  eta: string;
  age: string;
  runId?: string;        // NEW — links to PipelineRun.id
  sessionId?: string;    // NEW — links to TerminalSession.id
  error?: string;        // NEW — set when dispatch fails; shows error badge
}
```

New store actions:
```ts
addCard: (card: KanbanCard) => void;
linkRun: (cardId: string, runId: string, sessionId: string) => void;
setCardError: (cardId: string, error: string) => void;
removeCard: (cardId: string) => void;
```

`seedCards` is kept for development; on first load the board seeds only when `cards.length === 0` and no real cards have been dispatched (same as today).

---

## 2 · uiStore — focusedSessionId

`src/stores/uiStore.ts` — add to `UIState`:
```ts
focusedSessionId: string | null;
```

Add to `UIActions`:
```ts
setFocusedSessionId: (id: string | null) => void;
```

Default: `null`.

---

## 3 · Provider → Plugin mapping

A constant map in `src/lib/providerPlugins.ts` (new small file):

```ts
export const PROVIDER_PLUGIN_MAP: Partial<Record<ProviderId, string>> = {
  claude:  'fn-task',
  copilot: 'copilot-cli',
};
```

`codex`, `gemini`, and `custom` have no entry. When `PROVIDER_PLUGIN_MAP[provider]` is undefined, dispatch shows a toast — "Provider not configured" — and the card stays in its current lane.

The plugin IDs (`'fn-task'`, `'copilot-cli'`) are confirmed from `electron/ipc/plugins.ts` at implementation time.

---

## 4 · DispatchPanel

**File:** `src/components/kanban/DispatchPanel.tsx` (new)

An inline popover rendered inside `KanbanBoard`. Two trigger sites:

- **"+" button in a lane header** — opens panel with lane pre-set, no existing card
- **"Dispatch" button on a backlog/planning card** — opens panel pre-filled with card title, card already exists

**Fields:**
- Prompt (textarea, required) — the instruction sent to the agent
- Project (dropdown, from `useProjectStore`) — pre-selects active project
- Provider (read from `uiStore.activeProvider`, shown but not editable inline — user changes it via ProviderPicker in TitleBar)

**On submit:**
1. If new card: `kanbanStore.addCard({ id: nanoid(), lane: 'planning', title: prompt.slice(0,80), projectId, provider, ... })`
2. Look up `pluginId = PROVIDER_PLUGIN_MAP[provider]` — if undefined, show toast + abort
3. Build a minimal `PipelineConfig`:
   ```ts
   {
     name: card.title,
     projectId: card.projectId,
     branch: activeProject.branch ?? 'main',
     plan:     { pluginId: 'manual' },
     execute:  { pluginId, config: { prompt } },
     validate: { chain: [] },
   }
   ```
4. `const run = await window.nexus.pipeline.create(card.projectId, config)`
5. `await window.nexus.pipeline.start(run.id, 'execute')`
6. `kanbanStore.linkRun(card.id, run.id, run.phases.execute?.terminalSessionId ?? '')`
7. `kanbanStore.move(card.id, 'executing')`
8. Subscribe: `window.nexus.pipeline.onUpdate(run.id, handleUpdate)` — see §5

On IPC error (step 4–5): `kanbanStore.setCardError(card.id, err.message)`, card stays in `planning` with error badge.

Close panel after successful dispatch.

---

## 5 · Live status sync

Inside `DispatchPanel` after dispatch, a one-time `pipeline.onUpdate` subscription:

```ts
const unsub = window.nexus.pipeline.onUpdate(run.id, (update) => {
  if (update.type === 'complete') {
    kanbanStore.move(card.id, 'review');
    unsub();
  }
  if (update.type === 'error') {
    kanbanStore.setCardError(card.id, update.data ?? 'Agent failed');
    kanbanStore.move(card.id, 'review');
    unsub();
  }
});
```

`terminal.onExit` is not used directly — pipeline.onUpdate wraps it. If `pipeline.onUpdate` is never fired (edge case: main process dies), the card stays in `executing` until the user manually moves it.

---

## 6 · KanbanCard — "View in terminal" + error badge

`src/components/kanban/KanbanCard.tsx` — two new conditional renders:

**Error badge** (when `card.error` is set):
```tsx
{card.error && (
  <div className="mt-1 truncate font-mono text-[9.5px] text-[var(--v2-red)]" title={card.error}>
    ⚠ {card.error}
  </div>
)}
```

**"View in terminal" button** (when `card.sessionId` is set and `card.lane === 'executing'`):
```tsx
{card.sessionId && card.lane === 'executing' && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      useUIStore.getState().setFocusedSessionId(card.sessionId!);
      useUIStore.getState().setActiveMode('workbench');
    }}
    className="mt-1.5 w-full rounded text-[10px] text-[var(--v2-text-faint)] hover:text-[var(--v2-amber)] [-webkit-app-region:no-drag]"
  >
    View in terminal →
  </button>
)}
```

---

## 7 · KanbanBoard — "+" trigger

`src/components/kanban/KanbanBoard.tsx` — add state:
```ts
const [dispatchLane, setDispatchLane] = useState<KanbanLane | null>(null);
const [dispatchCardId, setDispatchCardId] = useState<string | null>(null);
```

Pass `onAdd` prop to `KanbanLane` (which passes it to its header "+"). Render `DispatchPanel` when `dispatchLane !== null`.

---

## 8 · KanbanLane — "+" button in header

`src/components/kanban/KanbanLane.tsx` — add `onAdd: () => void` prop:

```tsx
<button onClick={onAdd} className="ml-auto text-[var(--v2-text-faint)] hover:text-[var(--v2-text)] [-webkit-app-region:no-drag]">
  +
</button>
```

---

## 9 · AgentsInbox — wire action buttons

`src/components/agents/AgentsInbox.tsx` — the three buttons call kanbanStore directly:

```ts
const { move, removeCard } = useKanbanStore();

// Approve
onClick={() => { move(card.id, 'done'); }}

// Iterate
onClick={() => { move(card.id, 'planning'); }}

// Reject
onClick={() => { removeCard(card.id); }}
```

No IPC calls — moving to `done`/`planning` is a UI decision; the pipeline run is already finished.

---

## 10 · ProviderPicker — settings persistence

`src/components/shared/ProviderPicker.tsx`:

**On mount** (inside `useEffect([], [])`):
```ts
window.nexus.settings.get().then((s) => {
  const saved = s['ui.activeProvider'] as ProviderId | undefined;
  if (saved) useUIStore.getState().setActiveProvider(saved);
});
```

**On click** (after `setActiveProvider`):
```ts
window.nexus.settings.set({ 'ui.activeProvider': p.id });
```

## 6b · DevPane — respect focusedSessionId

When `uiStore.focusedSessionId` is non-null and the user is in `workbench` mode, `DevPane` (or the terminal session list inside it) calls `terminalStore.setActiveSession(focusedSessionId)` and clears `focusedSessionId` immediately after (so subsequent manual tab switches work normally).

The implementation reads `focusedSessionId` from uiStore in a `useEffect`, switches the active terminal, then calls `setFocusedSessionId(null)`. No structural change to DevPane layout is needed.

---

## File map

| File | Status | Change |
|---|---|---|
| `src/components/kanban/DispatchPanel.tsx` | **create** | Panel + dispatch logic |
| `src/lib/providerPlugins.ts` | **create** | Provider → plugin ID map |
| `src/stores/kanbanStore.ts` | **modify** | Extend KanbanCard, add addCard/linkRun/setCardError/removeCard |
| `src/stores/uiStore.ts` | **modify** | Add focusedSessionId + setter |
| `src/components/kanban/KanbanCard.tsx` | **modify** | Error badge + "View in terminal" button |
| `src/components/kanban/KanbanBoard.tsx` | **modify** | Dispatch panel state + trigger |
| `src/components/kanban/KanbanLane.tsx` | **modify** | "+" button in header |
| `src/components/agents/AgentsInbox.tsx` | **modify** | Wire Approve/Iterate/Reject |
| `src/components/shared/ProviderPicker.tsx` | **modify** | Load + save activeProvider to settings |

---

## What is explicitly not in scope

- Settings panel for provider command paths
- Pipeline plan/validate phases
- Codex, Gemini, Custom provider wiring
- Token count / ETA from real terminal output
- Terminal output shown inside the kanban card
