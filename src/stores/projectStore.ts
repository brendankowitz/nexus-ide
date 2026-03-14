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

interface ProjectDerived {
  readonly activeProject: Project | null;
  readonly activeProjectBranches: Branch[];
  readonly activeProjectWorktrees: Worktree[];
  readonly activeProjectStatus: GitStatus | null;
}

type ProjectStore = ProjectState & ProjectActions & ProjectDerived;

const initialState = {
  projects: [],
  activeProjectId: null,
  gitStatus: {},
  branches: {},
  worktrees: {},
} satisfies ProjectState;

export const useProjectStore = create<ProjectStore>()(
  immer((set, get) => ({
    ...initialState,

    // Derived getters
    get activeProject(): Project | null {
      const { projects, activeProjectId } = get();
      return projects.find((p) => p.id === activeProjectId) ?? null;
    },
    get activeProjectBranches(): Branch[] {
      const { branches, activeProjectId } = get();
      return activeProjectId !== null ? (branches[activeProjectId] ?? []) : [];
    },
    get activeProjectWorktrees(): Worktree[] {
      const { worktrees, activeProjectId } = get();
      return activeProjectId !== null ? (worktrees[activeProjectId] ?? []) : [];
    },
    get activeProjectStatus(): GitStatus | null {
      const { gitStatus, activeProjectId } = get();
      return activeProjectId !== null ? (gitStatus[activeProjectId] ?? null) : null;
    },

    // Actions
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
