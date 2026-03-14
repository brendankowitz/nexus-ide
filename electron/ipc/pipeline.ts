/**
 * electron/ipc/pipeline.ts
 *
 * Pipeline execution engine.
 *
 * Manages PipelineRun lifecycle, launches terminal sessions for plan/execute
 * phases via the terminal module, and pushes PipelineUpdate events to all
 * renderer windows.
 */

import { BrowserWindow } from 'electron';
import { createSession, onSessionData, onSessionExit } from './terminal.js';
import type {
  PipelineConfig,
  PipelineRun,
  PhaseResult,
  ValidateResult,
  ValidateStepResult,
  Phase,
  PipelineUpdate,
} from '../../src/types/index.js';

/* ─── In-memory run registry ───────────────────────────────────────────────── */

const runs = new Map<string, PipelineRun>();

/* ─── Push helper ──────────────────────────────────────────────────────────── */

function pushUpdate(runId: string, update: PipelineUpdate): void {
  const channel = `pipeline:update:${runId}`;
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send(channel, update);
  }
}

/* ─── createPipelineRun ────────────────────────────────────────────────────── */

/**
 * Allocate a new PipelineRun in 'draft' status.
 * The run is stored in the registry and returned to the caller.
 */
export function createPipelineRun(
  _projectId: string,
  config: PipelineConfig,
): PipelineRun {
  const run: PipelineRun = {
    id: `run-${Date.now()}`,
    config,
    status: 'draft',
    createdAt: new Date().toISOString(),
    phases: { plan: null, execute: null, validate: null },
  };
  runs.set(run.id, run);
  return run;
}

/* ─── listPipelineRuns ─────────────────────────────────────────────────────── */

export function listPipelineRuns(projectId: string): PipelineRun[] {
  return [...runs.values()].filter((r) => r.config.projectId === projectId);
}

/* ─── getPipelineRun ───────────────────────────────────────────────────────── */

export function getPipelineRun(runId: string): PipelineRun | undefined {
  return runs.get(runId);
}

/* ─── startPhase ───────────────────────────────────────────────────────────── */

/**
 * Transition a run into the given phase and launch the associated plugin.
 *
 * - plan / execute: spawn a PTY session and stream output into PhaseResult.
 * - validate:       initialise ValidateResult with pending steps; individual
 *                   step execution is handled separately (future work).
 */
export async function startPhase(runId: string, phase: Phase): Promise<void> {
  const run = runs.get(runId);
  if (!run) throw new Error(`Run not found: ${runId}`);

  /* ── Status transition ─────────────────────────────────────────────────── */

  run.status =
    phase === 'plan'
      ? 'planning'
      : phase === 'execute'
        ? 'executing'
        : 'validating';

  /* ── Plan / Execute — launch terminal session ──────────────────────────── */

  if (phase === 'plan' || phase === 'execute') {
    const phaseConfig = run.config[phase];
    const pluginId = phaseConfig.pluginId;

    const sessionId = createSession({
      projectId: run.config.projectId,
      worktreePath: run.config.worktreePath ?? '',
      command: 'claude',
      args: ['-p', `Running ${phase} phase for: ${run.config.name}`],
      label: `${phase}: ${pluginId}`,
    });

    const result: PhaseResult = {
      status: 'running',
      pluginId,
      startedAt: new Date().toISOString(),
      terminalSessionId: sessionId,
    };
    run.phases[phase] = result;

    pushUpdate(runId, {
      runId,
      type: 'phase-start',
      phase,
      result,
      run: { ...run },
    });

    /* Accumulate stdout into result.output and push incremental updates */
    let output = '';
    onSessionData(sessionId, (data) => {
      output += data;
      result.output = output;
      pushUpdate(runId, { runId, type: 'output', phase, data });
    });

    /* Mark complete / failed on exit */
    onSessionExit(sessionId, (code) => {
      result.status = code === 0 ? 'complete' : 'failed';
      result.completedAt = new Date().toISOString();

      if (result.status === 'complete') {
        // Auto-advance: plan → execute status, execute → validating status
        if (phase === 'plan') {
          run.status = 'executing';
        } else if (phase === 'execute') {
          run.status = 'validating';
        }
      } else {
        run.status = 'failed';
      }

      pushUpdate(runId, {
        runId,
        type: 'phase-end',
        phase,
        result,
        run: { ...run },
      });
    });

    return;
  }

  /* ── Validate — initialise step results ───────────────────────────────── */

  if (phase === 'validate') {
    const validateConfig = run.config.validate;
    const steps: ValidateStepResult[] = validateConfig.chain.map((step) => ({
      pluginId: step.pluginId,
      status: 'pending',
    }));

    const validateResult: ValidateResult = {
      status: 'running',
      steps,
    };
    run.phases.validate = validateResult;

    pushUpdate(runId, {
      runId,
      type: 'phase-start',
      phase: 'validate',
      run: { ...run },
    });
  }
}

/* ─── abortPipelineRun ─────────────────────────────────────────────────────── */

export function abortPipelineRun(runId: string): void {
  const run = runs.get(runId);
  if (!run) throw new Error(`Run not found: ${runId}`);

  run.status = 'aborted';

  pushUpdate(runId, {
    runId,
    type: 'complete',
    run: { ...run },
  });
}
