import { useUIStore, type SCTab } from '@/stores/uiStore';
import { useProjectStore, selectActiveProject, selectActiveWorktrees } from '@/stores/projectStore';
import { BranchList } from '@/components/git/BranchList';
import { DiffViewer } from '@/components/git/DiffViewer';
import { CommitLog } from '@/components/git/CommitLog';
import { WorktreeGrid } from '@/components/git/WorktreeGrid';


const SC_TABS: { id: SCTab; label: string }[] = [
  { id: 'worktrees', label: 'worktrees' },
  { id: 'branches', label: 'branches' },
  { id: 'diffs', label: 'diffs' },
  { id: 'log', label: 'log' },
];

export const SCPanel = (): React.JSX.Element => {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  const gitStatus = useProjectStore((s) =>
    s.activeProjectId !== null ? (s.gitStatus[s.activeProjectId] ?? null) : null
  );

  const worktreeCount = useProjectStore((s) => selectActiveWorktrees(s).length);
  const activeWorktreePath = useProjectStore((s) => s.activeWorktreePath);
  const worktrees = useProjectStore(selectActiveWorktrees);
  const activeProject = useProjectStore(selectActiveProject);

  const activeWorktree = worktrees.find((wt) => wt.path === activeWorktreePath);
  const isWorktreeContext = activeWorktreePath !== null && activeWorktree !== undefined;
  const contextLabel = isWorktreeContext
    ? activeWorktree!.branch.replace(/^refs\/heads\//, '')
    : null;

  return (
    <div
      className="flex flex-col overflow-hidden border-l border-border-subtle bg-bg-void"
      style={{ width: 'var(--sc-panel-width)', minWidth: 'var(--sc-panel-width)' }}
    >
      {/* Tab bar */}
      <div className="flex h-[var(--tab-height)] min-h-[var(--tab-height)] items-stretch border-b border-border-subtle px-0.5">
        {SC_TABS.map((tab) => {
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
              {tab.id === 'diffs' && gitStatus !== null && gitStatus.changeCount > 0 && (
                <span
                  className={`rounded-[3px] px-[5px] font-mono text-[10px] font-medium ${
                    isActive
                      ? 'bg-[var(--color-modified)] text-bg-void'
                      : 'bg-bg-active text-text-secondary'
                  }`}
                >
                  {gitStatus.changeCount}
                </span>
              )}
              {tab.id === 'worktrees' && worktreeCount > 0 && (
                <span
                  className={`rounded-[3px] px-[5px] font-mono text-[10px] font-medium ${
                    isActive
                      ? 'bg-[var(--phase-plan-dim)] text-phase-plan'
                      : 'bg-bg-active text-text-secondary'
                  }`}
                >
                  {worktreeCount}
                </span>
              )}
              {isActive && (
                <div className="absolute bottom-0 left-3.5 right-3.5 h-px bg-text-primary" />
              )}
            </button>
          );
        })}

        <div className="flex-1" />

        {contextLabel !== null && (
          <div
            className="flex items-center gap-1.5 mr-2 px-2 py-0.5 rounded-[var(--radius-sm)] font-mono text-[10px]"
            style={{
              background: isWorktreeContext ? 'var(--phase-execute-glow)' : 'transparent',
              border: isWorktreeContext ? '1px solid var(--phase-execute-dim)' : 'none',
              color: isWorktreeContext ? 'var(--phase-execute)' : 'var(--text-tertiary)',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="6" cy="6" r="2" />
              <line x1="6" y1="1" x2="6" y2="3.5" />
              <line x1="6" y1="8.5" x2="6" y2="11" />
            </svg>
            {contextLabel}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'branches' && <BranchList />}
        {activeTab === 'worktrees' && <WorktreeGrid />}
        {activeTab === 'diffs' && <DiffViewer key={activeWorktreePath ?? '_main'} />}
        {activeTab === 'log' && <CommitLog key={activeWorktreePath ?? '_main'} />}
      </div>
    </div>
  );
};
