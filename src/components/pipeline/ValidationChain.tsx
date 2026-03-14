import type { ValidateStepResult } from '@/types';

interface ValidationChainProps {
  steps: ValidateStepResult[];
  onRunStep?: (stepIndex: number) => void;
}

export const ValidationChain = ({ steps, onRunStep }: ValidationChainProps): React.JSX.Element => {
  return (
    <div className="flex flex-col gap-2">
      {steps.map((step, idx) => (
        <ValidationStep
          key={`${step.pluginId}-${idx}`}
          step={step}
          index={idx}
          onRun={onRunStep ? () => onRunStep(idx) : undefined}
        />
      ))}
    </div>
  );
};

const ValidationStep = ({
  step,
  index,
  onRun,
}: {
  step: ValidateStepResult;
  index: number;
  onRun?: () => void;
}): React.JSX.Element => {
  const displayIndex = index + 1;

  const indexStyle =
    step.status === 'passed'
      ? 'bg-[var(--color-clean)] text-[var(--bg-void)]'
      : step.status === 'running'
        ? 'bg-phase-validate text-[var(--bg-void)] animate-pulse'
        : step.status === 'failed'
          ? 'bg-[var(--color-danger)] text-white'
          : 'bg-bg-active text-text-secondary';

  const statusColor =
    step.status === 'passed'
      ? 'text-[var(--color-clean)]'
      : step.status === 'running'
        ? 'text-phase-validate'
        : step.status === 'failed'
          ? 'text-[var(--color-danger)]'
          : 'text-text-tertiary';

  const canRun = step.status === 'pending' || step.status === 'failed';

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border-default bg-bg-surface p-2.5 px-3.5 font-mono text-[12px]">
      {/* Step index circle */}
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${indexStyle}`}
      >
        {displayIndex}
      </div>

      {/* Step name */}
      <span className="flex-1 text-text-primary">{step.pluginId}</span>

      {/* Iteration counter */}
      {step.iteration !== undefined && step.iteration > 0 && (
        <span className="text-[10px] text-text-ghost">
          iter {step.iteration}{step.maxIterations !== undefined ? `/${step.maxIterations}` : ''}
        </span>
      )}

      {/* Status */}
      <span className={`text-[10px] ${statusColor}`}>{step.status}</span>

      {/* Run button */}
      {canRun && onRun !== undefined && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRun();
          }}
          className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--phase-validate-dim)] bg-[var(--phase-validate-dim)] px-2 py-0.5 text-[10px] font-medium text-phase-validate transition-all duration-[var(--duration-fast)] hover:bg-phase-validate hover:text-[var(--bg-void)]"
        >
          {step.status === 'failed' ? 'Retry' : 'Run'}
        </button>
      )}

      {/* Running spinner */}
      {step.status === 'running' && (
        <div className="h-3 w-3 animate-spin rounded-full border border-text-ghost border-t-phase-validate" />
      )}
    </div>
  );
};
