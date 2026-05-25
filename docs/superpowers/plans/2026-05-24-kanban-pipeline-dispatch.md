# Kanban ↔ Pipeline Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the kanban board to the existing pipeline engine so dispatching a card creates a real PipelineRun, spawns a terminal session via Claude Code or Copilot CLI, and auto-advances the card's lane when the agent finishes.

**Architecture:** Kanban-centric — `KanbanCard` gains optional `runId` and `sessionId` fields linking it to a `PipelineRun` and `TerminalSession`. A `DispatchPanel` component orchestrates creation via the existing `window.nexusAPI.pipeline` API. Status feeds back through `pipeline.onUpdate`, advancing the card lane automatically.

**Tech Stack:** React 19 + TypeScript, Zustand 5 + Immer, Tailwind v4 CSS custom properties, Vitest (node env — store tests only), `window.nexusAPI` (Electron contextBridge).

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/stores/kanbanStore.ts` | **modify** | Extend KanbanCard interface; add addCard/linkRun/setCardError/removeCard |
| `src/stores/kanbanStore.test.ts` | **modify** | Add tests for the four new actions |
| `src/stores/uiStore.ts` | **modify** | Add focusedSessionId + setFocusedSessionId |
| `src/stores/uiStore.test.ts` | **modify** | Add 3 tests for focusedSessionId |
| `src/lib/providerPlugins.ts` | **create** | Constant map: ProviderId → pipeline plugin ID |
| `src/components/kanban/KanbanLane.tsx` | **modify** | Add onAdd + onCardDispatch props; "+" button in header |
| `src/components/kanban/KanbanCard.tsx` | **modify** | Error badge, "View in terminal" button, "Dispatch" button for backlog/planning |
| `src/components/kanban/DispatchPanel.tsx` | **create** | Inline panel — prompt + project display + async dispatch logic |
| `src/components/kanban/KanbanBoard.tsx` | **modify** | Dispatch panel state; pass onAdd + onCardDispatch to lanes |
| `src/components/agents/AgentsInbox.tsx` | **modify** | Wire Approve/Iterate/Reject buttons to kanbanStore |
| `src/components/shared/ProviderPicker.tsx` | **modify** | Load activeProvider from settings on mount; save on click |
| `src/components/layout/DevPane.tsx` | **modify** | useEffect: switch active terminal when focusedSessionId set |

---

## Task 1: Extend kanbanStore — new fields + actions

**Files:**
- Modify: `src/stores/kanbanStore.ts`
- Modify: `src/stores/kanbanStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Append these new `describe` blocks to `src/stores/kanbanStore.test.ts` (after the existing tests):

```ts
import type { KanbanCard } from './kanbanStore';

const makeCard = (id: string, lane: KanbanCard['lane'] = 'backlog'): KanbanCard => ({
  id,
  lane,
  title: 'Test task',
  project: 'my-project',
  projectId: 'proj-1',
  provider: 'claude',
  story: 'S-1',
  tokens: 0,
  eta: '—',
  age: '0m',
});

describe('addCard', () => {
  it('appends a card to the store', () => {
    useKanbanStore.getState().addCard(makeCard('c1'));
    expect(useKanbanStore.getState().cards).toHaveLength(1);
    expect(useKanbanStore.getState().cards[0].id).toBe('c1');
  });
});

describe('linkRun', () => {
  it('sets runId and sessionId on a card', () => {
    useKanbanStore.getState().addCard(makeCard('c2'));
    useKanbanStore.getState().linkRun('c2', 'run-99', 'sess-99');
    const card = useKanbanStore.getState().cards.find((c) => c.id === 'c2');
    expect(card?.runId).toBe('run-99');
    expect(card?.sessionId).toBe('sess-99');
  });

  it('does not affect other cards', () => {
    useKanbanStore.getState().addCard(makeCard('c3'));
    useKanbanStore.getState().addCard(makeCard('c4'));
    useKanbanStore.getState().linkRun('c3', 'run-99', 'sess-99');
    const other = useKanbanStore.getState().cards.find((c) => c.id === 'c4');
    expect(other?.runId).toBeUndefined();
  });
});

describe('setCardError', () => {
  it('stores the error message on a card', () => {
    useKanbanStore.getState().addCard(makeCard('c5'));
    useKanbanStore.getState().setCardError('c5', 'provider not configured');
    const card = useKanbanStore.getState().cards.find((c) => c.id === 'c5');
    expect(card?.error).toBe('provider not configured');
  });
});

describe('removeCard', () => {
  it('removes the card from the store', () => {
    useKanbanStore.getState().addCard(makeCard('c6'));
    useKanbanStore.getState().removeCard('c6');
    expect(useKanbanStore.getState().cards.find((c) => c.id === 'c6')).toBeUndefined();
  });

  it('does not remove other cards', () => {
    useKanbanStore.getState().addCard(makeCard('c7'));
    useKanbanStore.getState().addCard(makeCard('c8'));
    useKanbanStore.getState().removeCard('c7');
    expect(useKanbanStore.getState().cards.find((c) => c.id === 'c8')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- kanbanStore
```

