import { useCallback, useEffect, useRef, useState } from 'react';
import { useTerminalStore } from '@/stores/terminalStore';
import { useProjectStore, selectActiveProject, selectActiveWorktrees } from '@/stores/projectStore';
import { useToastStore } from '@/stores/toastStore';
import { AgentCard, LaunchAgentCard } from '@/components/terminals/AgentCard';
import { TerminalTab } from '@/components/terminals/TerminalTab';
import { LaunchMenu } from '@/components/terminals/LaunchMenu';
import { WelcomeScreen } from '@/components/layout/WelcomeScreen';

// ── DevPane Empty State ───────────────────────────────────────────────────────

interface DevPaneEmptyStateProps {
  projectName: string | null;
  onLaunch: (option: { label: string; command?: string; args?: string[] }) => void;
  onOpenLaunchMenu: () => void;
}

const DevPaneEmptyState = ({ projectName, onLaunch, onOpenLaunchMenu }: DevPaneEmptyStateProps): React.JSX.Element => (
  <div className="flex h-full flex-col items-center justify-center gap-6">
    <div className="text-center">
      <p className="font-mono text-[12px] font-medium text-text-secondary">
        {projectName !== null ? `no terminals for ${projectName}` : 'start a terminal session'}
      </p>
      <p className="mt-1 font-mono text-[11px] text-text-ghost">choose an environment to launch</p>
    </div>
    <div className="flex gap-2.5">
      <LaunchButton label="Shell" onClick={() => onLaunch({ label: 'Shell' })} />
      <LaunchButton
        label="Claude Code"
        onClick={() => onLaunch({ label: 'Claude Code', command: 'claude' })}
        accent
      />
      <LaunchButton label="Copilot" onClick={() => onLaunch({ label: 'Copilot', command: 'copilot' })} />
    </div>
    <button
      onClick={onOpenLaunchMenu}
      className="font-mono text-[10px] text-text-ghost transition-colors hover:text-text-secondary"
    >
      custom...
    </button>
  </div>
);

interface LaunchButtonProps {
  label: string;
  onClick: () => void;
  accent?: boolean;
}

const LaunchButton = ({ label, onClick, accent = false }: LaunchButtonProps): React.JSX.Element => (
  <button
    onClick={onClick}
    className={`cursor-pointer rounded-[var(--radius-md)] border px-4 py-2 font-mono text-[11px] font-medium transition-all duration-[var(--duration-fast)] ${
      accent
        ? 'border-phase-execute bg-[var(--phase-execute-glow)] text-phase-execute hover:bg-phase-execute hover:text-bg-void'
        : 'border-border-default bg-transparent text-text-secondary hover:border-border-strong hover:bg-bg-active hover:text-text-primary'
    }`}
  >
    {label}
  </button>
);

// ── DevPane ───────────────────────────────────────────────────────────────────

