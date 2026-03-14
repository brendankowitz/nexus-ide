import type { TerminalSession } from '@/types';

interface AgentCardProps {
  session: TerminalSession;
  selected: boolean;
  onClick: () => void;
  onKill?: () => void;
}

/* ─── ContextGaugeMini ──────────────────────────────────────────────────────── */

interface ContextGaugeMiniProps {
  percent: number;
}

const ContextGaugeMini = ({ percent }: ContextGaugeMiniProps): React.JSX.Element => {
  const filled = Math.round(percent / 20);
  const blocks = Array.from({ length: 5 }, (_, i) => i < filled);
  const color =
    percent > 80
      ? 'var(--color-danger)'
      : percent > 50
        ? 'var(--color-warning)'
        : 'var(--phase-execute)';

  return (
    <span className="font-mono text-[8px]" style={{ color }}>
      {blocks.map((fill, i) => (
        <span key={i} style={{ opacity: fill ? 1 : 0.2 }}>
          ▰
        </span>
      ))}
    </span>
  );
};

/* ─── Status dot styles ─────────────────────────────────────────────────────── */

function resolveStatusDot(session: TerminalSession): string {
  const isClaudeSession = session.sessionType === 'claude' || session.command === 'claude';
  if (isClaudeSession && session.status === 'running') {
    return 'bg-phase-plan animate-pulse';
  }
  const map: Record<TerminalSession['status'], string> = {
    running: 'bg-[var(--color-clean)] animate-pulse',
    idle: 'bg-text-ghost',
    exited: 'bg-[var(--color-danger)]',
  };
  return map[session.status] ?? 'bg-text-ghost';
}

/* ─── AgentCard ─────────────────────────────────────────────────────────────── */

export const AgentCard = ({
  session,
  selected,
  onClick,
  onKill,
}: AgentCardProps): React.JSX.Element => {
  const isClaudeSession = session.sessionType === 'claude' || session.command === 'claude';
  const dotClass = resolveStatusDot(session);

  return (
    <div
      onClick={onClick}
      className={`min-w-[180px] max-w-[220px] shrink-0 cursor-pointer rounded-[var(--radius-md)] border p-2.5 px-3 transition-all duration-[var(--duration-fast)] ${
        selected
          ? 'border-phase-execute bg-bg-surface shadow-[0_0_0_1px_var(--phase-execute-dim)]'
          : 'border-border-default bg-bg-surface hover:border-border-strong hover:bg-bg-overlay'
      }`}
    >
      {/* Header row */}
      <div className="mb-1.5 flex items-center gap-2">
        {/* Agent label with optional Claude badge */}
        <span className="font-mono text-[11px] font-medium text-text-primary">
          {isClaudeSession ? 'Claude Code' : session.agentType}
        </span>
        {isClaudeSession && (
          <span className="rounded-[2px] bg-[var(--phase-plan-dim)] px-1 py-px font-mono text-[8px] font-semibold text-phase-plan">
            AI
          </span>
        )}
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
          className={`${onKill !== undefined && session.status === 'running' ? '' : 'ml-auto'} h-1.5 w-1.5 rounded-full ${dotClass}`}
        />
      </div>

      {/* Project info */}
      <div className="font-mono text-[10px] text-text-tertiary">
        {session.projectName}
        {session.branch !== undefined && ` / ${session.branch}`}
      </div>

      {/* Claude context gauge row (shown only when data is available) */}
      {isClaudeSession && session.claudeStatus !== undefined && (
        <div className="mt-1.5 flex items-center gap-1.5">
          {session.claudeStatus.contextPercent !== undefined && (
            <ContextGaugeMini percent={session.claudeStatus.contextPercent} />
          )}
          {session.claudeStatus.model !== undefined && (
            <span className="truncate font-mono text-[8px] text-text-ghost">
              {session.claudeStatus.model}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── LaunchAgentCard ───────────────────────────────────────────────────────── */

interface LaunchAgentCardProps {
  onClick?: () => void;
}

export const LaunchAgentCard = ({ onClick }: LaunchAgentCardProps): React.JSX.Element => (
  <div
    onClick={onClick}
    className="flex min-w-[180px] max-w-[220px] shrink-0 cursor-pointer items-center rounded-[var(--radius-md)] border border-dashed border-border-default bg-transparent p-2.5 px-3 transition-all duration-[var(--duration-fast)] hover:border-border-strong hover:bg-bg-surface"
  >
    <span className="font-mono text-[11px] font-medium text-text-tertiary">+ launch agent</span>
  </div>
);
