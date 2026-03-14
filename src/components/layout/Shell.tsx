import { useUIStore } from '@/stores/uiStore';
import { ProjectRail } from '@/components/projects/ProjectRail';
import { TabBar } from '@/components/layout/TabBar';
import { AgentPanel } from '@/components/terminals/AgentPanel';
import { BranchList } from '@/components/git/BranchList';
import { WorktreeGrid } from '@/components/git/WorktreeGrid';
import { DiffViewer } from '@/components/git/DiffViewer';
import { CommitLog } from '@/components/git/CommitLog';
import { PipelineView } from '@/components/pipeline/PipelineView';
import { SettingsView } from '@/components/settings/SettingsView';

export const Shell = (): React.JSX.Element => {
  const activeTab = useUIStore((s) => s.activeTab);

  return (
    <div className="flex h-[calc(100vh-var(--titlebar-height))]">
      {/* Project Rail */}
      <ProjectRail />

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TabBar />

        {/* Content views */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'branches' && <BranchList />}
          {activeTab === 'worktrees' && <WorktreeGrid />}
          {activeTab === 'diffs' && <DiffViewer />}
          {activeTab === 'log' && <CommitLog />}
          {activeTab === 'pipeline' && <PipelineView />}
          {activeTab === 'settings' && <SettingsView />}
        </div>

        {/* Agent panel dock */}
        <AgentPanel />
      </div>
    </div>
  );
};
