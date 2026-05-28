import { useEffect, useRef, useState, useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { useUIStore } from '@/stores/uiStore';

const GearIcon = (): React.JSX.Element => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.3 9.6c.1-.2.1-.4.1-.6 0-.2 0-.4-.1-.6l1.4-1.1a.3.3 0 0 0 .1-.4l-1.3-2.3a.3.3 0 0 0-.4-.1l-1.6.7c-.3-.3-.7-.5-1.1-.7L10.2 3a.3.3 0 0 0-.3-.3H7.1a.3.3 0 0 0-.3.3l-.2 1.5c-.4.2-.8.4-1.1.7l-1.6-.7a.3.3 0 0 0-.4.1L2.2 6.9a.3.3 0 0 0 .1.4L3.7 8.4c-.1.2-.1.4-.1.6 0 .2 0 .4.1.6L2.3 10.7a.3.3 0 0 0-.1.4l1.3 2.3c.1.2.3.2.4.1l1.6-.7c.3.3.7.5 1.1.7l.2 1.5c0 .2.1.3.3.3h2.6c.2 0 .3-.1.3-.3l.2-1.5c.4-.2.8-.4 1.1-.7l1.6.7c.2.1.4 0 .4-.1l1.3-2.3a.3.3 0 0 0-.1-.4l-1.4-1.1Z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
import { ProjectCard } from '@/components/projects/ProjectCard';
import { AddProjectModal } from '@/components/projects/AddProjectModal';
import type { ProjectGroup } from '@/types';

// ── GroupHeader ────────────────────────────────────────────────────────────

interface GroupHeaderProps {
  group: ProjectGroup;
  autoRename?: boolean;
  onToggle: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

const GroupHeader = ({ group, autoRename, onToggle, onRename, onDelete }: GroupHeaderProps): React.JSX.Element => {
  const [showMenu, setShowMenu] = useState(false);
  const [renaming, setRenaming] = useState(autoRename ?? false);
  const [renameValue, setRenameValue] = useState(group.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus input when entering rename mode
  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  function commitRename(): void {
    const trimmed = renameValue.trim();
    if (trimmed.length > 0 && trimmed !== group.name) {
      onRename(trimmed);
    } else {
      setRenameValue(group.name);
    }
    setRenaming(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') {
      setRenameValue(group.name);
      setRenaming(false);
    }
  }

  return (
    <div className="group/header flex items-center gap-1 px-3 py-1 mt-1">
      {/* Colored dot + name toggle */}
      <button
        onClick={onToggle}
        className="flex flex-1 items-center gap-1.5 min-w-0 text-left"
        title={group.collapsed ? 'Expand group' : 'Collapse group'}
      >
        <span
          className="inline-block w-2 h-2 rounded-[2px] shrink-0"
          style={{ background: 'var(--v2-border)' }}
        />
        {renaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 bg-bg-void border border-border-strong rounded px-1 py-0.5 font-mono text-[10px] text-text-primary focus:outline-none focus:border-text-tertiary"
          />
        ) : (
          <span className="text-[10.5px] tracking-[0.4px] text-[var(--v2-text-faint)] group-hover/header:text-[var(--v2-text-dim)] transition-colors truncate">
            {group.name}
          </span>
        )}
      </button>

      {/* Options button */}
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu((v) => !v);
          }}
          className="flex h-5 w-5 items-center justify-center rounded text-[11px] text-text-tertiary opacity-0 group-hover/header:opacity-100 hover:text-text-secondary hover:bg-bg-hover transition-all"
          title="Group options"
        >
          ⋯
        </button>
        {showMenu && (
          <div
            ref={menuRef}
            className="absolute right-0 top-full mt-0.5 w-32 rounded-[var(--radius-md)] border border-border-strong bg-bg-surface shadow-lg z-[1002]"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                setRenameValue(group.name);
                setRenaming(true);
              }}
              className="block w-full text-left px-3 py-2 font-mono text-[11px] text-text-secondary hover:bg-bg-hover transition-colors border-b border-border-subtle"
            >
              Rename
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onDelete();
              }}
              className="block w-full text-left px-3 py-2 font-mono text-[11px] text-[var(--color-deleted,#f87171)] hover:bg-bg-hover transition-colors"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── ProjectRail ────────────────────────────────────────────────────────────

