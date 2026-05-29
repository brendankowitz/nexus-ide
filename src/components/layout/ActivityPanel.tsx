import { useState } from 'react';
import { useTerminalStore } from '@/stores/terminalStore';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { PROVIDERS } from '@/components/shared/ProviderPicker';

const KIND_COLORS: Record<string, string> = {
  tool:   'var(--v2-text-dim)',
  plan:   'var(--v2-blue)',
  edit:   'var(--v2-amber)',
  shell:  'var(--v2-green)',
  result: 'var(--v2-green)',
};

const SESSION_KINDS: Record<string, string> = {
  claude:  'tool',
  copilot: 'shell',
  codex:   'plan',
  gemini:  'edit',
};

function agentTypeToProviderId(agentType: string): string {
  const lower = agentType.toLowerCase();
  if (lower.includes('claude')) return 'claude';
  if (lower.includes('copilot')) return 'copilot';
  if (lower.includes('codex')) return 'codex';
  if (lower.includes('gemini')) return 'gemini';
  return 'custom';
}

export const ActivityPanel = (): React.JSX.Element => {
  const sessions = useTerminalStore((s) => s.sessions);
  const setActiveSession = useTerminalStore((s) => s.setActiveSession);
  const projects = useProjectStore((s) => s.projects);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const setActiveMode = useUIStore((s) => s.setActiveMode);
  const [collapsed, setCollapsed] = useState(true);

  const handleSelectSession = (sessionId: string, projectId: string | undefined): void => {
    if (projectId !== undefined) setActiveProject(projectId);
    setActiveSession(sessionId);
    setActiveMode('workbench');
  };

  const active = sessions.filter((s) => s.status === 'running' || s.status === 'idle');

  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center py-2 bg-[var(--v2-bg1)]"
        style={{ width: 32, flexShrink: 0, borderLeft: '1px solid var(--v2-border)' }}
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="Expand activity panel"
          className="flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--v2-bg2)] text-[var(--v2-text-faint)] hover:text-[var(--v2-text-dim)] transition-colors cursor-pointer"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        {active.length > 0 && (
          <span
            className="mt-2 w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: 'var(--v2-green)' }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col min-h-0 bg-[var(--v2-bg1)]"
      style={{ width: 320, flexShrink: 0, borderLeft: '1px solid var(--v2-border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--v2-border-soft)]">
        <span className="text-[12px] font-semibold text-[var(--v2-text)]">Activity · across all projects</span>
        <div className="flex items-center gap-2">
          {active.length > 0 && (
            <span className="text-[11px] text-[var(--v2-green)]">live</span>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            title="Collapse activity panel"
            className="flex items-center justify-center w-5 h-5 rounded hover:bg-[var(--v2-bg2)] text-[var(--v2-text-faint)] hover:text-[var(--v2-text-dim)] transition-colors cursor-pointer"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Activity rows */}
      <div className="flex-1 overflow-auto p-1">
        {active.length === 0 && (
          <div className="flex items-center justify-center h-full text-[11px] text-[var(--v2-text-faint)]">
            no active sessions
          </div>
        )}
        {active.map((session) => {
          const providerId = agentTypeToProviderId(session.agentType ?? session.label ?? '');
          const provider = PROVIDERS.find((p) => p.id === providerId) ?? PROVIDERS[0];
          const proj = projects.find((p) => p.id === session.projectId);
          const kind = SESSION_KINDS[providerId] ?? 'tool';
          const kindColor = KIND_COLORS[kind] ?? KIND_COLORS.tool;

          const elapsed = session.startedAt
            ? Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)
            : null;
          const elapsedStr = elapsed !== null
            ? elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m`
            : null;

          const ctx = session.claudeStatus?.contextPercent;
          const tokens = session.claudeStatus?.tokens;

          return (
            <button
              key={session.id}
              type="button"
              onClick={() => handleSelectSession(session.id, session.projectId)}
              className="grid gap-1.5 rounded-md px-2 py-1.5 w-full text-left cursor-pointer hover:bg-[var(--v2-bg2)] transition-colors"
              style={{ gridTemplateColumns: '32px 1fr' }}
            >
              {/* Timestamp / elapsed */}
              <div className="text-[10.5px] text-[var(--v2-text-faint)] font-mono pt-0.5">
                {elapsedStr ?? '—'}
              </div>
              <div>
                {/* Kind tag + project + provider dot */}
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className="text-[9.5px] font-mono uppercase tracking-[0.6px] rounded px-1 py-px bg-[var(--v2-bg2)]"
                    style={{ color: kindColor }}
                  >
                    {kind}
                  </span>
                  <span className="text-[10.5px] text-[var(--v2-text-faint)]">{proj?.name ?? session.projectId}</span>
                  <span
                    className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: provider.tint }}
                  />
                </div>
                {/* Description */}
                <div className="text-[12px] text-[var(--v2-text)] leading-snug truncate">
                  {session.label} · {provider.short}
                  {tokens !== undefined && tokens > 0 && (
                    <span className="text-[var(--v2-text-faint)] font-mono ml-1.5">
                      {(tokens / 1000).toFixed(1)}k
                    </span>
                  )}
                </div>
                {/* Context bar (Claude only) */}
                {ctx !== undefined && (
                  <div className="mt-1.5 h-0.5 bg-[var(--v2-bg3)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${ctx}%`,
                        background: ctx > 80
                          ? 'var(--v2-red)'
                          : ctx > 50
                            ? 'var(--v2-yellow)'
                            : provider.tint,
                      }}
                    />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
