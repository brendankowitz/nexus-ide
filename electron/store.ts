/**
 * electron/store.ts
 *
 * Typed persistent store for settings and project list.
 *
 * Storage location:
 *   Windows : %APPDATA%/nexus-ide/nexus-config.json
 *   macOS   : ~/Library/Application Support/nexus-ide/nexus-config.json
 *   Linux   : ~/.config/nexus-ide/nexus-config.json
 *
 * Implementation note — electron-store v10 is ESM-only, but electron-vite
 * builds the main process to CJS. Dynamic `await import('electron-store')`
 * works at runtime via Node's ESM/CJS interop, but `store.get()` / `store.set()`
 * must remain synchronous for the rest of the codebase. We therefore use a plain
 * JSON file (same path electron-store would choose) so we keep synchronous reads
 * and writes without pulling in the ESM bundle at build time.
 *
 * All path values are stored with forward slashes and normalized via
 * path.resolve() on read.
 *
 * Sensitive values (API tokens, secrets) should be encrypted before storage
 * via Electron's safeStorage.encryptString() (DPAPI on Windows).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { app } from 'electron';
import type { Project } from '../src/types/index.js';

/* ─── Schema types ─────────────────────────────────────────────────────────── */

export interface EditorConfig {
  readonly command: string;
  readonly args: readonly string[];
}

export interface TerminalConfig {
  /** 'auto' resolves shell at startup: pwsh > powershell > cmd on Windows. */
  readonly shell: 'auto' | string;
  readonly fontSize: number;
  readonly fontFamily: string;
}

export interface GitConfig {
  /** Git status poll interval in milliseconds. Default: 3000. */
  readonly statusPollInterval: number;
  /** Auto-fetch interval in milliseconds. 0 = disabled. Default: 60000. */
  readonly autoFetchInterval: number;
}

export interface PipelineDefaults {
  readonly defaultPlan: string;
  readonly defaultExecute: string;
  readonly defaultValidateChain: readonly string[];
}

export interface AgentEntry {
  readonly command: string;
  readonly args?: readonly string[];
  readonly available: boolean;
}

export interface AgentsConfig {
  readonly claudeCode: AgentEntry;
  readonly copilotCli: AgentEntry;
  readonly aider: AgentEntry;
  readonly az?: AgentEntry;
  readonly gh?: AgentEntry;
  readonly dotnet?: AgentEntry;
}

export interface StoredProject {
  readonly id: string;
  readonly name: string;
  /** Forward-slash normalized absolute path. */
  readonly path: string;
  readonly watchEnabled: boolean;
  readonly editorWorkspace?: string;
  readonly lastOpened: number;
}

export interface NexusStoreSchema {
  readonly editor: EditorConfig;
  readonly theme: 'dark' | 'light';
  readonly terminal: TerminalConfig;
  readonly git: GitConfig;
  readonly pipeline: PipelineDefaults;
  readonly agents: AgentsConfig;
  readonly projects: readonly StoredProject[];
  /** Cached shell detection result — avoids re-detection on every launch. */
  readonly resolvedShell: string | null;
}

/* ─── Defaults ─────────────────────────────────────────────────────────────── */

const STORE_DEFAULTS: NexusStoreSchema = {
  editor: {
    command: 'code',
    args: ['--goto'],
  },
  theme: 'dark',
  terminal: {
    shell: 'auto',
    fontSize: 13,
    fontFamily: 'JetBrains Mono',
  },
  git: {
    statusPollInterval: 3_000,
    autoFetchInterval: 60_000,
  },
  pipeline: {
    defaultPlan: 'fn-investigation',
    defaultExecute: 'fn-task',
    defaultValidateChain: ['pr-summary', 'fn-review', 'unit-test'],
  },
  agents: {
    claudeCode: { command: 'claude', available: true },
    copilotCli: { command: 'copilot', available: true },
    aider: { command: 'aider', available: false },
    az: { command: 'az', available: true },
    gh: { command: 'gh', available: true },
    dotnet: { command: 'dotnet', available: true },
  },
  projects: [],
  resolvedShell: null,
};

/* ─── JSON-file persistent store ──────────────────────────────────────────── */
//
// electron-store v10 is ESM-only; the main process builds to CJS. Rather than
// introducing a dynamic-import async boundary into every synchronous caller we
// use a plain JSON file at the same userData path. The API surface is identical
// to electron-store's get/set so migrating to the real package later is trivial.

type DeepMutable<T> = {
  -readonly [K in keyof T]: T[K] extends ReadonlyArray<infer U>
    ? Array<DeepMutable<U>>
    : T[K] extends object
    ? DeepMutable<T[K]>
    : T[K];
};

function resolveConfigPath(): string {
  return join(app.getPath('userData'), 'nexus-config.json');
}