export const ProjectRail = (): React.JSX.Element => {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setProjects = useProjectStore((s) => s.setProjects);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const gitStatus = useProjectStore((s) => s.gitStatus);
  const worktrees = useProjectStore((s) => s.worktrees);

  const groups = useProjectStore((s) => s.groups);
  const setGroups = useProjectStore((s) => s.setGroups);
  const addGroup = useProjectStore((s) => s.addGroup);
  const removeGroup = useProjectStore((s) => s.removeGroup);
  const renameGroup = useProjectStore((s) => s.renameGroup);
  const toggleGroupCollapsed = useProjectStore((s) => s.toggleGroupCollapsed);
  const moveProjectToGroup = useProjectStore((s) => s.moveProjectToGroup);

  const showAddModal = useUIStore((s) => s.addProjectModalOpen);
  const setShowAddModal = useUIStore((s) => s.setAddProjectModalOpen);
  const setSettingsModalOpen = useUIStore((s) => s.setSettingsModalOpen);

  // Derive running terminal count per project
  const sessions = useTerminalStore((s) => s.sessions);
  const agentCountByProject = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of sessions) {
      if (s.status !== 'exited') {
        counts[s.projectId] = (counts[s.projectId] ?? 0) + 1;
      }
    }
    return counts;
  }, [sessions]);

  // Track which group was just created so GroupHeader can auto-enter rename mode
  const [newGroupId, setNewGroupId] = useState<string | null>(null);

  // Prevents the save effect from firing before the initial load completes
  const hasLoadedGroupsRef = useRef(false);

  // Load projects and groups on mount
  useEffect(() => {
    async function loadProjectsAndGroups(): Promise<void> {
      if (!window.nexusAPI?.projects) return;
      try {
        const loaded = await window.nexusAPI.projects.list();
        setProjects(loaded);
        if (loaded.length > 0 && loaded[0] !== undefined) {
          setActiveProject(loaded[0].id);
        }
      } catch (err) {
        console.error('[ProjectRail] failed to load projects:', err);
      }

      try {
        const data = await window.nexusAPI?.settings?.get() ?? {};
        const savedGroups = data['projectGroups'];
        if (Array.isArray(savedGroups)) {
          setGroups(savedGroups as ProjectGroup[]);
        }
      } catch (err) {
        console.error('[ProjectRail] failed to load groups:', err);
      }

      hasLoadedGroupsRef.current = true;
    }
    void loadProjectsAndGroups();
  // Run only once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist groups whenever they change (skip until initial load is complete)
  useEffect(() => {
    if (!window.nexusAPI?.settings) return;
    if (!hasLoadedGroupsRef.current) return;
    void window.nexusAPI.settings.set({ projectGroups: groups });
  }, [groups]);

  function handleAddGroup(): void {
    const created = addGroup('New Group');
    setNewGroupId(created.id);
  }

  // Compute grouped and ungrouped sets
  const groupedProjectIds = new Set(groups.flatMap((g) => g.projectIds));
  const ungroupedProjects = projects.filter((p) => !groupedProjectIds.has(p.id));

  const hasAnything = projects.length > 0 || groups.length > 0;

  return (
    <>
      <div className="flex w-[var(--rail-width)] min-w-[var(--rail-width)] flex-col overflow-hidden border-r border-[var(--v2-border)] bg-[var(--v2-bg1)]">
        {/* Header */}
        <div className="flex items-center justify-between px-3 pb-1.5 pt-2.5">
          <span className="text-[11px] uppercase tracking-[0.6px] text-[var(--v2-text-faint)]">
            Projects · {projects.length}
          </span>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center p-0.5 text-[var(--v2-text-faint)] hover:text-[var(--v2-text-dim)] transition-colors cursor-pointer"
            title="Add project"
            style={{ border: 'none', background: 'transparent' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto px-0 py-1 min-h-0">
          {!hasAnything ? (
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
            <>
              {/* Groups with their projects */}
              {groups.map((group) => {
                const groupProjects = group.projectIds
                  .map((id) => projects.find((p) => p.id === id))
                  .filter((p): p is NonNullable<typeof p> => p !== undefined);

                return (
                  <div key={group.id}>
                    <GroupHeader
                      group={group}
                      autoRename={group.id === newGroupId}
                      onToggle={() => toggleGroupCollapsed(group.id)}
                      onRename={(name) => {
                        renameGroup(group.id, name);
                        if (group.id === newGroupId) setNewGroupId(null);
                      }}
                      onDelete={() => removeGroup(group.id)}
                    />
                    {!group.collapsed && groupProjects.map((project) => (
                      <div key={project.id} className="pl-2">
                        <ProjectCard
                          project={project}
                          active={project.id === activeProjectId}
                          gitStatus={gitStatus[project.id]}
                          worktreeCount={worktrees[project.id]?.length}
                          agentCount={agentCountByProject[project.id]}
                          activePhase={undefined}
                          onClick={() => setActiveProject(project.id)}
                          groupId={group.id}
                          groups={groups}
                          onMoveToGroup={(gId) => moveProjectToGroup(project.id, gId)}
                        />
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Ungrouped projects */}
              {ungroupedProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  active={project.id === activeProjectId}
                  gitStatus={gitStatus[project.id]}
                  worktreeCount={worktrees[project.id]?.length}
                  agentCount={agentCountByProject[project.id]}
                  activePhase={undefined}
                  onClick={() => setActiveProject(project.id)}
                  groups={groups}
                  onMoveToGroup={(gId) => moveProjectToGroup(project.id, gId)}
                />
              ))}
            </>
          )}
        </div>

        {/* Footer: watcher count + settings */}
        <div className="shrink-0 border-t border-[var(--v2-border-soft)] px-3 py-2">
          {/* Agent/watcher summary */}
          <div className="flex items-center gap-1.5 mb-1.5 font-mono text-[11px] text-[var(--v2-text-faint)]">
            <span
              className="inline-block w-[7px] h-[7px] rounded-full"
              style={{ background: sessions.some(s => s.status === 'running') ? 'var(--v2-green)' : 'var(--v2-text-faint)' }}
            />
            <span>{sessions.filter(s => s.status !== 'exited').length} agents running</span>
          </div>
          <button
            onClick={() => setSettingsModalOpen(true)}
            title="Settings (Ctrl+,)"
            className="flex w-full cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-1 py-1 text-[var(--v2-text-faint)] transition-colors hover:text-[var(--v2-text-dim)]"
          >
            <GearIcon />
            <span className="font-mono text-[11px]">settings</span>
          </button>
        </div>
      </div>

      {showAddModal && (
        <AddProjectModal onClose={() => setShowAddModal(false)} />
      )}
    </>
  );
};
