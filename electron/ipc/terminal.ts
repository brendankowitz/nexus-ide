/**
 * electron/ipc/terminal.ts
 *
 * Terminal session manager — real PTY sessions via @lydell/node-pty.
 *
 * Windows notes:
 *   - Default shell detection order: pwsh.exe → powershell.exe → cmd.exe.
 *   - Uses ConPTY via @lydell/node-pty (prebuilt binaries, no node-gyp needed).
 *   - useConpty: true enables Windows ConPTY.
 *   - ASAR unpack required: add '@lydell/node-pty/**' to electron-builder asarUnpack.
 */

import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as pty from '@lydell/node-pty';
import type { TerminalOptions, TerminalSession } from '../../src/types/index.js';

/* ─── Shell detection ──────────────────────────────────────────────────────── */

/** Resolve the best available default shell. Cached after first call. */
let _cachedShell: string | null = null;

export function detectDefaultShell(): string {
  if (_cachedShell !== null) return _cachedShell;

  if (process.platform === 'win32') {
    const candidates = ['pwsh.exe', 'powershell.exe', 'cmd.exe'] as const;
    for (const candidate of candidates) {
      try {
        execSync(`where ${candidate}`, { stdio: 'ignore', windowsHide: true });
        _cachedShell = candidate;
        return _cachedShell;
      } catch {
        // not found, try next
      }
    }
    _cachedShell = 'cmd.exe'; // guaranteed fallback on Windows
  } else {
    _cachedShell = process.env['SHELL'] ?? '/bin/zsh';
  }

  return _cachedShell;
}

/* ─── Internal session representation ─────────────────────────────────────── */

interface SessionEntry {
  readonly id: string;
  readonly projectId: string;
  readonly label: string;
  readonly command: string;
  readonly args: string[];
  readonly createdAt: string;
  ptyProcess: pty.IPty | null;
  status: 'running' | 'idle' | 'exited';
  exitCode: number | undefined;
  dataListeners: Array<(data: string) => void>;
  exitListeners: Array<(code: number) => void>;
}

const sessions = new Map<string, SessionEntry>();

/* ─── createSession ────────────────────────────────────────────────────────── */

/**
 * Create a new terminal session backed by a real PTY process.
 *
 * @returns Session ID (UUID v4).
 * @throws If the PTY process fails to spawn (e.g. command not found).
 */
export function createSession(options: TerminalOptions): string {
  const id = randomUUID();
  const shell = options.command ?? options.shell ?? detectDefaultShell();
  const args = options.args ?? [];
  const cwd = (options.cwd ?? options.worktreePath ?? process.cwd()).replace(/\\/g, '/');

  const entry: SessionEntry = {
    id,
    projectId: options.projectId,
    label: options.label ?? shell,
    command: shell,
    args,
    createdAt: new Date().toISOString(),
    ptyProcess: null,
    status: 'running',
    exitCode: undefined,
    dataListeners: [],
    exitListeners: [],
  };

  const ptyProcess = pty.spawn(shell, args, {
    name: 'xterm-256color',
    cols: options.cols ?? 120,
    rows: options.rows ?? 30,
    cwd,
    env: { ...process.env, ...options.env } as Record<string, string>,
    useConpty: process.platform === 'win32',
  });

  entry.ptyProcess = ptyProcess;

  ptyProcess.onData((data) => {
    for (const cb of entry.dataListeners) {
      cb(data);
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    entry.status = 'exited';
    entry.exitCode = exitCode;
    const code = exitCode ?? 0;
    for (const cb of entry.exitListeners) {
      cb(code);
    }
    // Clean up listeners after exit to avoid leaks
    entry.dataListeners.length = 0;
    entry.exitListeners.length = 0;
  });

  sessions.set(id, entry);
  return id;
}

/* ─── writeToSession ───────────────────────────────────────────────────────── */

/**
 * Write data (keyboard input) to the PTY stdin.
 */
export function writeToSession(sessionId: string, data: string): void {
  const entry = sessions.get(sessionId);
  if (!entry || entry.status === 'exited') return;
  entry.ptyProcess?.write(data);
}

/* ─── resizeSession ────────────────────────────────────────────────────────── */

/**
 * Resize the PTY dimensions.
 */
export function resizeSession(sessionId: string, cols: number, rows: number): void {
  const entry = sessions.get(sessionId);
  if (!entry || entry.status === 'exited') return;
  entry.ptyProcess?.resize(cols, rows);
}

/* ─── killSession ──────────────────────────────────────────────────────────── */

/**
 * Kill a terminal session and clean up resources to avoid zombie processes.
 */
export async function killSession(sessionId: string): Promise<void> {
  const entry = sessions.get(sessionId);
  if (!entry) return;

  if (entry.status !== 'exited' && entry.ptyProcess !== null) {
    try {
      entry.ptyProcess.kill();
    } catch {
      // Ignore kill errors — process may have already exited
    }
  }

  entry.dataListeners.length = 0;
  entry.exitListeners.length = 0;
  sessions.delete(sessionId);
}

/* ─── listSessions ─────────────────────────────────────────────────────────── */

/**
 * List all active (non-exited) terminal sessions.
 */
export function listSessions(): TerminalSession[] {
  return Array.from(sessions.values())
    .filter(e => e.status !== 'exited')
    .map(e => ({
      id: e.id,
      projectId: e.projectId,
      projectName: e.projectId,
      agentType: e.command,
      label: e.label,
      status: e.status,
      command: e.command,
      startedAt: e.createdAt,
    }));
}

/* ─── onSessionData ────────────────────────────────────────────────────────── */

/**
 * Subscribe to data output from a terminal session.
 *
 * @returns Unsubscribe function.
 */
export function onSessionData(
  sessionId: string,
  callback: (data: string) => void,
): () => void {
  const entry = sessions.get(sessionId);
  if (!entry) return () => { /* no-op */ };

  entry.dataListeners.push(callback);
  return () => {
    const idx = entry.dataListeners.indexOf(callback);
    if (idx !== -1) entry.dataListeners.splice(idx, 1);
  };
}

/* ─── onSessionExit ────────────────────────────────────────────────────────── */

/**
 * Subscribe to the exit event of a terminal session.
 *
 * @returns Unsubscribe function.
 */
export function onSessionExit(
  sessionId: string,
  callback: (code: number) => void,
): () => void {
  const entry = sessions.get(sessionId);
  if (!entry) return () => { /* no-op */ };

  if (entry.status === 'exited') {
    // Already exited — fire immediately
    callback(entry.exitCode ?? 0);
    return () => { /* no-op */ };
  }

  entry.exitListeners.push(callback);
  return () => {
    const idx = entry.exitListeners.indexOf(callback);
    if (idx !== -1) entry.exitListeners.splice(idx, 1);
  };
}