Expected: FAIL — `makeCard` uses `projectId` which doesn't exist yet; `addCard`, `linkRun`, `setCardError`, `removeCard` actions not found.

- [ ] **Step 3: Update kanbanStore.ts**

Replace the entire contents of `src/stores/kanbanStore.ts`:

```ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type KanbanLane = 'backlog' | 'planning' | 'executing' | 'review' | 'done';
export type ProviderId = 'claude' | 'copilot' | 'codex' | 'gemini' | 'custom';

export interface KanbanCard {
  id: string;
  lane: KanbanLane;
  title: string;
  project: string;     // display name
  projectId: string;   // project.id for API calls
  provider: ProviderId;
  story: string;
  tokens: number;
  eta: string;
  age: string;
  runId?: string;      // links to PipelineRun.id
  sessionId?: string;  // links to TerminalSession.id
  error?: string;      // set when dispatch fails
}

interface KanbanState {
  cards: KanbanCard[];
}

interface KanbanActions {
  seedCards: () => void;
  addCard: (card: KanbanCard) => void;
  move: (cardId: string, lane: KanbanLane) => void;
  linkRun: (cardId: string, runId: string, sessionId: string) => void;
  setCardError: (cardId: string, error: string) => void;
  removeCard: (cardId: string) => void;
  cardsForLane: (lane: KanbanLane) => KanbanCard[];
  liveCards: () => KanbanCard[];
}

const SEED: KanbanCard[] = [
  { id: 'k1',  lane: 'backlog',   title: 'Streaming embed for vectorized-indexer',  project: 'vectorized-indexer',   projectId: '', provider: 'claude',  story: 'STORY-142', tokens: 0,     eta: '—',    age: '3h'  },
  { id: 'k2',  lane: 'backlog',   title: 'Recover from Copilot CLI rate-limit',     project: 'superpowers',          projectId: '', provider: 'custom',  story: 'CHORE-08',  tokens: 0,     eta: '—',    age: '1d'  },
  { id: 'k3',  lane: 'planning',  title: 'JWT migration for ignixa-fhir auth',      project: 'ignixa-fhir',          projectId: '', provider: 'claude',  story: 'STORY-201', tokens: 38400, eta: '~14m', age: '11m' },
  { id: 'k4',  lane: 'planning',  title: 'Thread Gmail MCP responses',              project: 'dotnet-gmail-mcp',     projectId: '', provider: 'gemini',  story: 'STORY-87',  tokens: 12100, eta: '~6m',  age: '6m'  },
  { id: 'k5',  lane: 'executing', title: 'Fix conn-pool leak under load',           project: 'dotnet-sqlserver-mcp', projectId: '', provider: 'claude',  story: 'BUG-1041',  tokens: 81200, eta: '~3m',  age: '24m' },
  { id: 'k6',  lane: 'executing', title: 'Reviewer agent for release/0.4',          project: 'superpowers',          projectId: '', provider: 'codex',   story: 'STORY-91',  tokens: 54800, eta: '~9m',  age: '18m' },
  { id: 'k7',  lane: 'executing', title: 'Adversarial test pass on ingest',         project: 'ignixa-fhir',          projectId: '', provider: 'copilot', story: 'TEST-22',   tokens: 22000, eta: '~12m', age: '15m' },
  { id: 'k8',  lane: 'review',    title: 'Lift duplicate FHIRPath fixtures',        project: 'ignixa-fhir',          projectId: '', provider: 'claude',  story: 'CLEAN-11',  tokens: 7400,  eta: 'done', age: '2h'  },
  { id: 'k9',  lane: 'review',    title: 'Rename "agents" → "runs" in router',      project: 'superpowers',          projectId: '', provider: 'codex',   story: 'REFAC-3',   tokens: 16800, eta: 'done', age: '40m' },
  { id: 'k10', lane: 'done',      title: 'CI matrix for win-arm64',                 project: 'superpowers',          projectId: '', provider: 'claude',  story: 'INFRA-2',   tokens: 9200,  eta: 'done', age: '1d'  },
];

export const useKanbanStore = create<KanbanState & KanbanActions>()(
  immer((set, get) => ({
    cards: [],

    seedCards: () =>
      set((state) => {
        state.cards = SEED.map((c) => ({ ...c }));
      }),

    addCard: (card) =>
      set((state) => {
        state.cards.push(card);
      }),

    move: (cardId, lane) =>
      set((state) => {
        const card = state.cards.find((c) => c.id === cardId);
        if (card) card.lane = lane;
      }),

    linkRun: (cardId, runId, sessionId) =>
      set((state) => {
        const card = state.cards.find((c) => c.id === cardId);
        if (card) {
          card.runId = runId;
          card.sessionId = sessionId;
        }
      }),

    setCardError: (cardId, error) =>
      set((state) => {
        const card = state.cards.find((c) => c.id === cardId);
        if (card) card.error = error;
      }),

    removeCard: (cardId) =>
      set((state) => {
        state.cards = state.cards.filter((c) => c.id !== cardId);
      }),

    cardsForLane: (lane) => get().cards.filter((c) => c.lane === lane),

    liveCards: () => get().cards.filter((c) => c.lane === 'executing' || c.lane === 'review'),
  }))
);
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- kanbanStore
```

