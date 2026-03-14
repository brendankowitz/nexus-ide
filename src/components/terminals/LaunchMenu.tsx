import { useEffect, useRef, useState } from 'react';

interface LaunchOption {
  label: string;
  command?: string;
  args?: string[];
  description: string;
}

const QUICK_LAUNCH_OPTIONS: readonly LaunchOption[] = [
  {
    label: 'Shell',
    description: 'Default system shell',
  },
  {
    label: 'Claude Code',
    command: 'claude',
    args: [],
    description: 'claude',
  },
  {
    label: 'Claude Code (task)',
    command: 'claude',
    args: ['--task'],
    description: 'claude --task',
  },
  {
    label: 'Copilot CLI',
    command: 'gh',
    args: ['copilot'],
    description: 'gh copilot',
  },
];

interface LaunchMenuProps {
  onLaunch: (option: { label: string; command?: string; args?: string[] }) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export const LaunchMenu = ({
  onLaunch,
  onClose,
  anchorRef,
}: LaunchMenuProps): React.JSX.Element => {
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [customCommand, setCustomCommand] = useState('');

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      const target = e.target as Node;
      if (
        menuRef.current !== null &&
        !menuRef.current.contains(target) &&
        (anchorRef.current === null || !anchorRef.current.contains(target))
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorRef]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleCustomSubmit = (): void => {
    const trimmed = customCommand.trim();
    if (trimmed === '') return;
    const parts = trimmed.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);
    onLaunch({ label: trimmed, command: cmd, args });
  };

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 z-50 mb-2 flex w-[280px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border-strong bg-bg-raised shadow-[0_16px_48px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)] animate-[palette-enter_150ms_var(--ease-out)]"
    >
      {/* Quick launch */}
      <div className="px-2.5 pb-1 pt-2.5 font-mono text-[10px] font-semibold uppercase tracking-[1px] text-text-ghost">
        Quick launch
      </div>
      <div className="flex flex-col px-1.5 pb-1.5">
        {QUICK_LAUNCH_OPTIONS.map((option) => (
          <button
            key={option.label}
            onClick={() =>
              onLaunch({
                label: option.label,
                command: option.command,
                args: option.args,
              })
            }
            className="flex cursor-pointer items-center justify-between rounded-[var(--radius-sm)] px-2.5 py-[7px] text-left transition-colors duration-[var(--duration-fast)] hover:bg-bg-hover"
          >
            <span className="font-mono text-[12px] text-text-primary">
              {option.label}
            </span>
            <span className="font-mono text-[10px] text-text-ghost">
              {option.description}
            </span>
          </button>
        ))}
      </div>

      {/* Custom command */}
      <div className="border-t border-border-subtle px-2.5 pb-2.5 pt-2">
        <div className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[1px] text-text-ghost">
          Custom command
        </div>
        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            value={customCommand}
            onChange={(e) => setCustomCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCustomSubmit();
            }}
            placeholder="e.g. npm run dev"
            className="flex-1 rounded-[var(--radius-sm)] border border-border-default bg-bg-surface px-2.5 py-[5px] font-mono text-[11px] text-text-primary caret-phase-execute outline-none placeholder:text-text-ghost focus:border-phase-execute"
          />
          <button
            onClick={handleCustomSubmit}
            className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--phase-execute-dim)] bg-[var(--phase-execute-dim)] px-2.5 py-[5px] font-mono text-[10px] font-medium text-phase-execute transition-all duration-[var(--duration-fast)] hover:bg-phase-execute hover:text-[var(--bg-void)]"
          >
            run
          </button>
        </div>
      </div>
    </div>
  );
};
