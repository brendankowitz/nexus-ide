import type { ValidateStepResult } from '@/types';

interface ValidationChainProps {
  steps: ValidateStepResult[];
}

export const ValidationChain = ({ steps }: ValidationChainProps): React.JSX.Element => {
  return (
    <div className="flex flex-col gap-2">
      {steps.map((step, idx) => (
        <ValidationStep key={`${step.pluginId}-${idx}`} step={step} index={idx + 1} />
      ))}
    </div>
  );
};

const ValidationStep = ({
  step,
  index,
}: {
  step: ValidateStepResult;
  index: number;
}): React.JSX.Element => {
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

  const statusText =
    step.maxIterations !== undefined
      ? `max ${step.maxIterations} iterations`
      : step.status;

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border-default bg-bg-surface p-2.5 px-3.5 font-mono text-[12px]">
      {/* Step index circle */}
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${indexStyle}`}
      >
        {index}
      </div>

      {/* Step name */}
      <span className="flex-1 text-text-primary">{step.pluginId}</span>

      {/* Status */}
      <span className={`text-[10px] ${statusColor}`}>{statusText}</span>
    </div>
  );
};