export const DevPane = (): React.JSX.Element => {
  const sessions = useTerminalStore((s) => s.sessions);
  const activeSessionId = useTerminalStore((s) => s.activeSessionId);
  const setActiveSession = useTerminalStore((s) => s.setActiveSession);
  const addSession = useTerminalStore((s) => s.addSession);
  const updateSession = useTerminalStore((s) => s.updateSession);
  const removeSession = useTerminalStore((s) => s.removeSession);

  const activeProject = useProjectStore(selectActiveProject);
  const worktrees = useProjectStore(selectActiveWorktrees);
  const activeWorktreePath = useProjectStore((s) => s.activeWorktreePath);
  const setActiveWorktreePath = useProjectStore((s) => s.setActiveWorktreePath);

  const [launchMenuOpen, setLaunchMenuOpen] = useState(false);
  const [elsewhereExpanded, setElsewhereExpanded] = useState(false);
  const launchButtonRef = useRef<HTMLButtonElement>(null);
  const subscribedRef = useRef<Set<string>>(new Set());
  const cleanupsRef = useRef<Map<string, () => void>>(new Map());

  // Split sessions: active project vs other projects
  const projectSessions = sessions.filter(
    (s) => activeProject !== null && s.projectId === activeProject.id,
  );
  const otherSessions = sessions.filter(
    (s) => activeProject === null || s.projectId !== activeProject.id,
  );
  const projectRunningCount = projectSessions.filter((s) => s.status === 'running').length;

  // Active worktree display (branch name, stripped)
  const activeWorktree = worktrees.find((wt) => wt.path === activeWorktreePath);
  const activeWorktreeBranch = activeWorktree?.branch.replace(/^refs\/heads\//, '') ?? null;
  const isWorktreeContext = activeWorktreePath !== null && activeWorktree !== undefined;

  // Subscribe to exit events for new running sessions (deduped via ref)
  useEffect(() => {
    for (const session of sessions) {
      if (session.status !== 'exited' && !subscribedRef.current.has(session.id)) {
        subscribedRef.current.add(session.id);
        if (!window.nexusAPI?.terminal) continue;
        const cleanup = window.nexusAPI.terminal.onExit(session.id, () => {
          updateSession(session.id, { status: 'exited' });
          subscribedRef.current.delete(session.id);
          cleanupsRef.current.delete(session.id);
        });
        cleanupsRef.current.set(session.id, cleanup);
      }
    }
    return () => {
      for (const cleanup of cleanupsRef.current.values()) cleanup();
      cleanupsRef.current.clear();
      subscribedRef.current.clear();
    };
  }, [sessions, updateSession]);

  const handleLaunch = useCallback(
    async (option: { label: string; command?: string; args?: string[]; worktreePath?: string }) => {
      if (activeProject === null) return;

      setLaunchMenuOpen(false);

      try {
        let command = option.command;
        let args = [...(option.args ?? [])];

        try {
          const stored = await window.nexusAPI.settings.get() as Record<string, unknown>;
          const agents = stored['agents'] as Record<string, unknown> | undefined;

          const claudeCode = agents?.['claudeCode'] as Record<string, unknown> | undefined;
          const copilotCli = agents?.['copilotCli'] as Record<string, unknown> | undefined;

          const claudeCmd = (claudeCode?.['command'] as string | undefined) || 'claude';
          const copilotCmd = (copilotCli?.['command'] as string | undefined) || 'copilot';

          if (option.command === 'claude' || option.command === claudeCmd) {
            command = claudeCmd;
            const mode = claudeCode?.['mode'] as string | undefined;
            if (mode) args = [...args, mode];
            if (claudeCode?.['worktrees'] === true) args = [...args, '--worktrees'];
          } else if (option.command === 'copilot' || option.command === copilotCmd) {
            command = copilotCmd;
            const mode = copilotCli?.['mode'] as string | undefined;
            if (mode) args = [...args, mode];
          }
        } catch { /* settings unavailable — launch with defaults */ }

        const resolvedWorktreePath = option.worktreePath ?? activeProject.path;

        const sessionId = await window.nexusAPI.terminal.create({
          projectId: activeProject.id,
          worktreePath: resolvedWorktreePath,
          command,
          args,
          label: option.label,
        });

        addSession({
          id: sessionId,
          projectId: activeProject.id,
          projectName: activeProject.name,
          agentType: option.label,
          label: option.label,
          status: 'running',
          worktreePath: resolvedWorktreePath,
          command: option.command,
          startedAt: new Date().toISOString(),
        });
      } catch (err) {
        useToastStore.getState().addToast(
          `Launch failed: ${err instanceof Error ? err.message : String(err)}`,
          'error',
        );
      }
    },
    [activeProject, addSession],
  );

  const handleKill = useCallback(
    async (sessionId: string) => {
      await window.nexusAPI.terminal.kill(sessionId);
      removeSession(sessionId);
    },
    [removeSession],
  );

  const showWelcome = activeProject === null && sessions.length === 0;
  const showEmptyState = activeProject !== null && projectSessions.length === 0;

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-bg-void">
      {/* Header — project-scoped */}
      <div className="flex h-[var(--tab-height)] min-h-[var(--tab-height)] items-center gap-2 border-b border-border-subtle px-4">

        {/* Project name (primary identity) */}
        {activeProject !== null ? (
          <span className="font-mono text-[11px] font-medium text-text-primary truncate max-w-[160px]">
            {activeProject.name}
          </span>
        ) : (
          <span className="font-mono text-[11px] font-medium text-text-secondary">terminals</span>
        )}

        {/* Worktree context pill — mirrors SCPanel, bridges work ↔ review */}
        {isWorktreeContext && activeWorktreeBranch !== null && (
          <div
            className="flex items-center gap-1 shrink-0 rounded-[var(--radius-sm)] px-1.5 py-px font-mono text-[9px]"
            style={{
              background: 'var(--phase-execute-glow)',
              border: '1px solid var(--phase-execute-dim)',
              color: 'var(--phase-execute)',
            }}
          >
            <svg width="7" height="7" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="6" cy="6" r="2" />
              <line x1="6" y1="1" x2="6" y2="3.5" />
              <line x1="6" y1="8.5" x2="6" y2="11" />
            </svg>
            {activeWorktreeBranch}
          </div>
        )}

        {/* Running count — active project only */}
        {projectSessions.length > 0 && (
          <span className="shrink-0 rounded-[3px] bg-[var(--phase-execute-dim)] px-1.5 py-px font-mono text-[10px] font-semibold text-phase-execute">
            {projectRunningCount > 0 ? projectRunningCount : projectSessions.length}
          </span>
        )}

        {/* Elsewhere indicator — other-project sessions exist */}
        {otherSessions.length > 0 && activeProject !== null && (
          <button
            onClick={() => setElsewhereExpanded((v) => !v)}
            title={`${otherSessions.length} terminal${otherSessions.length !== 1 ? 's' : ''} from other projects`}
            className={`shrink-0 rounded-[3px] px-1.5 py-px font-mono text-[9px] transition-colors duration-[var(--duration-fast)] cursor-pointer ${
              elsewhereExpanded
                ? 'bg-bg-active text-text-tertiary'
                : 'text-text-ghost hover:text-text-tertiary'
            }`}
          >
            +{otherSessions.length} elsewhere
          </button>
        )}

        <div className="relative ml-auto">
          <button
            ref={launchButtonRef}
            onClick={() => setLaunchMenuOpen((prev) => !prev)}
            className="cursor-pointer rounded-[var(--radius-sm)] border border-dashed border-border-strong bg-transparent px-2.5 py-[3px] font-mono text-[10px] text-text-tertiary transition-all duration-[var(--duration-fast)] hover:border-solid hover:border-phase-execute hover:bg-[var(--phase-execute-glow)] hover:text-phase-execute"
          >
            + launch
          </button>
          {launchMenuOpen && (
            <LaunchMenu
              onLaunch={handleLaunch}
              onClose={() => setLaunchMenuOpen(false)}
              anchorRef={launchButtonRef}
              worktrees={worktrees}
            />
          )}
        </div>
      </div>

      {/* Session card strip */}
      {(projectSessions.length > 0 || (elsewhereExpanded && otherSessions.length > 0)) && (
        <div className="shrink-0 border-b border-border-subtle">
          {/* Active project sessions */}
          {projectSessions.length > 0 && (
            <div className="flex h-[64px] min-h-[64px] items-center gap-2 overflow-x-auto px-3">
              {projectSessions.map((session) => (
                <AgentCard
                  key={session.id}
                  session={session}
                  selected={session.id === activeSessionId}
                  projectMatch={true}
                  onClick={() => {
                    setActiveSession(session.id);
                    setActiveWorktreePath(session.worktreePath ?? null);
                  }}
                  onKill={() => void handleKill(session.id)}
                />
              ))}
              <LaunchAgentCard onClick={() => setLaunchMenuOpen(true)} />
            </div>
          )}

          {/* Other-project sessions — only when expanded */}
          {elsewhereExpanded && otherSessions.length > 0 && (
            <div
              className="flex items-center gap-2 overflow-x-auto border-t border-border-subtle px-3 py-2"
              style={{ background: 'var(--bg-raised)' }}
            >
              <span className="shrink-0 font-mono text-[9px] text-text-ghost">elsewhere</span>
              {otherSessions.map((session) => (
                <AgentCard
                  key={session.id}
                  session={session}
                  selected={session.id === activeSessionId}
                  projectMatch={false}
                  onClick={() => {
                    setActiveSession(session.id);
                    setActiveWorktreePath(session.worktreePath ?? null);
                  }}
                  onKill={() => void handleKill(session.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state: no sessions for this project but there are sessions elsewhere */}
      {showEmptyState && !elsewhereExpanded && otherSessions.length > 0 && (
        <div className="flex h-[64px] min-h-[64px] shrink-0 items-center gap-3 border-b border-border-subtle px-3">
          <LaunchAgentCard onClick={() => setLaunchMenuOpen(true)} />
          <span className="font-mono text-[10px] text-text-ghost">
            no terminals for {activeProject?.name}
          </span>
        </div>
      )}

      {/* Main area */}
      <div className="relative flex-1 overflow-hidden">
        {showWelcome ? (
          <WelcomeScreen />
        ) : showEmptyState && otherSessions.length === 0 ? (
          <DevPaneEmptyState
            projectName={activeProject?.name ?? null}
            onLaunch={(opt) => { void handleLaunch(opt); }}
            onOpenLaunchMenu={() => setLaunchMenuOpen(true)}
          />
        ) : activeSessionId !== null ? (
          <TerminalTab
            sessionId={activeSessionId}
            onKill={() => void handleKill(activeSessionId)}
            borderless
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="font-mono text-[11px] text-text-ghost">
              select a terminal above
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
