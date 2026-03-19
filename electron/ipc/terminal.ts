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
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { app } from 'electron';
import * as pty from '@lydell/node-pty';
import type { TerminalOptions, TerminalSession } from '../../src/types/index.js';

/* ─── PATH augmentation ────────────────────────────────────────────────────── */

const PATH_SEP = process.platform === 'win32' ? ';' : ':';

/**
 * Electron may start with a minimal PATH when launched from a GUI shortcut or
 * file manager, omitting user-installed tools (git, npm globals, homebrew, etc.).
 *
 * - Windows: reads Machine + User PATH from the Windows environment via PowerShell.
 * - macOS / Linux: spawns a login shell to capture its full $PATH.
 *
 * Merges the result into process.env.PATH so all subsequently spawned PTY
 * processes inherit the complete PATH. Called once at app startup.
 */
export function augmentPathFromSystem(): void {
  try {
    let fromSystem: string[];

    if (process.platform === 'win32') {
      const result = execSync(
        'powershell -NoProfile -NonInteractive -Command ' +
        '"[System.Environment]::GetEnvironmentVariable(\'PATH\',\'Machine\') + \';\' + ' +
        '[System.Environment]::GetEnvironmentVariable(\'PATH\',\'User\')"',
        { encoding: 'utf8', windowsHide: true, timeout: 5000 },
      ).trim();
      fromSystem = result ? result.split(';').filter(Boolean) : [];
    } else {
      const shell = process.env['SHELL'] ?? '/bin/sh';
      const result = execSync(`${shell} -l -c 'echo $PATH'`, {
        encoding: 'utf8',
        timeout: 5000,
      }).trim();
      fromSystem = result ? result.split(':').filter(Boolean) : [];
    }

    if (fromSystem.length > 0) {
      const existing = (process.env['PATH'] ?? '').split(PATH_SEP).filter(Boolean);
      const merged = [...new Set([...fromSystem, ...existing])];
      process.env['PATH'] = merged.join(PATH_SEP);
    }
  } catch {
    // Shell query failed — inject well-known fallback paths per platform
    if (process.platform === 'win32') {
      const fallbacks = [
        'C:\\Program Files\\Git\\cmd',
        'C:\\Program Files\\Git\\bin',
        'C:\\Program Files (x86)\\Git\\cmd',
      ];
      process.env['PATH'] = [...fallbacks, process.env['PATH'] ?? ''].join(';');
    } else {
      const fallbacks = [
        '/opt/homebrew/bin',
        '/opt/homebrew/sbin',
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
      ];
      const existing = (process.env['PATH'] ?? '').split(':').filter(Boolean);
      process.env['PATH'] = [...new Set([...fallbacks, ...existing])].join(':');
    }
  }

  // On Windows, append dugite's bundled git/cmd to PATH as a guaranteed fallback.
  // dugite ships git.exe inside the package (already asarUnpack'd), so git is always
  // available even if the user has no system Git installation.
  // System git (if present earlier in PATH) takes precedence.
  if (process.platform === 'win32') {
    try {
      const appPath = app.getAppPath();
      // In packaged builds app.getAppPath() returns the .asar path. Electron's
      // patched fs treats .asar as a virtual filesystem so existsSync returns true
      // for paths inside it — but executables inside .asar cannot be spawned.
      // Always resolve to the real on-disk path: .asar → .asar.unpacked.
      const realBase = appPath.endsWith('.asar') ? appPath + '.unpacked' : appPath;
      const dugiteCandidates = [
        join(realBase, 'node_modules', 'dugite', 'git', 'cmd'),
      ];
      for (const candidate of dugiteCandidates) {
        if (existsSync(join(candidate, 'git.exe'))) {
          const entries = (process.env['PATH'] ?? '').split(';').filter(Boolean);
          if (!entries.includes(candidate)) {
            process.env['PATH'] = [...entries, candidate].join(';');
          }
          break;
        }
      }
    } catch { /* dugite not available */ }
  }

  // On Windows, Claude Code requires bash.exe (or a bash-compatible shell).
  // If CLAUDE_CODE_GIT_BASH_PATH is not already set, locate one and set it.
  //
  // Search order (most-reliable → least):
  //   1. dugite's bundled sh.exe — confirmed to be GNU bash 5.x, already
  //      asarUnpack'd so it works in packaged builds with zero user setup.
  //   2. bash.exe found in PATH entries — covers SmartGit, Cygwin, MSYS2, etc.
  //   3. Well-known Git for Windows install paths.
  if (process.platform === 'win32' && !process.env['CLAUDE_CODE_GIT_BASH_PATH']) {
    const bashCandidates: string[] = [];

    // 1. dugite's sh.exe — must use the real on-disk path (.asar.unpacked),
    //    never the virtual .asar path (Electron patches existsSync to see inside
    //    .asar, but spawn cannot execute files from within it).
    try {
      const appPath = app.getAppPath();
      const realBase = appPath.endsWith('.asar') ? appPath + '.unpacked' : appPath;
      bashCandidates.push(join(realBase, 'node_modules', 'dugite', 'git', 'usr', 'bin', 'sh.exe'));
    } catch { /* app not ready */ }

    // 2. bash.exe / sh.exe in current PATH entries — skip System32/SysWOW64 because
    //    C:\Windows\System32\bash.exe is the WSL launcher; spawning it would open
    //    a visible WSL window instead of a real scripting shell.
    const pathEntries = (process.env['PATH'] ?? '').split(';').filter(Boolean);
    for (const dir of pathEntries) {
      const normalizedDir = dir.toLowerCase().replace(/\\/g, '/');
      if (normalizedDir.includes('system32') || normalizedDir.includes('syswow64')) continue;
      bashCandidates.push(join(dir, 'bash.exe'));
      bashCandidates.push(join(dir, 'sh.exe'));
    }

    // 3. Well-known Git for Windows install paths
    bashCandidates.push(
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
      'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
    );

    for (const candidate of bashCandidates) {
      if (existsSync(candidate)) {
        process.env['CLAUDE_CODE_GIT_BASH_PATH'] = candidate;
        break;
      }
    }
  }
}

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
  sessionType: 'claude' | 'copilot' | 'aider' | 'shell';
  claudeStatus: { model?: string; contextPercent?: number; tokens?: number };
  dataListeners: Array<(data: string) => void>;
  exitListeners: Array<(code: number) => void>;
  claudeStatusListeners: Array<(status: { model?: string; contextPercent?: number; tokens?: number }) => void>;
}

