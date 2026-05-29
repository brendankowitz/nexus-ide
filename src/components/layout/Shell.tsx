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
import { ContextBar } from '@/components/layout/ContextBar';
import { StatusBar } from '@/components/layout/StatusBar';
import { ActivityPanel } from '@/components/layout/ActivityPanel';

const clamp = (val: number, min: number, max: number): number =>
  Math.min(Math.max(val, min), max);

export const Shell = (): React.JSX.Element => {
  const [railWidth, setRailWidth] = useState(232);
  const activeMode = useUIStore((s) => s.activeMode);

  useEffect(() => {
    document.documentElement.style.setProperty('--rail-width', `${railWidth}px`);
  }, [railWidth]);

  const showActivity = activeMode === 'workbench';

  return (
    <div className="flex flex-col bg-[var(--v2-bg0)]" style={{ height: 'calc(100vh - 38px)' }}>
      {/* Main row: rail + content */}
      <div className="flex flex-1 min-h-0">
        {/* Project Rail */}
        <ProjectRail />
        <ResizeHandle onDelta={(dx) => setRailWidth((w) => clamp(w + dx, 140, 360))} />

        {/* Right section: context bar + content */}
        <div className="flex flex-col flex-1 min-w-0">
          <ContextBar />

          {/* Content row */}
          <div className="flex flex-1 min-h-0">
            {/* Center content — swaps based on activeMode */}
            <div className="relative min-w-0 flex-1">
              {/* Workbench: keep mounted, toggle visibility */}
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

              {/* Review: full-width SCPanel replaces center */}
              {activeMode === 'review' && (
                <div className="absolute inset-0">
                  <SCPanel />
                </div>
              )}
            </div>

            {/* Activity panel — workbench only, right side */}
            {showActivity && <ActivityPanel />}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <StatusBar />

      <SettingsModal />
      <CommandPalette />
    </div>
  );
};
