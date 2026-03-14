import type { DiffHunk as DiffHunkType } from '@/types';

interface DiffHunkProps {
  hunk: DiffHunkType;
}

export const DiffHunk = ({ hunk }: DiffHunkProps): React.JSX.Element => {
  return (
    <div>
      {/* Hunk header */}
      <div className="border-b border-border-subtle bg-bg-base py-1 pl-[60px] pr-5 font-mono text-[10px] text-text-ghost">
        {hunk.header}
      </div>

      {/* Lines */}
      {hunk.lines.map((line, idx) => {
        const lineClass =
          line.type === 'added'
            ? 'bg-[var(--color-added-bg)]'
            : line.type === 'deleted'
              ? 'bg-[var(--color-deleted-bg)]'
              : '';

        const contentColor =
          line.type === 'added'
            ? 'text-[var(--color-added)]'
            : line.type === 'deleted'
              ? 'text-[var(--color-deleted)]'
              : 'text-text-tertiary';

        const numColor =
          line.type === 'added'
            ? 'text-[var(--color-added)] opacity-50'
            : line.type === 'deleted'
              ? 'text-[var(--color-deleted)] opacity-50'
              : 'text-text-ghost';

        return (
          <div key={`${line.oldLineNumber ?? 'n'}-${line.newLineNumber ?? 'n'}-${idx}`} className={`flex font-mono text-[11px] leading-[1.6] pr-5 ${lineClass}`}>
            {/* New line number */}
            <span
              className={`w-10 shrink-0 select-none pr-2 text-right text-[10px] ${numColor}`}
            >
              {line.newLineNumber ?? ''}
            </span>
            {/* Old line number */}
            <span
              className={`w-10 shrink-0 select-none border-r border-border-subtle pr-2 text-right text-[10px] ${numColor}`}
            >
              {line.oldLineNumber ?? ''}
            </span>
            {/* Content */}
            <span className={`min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-pre px-3 ${contentColor}`} style={{ tabSize: 4 }}>
              {line.content}
            </span>
          </div>
        );
      })}
    </div>
  );
};
