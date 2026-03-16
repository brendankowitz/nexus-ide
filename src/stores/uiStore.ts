import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type SCTab = 'branches' | 'worktrees' | 'diffs' | 'log';

interface UIState {
  activeTab: SCTab;
  commandPaletteOpen: boolean;
  addProjectModalOpen: boolean;
  settingsModalOpen: boolean;
  expandedDiffFiles: Record<string, boolean>;
  reviewedFiles: Record<string, { checkedAt: number; signature: string }>;
  lastKeyPressed: string | null;
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
  }))
);

export const getUIState = useUIStore.getState;
