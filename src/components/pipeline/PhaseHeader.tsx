import type { Phase, PipelineRun, RunStatus } from '@/types';

interface PhaseHeaderProps {
  run: PipelineRun;
  activePhase: Phase;
  onSelectPhase: (phase: Phase) => void;
  onStartPhase: (phase: Phase) => void;
  onAbort: () => void;
}

const phaseConfig: Array<{
  phase: Phase;
  label: string;
  labelColor: string;
  activeClass: string;
  btnBg: string;
  btnHover: string;
}> = [
  {
    phase: 'plan',
    label: 'Plan',
    labelColor: 'text-phase-plan',
    activeClass: 'border-[var(--phase-plan-dim)] shadow-[inset_0_2px_0_var(--phase-plan)]',
    btnBg: 'bg-[var(--phase-plan-dim)] text-phase-plan border-[var(--phase-plan-dim)]',
    btnHover: 'hover:bg-phase-plan hover:text-[var(--bg-void)]',
  },
  {
    phase: 'execute',
    label: 'Execute',
    labelColor: 'text-phase-execute',
    activeClass: 'border-[var(--phase-execute-dim)] shadow-[inset_0_2px_0_var(--phase-execute)]',
    btnBg: 'bg-[var(--phase-execute-dim)] text-phase-execute border-[var(--phase-execute-dim)]',
    btnHover: 'hover:bg-phase-execute hover:text-[var(--bg-void)]',
  },
  {
    phase: 'validate',
    label: 'Validate',
    labelColor: 'text-phase-validate',
    activeClass: 'border-[var(--phase-validate-dim)] shadow-[inset_0_2px_0_var(--phase-validate)]',
    btnBg: 'bg-[var(--phase-validate-dim)] text-phase-validate border-[var(--phase-validate-dim)]',
    btnHover: 'hover:bg-phase-validate hover:text-[var(--bg-void)]',
  },
];

/** Map run status to which phase is currently active */
function getRunningPhase(status: RunStatus): Phase | null {
  if (status === 'planning') return 'plan';
  if (status === 'executing') return 'execute';
  if (status === 'validating') return 'validate';
  return null;
}

/** Can this phase be started given the current run state? */
function canStartPhase(run: PipelineRun, phase: Phase): boolean {
  if (phase === 'plan') {
    return run.status === 'draft';
  }
  if (phase === 'execute') {
    return run.phases.plan?.status === 'complete' && run.phases.execute === null;
  }
  if (phase === 'validate') {
    return run.phases.execute?.status === 'complete' && run.phases.validate === null;
  }
  return false;
}

export const PhaseHeader = ({
  run,
  activePhase,
  onSelectPhase,
  onStartPhase,
  onAbort,
}: PhaseHeaderProps): React.JSX.Element => {
  const runningPhase = getRunningPhase(run.status);

  return (
    <div className="flex gap-0 border-b border-border-subtle px-5 py-4">
      {phaseConfig.map((cfg, idx) => {
        const isActive = activePhase === cfg.phase;
        const pluginId = getPluginId(run, cfg.phase);
        const statusText = getPhaseStatusText(run, cfg.phase);
        const isRunning = runningPhase === cfg.phase;
        const showStart = canStartPhase(run, cfg.phase);

        return (
          <div
            key={cfg.phase}
            onClick={() => onSelectPhase(cfg.phase)}
            className={`relative flex-1 cursor-pointer border border-border-default p-3 px-4 transition-all duration-[var(--duration-fast)] ${
              isActive ? `bg-bg-overlay ${cfg.activeClass}` : 'bg-bg-surface'
            } ${idx === 0 ? 'rounded-l-[var(--radius-md)]' : ''} ${
              idx === phaseConfig.length - 1 ? 'rounded-r-[var(--radius-md)]' : ''
            } ${idx > 0 ? 'border-l-0' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div
                className={`mb-1 font-mono text-[10px] font-semibold uppercase tracking-[1px] ${cfg.labelColor}`}
              >
                {cfg.label}
              </div>

              {/* Start button */}
              {showStart && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartPhase(cfg.phase);
                  }}
                  className={`rounded-[var(--radius-sm)] border px-2.5 py-0.5 font-mono text-[10px] font-medium transition-all duration-[var(--duration-fast)] ${cfg.btnBg} ${cfg.btnHover} cursor-pointer`}
                >
                  Start
                </button>
              )}

              {/* Abort button */}
              {isRunning && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAbort();
                  }}
                  className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-danger)] bg-transparent px-2.5 py-0.5 font-mono text-[10px] font-medium text-[var(--color-danger)] transition-all duration-[var(--duration-fast)] hover:bg-[var(--color-danger)] hover:text-white"
                >
                  Abort
                </button>
              )}
            </div>

            <div className="font-mono text-[11px] text-text-secondary">
              {pluginId}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              {/* Status dot */}
              {isRunning && (
                <div className={`h-1.5 w-1.5 animate-pulse rounded-full ${
                  cfg.phase === 'plan' ? 'bg-phase-plan' : cfg.phase === 'execute' ? 'bg-phase-execute' : 'bg-phase-validate'
                }`} />
              )}
              <span className="font-mono text-[10px] text-text-tertiary">
                {statusText}
              </span>
            </div>

            {/* Arrow connector */}
            {idx < phaseConfig.length - 1 && (
              <div
                className="absolute -right-2 top-1/2 z-[1] -translate-y-1/2 border-y-[6px] border-l-[7px] border-y-transparent border-l-border-default"
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

function getPluginId(run: PipelineRun, phase: Phase): string {
  if (phase === 'plan') return run.config.plan.pluginId;
  if (phase === 'execute') return run.config.execute.pluginId;
  return `${run.config.validate.chain.length}-step chain`;
}

function getPhaseStatusText(run: PipelineRun, phase: Phase): string {
  const result = run.phases[phase];
  if (result === null) return 'pending';

  const status = result.status;
  if (phase === 'plan' || phase === 'execute') {
    const pr = result as { status: string; startedAt?: string; metrics?: { duration?: number } };

    // Show elapsed time for running phases
    if (status === 'running' && pr.startedAt) {
      const elapsed = Date.now() - new Date(pr.startedAt).getTime();
      const secs = Math.floor(elapsed / 1000);
      const mins = Math.floor(secs / 60);
      const remainSecs = secs % 60;
      return `running ${mins}m ${remainSecs.toString().padStart(2, '0')}s`;
    }

    if (pr.metrics?.duration !== undefined) {
      const secs = Math.floor(pr.metrics.duration / 1000);
      const mins = Math.floor(secs / 60);
      const remainSecs = secs % 60;
      return `${status} · ${mins}m ${remainSecs.toString().padStart(2, '0')}s`;
    }
  }
  return status;
}
