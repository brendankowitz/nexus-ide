import { useUIStore } from '@/stores/uiStore';
import type { AppMode } from '@/stores/uiStore';
import { NexusLogo } from '@/components/shared/NexusLogo';

const isMac = navigator.platform.toLowerCase().includes('mac');

const TabIcons: Record<AppMode, React.JSX.Element> = {
  workbench: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 6 8 10 4 14"/><line x1="11" y1="14" x2="20" y2="14"/>
    </svg>
  ),
  kanban: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="5" height="14" rx="1"/><rect x="10" y="4" width="5" height="9" rx="1"/><rect x="17" y="4" width="4" height="6" rx="1"/>
    </svg>
  ),
  agents: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 13H16l-2 3h-4l-2-3H2"/><path d="M5.5 5h13l3.5 8v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>
    </svg>
  ),
  review: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3v12a2 2 0 0 0 2 2h4M15 21V9a2 2 0 0 0-2-2H9"/><circle cx="9" cy="3" r="1.5"/><circle cx="15" cy="21" r="1.5"/>
    </svg>
  ),
};

interface ModeTab { id: AppMode; label: string; }
const TABS: ModeTab[] = [
  { id: 'workbench', label: 'Workbench' },
  { id: 'kanban',    label: 'Kanban'    },
  { id: 'agents',    label: 'Agents'    },
  { id: 'review',    label: 'Review'    },
];

export const TitleBar = (): React.JSX.Element => {
  const activeMode = useUIStore((s) => s.activeMode);
  const setActiveMode = useUIStore((s) => s.setActiveMode);
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette);

  return (
    <div
      className={`flex h-[38px] items-center border-b border-[var(--v2-border)] bg-[var(--v2-bg1)] ${isMac ? 'pl-20' : 'pl-3.5'} pr-3 [-webkit-app-region:drag] relative z-[100] gap-3.5`}
    >
      {/* Logo + wordmark */}
      <div className="flex items-center gap-2 shrink-0 [-webkit-app-region:no-drag]">
        <NexusLogo size={18} />
        <span className="font-semibold text-[13px] tracking-[0.2px] text-[var(--v2-text)]">Nexus</span>
        <span className="text-[11px] text-[var(--v2-text-faint)] mt-px">v2 · mission control</span>
      </div>

      <div className="h-[18px] w-px bg-[var(--v2-border)] shrink-0" />

      {/* Mode tabs */}
      <div className="flex gap-0.5 [-webkit-app-region:no-drag]">
        {TABS.map((tab) => {
          const active = tab.id === activeMode;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveMode(tab.id)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors duration-100 cursor-pointer [-webkit-app-region:no-drag] ${
                active
                  ? 'bg-[var(--v2-bg3)] text-[var(--v2-text)]'
                  : 'text-[var(--v2-text-faint)] hover:text-[var(--v2-text-dim)] bg-transparent'
              }`}
            >
              {TabIcons[tab.id]}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search / command palette trigger */}
      <button
        onClick={toggleCommandPalette}
        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--v2-bg2)] rounded-md text-[var(--v2-text-faint)] text-[12px] border border-[var(--v2-border)] min-w-[280px] [-webkit-app-region:no-drag] cursor-pointer hover:border-[var(--v2-border)] transition-colors"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>
        </svg>
        <span>Find project, branch, agent, file…</span>
        <span className="ml-auto text-[10.5px] text-[var(--v2-text-faint)] font-mono">{isMac ? '⌘K' : 'Ctrl+K'}</span>
      </button>
    </div>
  );
};
