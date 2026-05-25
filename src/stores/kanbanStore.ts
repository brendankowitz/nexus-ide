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
