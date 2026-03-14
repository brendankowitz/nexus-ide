import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { PipelineRun } from '@/types';

interface PipelineState {
  runs: PipelineRun[];
  activeRunId: string | null;
}

interface PipelineActions {
  addRun: (run: PipelineRun) => void;
  updateRun: (id: string, patch: Partial<PipelineRun>) => void;
  removeRun: (id: string) => void;
  setActiveRun: (id: string | null) => void;
}

interface PipelineDerived {
  readonly activeRun: PipelineRun | null;
  readonly runsByStatus: (status: PipelineRun['status']) => PipelineRun[];
}

type PipelineStore = PipelineState & PipelineActions & PipelineDerived;

const initialState = {
  runs: [],
  activeRunId: null,
} satisfies PipelineState;

export const usePipelineStore = create<PipelineStore>()(
  immer((set, get) => ({
    ...initialState,

    // Derived getters
    get activeRun(): PipelineRun | null {
      const { runs, activeRunId } = get();
      return runs.find((r) => r.id === activeRunId) ?? null;
    },

    runsByStatus: (status) => {
      return get().runs.filter((r) => r.status === status);
    },

    // Actions
    addRun: (run) =>
      set((state: PipelineState) => {
        const exists = state.runs.some((r) => r.id === run.id);
        if (!exists) {
          state.runs.push(run);
        }
        if (state.activeRunId === null) {
          state.activeRunId = run.id;
        }
      }),

    updateRun: (id, patch) =>
      set((state: PipelineState) => {
        const run = state.runs.find((r) => r.id === id);
        if (run !== undefined) {
          const keys = Object.keys(patch) as (keyof PipelineRun)[];
          for (const key of keys) {
            if (patch[key] !== undefined) {
              (run as any)[key] = patch[key]; // eslint-disable-line @typescript-eslint/no-explicit-any
            }
          }
        }
      }),

    removeRun: (id) =>
      set((state: PipelineState) => {
        state.runs = state.runs.filter((r) => r.id !== id);
        if (state.activeRunId === id) {
          state.activeRunId = state.runs[0]?.id ?? null;
        }
      }),

    setActiveRun: (id) =>
      set((state: PipelineState) => {
        state.activeRunId = id;
      }),
  }))
);

export const getPipelineState = usePipelineStore.getState;
