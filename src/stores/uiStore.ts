import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

/** Static tabs are fixed; terminal tabs use the `terminal:${sessionId}` pattern. */
export type StaticTab = 'branches' | 'worktrees' | 'diffs' | 'log' | 'pipeline' | 'settings';
export type MainTab = StaticTab | `terminal:${string}`;

export interface TerminalTabEntry {
  id: string;          // matches the `terminal:${sessionId}` pattern value
  sessionId: string;   // terminal session id from terminalStore
  label: string;       // display label (e.g. "Shell", "Claude Code")
}

interface UIState {
  activeTab: MainTab;
  agentPanelExpanded: boolean;
  commandPaletteOpen: boolean;
  addProjectModalOpen: boolean;
  expandedDiffFiles: Record<string, boolean>;
  lastKeyPressed: string | null;
  terminalTabs: TerminalTabEntry[];
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
  addTerminalTab: (sessionId: string, label: string) => void;
  removeTerminalTab: (id: string) => void;
}

type UIStore = UIState & UIActions;

const initialState = {
  activeTab: 'branches' as MainTab,
  agentPanelExpanded: false,
  commandPaletteOpen: false,
  addProjectModalOpen: false,
  expandedDiffFiles: {} as Record<string, boolean>,
  lastKeyPressed: null,
  terminalTabs: [],
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

    addTerminalTab: (sessionId, label) =>
      set((state) => {
        const id = `terminal:${sessionId}`;
        const exists = state.terminalTabs.some((t) => t.id === id);
        if (!exists) {
          state.terminalTabs.push({ id, sessionId, label });
        }
        state.activeTab = id as MainTab;
      }),

    removeTerminalTab: (id) =>
      set((state) => {
        state.terminalTabs = state.terminalTabs.filter((t) => t.id !== id);
        // If the closed tab was active, fall back to 'branches'
        if (state.activeTab === id) {
          const remaining = state.terminalTabs;
          state.activeTab = remaining.length > 0
            ? (remaining[remaining.length - 1].id as MainTab)
            : 'branches';
        }
      }),
  }))
);

export const getUIState = useUIStore.getState;
