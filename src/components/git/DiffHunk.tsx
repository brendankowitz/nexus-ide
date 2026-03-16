import { useState, useEffect } from 'react';
import type { ThemedToken } from 'shiki';
import { tokeniseLines } from '@/lib/syntaxHighlight';
import type { DiffHunk as DiffHunkType } from '@/types';

interface DiffHunkProps {
  hunk: DiffHunkType;
  filePath?: string;
}

export const DiffHunk = ({ hunk, filePath }: DiffHunkProps): React.JSX.Element => {
  const [tokens, setTokens] = useState<ThemedToken[][] | null>(null);

  useEffect(() => {
    if (!filePath) return;
    const lines = hunk.lines.map((l) => l.content);
    void tokeniseLines(lines, filePath).then(setTokens);
  }, [filePath, hunk]);

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

        const lineTokens = tokens?.[idx];

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
            <span className={`min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-pre px-3 ${lineTokens ? '' : contentColor}`} style={{ tabSize: 4 }}>
              {lineTokens
                ? lineTokens.map((token, ti) => (
                    <span key={ti} style={{ color: token.color }}>
                      {token.content}
                    </span>
                  ))
                : line.content}
            </span>
          </div>
        );
      })}
    </div>
  );
};