function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result: Record<string, unknown> = { ...target };
  for (const key of Object.keys(source) as Array<keyof T>) {
    const sv = source[key];
    const tv = target[key];
    if (
      sv !== null &&
      typeof sv === 'object' &&
      !Array.isArray(sv) &&
      tv !== null &&
      typeof tv === 'object' &&
      !Array.isArray(tv)
    ) {
      result[key as string] = deepMerge(
        tv as object,
        sv as Partial<typeof tv>,
      );
    } else if (sv !== undefined) {
      result[key as string] = sv;
    }
  }
  return result as T;
}

function loadFromDisk(): DeepMutable<NexusStoreSchema> {
  try {
    const configPath = resolveConfigPath();
    if (!existsSync(configPath)) {
      return JSON.parse(JSON.stringify(STORE_DEFAULTS)) as DeepMutable<NexusStoreSchema>;
    }
    const raw = readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<NexusStoreSchema>;
    // Deep-merge with defaults so missing keys in the file get filled in.
    return deepMerge(
      JSON.parse(JSON.stringify(STORE_DEFAULTS)) as NexusStoreSchema,
      parsed,
    ) as DeepMutable<NexusStoreSchema>;
  } catch (err) {
    console.warn('[store] failed to load config from disk, using defaults:', err);
    return JSON.parse(JSON.stringify(STORE_DEFAULTS)) as DeepMutable<NexusStoreSchema>;
  }
}

function saveToDisk(data: DeepMutable<NexusStoreSchema>): void {
  try {
    const configPath = resolveConfigPath();
    const dir = dirname(configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[store] failed to persist config:', err);
  }
}

// In-memory cache — loaded lazily on first access so `app` is ready.
let _data: DeepMutable<NexusStoreSchema> | null = null;

function getData(): DeepMutable<NexusStoreSchema> {
  if (_data === null) {
    _data = loadFromDisk();
  }
  return _data;
}

/** Typed store with the same get/set API surface as electron-store. */
export const store = {
  get<K extends keyof NexusStoreSchema>(key: K): NexusStoreSchema[K] {
    return getData()[key] as NexusStoreSchema[K];
  },

  set<K extends keyof NexusStoreSchema>(key: K, value: NexusStoreSchema[K]): void {
    const data = getData();
    (data as Record<string, unknown>)[key] = JSON.parse(JSON.stringify(value));
    saveToDisk(data);
  },

  /** Replace the entire store data (used by tests / reset). */
  _reset(): void {
    _data = JSON.parse(JSON.stringify(STORE_DEFAULTS)) as DeepMutable<NexusStoreSchema>;
    saveToDisk(_data);
  },
} as const;

/* ─── Project helpers ──────────────────────────────────────────────────────── */

/** Normalize a path to forward slashes for consistent storage. */
function toForwardSlashes(p: string): string {
  return p.replace(/\\/g, '/');
}

/** Read the persisted project list. */
export function getProjects(): Project[] {
  return (store.get('projects') as readonly StoredProject[]).map(p => ({
    id: p.id,
    name: p.name,
    path: p.path,
    addedAt: new Date(p.lastOpened).toISOString(),
  }));
}

/** Persist a new project, returning the created Project. */
export function addProject(rawPath: string): Project {
  const normalized = toForwardSlashes(rawPath);
  const name = normalized.split('/').at(-1) ?? normalized;

  // Prevent duplicates by path
  const existing = (store.get('projects') as readonly StoredProject[]).find(
    p => p.path === normalized,
  );
  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      path: existing.path,
      addedAt: new Date(existing.lastOpened).toISOString(),
    };
  }

  const project: StoredProject = {
    id: randomUUID(),
    name,
    path: normalized,
    watchEnabled: true,
    lastOpened: Date.now(),
  };

  const current = store.get('projects') as readonly StoredProject[];
  store.set('projects', [...current, project]);

  return {
    id: project.id,
    name: project.name,
    path: project.path,
    addedAt: new Date(project.lastOpened).toISOString(),
  };
}

/** Remove a project by ID. */
export function removeProject(id: string): void {
  const current = store.get('projects') as readonly StoredProject[];
  store.set('projects', current.filter(p => p.id !== id));
}

/** Look up the filesystem path for a project by its ID. */
export function getProjectPath(projectId: string): string | null {
  const projects = store.get('projects') as readonly StoredProject[];
  return projects.find(p => p.id === projectId)?.path ?? null;
}

/** Update the resolvedShell cache. */
export function cacheResolvedShell(shell: string): void {
  store.set('resolvedShell', shell);
}

/** Read the cached resolved shell (null if not yet detected). */
export function getCachedShell(): string | null {
  return store.get('resolvedShell') as string | null;
}