Expected: PASS — all tests (original 6 + new 8 = 14 total).

- [ ] **Step 5: Commit**

```
git add src/stores/kanbanStore.ts src/stores/kanbanStore.test.ts
git commit -m "feat: extend kanbanStore with dispatch fields and actions"
```

---

## Task 2: uiStore — add focusedSessionId

**Files:**
- Modify: `src/stores/uiStore.ts`
- Modify: `src/stores/uiStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/stores/uiStore.test.ts`:

```ts
describe('focusedSessionId', () => {
  it('defaults to null', () => {
    expect(useUIStore.getState().focusedSessionId).toBeNull();
  });

  it('setFocusedSessionId stores a session id', () => {
    useUIStore.getState().setFocusedSessionId('sess-abc');
    expect(useUIStore.getState().focusedSessionId).toBe('sess-abc');
  });

  it('setFocusedSessionId can be cleared to null', () => {
    useUIStore.getState().setFocusedSessionId('sess-abc');
    useUIStore.getState().setFocusedSessionId(null);
    expect(useUIStore.getState().focusedSessionId).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```
npm test -- uiStore
```

Expected: FAIL — `focusedSessionId` does not exist.

- [ ] **Step 3: Update uiStore.ts**

In `src/stores/uiStore.ts`:

Add to `UIState` interface (after `activeProvider: ProviderId;`):
```ts
  focusedSessionId: string | null;
```

Add to `UIActions` interface (after `setActiveProvider`):
```ts
  setFocusedSessionId: (id: string | null) => void;
```

Add to `initialState` (after `activeProvider: 'claude' as ProviderId,`):
```ts
  focusedSessionId: null,
```

Add to the immer store body (after `setActiveProvider`):
```ts
    setFocusedSessionId: (id) =>
      set((state) => {
        state.focusedSessionId = id;
      }),
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- uiStore
```

Expected: PASS — 8 tests total (5 original + 3 new).

- [ ] **Step 5: Commit**

```
git add src/stores/uiStore.ts src/stores/uiStore.test.ts
git commit -m "feat: add focusedSessionId to uiStore"
```

---

## Task 3: providerPlugins.ts — provider → plugin ID map

**Files:**
- Create: `src/lib/providerPlugins.ts`

No tests needed — this is a pure constant.

- [ ] **Step 1: Create src/lib/providerPlugins.ts**

```ts
import type { ProviderId } from '@/stores/kanbanStore';

/**
 * Maps a ProviderPicker ID to the execute-phase plugin ID registered in
 * electron/ipc/plugins.ts. Providers absent from this map are not yet wired;
 * the DispatchPanel shows a "not configured" message for them.
 */
export const PROVIDER_PLUGIN_MAP: Partial<Record<ProviderId, string>> = {
  claude:  'fn-task',
  copilot: 'copilot-cli',
};
```

- [ ] **Step 2: Verify typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add src/lib/providerPlugins.ts
git commit -m "feat: add provider plugin ID map"
```

---

## Task 4: KanbanLane — "+" button + dispatch props

**Files:**
- Modify: `src/components/kanban/KanbanLane.tsx`

- [ ] **Step 1: Update KanbanLane.tsx**

Replace the entire contents of `src/components/kanban/KanbanLane.tsx`:

