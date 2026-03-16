import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { useTerminalStore } from '@/stores/terminalStore';
import type { Branch, TerminalSession } from '@/types';

const EMPTY_BRANCHES: Branch[] = [];

// ── Fuzzy matching ────────────────────────────────────────────────────────────

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

// ── Palette item types ────────────────────────────────────────────────────────

type PaletteGroup = 'projects' | 'commands' | 'branches';
type PaletteIconType = 'project' | 'command' | 'branch';

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  group: PaletteGroup;
  icon: PaletteIconType;
  action: () => void | Promise<void>;
}

// ── Helper to create a terminal session object ────────────────────────────────

function makeSession(
  sessionId: string,
  projectId: string,
  projectName: string,
  label: string,
  agentType: string,
  command?: string,
): TerminalSession {
  return {
    id: sessionId,
    projectId,
    projectName,
    agentType,
    label,
    status: 'running',
    command,
    startedAt: new Date().toISOString(),
  };
}

// ── Command Palette component ─────────────────────────────────────────────────

export const CommandPalette = (): React.JSX.Element | null => {
  const isOpen = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const setSettingsModalOpen = useUIStore((s) => s.setSettingsModalOpen);

  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const activeBranchesRaw = useProjectStore((s) =>
    s.activeProjectId !== null ? s.branches[s.activeProjectId] : undefined
  );
  const branches = activeBranchesRaw ?? EMPTY_BRANCHES;

  const addSession = useTerminalStore((s) => s.addSession);
  const setActiveSession = useTerminalStore((s) => s.setActiveSession);

  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Auto-focus and clear query when palette opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const close = (): void => setOpen(false);

  // ── Static commands ─────────────────────────────────────────────────────────

  const staticCommands: PaletteItem[] = [
    {
      id: 'cmd-new-terminal',
      label: 'New terminal',
      hint: 'Ctrl+T',
      group: 'commands',
      icon: 'command',
      action: async () => {
        const project = projects.find((p) => p.id === activeProjectId) ?? projects[0];
        if (project === undefined) return;
        const sessionId = await window.nexusAPI.terminal.create({
          projectId: project.id,
          label: `Terminal — ${project.name}`,
        });
        addSession(makeSession(sessionId, project.id, project.name, `Terminal — ${project.name}`, 'terminal'));
        setActiveSession(sessionId);
        close();
      },
    },
    {
      id: 'cmd-launch-claude',
      label: 'Launch Claude Code',
      hint: 'Ctrl+Shift+A',
      group: 'commands',
      icon: 'command',
      action: async () => {
        const project = projects.find((p) => p.id === activeProjectId) ?? projects[0];
        if (project === undefined) return;
        const sessionId = await window.nexusAPI.terminal.create({
          projectId: project.id,
          command: 'claude',
          label: `Claude — ${project.name}`,
        });
        addSession(makeSession(sessionId, project.id, project.name, `Claude — ${project.name}`, 'claude', 'claude'));
        setActiveSession(sessionId);
        close();
      },
    },
    {
      id: 'cmd-add-project',
      label: 'Add project',
      hint: '',
      group: 'commands',
      icon: 'command',
      action: () => {
        const { setAddProjectModalOpen } = useUIStore.getState();
        setAddProjectModalOpen(true);
        close();
      },
    },
    {
      id: 'cmd-settings',
      label: 'Settings',
      hint: 'Ctrl+,',
      group: 'commands',
      icon: 'command',
      action: () => {
        setSettingsModalOpen(true);
        close();
      },
    },
  ];

  // ── Build all items from live data ──────────────────────────────────────────

  const projectItems: PaletteItem[] = projects.map((p) => ({
    id: `project-${p.id}`,
    label: p.name,
    hint: p.path,
    group: 'projects' as const,
    icon: 'project' as const,
    action: () => {
      setActiveProject(p.id);
      close();
    },
  }));

  const branchItems: PaletteItem[] = branches.map((b) => ({
    id: `branch-${b.name}`,
    label: b.name,
    hint: b.isHead ? 'current' : undefined,
    group: 'branches' as const,
    icon: 'branch' as const,
    action: async () => {
      if (activeProjectId !== null) {
        await window.nexusAPI.git.checkout(activeProjectId, b.name);
      }
      close();
    },
  }));

  const allItems: PaletteItem[] = [...projectItems, ...staticCommands, ...branchItems];

  // ── Compound command parsing: "claude <project-name>" ───────────────────────

  function parseCompoundCommand(q: string): PaletteItem[] {
    const lower = q.toLowerCase().trim();

    if (lower.startsWith('claude ')) {
      const projectQuery = lower.slice('claude '.length).trim();
      if (projectQuery.length === 0) return [];
      return projects
        .filter((p) => fuzzyMatch(projectQuery, p.name))
        .map((p) => ({
          id: `compound-claude-${p.id}`,
          label: `Launch Claude Code in ${p.name}`,
          hint: p.path,
          group: 'commands' as const,
          icon: 'command' as const,
          action: async () => {
            const sessionId = await window.nexusAPI.terminal.create({
              projectId: p.id,
              command: 'claude',
              label: `Claude — ${p.name}`,
            });
            addSession(makeSession(sessionId, p.id, p.name, `Claude — ${p.name}`, 'claude', 'claude'));
            setActiveSession(sessionId);
            close();
          },
        }));
    }

    if (lower.startsWith('terminal ')) {
      const projectQuery = lower.slice('terminal '.length).trim();
      if (projectQuery.length === 0) return [];
      return projects
        .filter((p) => fuzzyMatch(projectQuery, p.name))
        .map((p) => ({
          id: `compound-terminal-${p.id}`,
          label: `New terminal in ${p.name}`,
          hint: p.path,
          group: 'commands' as const,
          icon: 'command' as const,
          action: async () => {
            const sessionId = await window.nexusAPI.terminal.create({
              projectId: p.id,
              label: `Terminal — ${p.name}`,
            });
            addSession(makeSession(sessionId, p.id, p.name, `Terminal — ${p.name}`, 'terminal'));
            setActiveSession(sessionId);
            close();
          },
        }));
    }

    if (lower.startsWith('diff ')) {
      const projectQuery = lower.slice('diff '.length).trim();
      if (projectQuery.length === 0) return [];
      return projects
        .filter((p) => fuzzyMatch(projectQuery, p.name))
        .map((p) => ({
          id: `compound-diff-${p.id}`,
          label: `Open diffs for ${p.name}`,
          hint: p.path,
          group: 'commands' as const,
          icon: 'command' as const,
          action: () => {
            setActiveProject(p.id);
            setActiveTab('diffs');
            close();
          },
        }));
    }

    return [];
  }

  // ── Filter items ────────────────────────────────────────────────────────────

  const filtered: PaletteItem[] = (() => {
    if (query === '') return allItems;

    const compound = parseCompoundCommand(query);
    if (compound.length > 0) return compound;

    return allItems.filter(
      (item) =>
        fuzzyMatch(query, item.label) ||
        (item.hint !== undefined && item.hint !== '' && fuzzyMatch(query, item.hint)),
    );
  })();

  const groups = groupBy(filtered, (i) => i.group);

  // ── Clamp selection when filtered list shrinks ──────────────────────────────

  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  if (!isOpen) return null;

  // ── Keyboard navigation ─────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % Math.max(filtered.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + filtered.length) % Math.max(filtered.length, 1));
    } else if (e.key === 'Enter') {
      const item = filtered[selectedIndex];
      if (item !== undefined) {
        void item.action();
      }
    } else if (e.key === 'Escape') {
      close();
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const groupLabels: Record<string, string> = {
    projects: 'Projects',
    commands: 'Commands',
    branches: 'Branches',
  };

  const iconStyles: Record<string, string> = {
    project: 'bg-[var(--phase-plan-glow)] text-phase-plan',
    command: 'bg-[var(--phase-execute-glow)] text-phase-execute',
    branch: 'bg-bg-active text-text-secondary',
  };

  let flatIndex = 0;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/60 pt-[15vh] backdrop-blur-[4px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="flex w-[560px] max-h-[420px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border-strong bg-bg-raised shadow-[0_24px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)] animate-[palette-enter_150ms_var(--ease-out)]">
        {/* Input */}
        <div className="flex items-center gap-2.5 border-b border-border-subtle px-4 py-3">
          <span className="font-mono text-[11px] font-medium text-text-ghost">&gt;</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search projects, branches, commands..."
            className="flex-1 border-none bg-transparent font-mono text-[13px] text-text-primary caret-phase-plan outline-none placeholder:text-text-ghost"
          />
          <span className="rounded-[3px] bg-bg-active px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary">
            esc
          </span>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <div className="px-2.5 py-6 text-center font-mono text-[12px] text-text-ghost">
              No results
            </div>
          )}
          {(['projects', 'commands', 'branches'] as const).map((groupKey) => {
            const items = groups[groupKey];
            if (items === undefined || items.length === 0) return null;
            return (
              <div key={groupKey}>
                <div className="px-2.5 pb-1 pt-2 font-mono text-[10px] font-semibold uppercase tracking-[1px] text-text-ghost">
                  {groupLabels[groupKey]}
                </div>
                {items.map((item) => {
                  const currentIndex = flatIndex++;
                  const isSelected = currentIndex === selectedIndex;
                  return (
                    <div
                      key={item.id}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-[7px] transition-colors duration-[var(--duration-fast)] ${
                        isSelected ? 'bg-bg-hover' : 'hover:bg-bg-hover'
                      }`}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      onClick={() => void item.action()}
                    >
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-sm)] font-mono text-[10px] ${iconStyles[item.icon]}`}
                      >
                        {item.icon === 'project' ? 'P' : item.icon === 'command' ? '>' : 'B'}
                      </div>
                      <span className="flex-1 font-mono text-[12px] text-text-primary">
                        {item.label}
                      </span>
                      {item.hint !== undefined && item.hint !== '' && (
                        <span className="font-mono text-[10px] text-text-ghost">{item.hint}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex gap-4 border-t border-border-subtle px-4 py-2 font-mono text-[10px] text-text-ghost">
          <span>
            <kbd className="mx-0.5 rounded-sm bg-bg-active px-1 py-px text-text-tertiary">&uarr;</kbd>
            <kbd className="mx-0.5 rounded-sm bg-bg-active px-1 py-px text-text-tertiary">&darr;</kbd>
            {' '}navigate
          </span>
          <span>
            <kbd className="mx-0.5 rounded-sm bg-bg-active px-1 py-px text-text-tertiary">enter</kbd>
            {' '}select
          </span>
          <span>
            <kbd className="mx-0.5 rounded-sm bg-bg-active px-1 py-px text-text-tertiary">esc</kbd>
            {' '}close
          </span>
        </div>
      </div>
    </div>
  );
};

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (result[key] === undefined) {
      result[key] = [];
    }
    result[key].push(item);
  }
  return result;
}
