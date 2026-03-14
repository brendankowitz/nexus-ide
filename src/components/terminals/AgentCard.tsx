import type { TerminalSession } from '@/types';

interface AgentCardProps {
  session: TerminalSession;
  selected: boolean;
  onClick: () => void;
  onKill?: () => void;
}

const statusIndicatorStyles: Record<TerminalSession['status'], string> = {
  running: 'bg-[var(--color-clean)] animate-pulse',
  idle: 'bg-text-ghost',
  exited: 'bg-[var(--color-danger)]',
};

export const AgentCard = ({
  session,
  selected,
  onClick,
  onKill,
}: AgentCardProps): React.JSX.Element => {
  return (
    <div
      onClick={onClick}
      className={`min-w-[180px] max-w-[220px] shrink-0 cursor-pointer rounded-[var(--radius-md)] border p-2.5 px-3 transition-all duration-[var(--duration-fast)] ${
        selected
          ? 'border-phase-execute bg-bg-surface shadow-[0_0_0_1px_var(--phase-execute-dim)]'
          : 'border-border-default bg-bg-surface hover:border-border-strong hover:bg-bg-overlay'
      }`}
    >
      {/* Header */}
      <div className="mb-1.5 flex items-center gap-2">
        <span className="font-mono text-[11px] font-medium text-text-primary">
          {session.agentType}
        </span>
        {onKill !== undefined && session.status === 'running' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onKill();
            }}
            className="ml-auto cursor-pointer rounded-[2px] px-1 py-px font-mono text-[9px] text-text-ghost transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-danger)] hover:text-text-primary"
            title="Kill session"
          >
            x
          </button>
        )}
        <div
          className={`${onKill !== undefined && session.status === 'running' ? '' : 'ml-auto'} h-1.5 w-1.5 rounded-full ${statusIndicatorStyles[session.status]}`}
        />
      </div>

      {/* Project info */}
      <div className="font-mono text-[10px] text-text-tertiary">
        {session.projectName}
        {session.branch !== undefined && ` / ${session.branch}`}
      </div>
    </div>
  );
};

interface LaunchAgentCardProps {
  onClick?: () => void;
}

export const LaunchAgentCard = ({ onClick }: LaunchAgentCardProps): React.JSX.Element => (
  <div
    onClick={onClick}
    className="flex min-w-[180px] max-w-[220px] shrink-0 cursor-pointer items-center rounded-[var(--radius-md)] border border-dashed border-border-default bg-transparent p-2.5 px-3 transition-all duration-[var(--duration-fast)] hover:border-border-strong hover:bg-bg-surface"
  >
    <span className="font-mono text-[11px] font-medium text-text-tertiary">
      + launch agent
    </span>
  </div>
);