```tsx
import type { KanbanCard, KanbanLane as LaneId } from '@/stores/kanbanStore';
import { KanbanCard as KanbanCardCmp } from './KanbanCard';

const LANE_META: Record<LaneId, { label: string; dotColor: string }> = {
  backlog:   { label: 'Backlog',   dotColor: 'var(--v2-text-faint)' },
  planning:  { label: 'Planning',  dotColor: 'var(--v2-blue)'       },
  executing: { label: 'Executing', dotColor: 'var(--v2-amber)'      },
  review:    { label: 'Review',    dotColor: 'var(--v2-yellow)'     },
  done:      { label: 'Done',      dotColor: 'var(--v2-green)'      },
};

interface KanbanLaneProps {
  id: LaneId;
  cards: KanbanCard[];
  draggingId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (lane: LaneId) => void;
  onAdd: () => void;
  onCardDispatch: (cardId: string, title: string) => void;
}

export const KanbanLane = ({
  id,
  cards,
  draggingId,
  onDragStart,
  onDragEnd,
  onDrop,
  onAdd,
  onCardDispatch,
}: KanbanLaneProps): React.JSX.Element => {
  const meta = LANE_META[id];

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--v2-border-soft)] bg-[var(--v2-bg1)]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDrop(id)}
    >
      {/* Lane header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--v2-border-soft)] px-2.5 py-2">
        <span
          style={{ background: meta.dotColor }}
          className="h-1.5 w-1.5 rounded-full"
        />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--v2-text)]">
          {meta.label}
        </span>
        <span className="font-mono text-[10px] text-[var(--v2-text-faint)]">{cards.length}</span>
        <button
          onClick={onAdd}
          className="ml-auto font-mono text-[14px] leading-none text-[var(--v2-text-faint)] hover:text-[var(--v2-text)] [-webkit-app-region:no-drag]"
          title="Dispatch new task"
        >
          +
        </button>
      </div>

      {/* Scrollable card list */}
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-1.5">
        {cards.map((card) => (
          <KanbanCardCmp
            key={card.id}
            card={card}
            dragging={draggingId === card.id}
            onDragStart={() => onDragStart(card.id)}
            onDragEnd={onDragEnd}
            onDispatch={() => onCardDispatch(card.id, card.title)}
          />
        ))}
        {cards.length === 0 && (
          <div className="rounded-md border border-dashed border-[var(--v2-border)] p-4 text-center text-[11px] text-[var(--v2-text-faint)]">
            drop a task here
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify typecheck**

```
npm run typecheck
```

Expected: TypeScript error — `KanbanCardCmp` doesn't have `onDispatch` prop yet (Task 5 will fix this). If the error is only about that, proceed; the error will resolve after Task 5.

- [ ] **Step 3: Commit**

```
git add src/components/kanban/KanbanLane.tsx
git commit -m "feat: add + button and dispatch props to KanbanLane"
```

---

## Task 5: KanbanCard — error badge + "View in terminal" + "Dispatch" button

**Files:**
- Modify: `src/components/kanban/KanbanCard.tsx`

- [ ] **Step 1: Replace KanbanCard.tsx**

Replace the entire contents of `src/components/kanban/KanbanCard.tsx`:

```tsx
import { useUIStore } from '@/stores/uiStore';
import type { KanbanCard as KanbanCardType } from '@/stores/kanbanStore';
import { PROVIDERS } from '@/components/shared/ProviderPicker';

interface KanbanCardProps {
  card: KanbanCardType;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDispatch: () => void;
}

