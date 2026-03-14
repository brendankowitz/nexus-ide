import { useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { AddProjectModal } from '@/components/projects/AddProjectModal';

export const ProjectRail = (): React.JSX.Element => {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setProjects = useProjectStore((s) => s.setProjects);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const gitStatus = useProjectStore((s) => s.gitStatus);
  const worktrees = useProjectStore((s) => s.worktrees);

  const showAddModal = useUIStore((s) => s.addProjectModalOpen);
  const setShowAddModal = useUIStore((s) => s.setAddProjectModalOpen);

  // Load real projects from IPC on mount
  useEffect(() => {
    async function loadProjects(): Promise<void> {
      try {
        const loaded = await window.nexusAPI.projects.list();
        setProjects(loaded);
        if (loaded.length > 0 && loaded[0] !== undefined) {
          setActiveProject(loaded[0].id);
        }
      } catch (err) {
        console.error('[ProjectRail] failed to load projects:', err);
      }
    }
    void loadProjects();
  // Run only once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="flex w-[var(--rail-width)] min-w-[var(--rail-width)] flex-col overflow-hidden border-r border-border-subtle bg-bg-void">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 pb-2 pt-3">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[2px] text-text-tertiary">
            Projects
          </span>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-border-strong bg-transparent text-[12px] text-text-tertiary transition-all duration-[var(--duration-fast)] hover:border-text-secondary hover:bg-bg-hover hover:text-text-secondary"
          >
            +
          </button>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto px-1.5 py-1">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
              <span className="font-mono text-[11px] text-text-ghost">No projects yet</span>
              <span className="font-mono text-[10px] text-text-ghost">
                Click{' '}
                <button
                  onClick={() => setShowAddModal(true)}
                  className="cursor-pointer text-text-tertiary underline-offset-2 hover:text-text-secondary hover:underline"
                >
                  +
                </button>{' '}
                to add a project
              </span>
            </div>
          ) : (
            projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                active={project.id === activeProjectId}
                gitStatus={gitStatus[project.id]}
                worktreeCount={worktrees[project.id]?.length}
                agentCount={undefined}
                activePhase={undefined}
                onClick={() => setActiveProject(project.id)}
              />
            ))
          )}
        </div>
      </div>

      {showAddModal && (
        <AddProjectModal onClose={() => setShowAddModal(false)} />
      )}
    </>
  );
};
