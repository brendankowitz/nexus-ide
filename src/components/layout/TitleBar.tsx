import { useEffect, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { mockGitStatuses } from '@/lib/mock-data';

export const TitleBar = (): React.JSX.Element => {
  const [clock, setClock] = useState(formatClock());
  const activeProject = useProjectStore((s) => s.activeProject);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const storeGitStatus = useProjectStore((s) =>
    s.activeProjectId !== null ? (s.gitStatus[s.activeProjectId] ?? null) : null
  );

  useEffect(() => {
    const interval = setInterval(() => setClock(formatClock()), 1000);
    return () => clearInterval(interval);
  }, []);

  const gitStatus =
    storeGitStatus ?? (activeProjectId !== null ? (mockGitStatuses[activeProjectId] ?? null) : null);

  return (
    <div
      className="flex h-[var(--titlebar-height)] items-center border-b border-border-subtle bg-bg-void px-4 [-webkit-app-region:drag] relative z-[100]"
    >
      <span className="mr-6 font-mono text-[11px] font-bold uppercase tracking-[3px] text-text-tertiary">
        Nexus
      </span>

      <div className="flex items-center gap-2 font-mono text-[11px] text-text-secondary">
        {activeProject !== null && (
          <>
            <span>{activeProject.name}</span>
            <span className="font-light text-text-ghost">/</span>
            <span className="font-medium text-phase-plan">
              {gitStatus?.branch ?? 'main'}
            </span>
            {gitStatus !== null && gitStatus.changeCount > 0 && (
              <>
                <span className="font-light text-text-ghost">&middot;</span>
                <span>{gitStatus.changeCount} changes</span>
              </>
            )}
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3 font-mono text-[10px] text-text-tertiary [-webkit-app-region:no-drag]">
        <span className="tabular-nums">{clock}</span>
        <span>Ctrl+K</span>
      </div>
    </div>
  );
};

function formatClock(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}
