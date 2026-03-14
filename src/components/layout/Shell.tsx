import { useMemo } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { ProjectRail } from '@/components/projects/ProjectRail';
import { TabBar } from '@/components/layout/TabBar';
import { AgentPanel } from '@/components/terminals/AgentPanel';
import { WelcomeScreen } from '@/components/layout/WelcomeScreen';
import { BranchList } from '@/components/git/BranchList';
import { WorktreeGrid } from '@/components/git/WorktreeGrid';
import { DiffViewer } from '@/components/git/DiffViewer';
import { CommitLog } from '@/components/git/CommitLog';
import { PipelineView } from '@/components/pipeline/PipelineView';
import { SettingsView } from '@/components/settings/SettingsView';
import { TerminalTab } from '@/components/terminals/TerminalTab';

export const Shell = (): React.JSX.Element => {
  const activeTab = useUIStore((s) => s.activeTab);
  const terminalTabs = useUIStore((s) => s.terminalTabs);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  // Resolve terminal session id when active tab is a terminal tab
  const terminalSessionId = useMemo(() => {
    if (!activeTab.startsWith('terminal:')) return null;
    const entry = terminalTabs.find((t) => t.id === activeTab);
    return entry?.sessionId ?? null;
  }, [activeTab, terminalTabs]);

  const isTerminalTab = terminalSessionId !== null;

  return (
    <div className="flex h-[calc(100vh-var(--titlebar-height))]">
      {/* Project Rail */}
      <ProjectRail />

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TabBar />

        {/* Content views */}
        <div className={`flex-1 overflow-hidden ${isTerminalTab ? '' : 'overflow-auto'}`}>
          {activeProjectId === null && !isTerminalTab ? (
            <WelcomeScreen />
          ) : isTerminalTab ? (
            <TerminalTab sessionId={terminalSessionId} borderless />
          ) : (
            <>
              {activeTab === 'branches' && <BranchList />}
              {activeTab === 'worktrees' && <WorktreeGrid />}
              {activeTab === 'diffs' && <DiffViewer />}
              {activeTab === 'log' && <CommitLog />}
              {activeTab === 'pipeline' && <PipelineView />}
              {activeTab === 'settings' && <SettingsView />}
            </>
          )}
        </div>

        {/* Agent panel dock */}
        <AgentPanel />
      </div>
    </div>
  );
};
