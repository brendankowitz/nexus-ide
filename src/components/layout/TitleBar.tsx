import { useEffect, useState } from 'react';
import { useProjectStore, selectActiveProject } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import type { AppMode } from '@/stores/uiStore';
import { NexusLogo } from '@/components/shared/NexusLogo';
import { ProviderPicker } from '@/components/shared/ProviderPicker';

const isMac = navigator.platform.toLowerCase().includes('mac');

interface ModeTab {
  id: AppMode;
  label: string;
  icon: string;
}

const TABS: ModeTab[] = [
  { id: 'workbench', label: 'Workbench', icon: '>_' },
  { id: 'kanban',    label: 'Kanban',    icon: '⋮⋮' },
  { id: 'agents',    label: 'Agents',    icon: '⬡'  },
  { id: 'review',    label: 'Review',    icon: '±'  },
];

export const TitleBar = (): React.JSX.Element => {
  const [clock, setClock] = useState(formatClock());
  const activeProject = useProjectStore(selectActiveProject);
  const gitStatus = useProjectStore((s) =>
    s.activeProjectId !== null ? (s.gitStatus[s.activeProjectId] ?? null) : null
  );
  const activeMode = useUIStore((s) => s.activeMode);
  const setActiveMode = useUIStore((s) => s.setActiveMode);

  useEffect(() => {
    const interval = setInterval(() => setClock(formatClock()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`flex h-[var(--titlebar-height)] items-center border-b border-border-subtle bg-bg-void ${isMac ? 'pl-20' : 'pl-3'} pr-3 [-webkit-app-region:drag] relative z-[100] gap-3`}
    >
      {/* Logo + wordmark */}
      <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">
        <NexusLogo size={20} />
        <span className="font-mono text-[10px] font-bold uppercase tracking-[2.5px] text-[var(--v2-text-faint)]">
          Nexus
        </span>
      </div>

      <div className="h-4 w-px bg-border-subtle" />

      {/* Mode tabs */}
      <div className="flex gap-0.5 [-webkit-app-region:no-drag]">
        {TABS.map((tab) => {
          const active = tab.id === activeMode;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveMode(tab.id)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] transition-colors duration-100 ${
                active
                  ? 'bg-[var(--v2-bg3)] text-[var(--v2-text)]'
                  : 'text-[var(--v2-text-faint)] hover:text-[var(--v2-text-dim)]'
              }`}
            >
              <span className="font-mono text-[10px]">{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Project + branch info */}
      <div className="flex items-center gap-1.5 font-mono text-[11px] text-text-secondary">
        {activeProject !== null && (
          <>
            <span className="text-text-tertiary">{activeProject.name}</span>
            <span className="text-text-ghost">/</span>
            <span className="font-medium text-phase-plan">
              {gitStatus?.branch ?? 'main'}
            </span>
            {gitStatus !== null && gitStatus.changeCount > 0 && (
              <>
                <span className="text-text-ghost">&middot;</span>
                <span>{gitStatus.changeCount} changes</span>
              </>
            )}
          </>
        )}
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-3 [-webkit-app-region:no-drag]">
        <ProviderPicker />
        <div className="flex items-center gap-2 font-mono text-[10px] text-text-tertiary">
          <span className="tabular-nums">{clock}</span>
          <span>{isMac ? '⌘K' : 'Ctrl+K'}</span>
        </div>
      </div>
    </div>
  );
};

function formatClock(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}