export const KanbanCard = ({
  card,
  dragging,
  onDragStart,
  onDragEnd,
  onDispatch,
}: KanbanCardProps): React.JSX.Element => {
  const provider = PROVIDERS.find((p) => p.id === card.provider) ?? PROVIDERS[0];
  const isExecuting = card.lane === 'executing';
  const canDispatch = card.lane === 'backlog' || card.lane === 'planning';

  const handleViewInTerminal = (e: React.MouseEvent) => {
    e.stopPropagation();
    useUIStore.getState().setFocusedSessionId(card.sessionId ?? null);
    useUIStore.getState().setActiveMode('workbench');
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{ borderLeftColor: provider.tint, opacity: dragging ? 0.4 : 1 }}
      className="relative cursor-grab rounded-md border border-[var(--v2-border)] border-l-2 bg-[var(--v2-bg2)] p-2.5 select-none"
    >
      {/* Header row: story ID + provider chip */}
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="font-mono text-[9.5px] text-[var(--v2-text-faint)]">{card.story}</span>
        <div className="ml-auto flex-shrink-0">
          <span
            style={{ background: provider.tint, color: '#0e1115' }}
            className="rounded px-1 py-px font-mono text-[9.5px] font-bold"
          >
            {provider.short}
          </span>
        </div>
      </div>

      {/* Title */}
      <p className="mb-2 line-clamp-2 text-[12px] leading-snug text-[var(--v2-text)]">
        {card.title}
      </p>

      {/* Footer */}
      <div className="flex items-center gap-2 font-mono text-[10px] text-[var(--v2-text-faint)]">
        <span className="min-w-0 truncate">{card.project}</span>
        <span className="ml-auto flex-shrink-0">{card.tokens > 0 ? `${(card.tokens / 1000).toFixed(0)}k` : ''}</span>
        <span className="flex-shrink-0">{card.eta}</span>
      </div>

      {/* Executing progress bar */}
      {isExecuting && (
        <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-[var(--v2-bg3)]">
          <div
            style={{ background: provider.tint }}
            className="h-full w-[70%] animate-[kanbanPulse_2.4s_ease-in-out_infinite]"
          />
        </div>
      )}

      {/* Error badge */}
      {card.error !== undefined && (
        <div
          className="mt-1.5 truncate font-mono text-[9.5px] text-[var(--v2-red)]"
          title={card.error}
        >
          ⚠ {card.error}
        </div>
      )}

      {/* View in terminal — only for executing cards that have a session */}
      {isExecuting && card.sessionId !== undefined && card.sessionId !== '' && (
        <button
          onClick={handleViewInTerminal}
          className="mt-1.5 w-full text-left font-mono text-[10px] text-[var(--v2-text-faint)] hover:text-[var(--v2-amber)] [-webkit-app-region:no-drag]"
        >
          View in terminal →
        </button>
      )}

      {/* Dispatch button — only for backlog/planning cards */}
      {canDispatch && (
        <button
          onClick={(e) => { e.stopPropagation(); onDispatch(); }}
          className="mt-1.5 w-full text-left font-mono text-[10px] text-[var(--v2-text-faint)] hover:text-[var(--v2-amber)] [-webkit-app-region:no-drag]"
        >
          Dispatch →
        </button>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify typecheck**

```
npm run typecheck
```

Expected: no errors (KanbanLane now passes `onDispatch`, KanbanCard now accepts it).

- [ ] **Step 3: Commit**

```
git add src/components/kanban/KanbanCard.tsx
git commit -m "feat: add error badge, view-in-terminal, and dispatch button to KanbanCard"
```

---

## Task 6: DispatchPanel — new component

**Files:**
- Create: `src/components/kanban/DispatchPanel.tsx`

- [ ] **Step 1: Create src/components/kanban/DispatchPanel.tsx**

```tsx
import { useState } from 'react';
import { useProjectStore, selectActiveProject } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { useKanbanStore } from '@/stores/kanbanStore';
import { PROVIDERS } from '@/components/shared/ProviderPicker';
import { PROVIDER_PLUGIN_MAP } from '@/lib/providerPlugins';
import type { KanbanLane } from '@/stores/kanbanStore';
import type { PipelineConfig, PipelineUpdate } from '@/types';

interface DispatchPanelProps {
  /** The lane the "+" was clicked in (used to seed a new card). */
  lane: KanbanLane;
  /** If promoting an existing card, its id. Undefined means create a new card. */
  existingCardId?: string;
  /** Pre-filled prompt text (card title when promoting). */
  initialTitle?: string;
  onClose: () => void;
}

export const DispatchPanel = ({
  lane,
  existingCardId,
  initialTitle = '',
  onClose,
}: DispatchPanelProps): React.JSX.Element => {
  const [prompt, setPrompt] = useState(initialTitle);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeProject = useProjectStore(selectActiveProject);
  const activeProvider = useUIStore((s) => s.activeProvider);
  const { addCard, linkRun, setCardError, move } = useKanbanStore();

  const provider = PROVIDERS.find((p) => p.id === activeProvider) ?? PROVIDERS[0];

  const handleSubmit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || activeProject === null) return;

    const pluginId = PROVIDER_PLUGIN_MAP[activeProvider];
    if (pluginId === undefined) {
      setErrorMsg(`"${provider.label}" is not configured. Select Claude Code or Copilot CLI.`);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    // Create a new card if not promoting an existing one
    const cardId = existingCardId ?? crypto.randomUUID();
    if (existingCardId === undefined) {
      addCard({
        id: cardId,
        lane: 'planning',
        title: trimmed.slice(0, 80),
        project: activeProject.name,
        projectId: activeProject.id,
        provider: activeProvider,
        story: '',
        tokens: 0,
        eta: '—',
        age: '0m',
      });
    }

    const config: PipelineConfig = {
      name: trimmed.slice(0, 80),
      projectId: activeProject.id,
      branch: 'main',
      plan: { pluginId: 'manual' },
      execute: { pluginId, config: { prompt: trimmed } },
      validate: { chain: [] },
    };

    try {
      const run = await window.nexusAPI.pipeline.create(activeProject.id, config);
      await window.nexusAPI.pipeline.start(run.id, 'execute');

      // Link card to run (sessionId may arrive later via onUpdate)
      linkRun(cardId, run.id, run.phases.execute?.terminalSessionId ?? '');
      move(cardId, 'executing');

      // Subscribe to pipeline updates for this run
      const capturedCardId = cardId;
      const unsub = window.nexusAPI.pipeline.onUpdate(run.id, (update: PipelineUpdate) => {
        // Capture sessionId once the execute phase starts
        if (update.type === 'phase-start' && update.phase === 'execute') {
          const sid = update.result?.terminalSessionId;
          if (sid) linkRun(capturedCardId, run.id, sid);
        }
        if (update.type === 'complete') {
          move(capturedCardId, 'review');
          unsub();
        }
        if (update.type === 'error') {
          setCardError(capturedCardId, update.data ?? 'Agent failed');
          move(capturedCardId, 'review');
          unsub();
        }
      });

      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCardError(cardId, msg);
      setErrorMsg(msg);
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-50 border-t border-[var(--v2-border)] bg-[var(--v2-bg1)] p-4 shadow-2xl">
      <div className="mx-auto max-w-xl">
        {/* Header */}
        <div className="mb-3 flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wide text-[var(--v2-text-faint)]">
            Dispatch task
          </span>
          <span
            style={{ background: provider.tint, color: '#0e1115' }}
            className="rounded px-1.5 py-px font-mono text-[10px] font-bold"
          >
            {provider.short}
          </span>
          <button
            onClick={onClose}
            className="ml-auto font-mono text-[14px] text-[var(--v2-text-faint)] hover:text-[var(--v2-text)] [-webkit-app-region:no-drag]"
          >
            ✕
          </button>
        </div>

        {/* Prompt input */}
        <textarea
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the task for the agent…"
          rows={3}
          className="w-full resize-none rounded-md border border-[var(--v2-border)] bg-[var(--v2-bg2)] p-2.5 font-mono text-[12px] text-[var(--v2-text)] placeholder:text-[var(--v2-text-faint)] focus:border-[var(--v2-amber)] focus:outline-none [-webkit-app-region:no-drag]"
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSubmit();
          }}
        />

        {/* Warnings */}
        {activeProject === null && (
          <p className="mt-1.5 font-mono text-[10px] text-[var(--v2-red)]">
            No active project — select one in the rail first.
          </p>
        )}
        {errorMsg !== null && (
          <p className="mt-1.5 font-mono text-[10px] text-[var(--v2-red)]">{errorMsg}</p>
        )}

        {/* Footer */}
        <div className="mt-2.5 flex items-center justify-between">
          <span className="font-mono text-[10px] text-[var(--v2-text-faint)]">
            {activeProject?.name ?? '—'} · ⌘↵ to dispatch
          </span>
          <button
            onClick={() => void handleSubmit()}
            disabled={loading || !prompt.trim() || activeProject === null}
            style={{ background: provider.tint }}
            className="rounded-md px-4 py-1.5 font-mono text-[11px] font-bold text-[#0e1115] transition-opacity disabled:opacity-40 [-webkit-app-region:no-drag]"
          >
            {loading ? 'dispatching…' : 'Dispatch →'}
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add src/components/kanban/DispatchPanel.tsx
git commit -m "feat: add DispatchPanel with pipeline dispatch logic"
```

---

## Task 7: KanbanBoard — wire DispatchPanel

**Files:**
- Modify: `src/components/kanban/KanbanBoard.tsx`

- [ ] **Step 1: Replace KanbanBoard.tsx**

Replace the entire contents of `src/components/kanban/KanbanBoard.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useKanbanStore } from '@/stores/kanbanStore';
import type { KanbanLane } from '@/stores/kanbanStore';
import { KanbanLane as KanbanLaneCmp } from './KanbanLane';
import { RunsStrip } from './RunsStrip';
import { DispatchPanel } from './DispatchPanel';

const LANES: KanbanLane[] = ['backlog', 'planning', 'executing', 'review', 'done'];

export const KanbanBoard = (): React.JSX.Element => {
  const cards = useKanbanStore((s) => s.cards);
  const cardsForLane = useKanbanStore((s) => s.cardsForLane);
  const move = useKanbanStore((s) => s.move);
  const seedCards = useKanbanStore((s) => s.seedCards);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dispatchLane, setDispatchLane] = useState<KanbanLane | null>(null);
  const [dispatchCardId, setDispatchCardId] = useState<string | undefined>(undefined);
  const [dispatchInitialTitle, setDispatchInitialTitle] = useState('');

  // Seed once on mount if the store is empty
  useEffect(() => {
    if (cards.length === 0) seedCards();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrop = (lane: KanbanLane) => {
    if (draggingId) move(draggingId, lane);
    setDraggingId(null);
  };

  const openDispatch = (lane: KanbanLane, cardId?: string, title = '') => {
    setDispatchLane(lane);
    setDispatchCardId(cardId);
    setDispatchInitialTitle(title);
  };

  const closeDispatch = () => {
    setDispatchLane(null);
    setDispatchCardId(undefined);
    setDispatchInitialTitle('');
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[var(--v2-bg0)]">
      <RunsStrip />
      <div className="flex min-h-0 flex-1 gap-2.5 overflow-hidden p-3">
        {LANES.map((lane) => (
          <KanbanLaneCmp
            key={lane}
            id={lane}
            cards={cardsForLane(lane)}
            draggingId={draggingId}
            onDragStart={(id) => setDraggingId(id)}
            onDragEnd={() => setDraggingId(null)}
            onDrop={handleDrop}
            onAdd={() => openDispatch(lane)}
            onCardDispatch={(cardId, title) => openDispatch(lane, cardId, title)}
          />
        ))}
      </div>

      {dispatchLane !== null && (
        <DispatchPanel
          lane={dispatchLane}
          existingCardId={dispatchCardId}
          initialTitle={dispatchInitialTitle}
          onClose={closeDispatch}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add src/components/kanban/KanbanBoard.tsx
git commit -m "feat: wire DispatchPanel into KanbanBoard"
```

---

## Task 8: AgentsInbox — wire Approve / Iterate / Reject

**Files:**
- Modify: `src/components/agents/AgentsInbox.tsx`

- [ ] **Step 1: Read the current file**

Read `src/components/agents/AgentsInbox.tsx` to see the current stub buttons (lines 73–85 approximately).

- [ ] **Step 2: Replace the three stub buttons**

Find the "Needs-input actions" section. It currently has three buttons with no `onClick` handlers. Replace that section with:

```tsx
{/* Needs-input actions */}
{group.id === 'needs' && (
  <div className="flex gap-1.5">
    <button
      onClick={() => move(card.id, 'done')}
      className="flex flex-1 items-center justify-center gap-1 rounded-md border border-[var(--v2-green)] px-2 py-1 text-[11px] text-[var(--v2-green)] hover:bg-[var(--v2-green)]/10 [-webkit-app-region:no-drag]"
    >
      ✓ Approve
    </button>
    <button
      onClick={() => move(card.id, 'planning')}
      className="flex flex-1 items-center justify-center gap-1 rounded-md border border-[var(--v2-amber)] px-2 py-1 text-[11px] text-[var(--v2-amber)] hover:bg-[var(--v2-amber)]/10 [-webkit-app-region:no-drag]"
    >
      ↻ Iterate
    </button>
    <button
      onClick={() => removeCard(card.id)}
      className="flex items-center justify-center rounded-md border border-[var(--v2-red)] px-2 py-1 text-[11px] text-[var(--v2-red)] hover:bg-[var(--v2-red)]/10 [-webkit-app-region:no-drag]"
    >
      ✕
    </button>
  </div>
)}
```

Also destructure `move` and `removeCard` from the store. At the top of `AgentsInbox`, the component currently only reads `cards`. Update the store destructuring:

```tsx
const cards = useKanbanStore((s) => s.cards);
const move = useKanbanStore((s) => s.move);
const removeCard = useKanbanStore((s) => s.removeCard);
```

- [ ] **Step 3: Verify typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```
git add src/components/agents/AgentsInbox.tsx
git commit -m "feat: wire Approve/Iterate/Reject actions in AgentsInbox"
```

---

## Task 9: ProviderPicker — persist activeProvider to settings

**Files:**
- Modify: `src/components/shared/ProviderPicker.tsx`

- [ ] **Step 1: Replace ProviderPicker.tsx**

Replace the entire contents of `src/components/shared/ProviderPicker.tsx`:

```tsx
import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import type { ProviderId } from '@/stores/uiStore';

const PROVIDERS: { id: ProviderId; short: string; label: string; tint: string }[] = [
  { id: 'claude',  short: 'CC', label: 'Claude Code',  tint: '#d97757' },
  { id: 'copilot', short: 'GH', label: 'Copilot CLI',  tint: '#7c8cff' },
  { id: 'codex',   short: 'CX', label: 'Codex',        tint: '#10a37f' },
  { id: 'gemini',  short: 'GM', label: 'Gemini',       tint: '#4a90ff' },
  { id: 'custom',  short: '··', label: 'Custom CLI',   tint: '#9aa0a8' },
];

export { PROVIDERS };

interface ProviderPickerProps {
  className?: string;
}

export const ProviderPicker = ({ className }: ProviderPickerProps): React.JSX.Element => {
  const activeProvider = useUIStore((s) => s.activeProvider);
  const setActiveProvider = useUIStore((s) => s.setActiveProvider);

  // Load persisted provider on first mount
  useEffect(() => {
    window.nexusAPI.settings.get().then((s) => {
      const saved = s['ui.activeProvider'] as ProviderId | undefined;
      if (saved !== undefined) setActiveProvider(saved);
    }).catch(() => {
      // settings unavailable in tests or before preload — ignore
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (id: ProviderId) => {
    setActiveProvider(id);
    window.nexusAPI.settings.set({ 'ui.activeProvider': id }).catch(() => {
      // ignore persistence errors
    });
  };

  return (
    <div
      className={`flex gap-0.5 rounded-md border border-[var(--v2-border)] bg-[var(--v2-bg2)] p-0.5 ${className ?? ''}`}
    >
      {PROVIDERS.map((p) => {
        const active = p.id === activeProvider;
        return (
          <button
            key={p.id}
            title={p.label}
            onClick={() => handleSelect(p.id)}
            style={active ? { background: p.tint, color: '#0e1115' } : undefined}
            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold transition-colors duration-100 [-webkit-app-region:no-drag] ${
              active
                ? 'shadow-[inset_0_-1px_0_rgba(0,0,0,.18)]'
                : 'text-[var(--v2-text-faint)] hover:text-[var(--v2-text-dim)]'
            }`}
          >
            {p.short}
          </button>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 2: Verify typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add src/components/shared/ProviderPicker.tsx
git commit -m "feat: persist activeProvider to settings in ProviderPicker"
```

---

## Task 10: DevPane — switch session on focusedSessionId

**Files:**
- Modify: `src/components/layout/DevPane.tsx`

- [ ] **Step 1: Read DevPane.tsx**

Read `src/components/layout/DevPane.tsx` to find where imports and the component body start.

- [ ] **Step 2: Add focusedSessionId effect**

Add `useUIStore` to the imports at the top:

```tsx
import { useUIStore } from '@/stores/uiStore';
```

Inside the `DevPane` component body, after the existing `setActiveSession` destructure, add this `useEffect` (place it after the existing project-change effect, around line 94):

```tsx
// Switch to the focused session when dispatched from the kanban board
const focusedSessionId = useUIStore((s) => s.focusedSessionId);
const setFocusedSessionId = useUIStore((s) => s.setFocusedSessionId);
useEffect(() => {
  if (focusedSessionId !== null) {
    setActiveSession(focusedSessionId);
    setFocusedSessionId(null);
  }
}, [focusedSessionId, setActiveSession, setFocusedSessionId]);
```

- [ ] **Step 3: Verify typecheck and tests**

```
npm run typecheck && npm test
```

Expected: typecheck clean, all tests pass.

- [ ] **Step 4: Verify build**

```
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```
git add src/components/layout/DevPane.tsx
git commit -m "feat: switch active terminal session when focusedSessionId is set"
```

---

## Task 11: Final integration check + push + PR

- [ ] **Step 1: Run full verification**

```
npm run typecheck && npm test && npm run build
```

Expected: typecheck clean, all tests pass, build succeeds.

- [ ] **Step 2: Review git log**

```
git log --oneline origin/main..HEAD
```

Expected: commits for all tasks in this plan plus the earlier v2 UI work.

- [ ] **Step 3: Push branch**

```
git push origin feature/nexus-v2-ui
```

- [ ] **Step 4: Open PR**

```
gh pr create \
  --title "feat: wire kanban board to pipeline dispatch (providers + live sync)" \
  --body "$(cat <<'EOF'
## Summary
- DispatchPanel: create-and-dispatch or promote existing backlog/planning card
- KanbanCard ↔ PipelineRun linked via runId + sessionId fields
- Claude Code (fn-task) and Copilot CLI (copilot-cli) wired; others show toast
- pipeline.onUpdate auto-advances card to review lane on agent completion
- "View in terminal" button on executing cards switches to Workbench + focuses session
- AgentsInbox Approve/Iterate/Reject buttons wired to kanbanStore
- activeProvider persisted to settings (loaded on mount, saved on change)
- DevPane respects focusedSessionId from uiStore

## Not in scope
- Settings UI for provider command paths
- Codex, Gemini, Custom actual wiring
- Token count / ETA from real terminal output

## Test plan
- [ ] `npm run typecheck` clean
- [ ] `npm test` passes (14 kanbanStore tests + 8 uiStore tests)
- [ ] `npm run build` succeeds
- [ ] Click "+" in a lane header → DispatchPanel opens
- [ ] Click "Dispatch →" on a backlog/planning card → panel pre-fills title
- [ ] Dispatching with claude/copilot provider → card moves to executing
- [ ] Dispatching with codex/gemini → error message shown, card stays in planning
- [ ] No active project → dispatch button disabled
- [ ] Approve button in AgentsInbox → card moves to done
- [ ] Iterate button → card moves to planning
- [ ] Reject button → card removed
- [ ] ProviderPicker selection survives app reload

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
