import { useCallback, useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { useProjectStore } from '@/stores/projectStore';
import { AgentCard, LaunchAgentCard } from '@/components/terminals/AgentCard';
import { TerminalTab } from '@/components/terminals/TerminalTab';
import { LaunchMenu } from '@/components/terminals/LaunchMenu';

export const AgentPanel = (): React.JSX.Element => {
  const expanded = useUIStore((s) => s.agentPanelExpanded);
  const togglePanel = useUIStore((s) => s.toggleAgentPanel);

  const sessions = useTerminalStore((s) => s.sessions);
  const activeSessionId = useTerminalStore((s) => s.activeSessionId);
  const setActiveSession = useTerminalStore((s) => s.setActiveSession);
  const addSession = useTerminalStore((s) => s.addSession);
  const updateSession = useTerminalStore((s) => s.updateSession);
  const removeSession = useTerminalStore((s) => s.removeSession);

  const activeProject = useProjectStore((s) => s.activeProject);

  const [launchMenuOpen, setLaunchMenuOpen] = useState(false);
  const launchButtonRef = useRef<HTMLButtonElement>(null);
  const subscribedRef = useRef<Set<string>>(new Set());
  const cleanupsRef = useRef<Map<string, () => void>>(new Map());

  const runningCount = sessions.filter((s) => s.status === 'running').length;

  // Subscribe to exit events for new running sessions only (deduped via ref)
  useEffect(() => {
    for (const session of sessions) {
      if (session.status !== 'exited' && !subscribedRef.current.has(session.id)) {
        subscribedRef.current.add(session.id);
        const cleanup = window.nexusAPI.terminal.onExit(session.id, () => {
          updateSession(session.id, { status: 'exited' });
          subscribedRef.current.delete(session.id);
          cleanupsRef.current.delete(session.id);
        });
        cleanupsRef.current.set(session.id, cleanup);
      }
    }
    // Only clean up on unmount
    return () => {
      for (const cleanup of cleanupsRef.current.values()) cleanup();
      cleanupsRef.current.clear();
      subscribedRef.current.clear();
    };
  }, [sessions, updateSession]);

  const handleLaunch = useCallback(
    async (option: { label: string; command?: string; args?: string[] }) => {
      if (activeProject === null) return;

      setLaunchMenuOpen(false);

      const sessionId = await window.nexusAPI.terminal.create({
        projectId: activeProject.id,
        worktreePath: activeProject.path,
        command: option.command,
        args: option.args,
        label: option.label,
      });

      addSession({
        id: sessionId,
        projectId: activeProject.id,
        projectName: activeProject.name,
        agentType: option.label,
        label: option.label,
        status: 'running',
        worktreePath: activeProject.path,
        command: option.command,
        startedAt: new Date().toISOString(),
      });

      // Ensure panel is expanded when a new session is created
      if (!expanded) {
        togglePanel();
      }
    },
    [activeProject, addSession, expanded, togglePanel],
  );

  const handleKill = useCallback(
    async (sessionId: string) => {
      await window.nexusAPI.terminal.kill(sessionId);
      removeSession(sessionId);
    },
    [removeSession],
  );

  return (
    <div
      className="flex flex-col overflow-hidden border-t border-border-subtle bg-bg-void transition-[height] duration-[250ms] ease-[var(--ease-out)]"
      style={{
        height: expanded
          ? 'var(--agent-panel-expanded)'
          : 'var(--agent-panel-collapsed)',
      }}
    >
      {/* Header */}
      <div
        onClick={togglePanel}
        className="flex h-[var(--agent-panel-collapsed)] min-h-[var(--agent-panel-collapsed)] cursor-pointer select-none items-center gap-2.5 px-4 transition-colors hover:bg-bg-hover"
      >
        <span
          className={`text-[10px] text-text-tertiary transition-transform duration-[150ms] ${
            expanded ? 'rotate-180' : ''
          }`}
        >
          &#9660;
        </span>
        <span className="font-mono text-[11px] font-medium text-text-secondary">
          Agent terminals
        </span>
        <span className="rounded-[3px] bg-[var(--phase-execute-dim)] px-1.5 py-px font-mono text-[10px] font-semibold text-phase-execute">
          {runningCount > 0 ? runningCount : sessions.length}
        </span>
        <div className="relative ml-auto">
          <button
            ref={launchButtonRef}
            onClick={(e) => {
              e.stopPropagation();
              setLaunchMenuOpen((prev) => !prev);
            }}
            className="cursor-pointer rounded-[var(--radius-sm)] border border-dashed border-border-strong bg-transparent px-2.5 py-[3px] font-mono text-[10px] text-text-tertiary transition-all duration-[var(--duration-fast)] hover:border-solid hover:border-phase-execute hover:bg-[var(--phase-execute-glow)] hover:text-phase-execute"
          >
            + launch
          </button>
          {launchMenuOpen && (
            <LaunchMenu
              onLaunch={handleLaunch}
              onClose={() => setLaunchMenuOpen(false)}
              anchorRef={launchButtonRef}
            />
          )}
        </div>
      </div>

      {/* Card strip */}
      <div className="flex shrink-0 gap-2 overflow-x-auto px-4 py-2">
        {sessions.map((session) => (
          <AgentCard
            key={session.id}
            session={session}
            selected={session.id === activeSessionId}
            onClick={() => setActiveSession(session.id)}
            onKill={() => void handleKill(session.id)}
          />
        ))}
        <LaunchAgentCard onClick={() => setLaunchMenuOpen(true)} />
      </div>

      {/* Terminal display area */}
      <div className="mx-4 mb-2 flex-1 overflow-hidden">
        {activeSessionId === null ? (
          <div className="flex h-full items-center justify-center rounded-[var(--radius-md)] border border-border-subtle bg-[#0c0c0c]">
            <span className="font-mono text-[11px] text-text-ghost">
              {sessions.length === 0
                ? 'Click "+ launch" to start a terminal session'
                : 'Select a terminal above to view output'}
            </span>
          </div>
        ) : (
          <TerminalTab sessionId={activeSessionId} />
        )}
      </div>
    </div>
  );
};
