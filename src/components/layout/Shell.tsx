import { useState, useEffect } from 'react';
import { ProjectRail } from '@/components/projects/ProjectRail';
import { DevPane } from '@/components/layout/DevPane';
import { SCPanel } from '@/components/layout/SCPanel';
import { SettingsModal } from '@/components/layout/SettingsModal';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { ResizeHandle } from '@/components/layout/ResizeHandle';

const clamp = (val: number, min: number, max: number): number =>
  Math.min(Math.max(val, min), max);

export const Shell = (): React.JSX.Element => {
  const [railWidth, setRailWidth] = useState(220);
  const [scWidth, setScWidth] = useState(380);

  useEffect(() => {
    document.documentElement.style.setProperty('--rail-width', `${railWidth}px`);
    document.documentElement.style.setProperty('--sc-panel-width', `${scWidth}px`);
  }, [railWidth, scWidth]);

  return (
    <div className="flex h-[calc(100vh-var(--titlebar-height))]">
      <ProjectRail />
      <ResizeHandle onDelta={(dx) => setRailWidth((w) => clamp(w + dx, 140, 360))} />
      <DevPane />
      <ResizeHandle onDelta={(dx) => setScWidth((w) => clamp(w - dx, 260, Math.floor(window.innerWidth * 0.5)))} />
      <SCPanel />
      <SettingsModal />
      <CommandPalette />
    </div>
  );
};
