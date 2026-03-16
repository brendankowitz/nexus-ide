import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';
import { useTerminalStore } from '@/stores/terminalStore';
import type { ClaudeStatus } from '@/types';

/* ─── Session accent config ─────────────────────────────────────────────────── */

interface HeaderConfig {
  accent: string;
  accentDim: string;
  dotRunning: string;
}

function getHeaderConfig(sessionType: string | undefined): HeaderConfig {
  switch (sessionType) {
    case 'claude':  return { accent: 'var(--phase-plan)',  accentDim: 'var(--phase-plan-dim)',          dotRunning: 'bg-[var(--phase-plan)] animate-pulse' };
    case 'copilot': return { accent: '#38bdf8',            accentDim: 'rgba(56,189,248,0.15)',           dotRunning: 'bg-[#38bdf8] animate-pulse' };
    case 'aider':   return { accent: '#f97316',            accentDim: 'rgba(249,115,22,0.15)',           dotRunning: 'bg-[#f97316] animate-pulse' };
    default:        return { accent: 'var(--phase-execute)', accentDim: 'var(--phase-execute-dim)',      dotRunning: 'bg-[var(--phase-execute)] animate-pulse' };
  }
}

/* ─── TerminalHeader ────────────────────────────────────────────────────────── */

interface TerminalHeaderProps {
  sessionId: string;
  onKill?: () => void;
}

