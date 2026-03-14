import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  Project,
  Branch,
  Worktree,
  GitStatus,
} from '@/types';

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  gitStatus: Record<string, GitStatus>;
  branches: Record<string, Branch[]>;
  worktrees: Record<string, Worktree[]>;
}

interface ProjectActions {
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  removeProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  updateGitStatus: (projectId: string, status: GitStatus) => void;
  setBranches: (projectId: string, branches: Branch[]) => void;
  setWorktrees: (projectId: string, worktrees: Worktree[]) => void;
}

type ProjectStore = ProjectState & ProjectActions;

const initialState = {
  projects: [],
  activeProjectId: null,
  gitStatus: {},
  branches: {},
  worktrees: {},
} satisfies ProjectState;

export const useProjectStore = create<ProjectStore>()(
  immer((set) => ({
    ...initialState,

    setProjects: (projects) =>
      set((state: ProjectState) => {
        state.projects = projects;
      }),

    addProject: (project) =>
      set((state: ProjectState) => {
        const exists = state.projects.some((p) => p.id === project.id);
        if (!exists) {
          state.projects.push(project);
        }
      }),

    removeProject: (id) =>
      set((state: ProjectState) => {
        state.projects = state.projects.filter((p) => p.id !== id);
        if (state.activeProjectId === id) {
          state.activeProjectId = state.projects[0]?.id ?? null;
        }
        delete state.gitStatus[id];
        delete state.branches[id];
        delete state.worktrees[id];
      }),

    setActiveProject: (id) =>
      set((state: ProjectState) => {
        state.activeProjectId = id;
      }),

    updateGitStatus: (projectId, status) =>
      set((state: ProjectState) => {
        state.gitStatus[projectId] = status;
      }),

    setBranches: (projectId, branches) =>
      set((state: ProjectState) => {
        state.branches[projectId] = branches;
      }),

    setWorktrees: (projectId, worktrees) =>
      set((state: ProjectState) => {
        state.worktrees[projectId] = worktrees;
      }),
  }))
);

export const getProjectState = useProjectStore.getState;

/* ─── Derived selectors (use these instead of JS getters) ────────────────── */

/** Select the active project. Use: useProjectStore(selectActiveProject) */
export const selectActiveProject = (s: ProjectState): Project | null =>
  s.activeProjectId !== null
    ? s.projects.find((p) => p.id === s.activeProjectId) ?? null
    : null;

/** Select branches for the active project. */
export const selectActiveBranches = (s: ProjectState): Branch[] =>
  s.activeProjectId !== null ? (s.branches[s.activeProjectId] ?? []) : [];

/** Select worktrees for the active project. */
export const selectActiveWorktrees = (s: ProjectState): Worktree[] =>
  s.activeProjectId !== null ? (s.worktrees[s.activeProjectId] ?? []) : [];

/** Select git status for the active project. */
export const selectActiveStatus = (s: ProjectState): GitStatus | null =>
  s.activeProjectId !== null ? (s.gitStatus[s.activeProjectId] ?? null) : null;
