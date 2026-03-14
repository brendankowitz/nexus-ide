import type { Phase, PipelineRun } from '@/types';

interface PhaseHeaderProps {
  run: PipelineRun;
  activePhase: Phase;
  onSelectPhase: (phase: Phase) => void;
}

const phaseConfig: Array<{
  phase: Phase;
  label: string;
  labelColor: string;
  activeClass: string;
}> = [
  {
    phase: 'plan',
    label: 'Plan',
    labelColor: 'text-phase-plan',
    activeClass: 'border-[var(--phase-plan-dim)] shadow-[inset_0_2px_0_var(--phase-plan)]',
  },
  {
    phase: 'execute',
    label: 'Execute',
    labelColor: 'text-phase-execute',
    activeClass: 'border-[var(--phase-execute-dim)] shadow-[inset_0_2px_0_var(--phase-execute)]',
  },
  {
    phase: 'validate',
    label: 'Validate',
    labelColor: 'text-phase-validate',
    activeClass: 'border-[var(--phase-validate-dim)] shadow-[inset_0_2px_0_var(--phase-validate)]',
  },
];

export const PhaseHeader = ({
  run,
  activePhase,
  onSelectPhase,
}: PhaseHeaderProps): React.JSX.Element => {
  return (
    <div className="flex gap-0 border-b border-border-subtle px-5 py-4">
      {phaseConfig.map((cfg, idx) => {
        const isActive = activePhase === cfg.phase;
        const pluginId = getPluginId(run, cfg.phase);
        const statusText = getPhaseStatusText(run, cfg.phase);

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
            <div
              className={`mb-1 font-mono text-[10px] font-semibold uppercase tracking-[1px] ${cfg.labelColor}`}
            >
              {cfg.label}
            </div>
            <div className="font-mono text-[11px] text-text-secondary">
              {pluginId}
            </div>
            <div className="mt-1 font-mono text-[10px] text-text-tertiary">
              {statusText}
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
    const pr = result as { status: string; metrics?: { duration?: number } };
    if (pr.metrics?.duration !== undefined) {
      const secs = Math.floor(pr.metrics.duration / 1000);
      const mins = Math.floor(secs / 60);
      const remainSecs = secs % 60;
      return `${status} \u00b7 ${mins}m ${remainSecs.toString().padStart(2, '0')}s`;
    }
  }
  return status;
}