const sessions = new Map<string, SessionEntry>();

/* ─── createSession ────────────────────────────────────────────────────────── */

/**
 * Create a new terminal session backed by a real PTY process.
 *
 * @returns Session ID (UUID v4).
 * @throws If the PTY process fails to spawn (e.g. command not found).
 */
/**
 * Resolve the actual PTY shell + args to spawn.
 *
 * On Windows, npm globals install as `.cmd` wrappers and Electron may not
 * inherit the full user shell PATH. We wrap any explicit command in the
 * default shell (pwsh / cmd) so that PATH resolution, .cmd files, and
 * user profile are all available — exactly as VSCode's integrated terminal does.
 */
function resolveSpawn(options: TerminalOptions): { shell: string; spawnArgs: string[] } {
  const defaultShell = detectDefaultShell();

  if (!options.command) {
    // Plain shell session
    return { shell: defaultShell, spawnArgs: options.args ?? [] };
  }

  if (process.platform === 'win32') {
    const cmdLine = [options.command, ...(options.args ?? [])].join(' ');
    const isPwsh =
      defaultShell.toLowerCase().includes('pwsh') ||
      defaultShell.toLowerCase().includes('powershell');
    if (isPwsh) {
      return { shell: defaultShell, spawnArgs: ['-NoExit', '-Command', cmdLine] };
    } else {
      return { shell: defaultShell, spawnArgs: ['/k', cmdLine] };
    }
  }

  // Unix/macOS — spawn directly
  return { shell: options.command, spawnArgs: options.args ?? [] };
}

