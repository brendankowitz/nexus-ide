import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { TerminalSession } from '@/types';

interface TerminalState {
  sessions: TerminalSession[];
  activeSessionId: string | null;
}

interface TerminalActions {
  addSession: (session: TerminalSession) => void;
  removeSession: (id: string) => void;
  updateSession: (id: string, patch: Partial<TerminalSession>) => void;
  setActiveSession: (id: string | null) => void;
}

interface TerminalDerived {
  readonly activeSession: TerminalSession | null;
  readonly runningSessions: TerminalSession[];
}

type TerminalStore = TerminalState & TerminalActions & TerminalDerived;

const initialState = {
  sessions: [],
  activeSessionId: null,
} satisfies TerminalState;

export const useTerminalStore = create<TerminalStore>()(
  immer((set, get) => ({
    ...initialState,

    // Derived getters
    get activeSession(): TerminalSession | null {
      const { sessions, activeSessionId } = get();
      return sessions.find((s) => s.id === activeSessionId) ?? null;
    },

    get runningSessions(): TerminalSession[] {
      return get().sessions.filter((s) => s.status === 'running');
    },

    // Actions
    addSession: (session) =>
      set((state: TerminalState) => {
        const exists = state.sessions.some((s) => s.id === session.id);
        if (!exists) {
          state.sessions.push(session);
        }
        if (state.activeSessionId === null) {
          state.activeSessionId = session.id;
        }
      }),

    removeSession: (id) =>
      set((state: TerminalState) => {
        state.sessions = state.sessions.filter((s) => s.id !== id);
        if (state.activeSessionId === id) {
          state.activeSessionId = state.sessions[0]?.id ?? null;
        }
      }),

    updateSession: (id, patch) =>
      set((state: TerminalState) => {
        const session = state.sessions.find((s) => s.id === id);
        if (session !== undefined) {
          const keys = Object.keys(patch) as (keyof TerminalSession)[];
          for (const key of keys) {
            if (patch[key] !== undefined) {
              (session as any)[key] = patch[key]; // eslint-disable-line @typescript-eslint/no-explicit-any
            }
          }
        }
      }),

    setActiveSession: (id) =>
      set((state: TerminalState) => {
        state.activeSessionId = id;
      }),
  }))
);

export const getTerminalState = useTerminalStore.getState;
