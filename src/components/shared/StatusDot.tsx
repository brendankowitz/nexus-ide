import type { Phase } from '@/types';

interface StatusDotProps {
  phase: Phase;
  size?: number;
}

const phaseStyles: Record<Phase, string> = {
  plan: 'bg-phase-plan shadow-[0_0_6px_var(--phase-plan-dim)]',
  execute: 'bg-phase-execute shadow-[0_0_6px_var(--phase-execute-dim)] animate-pulse',
  validate: 'bg-phase-validate shadow-[0_0_6px_var(--phase-validate-dim)]',
};

export const StatusDot = ({ phase, size = 6 }: StatusDotProps): React.JSX.Element => {
  return (
    <div
      className={`shrink-0 rounded-full ${phaseStyles[phase]}`}
      style={{ width: size, height: size }}
    />
  );
};
