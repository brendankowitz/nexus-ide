import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type MainTab = 'branches' | 'worktrees' | 'diffs' | 'log' | 'pipeline' | 'settings';

interface UIState {
  activeTab: MainTab;
  agentPanelExpanded: boolean;
  commandPaletteOpen: boolean;
  addProjectModalOpen: boolean;
  expandedDiffFiles: Record<string, boolean>;
  lastKeyPressed: string | null;
}

interface UIActions {
  setActiveTab: (tab: MainTab) => void;
  toggleAgentPanel: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setAddProjectModalOpen: (open: boolean) => void;
  toggleDiffFile: (filePath: string) => void;
  expandDiffFile: (filePath: string) => void;
  collapseDiffFile: (filePath: string) => void;
  isDiffFileExpanded: (filePath: string) => boolean;
  setLastKeyPressed: (key: string | null) => void;
}

type UIStore = UIState & UIActions;

const initialState = {
  activeTab: 'branches' as MainTab,
  agentPanelExpanded: false,
  commandPaletteOpen: false,
  addProjectModalOpen: false,
  expandedDiffFiles: {} as Record<string, boolean>,
  lastKeyPressed: null,
} satisfies UIState;

export const useUIStore = create<UIStore>()(
  immer((set, get) => ({
    ...initialState,

    setActiveTab: (tab) =>
      set((state) => {
        state.activeTab = tab;
      }),

    toggleAgentPanel: () =>
      set((state) => {
        state.agentPanelExpanded = !state.agentPanelExpanded;
      }),

    setCommandPaletteOpen: (open) =>
      set((state) => {
        state.commandPaletteOpen = open;
      }),

    toggleCommandPalette: () =>
      set((state) => {
        state.commandPaletteOpen = !state.commandPaletteOpen;
      }),

    setAddProjectModalOpen: (open) =>
      set((state) => {
        state.addProjectModalOpen = open;
      }),

    toggleDiffFile: (filePath) =>
      set((state) => {
        if (state.expandedDiffFiles[filePath]) {
          delete state.expandedDiffFiles[filePath];
        } else {
          state.expandedDiffFiles[filePath] = true;
        }
      }),

    expandDiffFile: (filePath) =>
      set((state) => {
        state.expandedDiffFiles[filePath] = true;
      }),

    collapseDiffFile: (filePath) =>
      set((state) => {
        delete state.expandedDiffFiles[filePath];
      }),

    isDiffFileExpanded: (filePath) => !!get().expandedDiffFiles[filePath],

    setLastKeyPressed: (key) =>
      set((state) => {
        state.lastKeyPressed = key;
      }),
  }))
);

export const getUIState = useUIStore.getState;
