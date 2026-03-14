import { useCallback } from 'react';
import { useUIStore, type MainTab } from '@/stores/uiStore';
import { useProjectStore, selectActiveProject } from '@/stores/projectStore';
import { useTerminalStore } from '@/stores/terminalStore';

const GearIcon = (): React.JSX.Element => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.3 9.6c.1-.2.1-.4.1-.6 0-.2 0-.4-.1-.6l1.4-1.1a.3.3 0 0 0 .1-.4l-1.3-2.3a.3.3 0 0 0-.4-.1l-1.6.7c-.3-.3-.7-.5-1.1-.7L10.2 3a.3.3 0 0 0-.3-.3H7.1a.3.3 0 0 0-.3.3l-.2 1.5c-.4.2-.8.4-1.1.7l-1.6-.7a.3.3 0 0 0-.4.1L2.2 6.9a.3.3 0 0 0 .1.4L3.7 8.4c-.1.2-.1.4-.1.6 0 .2 0 .4.1.6L2.3 10.7a.3.3 0 0 0-.1.4l1.3 2.3c.1.2.3.2.4.1l1.6-.7c.3.3.7.5 1.1.7l.2 1.5c0 .2.1.3.3.3h2.6c.2 0 .3-.1.3-.3l.2-1.5c.4-.2.8-.4 1.1-.7l1.6.7c.2.1.4 0 .4-.1l1.3-2.3a.3.3 0 0 0-.1-.4l-1.4-1.1Z"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TerminalIcon = (): React.JSX.Element => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M4 6l3 2.5L4 11"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 11h3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

interface StaticTabDef {
  id: MainTab;
  label: string;
}

const staticTabs: StaticTabDef[] = [
  { id: 'pipeline', label: 'pipeline' },
  { id: 'branches', label: 'branches' },
  { id: 'worktrees', label: 'worktrees' },
  { id: 'diffs', label: 'diffs' },
  { id: 'log', label: 'log' },
];

export const TabBar = (): React.JSX.Element => {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const terminalTabs = useUIStore((s) => s.terminalTabs);
  const addTerminalTab = useUIStore((s) => s.addTerminalTab);
  const removeTerminalTab = useUIStore((s) => s.removeTerminalTab);

  const activeProject = useProjectStore(selectActiveProject);
  const addSession = useTerminalStore((s) => s.addSession);

  const gitStatus = useProjectStore((s) =>
    s.activeProjectId !== null ? (s.gitStatus[s.activeProjectId] ?? null) : null
  );
  const worktreeCount = useProjectStore((s) =>
    s.activeProjectId !== null ? (s.worktrees[s.activeProjectId]?.length ?? 0) : 0
  );

  const isSettingsActive = activeTab === 'settings';

  const handleNewTerminalTab = useCallback(async () => {
    if (activeProject === null) return;
    if (!window.nexusAPI?.terminal) return;

    const sessionId = await window.nexusAPI.terminal.create({
      projectId: activeProject.id,
      worktreePath: activeProject.path,
      label: 'Shell',
    });

    addSession({
      id: sessionId,
      projectId: activeProject.id,
      projectName: activeProject.name,
      agentType: 'Shell',
      label: 'Shell',
      status: 'running',
      worktreePath: activeProject.path,
      startedAt: new Date().toISOString(),
    });

    addTerminalTab(sessionId, 'Shell');
  }, [activeProject, addSession, addTerminalTab]);

  return (
    <div className="flex h-[var(--tab-height)] items-stretch gap-0 border-b border-border-subtle bg-bg-void px-0.5">
      {/* Static navigation tabs */}
      <div className="flex items-stretch">
        {staticTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 whitespace-nowrap border-none bg-transparent px-3.5 font-mono text-[11px] transition-colors duration-[var(--duration-fast)] cursor-pointer ${
                isActive
                  ? 'font-medium text-text-primary'
                  : 'font-normal text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {tab.label}
              {tab.id === 'worktrees' && worktreeCount > 0 && (
                <TabCount count={worktreeCount} isActive={isActive} />
              )}
              {tab.id === 'diffs' && gitStatus !== null && gitStatus.changeCount > 0 && (
                <TabCount count={gitStatus.changeCount} isActive={isActive} />
              )}
              {isActive && (
                <div className="absolute bottom-0 left-3.5 right-3.5 h-px bg-text-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Terminal tabs -- after static tabs, before spacer */}
      {terminalTabs.length > 0 && (
        <div className="flex items-stretch border-l border-border-subtle ml-0.5 pl-0.5">
          {terminalTabs.map((tt) => {
            const isActive = activeTab === tt.id;
            return (
              <button
                key={tt.id}
                onClick={() => setActiveTab(tt.id as MainTab)}
                className={`group relative flex items-center gap-1 whitespace-nowrap border-none bg-transparent px-3 font-mono text-[11px] transition-colors duration-[var(--duration-fast)] cursor-pointer ${
                  isActive
                    ? 'font-medium text-text-primary'
                    : 'font-normal text-text-quaternary hover:text-text-secondary'
                }`}
              >
                <TerminalIcon />
                <span className="opacity-80">{tt.label}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTerminalTab(tt.id);
                  }}
                  className="ml-1 flex h-[14px] w-[14px] items-center justify-center rounded-sm text-[10px] opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100 hover:bg-bg-active"
                >
                  x
                </span>
                {isActive && (
                  <div className="absolute bottom-0 left-3 right-3 h-px bg-text-primary" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* New terminal tab button */}
      <button
        onClick={() => { void handleNewTerminalTab(); }}
        title="New terminal tab (Ctrl+T)"
        className="flex items-center justify-center px-2 border-none bg-transparent text-text-ghost transition-colors duration-[var(--duration-fast)] cursor-pointer hover:text-text-secondary"
      >
        <TerminalIcon />
        <span className="ml-0.5 text-[10px]">+</span>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings utility button -- right-aligned */}
      <button
        onClick={() => setActiveTab('settings')}
        title="Settings (Ctrl+,)"
        className={`relative flex items-center justify-center px-3 transition-colors duration-[var(--duration-fast)] cursor-pointer border-none bg-transparent ${
          isSettingsActive
            ? 'text-text-primary'
            : 'text-text-tertiary hover:text-text-secondary'
        }`}
      >
        <GearIcon />
        {isSettingsActive && (
          <div className="absolute bottom-0 left-2 right-2 h-px bg-text-primary" />
        )}
      </button>
    </div>
  );
};

const TabCount = ({ count, isActive }: { count: number; isActive: boolean }): React.JSX.Element => (
  <span
    className={`rounded-[3px] px-[5px] font-mono text-[10px] font-medium ${
      isActive
        ? 'bg-[var(--color-modified)] text-[var(--bg-void)]'
        : 'bg-bg-active text-text-secondary'
    }`}
  >
    {count}
  </span>
);
