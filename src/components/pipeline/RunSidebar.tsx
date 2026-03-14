import type { PipelineRun } from '@/types';

export const RunSidebar = ({
  activeRunId,
  onSelectRun,
  runs,
}: {
  activeRunId: string;
  onSelectRun: (id: string) => void;
  runs: PipelineRun[];
}): React.JSX.Element => {
  return (
    <div className="flex-1 overflow-y-auto p-1.5">
      {runs.map((run) => (
        <RunCard
          key={run.id}
          run={run}
          active={run.id === activeRunId}
          onClick={() => onSelectRun(run.id)}
        />
      ))}
    </div>
  );
};

const RunCard = ({
  run,
  active,
  onClick,
}: {
  run: PipelineRun;
  active: boolean;
  onClick: () => void;
}): React.JSX.Element => {
  const statusStyles: Record<string, string> = {
    executing: 'bg-[var(--phase-execute-dim)] text-phase-execute',
    validating: 'bg-[var(--phase-validate-dim)] text-phase-validate',
    complete: 'bg-[var(--color-clean)] text-[var(--bg-void)]',
    planning: 'bg-[var(--phase-plan-dim)] text-phase-plan',
    failed: 'bg-[var(--color-danger)] text-white',
    draft: 'bg-bg-active text-text-secondary',
    aborted: 'bg-bg-active text-text-tertiary',
  };

  const statusLabel: Record<string, string> = {
    executing: 'executing',
    validating: 'validating',
    complete: 'complete',
    planning: 'planning',
    failed: 'failed',
    draft: 'draft',
    aborted: 'aborted',
  };

  const timeAgo = getTimeAgo(run.createdAt);

  return (
    <div
      onClick={onClick}
      className={`mb-0.5 cursor-pointer rounded-[var(--radius-md)] px-2.5 py-2.5 transition-colors duration-[var(--duration-fast)] ${
        active ? 'bg-bg-surface' : 'hover:bg-bg-hover'
      }`}
    >
      <div className="mb-1 font-mono text-[12px] font-medium text-text-primary">
        {run.config.name}
      </div>
      <div className="flex items-center gap-1.5 font-mono text-[10px] text-text-tertiary">
        <span
          className={`rounded-[3px] px-1.5 py-px font-medium text-[10px] ${statusStyles[run.status] ?? statusStyles.draft}`}
        >
          {statusLabel[run.status] ?? run.status}
        </span>
        <span>{timeAgo}</span>
      </div>
    </div>
  );
};

function getTimeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 1) return `${diffDays}d ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffHours > 0) return `${diffHours}h ago`;
  return 'just now';
}
