import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  Project,
  Branch,
  Worktree,
  GitStatus,
  ProjectGroup,
} from '@/types';

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  activeWorktreePath: string | null;
  gitStatus: Record<string, GitStatus>;
  branches: Record<string, Branch[]>;
  worktrees: Record<string, Worktree[]>;
  groups: ProjectGroup[];
}

interface ProjectActions {
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  removeProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  setActiveWorktreePath: (path: string | null) => void;
  updateGitStatus: (projectId: string, status: GitStatus) => void;
  setBranches: (projectId: string, branches: Branch[]) => void;
  setWorktrees: (projectId: string, worktrees: Worktree[]) => void;
  setGroups: (groups: ProjectGroup[]) => void;
  addGroup: (name: string) => ProjectGroup;
  removeGroup: (id: string) => void;
  renameGroup: (id: string, name: string) => void;
  toggleGroupCollapsed: (id: string) => void;
  moveProjectToGroup: (projectId: string, groupId: string | null) => void;
}

type ProjectStore = ProjectState & ProjectActions;

const initialState = {
  projects: [],
  activeProjectId: null,
  activeWorktreePath: null,
  gitStatus: {},
  branches: {},
  worktrees: {},
  groups: [],
} satisfies ProjectState;

export const useProjectStore = create<ProjectStore>()(
  immer((set, get) => ({
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
        // Remove project from all groups
        for (const group of state.groups) {
          group.projectIds = group.projectIds.filter((pid) => pid !== id);
        }
      }),

    setActiveProject: (id) =>
      set((state: ProjectState) => {
        state.activeProjectId = id;
        state.activeWorktreePath = null;
      }),

    setActiveWorktreePath: (path) =>
      set((state: ProjectState) => {
        state.activeWorktreePath = path;
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

    setGroups: (groups) =>
      set((state: ProjectState) => {
        state.groups = groups;
      }),

    addGroup: (name) => {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
      const newGroup: ProjectGroup = { id, name, projectIds: [], collapsed: false };
      set((state: ProjectState) => {
        state.groups.push(newGroup);
      });
      return get().groups.find((g) => g.id === id) ?? newGroup;
    },

    removeGroup: (id) =>
      set((state: ProjectState) => {
        state.groups = state.groups.filter((g) => g.id !== id);
      }),

    renameGroup: (id, name) =>
      set((state: ProjectState) => {
        const group = state.groups.find((g) => g.id === id);
        if (group) group.name = name;
      }),

    toggleGroupCollapsed: (id) =>
      set((state: ProjectState) => {
        const group = state.groups.find((g) => g.id === id);
        if (group) group.collapsed = !group.collapsed;
      }),

    moveProjectToGroup: (projectId, groupId) =>
      set((state: ProjectState) => {
        // Remove from all groups first
        for (const group of state.groups) {
          group.projectIds = group.projectIds.filter((pid) => pid !== projectId);
        }
        // Add to target group if specified
        if (groupId !== null) {
          const targetGroup = state.groups.find((g) => g.id === groupId);
          if (targetGroup && !targetGroup.projectIds.includes(projectId)) {
            targetGroup.projectIds.push(projectId);
          }
        }
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

const EMPTY_BRANCHES: Branch[] = [];
const EMPTY_WORKTREES: Worktree[] = [];

/** Select branches for the active project. */
export const selectActiveBranches = (s: ProjectState): Branch[] =>
  s.activeProjectId !== null ? (s.branches[s.activeProjectId] ?? EMPTY_BRANCHES) : EMPTY_BRANCHES;

/** Select worktrees for the active project. */
export const selectActiveWorktrees = (s: ProjectState): Worktree[] =>
  s.activeProjectId !== null ? (s.worktrees[s.activeProjectId] ?? EMPTY_WORKTREES) : EMPTY_WORKTREES;

/** Select git status for the active project. */
export const selectActiveStatus = (s: ProjectState): GitStatus | null =>
  s.activeProjectId !== null ? (s.gitStatus[s.activeProjectId] ?? null) : null;

/** Select the active git working directory (worktree path if set, else project root). */
export const selectActiveGitPath = (s: ProjectState): string | null => {
  if (s.activeWorktreePath !== null) return s.activeWorktreePath;
  if (s.activeProjectId === null) return null;
  return s.projects.find((p) => p.id === s.activeProjectId)?.path ?? null;
};