export function createSession(options: TerminalOptions): string {
  const id = randomUUID();
  const { shell, spawnArgs: args } = resolveSpawn(options);
  const cwd = (options.cwd ?? options.worktreePath ?? process.cwd()).replace(/\\/g, '/');

  // Detect session type from the original requested command (not the wrapper shell)
  const commandBase = (options.command ?? shell).replace(/\\/g, '/').split('/').pop()?.replace(/\.exe$/i, '') ?? shell;
  const sessionType: SessionEntry['sessionType'] =
    commandBase === 'claude' ? 'claude'
    : commandBase === 'copilot' ? 'copilot'
    : commandBase === 'aider' ? 'aider'
    : 'shell';

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
    sessionType,
    claudeStatus: {},
    dataListeners: [],
    exitListeners: [],
    claudeStatusListeners: [],
  };

  const ptyProcess = pty.spawn(shell, args, {
    name: 'xterm-256color',
    cols: options.cols ?? 120,
    rows: options.rows ?? 30,
    cwd,
    env: {
      ...process.env,
      // Ensure TUI apps (Ink, etc.) recognise the terminal correctly.
      // TERM is set by node-pty via `name`, but TERM_PROGRAM and COLORTERM
      // help frameworks like Ink choose the right rendering/input mode.
      TERM_PROGRAM: 'nexus-ide',
      COLORTERM: 'truecolor',
      ...options.env,
    } as Record<string, string>,
    useConpty: process.platform === 'win32',
  });

  entry.ptyProcess = ptyProcess;

  ptyProcess.onData((data) => {
    for (const cb of entry.dataListeners) {
      cb(data);
    }
    // Best-effort Claude status parsing for Claude Code sessions
    if (entry.sessionType === 'claude') {
      parseClaudeStatus(entry, data);
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
  entry.claudeStatusListeners.length = 0;
  sessions.delete(sessionId);
}

/* ─── killAllSessions ──────────────────────────────────────────────────────── */

/**
 * Kill every running terminal session. Called on app quit to avoid rogue processes.
 */
export function killAllSessions(): void {
  for (const sessionId of Array.from(sessions.keys())) {
    const entry = sessions.get(sessionId);
    if (!entry) continue;
    if (entry.status !== 'exited' && entry.ptyProcess !== null) {
      try {
        entry.ptyProcess.kill();
      } catch {
        // Ignore — process may have already exited
      }
    }
    sessions.delete(sessionId);
  }
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
      sessionType: e.sessionType,
      claudeStatus: Object.keys(e.claudeStatus).length > 0 ? e.claudeStatus : undefined,
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

/* ─── parseClaudeStatus (internal) ────────────────────────────────────────── */

// Strip ANSI escape sequences for plain-text parsing
const ANSI_STRIP_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;

/**
 * Best-effort heuristic parser for Claude Code terminal output.
 * Looks for model names and context/token indicators in PTY data chunks.
 * Fires claudeStatusListeners when new information is parsed.
 */
function parseClaudeStatus(
  entry: SessionEntry,
  data: string,
): void {
  const plain = data.replace(ANSI_STRIP_RE, '');

  let changed = false;

  // Model detection — e.g. "claude-sonnet-4-5", "claude-opus-4", "Sonnet", "Opus", "Haiku"
  const modelMatch = plain.match(
    /claude[-\s]?(opus|sonnet|haiku)[-\s]?[\d.-]*/i,
  ) ?? plain.match(/\b(opus|sonnet|haiku)\b/i);
  if (modelMatch !== null) {
    const raw = modelMatch[0].toLowerCase();
    // Normalise to a short display label
    const normalized = raw.startsWith('claude') ? raw : `claude-${raw}`;
    if (entry.claudeStatus.model !== normalized) {
      entry.claudeStatus.model = normalized;
      changed = true;
    }
  }

  // Context percent — e.g. "context: 42%" or "42% context" or "context window: 42%"
  const pctMatch = plain.match(/context[^0-9]*(\d{1,3})\s*%/i)
    ?? plain.match(/(\d{1,3})\s*%\s*context/i);
  if (pctMatch !== null) {
    const pct = parseInt(pctMatch[1], 10);
    if (!isNaN(pct) && pct >= 0 && pct <= 100 && entry.claudeStatus.contextPercent !== pct) {
      entry.claudeStatus.contextPercent = pct;
      changed = true;
    }
  }

  // Token count — e.g. "12,345 tokens" or "tokens: 12345"
  const tokMatch = plain.match(/(\d[\d,]+)\s*tokens?/i)
    ?? plain.match(/tokens?[:\s]+(\d[\d,]+)/i);
  if (tokMatch !== null) {
    const tk = parseInt(tokMatch[1].replace(/,/g, ''), 10);
    if (!isNaN(tk) && entry.claudeStatus.tokens !== tk) {
      entry.claudeStatus.tokens = tk;
      changed = true;
    }
  }

  if (changed) {
    const snapshot = { ...entry.claudeStatus };
    for (const cb of entry.claudeStatusListeners) {
      cb(snapshot);
    }
  }
}

/* ─── onSessionClaudeStatus ────────────────────────────────────────────────── */

/**
 * Subscribe to parsed Claude status updates for a session.
 * Only fires for sessions with sessionType === 'claude'.
 *
 * @returns Unsubscribe function.
 */
export function onSessionClaudeStatus(
  sessionId: string,
  callback: (status: { model?: string; contextPercent?: number; tokens?: number }) => void,
): () => void {
  const entry = sessions.get(sessionId);
  if (!entry) return () => { /* no-op */ };

  entry.claudeStatusListeners.push(callback);
  return () => {
    const idx = entry.claudeStatusListeners.indexOf(callback);
    if (idx !== -1) entry.claudeStatusListeners.splice(idx, 1);
  };
}