const TerminalHeader = ({ sessionId, onKill }: TerminalHeaderProps): React.JSX.Element => {
  const session = useTerminalStore((s) => s.sessions.find((x) => x.id === sessionId));
  const updateSession = useTerminalStore((s) => s.updateSession);

  const isClaudeSession = session?.sessionType === 'claude' || session?.command === 'claude';
  const isCopilot = session?.sessionType === 'copilot';

  // Subscribe to live Claude status pushes from the main process
  useEffect(() => {
    if (!isClaudeSession) return;
    const api = window.nexusAPI?.terminal;
    if (!api?.onClaudeStatus) return;
    const cleanup = api.onClaudeStatus(sessionId, (status: ClaudeStatus) => {
      updateSession(sessionId, { claudeStatus: status });
    });
    return cleanup;
  }, [sessionId, isClaudeSession, updateSession]);

  if (session === undefined) return <></>;

  const cfg = getHeaderConfig(session.sessionType);

  const dotClass = session.status === 'exited'
    ? 'bg-[var(--color-danger)]'
    : session.status === 'idle'
      ? 'bg-text-ghost'
      : cfg.dotRunning;

  const claudeStatus = session.claudeStatus;
  const ctxPct = claudeStatus?.contextPercent;

  const worktreeDisplay = session.worktreePath
    ? session.worktreePath.replace(/\\/g, '/').split('/').slice(-2).join('/')
    : null;

  const ctxFillColor = ctxPct === undefined ? cfg.accent
    : ctxPct > 80 ? 'var(--color-danger)'
    : ctxPct > 50 ? 'var(--color-warning)'
    : cfg.accent;

  const formatTokens = (n: number): string =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  return (
    <div
      className="relative flex h-9 shrink-0 items-center overflow-hidden border-b border-border-subtle bg-bg-void"
    >
      {/* Context ambient fill — grows behind the whole bar as Claude fills context */}
      {isClaudeSession && ctxPct !== undefined && ctxPct > 0 && (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 transition-all duration-1000"
          style={{
            width: `${ctxPct}%`,
            background: ctxPct > 80
              ? 'linear-gradient(to left, rgba(248,81,73,0.07), transparent)'
              : ctxPct > 50
                ? 'linear-gradient(to left, rgba(210,153,34,0.07), transparent)'
                : 'linear-gradient(to left, rgba(127,119,221,0.09), transparent)',
          }}
        />
      )}

      {/* Left accent strip — session type color */}
      <div
        className="absolute left-0 top-0 h-full w-[2px]"
        style={{
          background: cfg.accent,
          opacity: session.status === 'running' ? 0.9 : 0.3,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex w-full items-center gap-2 px-3 pl-4">
        {/* Status dot */}
        <div className={`h-[5px] w-[5px] shrink-0 rounded-full ${dotClass}`} />

        {/* Label */}
        <span className="font-mono text-[10px] text-text-secondary">{session.label}</span>

        {/* Path */}
        {worktreeDisplay !== null && (
          <span className="max-w-[160px] truncate font-mono text-[10px] text-text-ghost">
            · {worktreeDisplay}
          </span>
        )}

        <div className="flex-1" />

        {/* ── Claude telemetry ── */}
        {isClaudeSession && claudeStatus !== undefined && (
          <div className="flex items-center gap-2.5">
            {/* Model chip */}
            {claudeStatus.model !== undefined && (
              <span
                className="shrink-0 rounded-[3px] px-1.5 py-px font-mono text-[8px] font-semibold uppercase tracking-wider"
                style={{
                  color: cfg.accent,
                  background: cfg.accentDim,
                  border: `1px solid ${cfg.accent}30`,
                }}
              >
                {claudeStatus.model.replace(/^claude-/, '').replace(/-\d+.*$/, '')}
              </span>
            )}

            {/* Context bar + percent */}
            {ctxPct !== undefined && (
              <div className="flex items-center gap-1.5">
                <div
                  className="h-[3px] w-14 overflow-hidden rounded-full"
                  style={{ background: 'var(--bg-active, #1e1e2e)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${ctxPct}%`, background: ctxFillColor }}
                  />
                </div>
                <span
                  className="w-6 text-right font-mono text-[9px] tabular-nums"
                  style={{ color: ctxFillColor, opacity: 0.9 }}
                >
                  {ctxPct}%
                </span>
              </div>
            )}

            {/* Token counter */}
            {claudeStatus.tokens !== undefined && (
              <span className="font-mono text-[9px] tabular-nums text-text-ghost">
                {formatTokens(claudeStatus.tokens)}
                <span className="opacity-40">tk</span>
              </span>
            )}
          </div>
        )}

        {/* ── Copilot badge ── */}
        {isCopilot && (
          <span
            className="shrink-0 rounded-[3px] px-1.5 py-px font-mono text-[8px] font-semibold uppercase tracking-wider"
            style={{
              color: '#38bdf8',
              background: 'rgba(56,189,248,0.12)',
              border: '1px solid rgba(56,189,248,0.25)',
            }}
          >
            copilot
          </span>
        )}

        {/* Kill */}
        {onKill !== undefined && (
          <button
            title="Kill session"
            tabIndex={-1}
            className="ml-1 cursor-default font-mono text-[13px] leading-none text-text-ghost transition-colors hover:text-[var(--color-danger)]"
            onClick={(e) => { e.stopPropagation(); onKill(); }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

/* ─── Terminal xterm theme ──────────────────────────────────────────────────── */

const NEXUS_TERMINAL_THEME = {
  background: '#0c0c0c',
  foreground: '#cccccc',
  cursor: '#1D9E75',
  cursorAccent: '#0c0c0c',
  selectionBackground: '#ffffff30',
  selectionForeground: '#ffffff',
  // ANSI colors — Nexus-branded
  black: '#0c0c0c',
  red: '#da3633',
  green: '#2ea043',
  yellow: '#d29922',
  blue: '#58a6ff',
  magenta: '#7F77DD',
  cyan: '#1D9E75',
  white: '#d4d4e0',
  brightBlack: '#55556a',
  brightRed: '#f85149',
  brightGreen: '#3fb950',
  brightYellow: '#e3b341',
  brightBlue: '#79c0ff',
  brightMagenta: '#bc8cff',
  brightCyan: '#56d4dd',
  brightWhite: '#f0f6fc',
} as const;

/* ─── TerminalTab ───────────────────────────────────────────────────────────── */

interface TerminalTabProps {
  sessionId: string;
  /** When true, removes border/rounding for edge-to-edge rendering. */
  borderless?: boolean;
  /** Called when the kill button in the header is clicked. */
  onKill?: () => void;
}

export const TerminalTab = ({
  sessionId,
  borderless = false,
  onKill,
}: TerminalTabProps): React.JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  // Track mount state to avoid state updates after unmount
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
      theme: NEXUS_TERMINAL_THEME,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);

    // Try WebGL renderer, fall back to canvas silently
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
      term.loadAddon(webglAddon);
    } catch {
      // Canvas fallback is fine
    }

    fitAddon.fit();
    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Guard: if nexusAPI isn't available, show local-only terminal
    const api = window.nexusAPI?.terminal;

    // Forward PTY output to xterm
    const cleanupData = api?.onData(sessionId, (data) => {
      term.write(data);
    });

    // Forward user keystrokes to PTY
    const onDataDisposable = term.onData((data) => {
      api?.write(sessionId, data);
    });

    // Right-click: copy selection before xterm clears it, suppress native menu
    const handleContextMenu = (e: MouseEvent): void => {
      const selection = term.getSelection();
      if (selection) {
        e.preventDefault();
        void navigator.clipboard.writeText(selection);
      }
    };
    container.addEventListener('contextmenu', handleContextMenu);

    // Sync terminal dimensions on resize
    const resizeObserver = new ResizeObserver(() => {
      if (container.offsetWidth === 0 || container.offsetHeight === 0) return;
      fitAddon.fit();
      api?.resize(sessionId, term.cols, term.rows);
    });
    resizeObserver.observe(container);

    // Initial resize notification to PTY
    api?.resize(sessionId, term.cols, term.rows);

    // Trigger a render so the header can read initial session state
    forceUpdate((n) => n + 1);

    return () => {
      container.removeEventListener('contextmenu', handleContextMenu);
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      cleanupData?.();
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId]);

  return (
    <div
      className={`flex h-full w-full flex-col overflow-hidden bg-[#0c0c0c] ${
        borderless ? '' : 'rounded-[var(--radius-md)] border border-border-subtle'
      }`}
    >
      <TerminalHeader sessionId={sessionId} onKill={onKill} />
      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden" />
    </div>
  );
};
