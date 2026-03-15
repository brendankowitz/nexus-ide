import { useRef, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type { Project, GitStatus, Phase, ProjectGroup } from '@/types';
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
  groupId?: string;
  groups?: ProjectGroup[];
  onMoveToGroup?: (groupId: string | null) => void;
}

export const ProjectCard = ({
  project,
  gitStatus,
  active,
  worktreeCount,
  agentCount,
  activePhase,
  onClick,
  groupId,
  groups,
  onMoveToGroup,
}: ProjectCardProps): React.JSX.Element => {
  const removeProject = useProjectStore((s) => s.removeProject);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);

  const isClean = gitStatus !== undefined && gitStatus.changeCount === 0;
  const branchName = gitStatus?.branch ?? 'main';
  // Truncate branch for display in the rail
  const displayBranch = branchName.length > 16 ? branchName.slice(0, 16) : branchName;

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showMoveToGroup, setShowMoveToGroup] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const availableGroups = groups ?? [];
  const hasGroups = availableGroups.length > 0;

  async function handleOpenInEditor(): Promise<void> {
    try {
      await window.nexusAPI.terminal.create({
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
      await window.nexusAPI.terminal.create({
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
    setShowMoveToGroup(false);
  }

  function handleMoveToGroup(targetGroupId: string | null): void {
    onMoveToGroup?.(targetGroupId);
    setShowContextMenu(false);
    setShowMoveToGroup(false);
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
          onClick={(e) => e.stopPropagation()}
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
            className={`block w-full text-left px-3 py-2 font-mono text-[11px] text-text-secondary hover:bg-bg-hover transition-colors ${hasGroups ? 'border-b border-border-subtle' : 'border-b border-border-subtle'}`}
          >
            Reveal in Explorer
          </button>

          {/* Move to group section */}
          {hasGroups && (
            <div className="border-b border-border-subtle">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMoveToGroup((v) => !v);
                }}
                className="flex w-full items-center justify-between text-left px-3 py-2 font-mono text-[11px] text-text-secondary hover:bg-bg-hover transition-colors"
              >
                <span>Move to group</span>
                <span className="text-text-ghost">{showMoveToGroup ? '▾' : '▸'}</span>
              </button>
              {showMoveToGroup && (
                <div className="pb-1">
                  {availableGroups.map((g) => (
                    <button
                      key={g.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveToGroup(g.id);
                      }}
                      className={`block w-full text-left pl-5 pr-3 py-1.5 font-mono text-[10px] hover:bg-bg-hover transition-colors ${
                        g.id === groupId ? 'text-text-primary' : 'text-text-tertiary'
                      }`}
                    >
                      {g.id === groupId ? '• ' : ''}{g.name}
                    </button>
                  ))}
                  {groupId !== undefined && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveToGroup(null);
                      }}
                      className="block w-full text-left pl-5 pr-3 py-1.5 font-mono text-[10px] text-text-ghost hover:bg-bg-hover transition-colors"
                    >
                      (ungrouped)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

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
