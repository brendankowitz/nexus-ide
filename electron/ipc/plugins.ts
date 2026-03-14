/**
 * electron/ipc/plugins.ts
 *
 * Nexus plugin registry — built-in plugins for the Plan → Execute → Validate
 * pipeline. User-defined plugins can be loaded from a directory in the future.
 */

import type { NexusPlugin, Phase } from '../../src/types/index.js';

/* ─── Built-in plugin catalogue ────────────────────────────────────────────── */

const builtinPlugins: NexusPlugin[] = [
  /* ── Plan plugins ─────────────────────────────────────────────────────── */

  {
    id: 'fn-investigation',
    name: 'fn-investigation',
    description: 'Deep codebase analysis via Claude Code',
    phase: 'plan',
    capabilities: { interactive: true, streaming: true, configurable: true },
    configSchema: {
      fields: [
        { key: 'scope', label: 'Investigation scope', type: 'string', default: '' },
        {
          key: 'depth',
          label: 'Analysis depth',
          type: 'select',
          default: 'thorough',
          options: ['quick', 'thorough', 'exhaustive'],
        },
      ],
    },
  },

  {
    id: 'spec-kit',
    name: 'Spec Kit',
    description: 'Generate structured spec with acceptance criteria',
    phase: 'plan',
    capabilities: { interactive: true, streaming: true, configurable: true },
  },

  {
    id: 'claude-planner',
    name: 'Claude Planner',
    description: 'Claude Code planning with TodoWrite',
    phase: 'plan',
    capabilities: { interactive: true, streaming: true, configurable: false },
  },

  {
    id: 'custom-prompt',
    name: 'Custom Prompt',
    description: 'Run a custom planning prompt',
    phase: 'plan',
    capabilities: { interactive: true, streaming: true, configurable: true },
    configSchema: {
      fields: [
        { key: 'prompt', label: 'Custom prompt', type: 'string', default: '' },
      ],
    },
  },

  /* ── Execute plugins ──────────────────────────────────────────────────── */

  {
    id: 'fn-task',
    name: 'fn-task',
    description: 'Claude Code task execution with plan context',
    phase: 'execute',
    capabilities: { interactive: true, streaming: true, configurable: true },
  },

  {
    id: 'copilot-cli',
    name: 'Copilot CLI',
    description: 'GitHub Copilot agent execution',
    phase: 'execute',
    capabilities: { interactive: true, streaming: true, configurable: false },
  },

  {
    id: 'aider',
    name: 'Aider',
    description: 'Aider pair programming',
    phase: 'execute',
    capabilities: { interactive: true, streaming: true, configurable: true },
  },

  {
    id: 'manual',
    name: 'Manual',
    description: 'You code it — Nexus watches',
    phase: 'execute',
    capabilities: { interactive: false, streaming: false, configurable: false },
  },

  /* ── Validate plugins ─────────────────────────────────────────────────── */

  {
    id: 'pr-summary',
    name: 'PR Summary',
    description: 'Group changes into logical features, generate summary',
    phase: 'validate',
    capabilities: { interactive: true, streaming: true, configurable: true },
  },

  {
    id: 'fn-review',
    name: 'fn-review',
    description: 'Structured code review',
    phase: 'validate',
    capabilities: { interactive: true, streaming: true, configurable: true },
  },

  {
    id: 'ralph-loop',
    name: 'Ralph Loop',
    description: 'Self-correcting build-fix-retry cycle',
    phase: 'validate',
    capabilities: { interactive: true, streaming: true, configurable: true },
  },

  {
    id: 'unit-test',
    name: 'Test Suite',
    description: 'Run test suite and analyze results',
    phase: 'validate',
    capabilities: { interactive: false, streaming: true, configurable: true },
  },

  {
    id: 'build-deploy',
    name: 'Build & Launch',
    description: 'Build and launch for testing',
    phase: 'validate',
    capabilities: { interactive: false, streaming: true, configurable: true },
  },
];

/* ─── Registry API ─────────────────────────────────────────────────────────── */

/**
 * List all plugins, optionally filtered to a specific phase.
 */
export function listPlugins(phase?: Phase): NexusPlugin[] {
  if (phase !== undefined) return builtinPlugins.filter((p) => p.phase === phase);
  return [...builtinPlugins];
}

/**
 * Look up a single plugin by ID.
 */
export function getPlugin(id: string): NexusPlugin | undefined {
  return builtinPlugins.find((p) => p.id === id);
}
