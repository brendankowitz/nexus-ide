import { useState, useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { ProjectRail } from '@/components/projects/ProjectRail';
import { DevPane } from '@/components/layout/DevPane';
import { SCPanel } from '@/components/layout/SCPanel';
import { SettingsModal } from '@/components/layout/SettingsModal';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { ResizeHandle } from '@/components/layout/ResizeHandle';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { AgentsInbox } from '@/components/agents/AgentsInbox';

const clamp = (val: number, min: number, max: number): number =>
  Math.min(Math.max(val, min), max);

export const Shell = (): React.JSX.Element => {
  const [railWidth, setRailWidth] = useState(220);
  const [scWidth, setScWidth] = useState(380);
  const activeMode = useUIStore((s) => s.activeMode);

  useEffect(() => {
    document.documentElement.style.setProperty('--rail-width', `${railWidth}px`);
    document.documentElement.style.setProperty('--sc-panel-width', `${scWidth}px`);
  }, [railWidth, scWidth]);

  // The SCPanel (diffs) doubles as the Review mode view
  const showSCPanel = activeMode === 'workbench' || activeMode === 'review';

  return (
    <div className="flex h-[calc(100vh-var(--titlebar-height))]">
      <ProjectRail />
      <ResizeHandle onDelta={(dx) => setRailWidth((w) => clamp(w + dx, 140, 360))} />

      {/* Center content — swaps based on activeMode */}
      <div className="relative min-w-0 flex-1">
        {/* Workbench: existing DevPane */}
        <div className={`absolute inset-0 ${activeMode === 'workbench' ? '' : 'pointer-events-none opacity-0'}`}>
          <DevPane />
        </div>

        {/* Kanban board */}
        {activeMode === 'kanban' && (
          <div className="absolute inset-0">
            <KanbanBoard />
          </div>
        )}

        {/* Agents inbox */}
        {activeMode === 'agents' && (
          <div className="absolute inset-0">
            <AgentsInbox />
          </div>
        )}
      </div>

      {/* SCPanel: shown in workbench (with resize handle) and review (full-width, no handle) */}
      {showSCPanel && (
        <>
          {activeMode === 'workbench' && (
            <ResizeHandle
              onDelta={(dx) =>
                setScWidth((w) => clamp(w - dx, 260, Math.floor(window.innerWidth * 0.5)))
              }
            />
          )}
          <SCPanel />
        </>
      )}

      <SettingsModal />
      <CommandPalette />
    </div>
  );
};
