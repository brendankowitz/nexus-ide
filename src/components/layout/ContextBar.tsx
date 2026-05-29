import { useProjectStore, selectActiveProject } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { ProviderPicker } from '@/components/shared/ProviderPicker';

const FolderIcon = (): React.JSX.Element => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
  </svg>
);

const BranchIcon = (): React.JSX.Element => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/>
    <path d="M6 8v8M18 8v3a3 3 0 0 1-3 3H6"/>
  </svg>
);

const PlayIcon = (): React.JSX.Element => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 5v14l11-7z"/>
  </svg>
);

export const ContextBar = (): React.JSX.Element => {
  const activeProject = useProjectStore(selectActiveProject);
  const gitStatus = useProjectStore((s) =>
    s.activeProjectId !== null ? (s.gitStatus[s.activeProjectId] ?? null) : null
  );
  const setNewRunRequested = useUIStore((s) => s.setNewRunRequested);
  const setActiveMode = useUIStore((s) => s.setActiveMode);

  const branch = gitStatus?.branch ?? 'main';
  const ahead = gitStatus?.ahead ?? 0;
  const behind = gitStatus?.behind ?? 0;
  const dirty = gitStatus?.changeCount ?? 0;

  const handleNewRun = () => {
    setActiveMode('workbench');
    setNewRunRequested(true);
  };

  return (
    <div className="flex h-10 shrink-0 items-center gap-2.5 border-b border-[var(--v2-border)] bg-[var(--v2-bg1)] px-3">
      {/* Project name */}
      <div className="flex items-center gap-1.5 text-[var(--v2-text-faint)]">
        <FolderIcon />
        <span className="text-[13px] font-medium text-[var(--v2-text)]">
          {activeProject?.name ?? 'no project'}
        </span>
      </div>

      {/* Separator */}
      <span className="text-[var(--v2-text-faint)]">/</span>

      {/* Branch */}
      <div className="flex items-center gap-1.5 font-mono text-[12px] text-[var(--v2-text-dim)]">
        <BranchIcon />
        <span>{branch}</span>
      </div>

      {/* Git indicators */}
      {ahead > 0 && (
        <span className="font-mono text-[11px] text-[var(--v2-green)]">↑{ahead}</span>
      )}
      {behind > 0 && (
        <span className="font-mono text-[11px] text-[var(--v2-amber)]">↓{behind}</span>
      )}
      {dirty > 0 && (
        <span className="font-mono text-[11px] text-[var(--v2-yellow)]">●{dirty} dirty</span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Provider launcher */}
      <span className="text-[11px] text-[var(--v2-text-faint)]">Launch with</span>
      <ProviderPicker />

      {/* New run button */}
      <button
        onClick={handleNewRun}
        className="flex items-center gap-1.5 rounded-md border border-[var(--v2-amber)] bg-[var(--v2-amber)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--v2-bg0)] cursor-pointer transition-opacity hover:opacity-90 [-webkit-app-region:no-drag]"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <PlayIcon />
        New run
      </button>
    </div>
  );
};
