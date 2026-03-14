import { useUIStore, type MainTab } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { StatusDot } from '@/components/shared/StatusDot';

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


interface TabDef {
  id: MainTab;
  label: string;
}

const tabs: TabDef[] = [
  { id: 'pipeline', label: 'pipeline' },
  { id: 'branches', label: 'branches' },
  { id: 'worktrees', label: 'worktrees' },
  { id: 'diffs', label: 'diffs' },
  { id: 'log', label: 'log' },
];

export const TabBar = (): React.JSX.Element => {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const gitStatus = useProjectStore((s) =>
    s.activeProjectId !== null ? (s.gitStatus[s.activeProjectId] ?? null) : null
  );
  const worktreeCount = useProjectStore((s) =>
    s.activeProjectId !== null ? (s.worktrees[s.activeProjectId]?.length ?? 0) : 0
  );

  const isSettingsActive = activeTab === 'settings';

  return (
    <div className="flex h-[var(--tab-height)] items-stretch gap-0 border-b border-border-subtle bg-bg-void px-0.5">
      {/* Main navigation tabs */}
      <div className="flex flex-1 items-stretch">
        {tabs.map((tab) => {
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

      {/* Settings utility button -- right-aligned, not a regular tab */}
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
