import type { TerminalSession } from '@/types';
import { useProjectStore, selectActiveWorktrees } from '@/stores/projectStore';

/* ─── Session type config ───────────────────────────────────────────────────── */

interface SessionConfig {
  accent: string;
  label: string;
}

function getSessionConfig(session: TerminalSession): SessionConfig {
  const type = session.sessionType ?? 'shell';
  switch (type) {
    case 'claude':  return { accent: 'var(--phase-plan)',    label: 'claude code' };
    case 'copilot': return { accent: '#38bdf8',              label: 'copilot' };
    case 'aider':   return { accent: '#f97316',              label: 'aider' };
    default:        return { accent: 'var(--text-ghost)',    label: session.label };
  }
}

/* ─── ContextBarMini ────────────────────────────────────────────────────────── */

const ContextBarMini = ({ percent }: { percent: number }): React.JSX.Element => {
  const fillColor =
    percent > 80 ? 'var(--color-danger)'
    : percent > 50 ? 'var(--color-warning)'
    : 'var(--phase-plan)';

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="h-[2px] w-10 rounded-full overflow-hidden" style={{ background: 'var(--bg-active, #1e1e2e)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${percent}%`, background: fillColor }}
        />
      </div>
      <span className="font-mono text-[8px] tabular-nums" style={{ color: fillColor, opacity: 0.85 }}>
        {percent}%
      </span>
    </div>
  );
};

/* ─── Status dot ────────────────────────────────────────────────────────────── */

function getStatusDotClass(session: TerminalSession): string {
  if ((session.sessionType === 'claude' || session.command === 'claude') && session.status === 'running') {
    return 'bg-[var(--phase-plan)] animate-pulse';
  }
  switch (session.status) {
    case 'running': return 'bg-[var(--color-clean)] animate-pulse';
    case 'idle':    return 'bg-text-ghost';
    case 'exited':  return 'bg-[var(--color-danger)]';
    default:        return 'bg-text-ghost';
  }
}

/* ─── AgentCard ─────────────────────────────────────────────────────────────── */

interface AgentCardProps {
  session: TerminalSession;
  selected: boolean;
  projectMatch?: boolean;
  onClick: () => void;
  onKill?: () => void;
}

export const AgentCard = ({
  session,
  selected,
  projectMatch = false,
  onClick,
  onKill,
}: AgentCardProps): React.JSX.Element => {
  const worktrees = useProjectStore(selectActiveWorktrees);
  const config = getSessionConfig(session);
  const isClaudeSession = session.sessionType === 'claude' || session.command === 'claude';
  const isCopilot = session.sessionType === 'copilot';

  const resolvedBranch = session.worktreePath !== undefined
    ? worktrees.find(
        (wt) =>
          wt.path === session.worktreePath ||
          wt.path.replace(/\\/g, '/') === session.worktreePath?.replace(/\\/g, '/'),
      )?.branch.replace(/^refs\/heads\//, '') ?? null
    : null;
  const dotClass = getStatusDotClass(session);
  const hasClaudeData = isClaudeSession && session.claudeStatus !== undefined;

  const borderColor = selected
    ? 'var(--phase-execute)'
    : projectMatch
      ? 'var(--phase-plan-dim)'
      : 'var(--border-default, #2a2a3e)';

  const bgColor = selected
    ? 'var(--bg-surface)'
    : projectMatch
      ? 'var(--bg-raised)'
      : 'var(--bg-surface)';

  return (
    <div
      onClick={onClick}
      className="relative shrink-0 cursor-pointer overflow-hidden transition-all duration-[var(--duration-fast)] hover:brightness-110"
      style={{
        width: '164px',
        height: '52px',
        border: `1px solid ${borderColor}`,
        background: bgColor,
        borderRadius: 'var(--radius-md)',
        boxShadow: selected ? `0 0 0 1px var(--phase-execute-dim), inset 0 0 12px var(--phase-execute-glow)` : undefined,
      }}
    >
      {/* Left accent strip — session type color */}
      <div
        className="absolute left-0 top-0 h-full w-[2px]"
        style={{
          background: config.accent,
          opacity: session.status === 'exited' ? 0.25 : session.status === 'running' ? 1 : 0.5,
        }}
      />

      <div className="flex h-full flex-col justify-between px-2.5 py-1.5 pl-3.5">
        {/* Row 1: label + badge + kill + dot */}
        <div className="flex items-center gap-1.5">
          <span className="truncate font-mono text-[10px] font-medium text-text-primary" style={{ maxWidth: '90px' }}
            title={session.title ?? session.label}>
            {isClaudeSession ? 'claude code' : isCopilot ? 'copilot' : (session.title ?? session.label)}
          </span>

          {/* Session type badge */}
          {(isClaudeSession || isCopilot) && (
            <span
              className="shrink-0 rounded-[2px] px-[5px] py-px font-mono text-[7px] font-bold uppercase tracking-wider"
              style={{
                color: config.accent,
                background: isClaudeSession ? 'var(--phase-plan-dim)' : 'rgba(56,189,248,0.12)',
                border: `1px solid ${isClaudeSession ? 'var(--phase-plan-dim)' : 'rgba(56,189,248,0.25)'}`,
              }}
            >
              {isClaudeSession ? 'AI' : 'CLI'}
            </span>
          )}

          <div className="ml-auto flex items-center gap-1">
            {onKill !== undefined && session.status === 'running' && (
              <button
                onClick={(e) => { e.stopPropagation(); onKill(); }}
                className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-[2px] font-mono text-[10px] text-text-tertiary transition-colors hover:bg-[var(--color-danger)] hover:text-white"
                title="Kill"
              >
                ×
              </button>
            )}
            <div className={`h-[5px] w-[5px] rounded-full ${dotClass}`} />
          </div>
        </div>

        {/* Row 2: telemetry / project — always present, uniform height */}
        <div className="flex h-[13px] items-center">
          {hasClaudeData && session.claudeStatus?.contextPercent !== undefined ? (
            <ContextBarMini percent={session.claudeStatus.contextPercent} />
          ) : hasClaudeData && session.claudeStatus?.model !== undefined ? (
            <span className="truncate font-mono text-[8px]" style={{ color: 'var(--phase-plan)', opacity: 0.7 }}>
              {session.claudeStatus.model.replace('claude-', '')}
            </span>
          ) : resolvedBranch !== null ? (
            <span
              className="truncate font-mono text-[9px]"
              style={{ color: 'var(--phase-execute)', opacity: 0.75 }}
            >
              {resolvedBranch}
            </span>
          ) : (
            <span className="truncate font-mono text-[9px] text-text-ghost">
              {session.projectName}
            </span>
          )}
        </div>
      </div>
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
    className="flex shrink-0 cursor-pointer items-center justify-center transition-all duration-[var(--duration-fast)] hover:brightness-110"
    style={{
      width: '164px',
      height: '52px',
      border: '1px dashed var(--border-default, #2a2a3e)',
      borderRadius: 'var(--radius-md)',
    }}
  >
    <span className="font-mono text-[10px] text-text-ghost">+ launch</span>
  </div>
);
