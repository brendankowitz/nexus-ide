import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';
import { useTerminalStore } from '@/stores/terminalStore';
import type { ClaudeStatus } from '@/types';

/* ─── ContextGauge ──────────────────────────────────────────────────────────── */

interface ContextGaugeProps {
  percent: number;
}

const ContextGauge = ({ percent }: ContextGaugeProps): React.JSX.Element => {
  const filled = Math.round(percent / 20); // 5 blocks total
  const blocks = Array.from({ length: 5 }, (_, i) => i < filled);
  const color =
    percent > 80
      ? 'var(--color-danger)'
      : percent > 50
        ? 'var(--color-warning)'
        : 'var(--phase-execute)';

  return (
    <span className="font-mono text-[9px]" style={{ color }}>
      {blocks.map((fill, i) => (
        <span key={i} style={{ opacity: fill ? 1 : 0.2 }}>
          ▰
        </span>
      ))}
    </span>
  );
};

/* ─── TerminalHeader ────────────────────────────────────────────────────────── */

interface TerminalHeaderProps {
  sessionId: string;
  onKill?: () => void;
}

const statusDotClass: Record<string, string> = {
  running: 'bg-phase-execute animate-pulse',
  idle: 'bg-text-ghost',
  exited: 'bg-sem-danger',
  claude: 'bg-phase-plan animate-pulse',
};

const TerminalHeader = ({ sessionId, onKill }: TerminalHeaderProps): React.JSX.Element => {
  const session = useTerminalStore((s) => s.sessions.find((x) => x.id === sessionId));
  const updateSession = useTerminalStore((s) => s.updateSession);

  const isClaudeSession =
    session?.sessionType === 'claude' || session?.command === 'claude';

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

  const dotClass =
    isClaudeSession && session.status === 'running'
      ? statusDotClass['claude']
      : (statusDotClass[session.status] ?? 'bg-text-ghost');

  const claudeStatus = session.claudeStatus;
  const worktreeDisplay = session.worktreePath
    ? session.worktreePath.replace(/\\/g, '/').split('/').slice(-2).join('/')
    : null;

  return (
    <div className="flex h-7 shrink-0 items-center gap-2 border-b border-border-subtle bg-bg-void px-3">
      {/* Status dot */}
      <div className={`h-2 w-2 rounded-full ${dotClass}`} />

      {/* Session label */}
      <span className="font-mono text-[10px] text-text-secondary">{session.label}</span>

      {/* Separator + working directory */}
      {worktreeDisplay !== null && (
        <>
          <span className="text-text-ghost">·</span>
          <span className="max-w-[180px] truncate font-mono text-[10px] text-text-ghost">
            {worktreeDisplay}
          </span>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Claude status section */}
      {isClaudeSession && claudeStatus !== undefined && (
        <div className="flex items-center gap-2">
          {claudeStatus.model !== undefined && (
            <span className="font-mono text-[9px] text-phase-plan">{claudeStatus.model}</span>
          )}
          {claudeStatus.contextPercent !== undefined && (
            <ContextGauge percent={claudeStatus.contextPercent} />
          )}
          {claudeStatus.tokens !== undefined && (
            <span className="font-mono text-[9px] text-text-ghost">
              {claudeStatus.tokens.toLocaleString()}tk
            </span>
          )}
        </div>
      )}

      {/* Controls */}
      <button
        title="Split"
        tabIndex={-1}
        className="cursor-default px-0.5 text-[11px] text-text-ghost transition-colors hover:text-text-secondary"
        onClick={(e) => e.preventDefault()}
      >
        ⊞
      </button>
      {onKill !== undefined && (
        <button
          title="Kill session"
          tabIndex={-1}
          className="cursor-default px-0.5 text-[11px] text-text-ghost transition-colors hover:text-sem-danger"
          onClick={(e) => {
            e.stopPropagation();
            onKill();
          }}
        >
          ×
        </button>
      )}
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
