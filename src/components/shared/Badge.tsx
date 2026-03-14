interface BadgeProps {
  variant: 'changes' | 'clean' | 'worktrees' | 'agents';
  children: React.ReactNode;
}

const variantStyles: Record<BadgeProps['variant'], string> = {
  changes: 'bg-[var(--color-modified)] text-[var(--bg-void)]',
  clean: 'bg-[var(--color-clean)] text-[var(--bg-void)]',
  worktrees: 'bg-bg-active text-text-secondary',
  agents: 'bg-[var(--phase-execute-dim)] text-phase-execute',
};

export const Badge = ({ variant, children }: BadgeProps): React.JSX.Element => {
  return (
    <span
      className={`inline-flex items-center font-mono text-[10px] font-medium leading-[1.4] rounded-[3px] px-[5px] py-[1px] ${variantStyles[variant]}`}
    >
      {children}
    </span>
  );
};
