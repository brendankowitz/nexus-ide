import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';

interface TerminalTabProps {
  sessionId: string;
  /** When true, removes border/rounding for edge-to-edge rendering in main content area. */
  borderless?: boolean;
}

export const TerminalTab = ({ sessionId, borderless = false }: TerminalTabProps): React.JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
      theme: {
        background: '#0c0c0c',
        foreground: '#cccccc',
        cursor: '#1D9E75',
        selectionBackground: '#ffffff30',
        black: '#0c0c0c',
        red: '#da3633',
        green: '#2ea043',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#7F77DD',
        cyan: '#1D9E75',
        white: '#d4d4e0',
      },
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
      // Guard against zero-size container (e.g. collapsed panel)
      if (container.offsetWidth === 0 || container.offsetHeight === 0) return;
      fitAddon.fit();
      api?.resize(sessionId, term.cols, term.rows);
    });
    resizeObserver.observe(container);

    // Initial resize notification to PTY
    api?.resize(sessionId, term.cols, term.rows);

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
      ref={containerRef}
      className={`h-full w-full overflow-hidden bg-[#0c0c0c] ${
        borderless ? '' : 'rounded-[var(--radius-md)] border border-border-subtle'
      }`}
    />
  );
};
