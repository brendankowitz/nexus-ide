import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ProviderId } from '@/stores/kanbanStore';

export type { ProviderId };
export type SCTab = 'branches' | 'worktrees' | 'diffs' | 'log';
export type AppMode = 'workbench' | 'kanban' | 'agents' | 'review';

interface UIState {
  activeTab: SCTab;
  commandPaletteOpen: boolean;
  addProjectModalOpen: boolean;
  settingsModalOpen: boolean;
  expandedDiffFiles: Record<string, boolean>;
  reviewedFiles: Record<string, { checkedAt: number; signature: string }>;
  lastKeyPressed: string | null;
  activeMode: AppMode;
  activeProvider: ProviderId;
  focusedSessionId: string | null;
}

interface UIActions {
  setActiveTab: (tab: SCTab) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setAddProjectModalOpen: (open: boolean) => void;
  setSettingsModalOpen: (open: boolean) => void;
  toggleDiffFile: (filePath: string) => void;
  expandDiffFile: (filePath: string) => void;
  collapseDiffFile: (filePath: string) => void;
  isDiffFileExpanded: (filePath: string) => boolean;
  setLastKeyPressed: (key: string | null) => void;
  reviewFile: (filePath: string, signature: string) => void;
  unreviewFile: (filePath: string) => void;
  isReviewedAndUnchanged: (filePath: string, signature: string) => boolean;
  purgeStaleReviews: (currentFiles: Array<{ filePath: string; signature: string }>) => void;
  setActiveMode: (mode: AppMode) => void;
  setActiveProvider: (provider: ProviderId) => void;
  setFocusedSessionId: (id: string | null) => void;
}

type UIStore = UIState & UIActions;

const initialState = {
  activeTab: 'worktrees' as SCTab,
  commandPaletteOpen: false,
  addProjectModalOpen: false,
  settingsModalOpen: false,
  expandedDiffFiles: {} as Record<string, boolean>,
  reviewedFiles: {} as Record<string, { checkedAt: number; signature: string }>,
  lastKeyPressed: null,
  activeMode: 'workbench' as AppMode,
  activeProvider: 'claude' as ProviderId,
  focusedSessionId: null,
} satisfies UIState;

export const useUIStore = create<UIStore>()(
  immer((set, get) => ({
    ...initialState,

    setActiveTab: (tab) =>
      set((state) => {
        state.activeTab = tab;
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

    setSettingsModalOpen: (open) =>
      set((state) => {
        state.settingsModalOpen = open;
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

    reviewFile: (filePath, signature) =>
      set((state) => {
        state.reviewedFiles[filePath] = { checkedAt: Date.now(), signature };
        delete state.expandedDiffFiles[filePath];
      }),

    unreviewFile: (filePath) =>
      set((state) => {
        delete state.reviewedFiles[filePath];
      }),

    isReviewedAndUnchanged: (filePath, signature) => {
      const entry = get().reviewedFiles[filePath];
      return !!entry && entry.signature === signature;
    },

    purgeStaleReviews: (currentFiles) =>
      set((state) => {
        const fileMap = new Map(currentFiles.map((f) => [f.filePath, f.signature]));
        for (const fp of Object.keys(state.reviewedFiles)) {
          const currentSig = fileMap.get(fp);
          if (currentSig === undefined || currentSig !== state.reviewedFiles[fp].signature) {
            delete state.reviewedFiles[fp];
          }
        }
      }),

    setActiveMode: (mode) =>
      set((state) => {
        state.activeMode = mode;
      }),

    setActiveProvider: (provider) =>
      set((state) => {
        state.activeProvider = provider;
      }),

    setFocusedSessionId: (id) =>
      set((state) => {
        state.focusedSessionId = id;
      }),
  }))
);

export const getUIState = useUIStore.getState;
