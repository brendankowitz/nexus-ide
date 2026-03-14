import { useRef, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type { Project, GitStatus, Phase } from '@/types';
import { Badge } from '@/components/shared/Badge';
import { StatusDot } from '@/components/shared/StatusDot';

interface ProjectCardProps {
  project: Project;
  gitStatus?: GitStatus;
  active: boolean;
  worktreeCount?: number;
  agentCount?: number;
  activePhase?: Phase;
  onClick: () => void;
}

export const ProjectCard = ({
  project,
  gitStatus,
  active,
  worktreeCount,
  agentCount,
  activePhase,
  onClick,
}: ProjectCardProps): React.JSX.Element => {
  const removeProject = useProjectStore((s) => s.removeProject);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);

  const isClean = gitStatus !== undefined && gitStatus.changeCount === 0;
  const branchName = gitStatus?.branch ?? 'main';
  // Truncate branch for display in the rail
  const displayBranch = branchName.length > 16 ? branchName.slice(0, 16) : branchName;

  const [showContextMenu, setShowContextMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  async function handleOpenInEditor(): Promise<void> {
    try {
      const sessionId = await window.nexusAPI.terminal.create({
        projectId: project.id,
        command: 'code',
        args: [project.path],
        label: 'Editor',
      });
      setShowContextMenu(false);
    } catch (err) {
      console.error('[ProjectCard] openInEditor failed:', err);
    }
  }

  async function handleOpenTerminal(): Promise<void> {
    try {
      const sessionId = await window.nexusAPI.terminal.create({
        projectId: project.id,
        cwd: project.path,
        label: `Terminal - ${project.name}`,
      });
      setShowContextMenu(false);
    } catch (err) {
      console.error('[ProjectCard] openTerminal failed:', err);
    }
  }

  async function handleRemove(): Promise<void> {
    try {
      await window.nexusAPI.projects.remove(project.id);
      removeProject(project.id);
      setShowContextMenu(false);
    } catch (err) {
      console.error('[ProjectCard] remove failed:', err);
    }
  }

  async function handleRevealInExplorer(): Promise<void> {
    try {
      await window.nexusAPI.shell.showInFolder(project.path);
      setShowContextMenu(false);
    } catch (err) {
      console.error('[ProjectCard] revealInExplorer failed:', err);
    }
  }

  function handleContextMenu(e: React.MouseEvent<HTMLDivElement>): void {
    e.preventDefault();
    setShowContextMenu(!showContextMenu);
  }

  return (
    <div
      onClick={onClick}
      onContextMenu={handleContextMenu}
      className={`relative mb-0.5 cursor-pointer rounded-[var(--radius-md)] px-2.5 py-2 transition-colors duration-[var(--duration-fast)] ${
        active ? 'bg-bg-surface' : 'hover:bg-bg-hover'
      }`}
    >
      {/* Active indicator bar */}
      {active && (
        <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-sm bg-phase-plan" />
      )}

      {/* Project name */}
      <div className="truncate font-mono text-[12px] font-medium text-text-primary mb-[3px]">
        {project.name}
      </div>

      {/* Meta row: branch + badges */}
      <div className="flex items-center gap-1.5 font-mono text-[10px] text-text-tertiary">
        <span className="max-w-[100px] truncate text-text-secondary">
          {displayBranch}
        </span>

        <div className="ml-auto flex items-center gap-1">
          {gitStatus !== undefined && gitStatus.changeCount > 0 && (
            <Badge variant="changes">{gitStatus.changeCount}</Badge>
          )}
          {isClean && <Badge variant="clean">{'\u2713'}</Badge>}
          {worktreeCount !== undefined && worktreeCount > 0 && (
            <Badge variant="worktrees">{worktreeCount}wt</Badge>
          )}
          {agentCount !== undefined && agentCount > 0 && (
            <Badge variant="agents">{agentCount}</Badge>
          )}
          {activePhase !== undefined && <StatusDot phase={activePhase} />}
        </div>
      </div>

      {/* Context menu */}
      {showContextMenu && (
        <div
          ref={menuRef}
          className="absolute bottom-full left-0 mb-1 w-48 rounded-[var(--radius-md)] border border-border-strong bg-bg-surface shadow-lg z-[1001]"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleOpenInEditor();
            }}
            className="block w-full text-left px-3 py-2 font-mono text-[11px] text-text-secondary hover:bg-bg-hover transition-colors border-b border-border-subtle"
          >
            Open in Editor
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleOpenTerminal();
            }}
            className="block w-full text-left px-3 py-2 font-mono text-[11px] text-text-secondary hover:bg-bg-hover transition-colors border-b border-border-subtle"
          >
            Open Terminal
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleRevealInExplorer();
            }}
            className="block w-full text-left px-3 py-2 font-mono text-[11px] text-text-secondary hover:bg-bg-hover transition-colors border-b border-border-subtle"
          >
            Reveal in Explorer
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleRemove();
            }}
            className="block w-full text-left px-3 py-2 font-mono text-[11px] text-[var(--color-deleted,#f87171)] hover:bg-bg-hover transition-colors"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
};
