import { useCallback, useEffect, useRef, useState } from 'react';
import { useTerminalStore } from '@/stores/terminalStore';
import { useProjectStore, selectActiveProject, selectActiveWorktrees } from '@/stores/projectStore';
import { useToastStore } from '@/stores/toastStore';
import { useUIStore } from '@/stores/uiStore';
import { TerminalTab } from '@/components/terminals/TerminalTab';
import { LaunchMenu } from '@/components/terminals/LaunchMenu';
import { WelcomeScreen } from '@/components/layout/WelcomeScreen';
import { PROVIDERS } from '@/components/shared/ProviderPicker';
import type { TerminalSession, ClaudeStatus } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSessionProvider(session: TerminalSession) {
  const cmd = (session.command ?? session.sessionType ?? '').toLowerCase();
  if (cmd.includes('claude')) return PROVIDERS.find((p) => p.id === 'claude')!;
  if (cmd.includes('copilot')) return PROVIDERS.find((p) => p.id === 'copilot')!;
  if (cmd.includes('codex')) return PROVIDERS.find((p) => p.id === 'codex')!;
  if (cmd.includes('gemini')) return PROVIDERS.find((p) => p.id === 'gemini')!;
  return PROVIDERS.find((p) => p.id === 'custom')!;
}

function formatElapsed(startedAt: string | undefined): string {
  if (!startedAt) return '—';
  const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

// ── MCSessionStrip ────────────────────────────────────────────────────────────

interface MCSessionStripProps {
  session: TerminalSession;
  onKill: () => void;
  newButtonRef: React.RefObject<HTMLButtonElement | null>;
  onNew: () => void;
}

const MCSessionStrip = ({ session, onKill, newButtonRef, onNew }: MCSessionStripProps): React.JSX.Element => {
  const provider = getSessionProvider(session);
  const worktrees = useProjectStore(selectActiveWorktrees);

  const [, setTick] = useState(0);
  useEffect(() => {
    if (session.status !== 'running') return;
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, [session.status]);

  const branch = session.worktreePath !== undefined
    ? worktrees.find(
        (wt) =>
          wt.path === session.worktreePath ||
          wt.path.replace(/\\/g, '/') === session.worktreePath?.replace(/\\/g, '/'),
      )?.branch.replace(/^refs\/heads\//, '') ?? null
    : null;

  const model = session.claudeStatus?.model?.replace(/^claude-/, '').replace(/-\d{8}.*$/, '');
  const ctx = session.claudeStatus?.contextPercent;
  const tokens = session.claudeStatus?.tokens;

  const statusDot =
    session.status === 'exited' ? 'bg-[var(--v2-red)]' :
    session.status === 'running' ? 'animate-pulse' : 'bg-[var(--v2-text-faint)]';

  return (
    <div
      className="flex items-center gap-2.5 border-b border-[var(--v2-border-soft)] bg-[var(--v2-bg1)] px-3"
      style={{ height: 44, minHeight: 44 }}
    >
      {/* Provider badge */}
      <div
        className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[5px] font-mono text-[10px] font-bold"
        style={{ background: provider.tint, color: '#0e1115' }}
      >
        {provider.short}
      </div>

      {/* Session identity */}
      <div className="flex min-w-0 flex-col" style={{ gap: 1 }}>
        <span className="font-mono text-[12px] font-medium leading-tight text-[var(--v2-text)]">
          {session.label ?? provider.label}
          {model !== undefined && (
            <span className="text-[var(--v2-text-faint)]"> · {model}</span>
          )}
        </span>
        <span className="font-mono text-[10px] leading-tight text-[var(--v2-text-faint)]">
          {branch !== null ? `worktree: ${branch}` : (session.worktreePath?.replace(/\\/g, '/').split('/').pop() ?? '—')}
          {session.startedAt !== undefined && ` · ${formatElapsed(session.startedAt)}`}
        </span>
      </div>

      <div className="flex-1" />

      {/* Context bar — Claude only */}
      {ctx !== undefined && (
        <>
          <div className="relative h-[6px] overflow-hidden rounded-full bg-[var(--v2-bg3)]" style={{ width: 120 }}>
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
              style={{
                width: `${ctx}%`,
                background: ctx > 80
                  ? 'var(--v2-red)'
                  : `linear-gradient(90deg, var(--v2-green), var(--v2-amber))`,
              }}
            />
          </div>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--v2-text-dim)]" style={{ minWidth: 60 }}>
            ctx {ctx}%
            {tokens !== undefined && tokens > 0 && (
              <span className="text-[var(--v2-text-faint)]"> · {tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens}</span>
            )}
          </span>
        </>
      )}

      {/* Status dot */}
      <div
        className={`h-[6px] w-[6px] shrink-0 rounded-full ${statusDot}`}
        style={session.status === 'running' ? { background: provider.tint } : undefined}
      />

      {/* Stop button */}
      {session.status === 'running' && (
        <button
          onClick={(e) => { e.stopPropagation(); onKill(); }}
          title="Stop session"
          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded border border-[var(--v2-border)] bg-transparent text-[var(--v2-text-faint)] transition-colors hover:border-[var(--v2-red)] hover:text-[var(--v2-red)]"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
            <rect x="1" y="1" width="6" height="6" rx="1" />
          </svg>
        </button>
      )}

      {/* New session button */}
      <button
        ref={newButtonRef as React.RefObject<HTMLButtonElement>}
        onClick={onNew}
        title="New session"
        className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded border border-[var(--v2-border)] bg-transparent font-mono text-[14px] leading-none text-[var(--v2-text-faint)] transition-colors hover:border-[var(--v2-amber)] hover:text-[var(--v2-amber)]"
      >
        +
      </button>
    </div>
  );
};

// ── SessionTabStrip ───────────────────────────────────────────────────────────

interface SessionTabStripProps {
  sessions: TerminalSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

const SessionTabStrip = ({ sessions, activeId, onSelect }: SessionTabStripProps): React.JSX.Element => (
  <div
    className="flex items-center gap-0.5 overflow-x-auto border-b border-[var(--v2-border-soft)] bg-[var(--v2-bg1)] px-2"
    style={{ height: 30, minHeight: 30 }}
  >
    {sessions.map((s) => {
      const prov = getSessionProvider(s);
      const isActive = s.id === activeId;
      return (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={`flex shrink-0 items-center gap-1.5 rounded px-2 font-mono text-[10.5px] transition-colors ${
            isActive
              ? 'bg-[var(--v2-bg3)] text-[var(--v2-text)]'
              : 'text-[var(--v2-text-faint)] hover:bg-[var(--v2-bg2)] hover:text-[var(--v2-text-dim)]'
          }`}
          style={{ height: 22 }}
        >
          <span className="h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: prov.tint }} />
          <span className="max-w-[90px] truncate">{s.label ?? prov.short}</span>
          {s.status === 'running' && (
            <span className="h-[4px] w-[4px] shrink-0 animate-pulse rounded-full bg-[var(--v2-green)]" />
          )}
        </button>
      );
    })}
  </div>
);

// ── DevPaneEmptyState ─────────────────────────────────────────────────────────

interface DevPaneEmptyStateProps {
  projectName: string | null;
  onLaunch: (option: { label: string; command?: string; args?: string[] }) => void;
  onOpenLaunchMenu: () => void;
}

const DevPaneEmptyState = ({ projectName, onLaunch, onOpenLaunchMenu }: DevPaneEmptyStateProps): React.JSX.Element => (
  <div className="flex h-full flex-col items-center justify-center gap-5">
    <div className="text-center">
      <p className="font-mono text-[12px] font-medium text-[var(--v2-text-dim)]">
        {projectName !== null ? `no sessions for ${projectName}` : 'start a session'}
      </p>
      <p className="mt-1 font-mono text-[11px] text-[var(--v2-text-faint)]">choose a provider to launch</p>
    </div>
    <div className="flex gap-2">
      <LaunchButton label="Shell" onClick={() => onLaunch({ label: 'Shell' })} />
      <LaunchButton
        label="Claude Code"
        onClick={() => onLaunch({ label: 'Claude Code', command: 'claude' })}
        tint="#d97757"
      />
      <LaunchButton label="Copilot" onClick={() => onLaunch({ label: 'Copilot', command: 'copilot' })} />
    </div>
    <button
      onClick={onOpenLaunchMenu}
      className="font-mono text-[10px] text-[var(--v2-text-faint)] transition-colors hover:text-[var(--v2-text-dim)]"
    >
      custom...
    </button>
  </div>
);

const LaunchButton = ({ label, onClick, tint }: { label: string; onClick: () => void; tint?: string }): React.JSX.Element => (
  <button
    onClick={onClick}
    className="cursor-pointer rounded border px-4 py-2 font-mono text-[11px] font-medium transition-all"
    style={
      tint
        ? { borderColor: tint, background: `${tint}18`, color: tint }
        : { borderColor: 'var(--v2-border)', background: 'transparent', color: 'var(--v2-text-dim)' }
    }
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
  const newButtonRef = useRef<HTMLButtonElement | null>(null);
  const terminalPaneRef = useRef<HTMLDivElement>(null);
  const subscribedRef = useRef<Set<string>>(new Set());
  const cleanupsRef = useRef<Map<string, () => void>>(new Map());

  const activeProjectId = activeProject?.id ?? null;
  useEffect(() => {
    const { sessions: s, activeSessionId: cur, setActiveSession: set } = useTerminalStore.getState();
    const projectSessions = s.filter((x) => activeProjectId !== null && x.projectId === activeProjectId);
    if (cur !== null && !projectSessions.some((x) => x.id === cur)) {
      set(projectSessions[0]?.id ?? null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const projectSessions = sessions.filter(
    (s) => activeProject !== null && s.projectId === activeProject.id,
  );

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // Subscribe to exit and Claude status events for all live sessions
  useEffect(() => {
    for (const session of sessions) {
      if (session.status !== 'exited' && !subscribedRef.current.has(session.id)) {
        subscribedRef.current.add(session.id);
        if (!window.nexusAPI?.terminal) continue;

        const exitCleanup = window.nexusAPI.terminal.onExit(session.id, () => {
          updateSession(session.id, { status: 'exited' });
          subscribedRef.current.delete(session.id);
          cleanupsRef.current.delete(session.id);
        });

        const isClaudeSession = session.sessionType === 'claude' || session.command === 'claude';
        const statusCleanup =
          isClaudeSession && window.nexusAPI.terminal.onClaudeStatus
            ? window.nexusAPI.terminal.onClaudeStatus(session.id, (status: ClaudeStatus) => {
                updateSession(session.id, { claudeStatus: status });
              })
            : undefined;

        cleanupsRef.current.set(session.id, () => {
          exitCleanup();
          statusCleanup?.();
        });
      }
    }
    return () => {
      for (const cleanup of cleanupsRef.current.values()) cleanup();
      cleanupsRef.current.clear();
      subscribedRef.current.clear();
    };
  }, [sessions, updateSession]);

  // Open launch menu when requested via ContextBar "New run" button
  const newRunRequested = useUIStore((s) => s.newRunRequested);
  const setNewRunRequested = useUIStore((s) => s.setNewRunRequested);
  useEffect(() => {
    if (newRunRequested) {
      setLaunchMenuOpen(true);
      setNewRunRequested(false);
    }
  }, [newRunRequested, setNewRunRequested]);

  // Switch to session focused from kanban board
  const focusedSessionId = useUIStore((s) => s.focusedSessionId);
  const setFocusedSessionId = useUIStore((s) => s.setFocusedSessionId);
  useEffect(() => {
    if (focusedSessionId !== null) {
      const exists = sessions.some((s) => s.id === focusedSessionId);
      if (exists) setActiveSession(focusedSessionId);
      setFocusedSessionId(null);
    }
  }, [focusedSessionId, sessions, setActiveSession, setFocusedSessionId]);

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
        } catch (settingsErr) {
          console.error('[DevPane] failed to read agent settings, launching with defaults:', settingsErr);
        }

        const resolvedWorktreePath = option.worktreePath ?? activeProject.path;

        const pane = terminalPaneRef.current;
        const cols = pane && pane.offsetWidth > 0 ? Math.max(40, Math.floor(pane.offsetWidth / 8)) : 120;
        const rows = pane && pane.offsetHeight > 0 ? Math.max(10, Math.floor(pane.offsetHeight / 17)) : 30;

        const sessionId = await window.nexusAPI.terminal.create({
          projectId: activeProject.id,
          worktreePath: resolvedWorktreePath,
          command,
          args,
          label: option.label,
          cols,
          rows,
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
        setActiveSession(sessionId);
      } catch (err) {
        useToastStore.getState().addToast(
          `Launch failed: ${err instanceof Error ? err.message : String(err)}`,
          'error',
        );
      }
    },
    [activeProject, addSession, setActiveSession],
  );

  const handleKill = useCallback(
    async (sessionId: string) => {
      try {
        await window.nexusAPI.terminal.kill(sessionId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[DevPane] failed to kill session:', err);
        useToastStore.getState().addToast(`Stop session failed: ${msg}`, 'error');
      } finally {
        removeSession(sessionId);
      }
    },
    [removeSession],
  );

  const handleSelectSession = (id: string) => {
    setActiveSession(id);
    const s = sessions.find((x) => x.id === id);
    if (s) setActiveWorktreePath(s.worktreePath ?? null);
  };

  const showWelcome = activeProject === null && sessions.length === 0;
  const showEmptyState = activeProject !== null && projectSessions.length === 0;

  return (
    <div className="flex h-full w-full min-w-0 flex-col bg-[var(--v2-bg0)]">
      {/* Active session strip */}
      {activeSession !== undefined && (
        <MCSessionStrip
          session={activeSession}
          onKill={() => void handleKill(activeSession.id)}
          newButtonRef={newButtonRef}
          onNew={() => setLaunchMenuOpen(true)}
        />
      )}

      {/* Multi-session tab strip — only when there are 2+ project sessions */}
      {projectSessions.length > 1 && (
        <SessionTabStrip
          sessions={projectSessions}
          activeId={activeSessionId}
          onSelect={handleSelectSession}
        />
      )}

      {/* Terminal area */}
      <div ref={terminalPaneRef} className="relative flex-1 overflow-hidden">
        {showWelcome && <WelcomeScreen />}
        {showEmptyState && (
          <DevPaneEmptyState
            projectName={activeProject?.name ?? null}
            onLaunch={(opt) => { void handleLaunch(opt); }}
            onOpenLaunchMenu={() => setLaunchMenuOpen(true)}
          />
        )}
        {!showWelcome && activeSessionId === null && !showEmptyState && (
          <div className="flex h-full items-center justify-center">
            <span className="font-mono text-[11px] text-[var(--v2-text-faint)]">select a session above</span>
          </div>
        )}

        {/* Persistent terminal pool — all sessions mounted, only active visible */}
        {sessions.map((session) => (
          <div
            key={session.id}
            className="absolute inset-0"
            style={session.id !== activeSessionId ? { visibility: 'hidden' } : undefined}
          >
            <TerminalTab
              sessionId={session.id}
              visible={session.id === activeSessionId}
              onKill={() => void handleKill(session.id)}
              borderless
              hideHeader
            />
          </div>
        ))}
      </div>

      {/* Launch menu */}
      {launchMenuOpen && (
        <LaunchMenu
          onLaunch={handleLaunch}
          onClose={() => setLaunchMenuOpen(false)}
          anchorRef={newButtonRef}
          worktrees={worktrees}
        />
      )}
    </div>
  );
};
