import { useState, useMemo, useCallback } from 'react';
import type { DiffFile, DiffHunk as DiffHunkType, SortColumn, SortDirection } from '@/types';
import { DiffFileRow, DEFAULT_COL_WIDTHS } from '@/components/git/DiffFileRow';
import type { ColWidths } from '@/components/git/DiffFileRow';

interface DiffListViewProps {
  files: DiffFile[];
  activeProjectId: string | null;
  onRefresh: () => Promise<void>;
  onOpenFullDiff: (file: DiffFile, hunks: DiffHunkType[]) => void;
  selectedFiles?: Set<string>;
  onToggleSelect?: (filePath: string) => void;
  externalDiffCommand?: string;
}

type FixedCol = keyof ColWidths;
const COL_MIN: ColWidths = { path: 50, state: 40, changes: 40 };

function getFileName(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/');
  return lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
}

function getDirPath(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/');
  return lastSlash >= 0 ? filePath.slice(0, lastSlash + 1) : '';
}

export const DiffListView = ({
  files,
  activeProjectId,
  onRefresh,
  onOpenFullDiff,
  selectedFiles,
  onToggleSelect,
  externalDiffCommand,
}: DiffListViewProps): React.JSX.Element => {
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [colWidths, setColWidths] = useState<ColWidths>(DEFAULT_COL_WIDTHS);

  const startResize = useCallback((col: FixedCol, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = colWidths[col];
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent): void => {
      setColWidths((w) => ({ ...w, [col]: Math.max(COL_MIN[col], startW + (ev.clientX - startX)) }));
    };
    const onUp = (): void => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [colWidths]);

  const handleColumnClick = (col: SortColumn): void => {
    if (sortColumn === col) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  const sortedFiles = useMemo(() => {
    const sorted = [...files];
    const dir = sortDirection === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      switch (sortColumn) {
        case 'name':
          return dir * getFileName(a.filePath).localeCompare(getFileName(b.filePath));
        case 'path':
          return dir * getDirPath(a.filePath).localeCompare(getDirPath(b.filePath));
        case 'state':
          return dir * a.status.localeCompare(b.status);
        case 'changes': {
          const aTotal = a.additions + a.deletions;
          const bTotal = b.additions + b.deletions;
          return dir * (aTotal - bTotal);
        }
        default:
          return 0;
      }
    });

    return sorted;
  }, [files, sortColumn, sortDirection]);

  return (
    <div>
      {/* Column headers */}
      <div className="flex items-center gap-2.5 border-b border-border-default px-5 py-1.5">
        {/* Spacer for select + expand + status icons */}
        <div className={`${onToggleSelect !== undefined ? 'w-[56px]' : 'w-[42px]'} shrink-0`} />
        {/* File Name — flex-1, no resize */}
        <button
          onClick={() => handleColumnClick('name')}
          className="flex-1 min-w-0 cursor-pointer select-none text-left font-mono text-[9px] font-medium uppercase tracking-wider text-text-ghost transition-colors hover:text-text-secondary"
        >
          File Name{sortColumn === 'name' && <span className="ml-0.5 text-text-tertiary">{sortDirection === 'asc' ? '▴' : '▾'}</span>}
        </button>
        {/* Fixed-width columns with resize handles */}
        {(['path', 'state', 'changes'] as FixedCol[]).map((col, i) => {
          const labels: Record<FixedCol, string> = { path: 'Path', state: 'State', changes: '+/-' };
          const aligns: Record<FixedCol, string> = { path: 'text-left', state: 'text-center', changes: 'text-right' };
          return (
            <div key={col} className="relative shrink-0" style={{ width: colWidths[col] }}>
              <button
                onClick={() => handleColumnClick(col as SortColumn)}
                className={`w-full cursor-pointer select-none font-mono text-[9px] font-medium uppercase tracking-wider text-text-ghost transition-colors hover:text-text-secondary ${aligns[col]}`}
              >
                {labels[col]}{sortColumn === col && <span className="ml-0.5 text-text-tertiary">{sortDirection === 'asc' ? '▴' : '▾'}</span>}
              </button>
              {/* Resize handle — on every column including last for symmetry */}
              <div
                onMouseDown={(e) => startResize(col, e)}
                className="group absolute inset-y-0 -right-[5px] w-[10px] cursor-col-resize"
                style={{ zIndex: 1 }}
              >
                <div className="absolute inset-y-1 left-[4px] w-px bg-border-strong opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </div>
          );
        })}
        {/* Spacer for action buttons */}
        <div className="w-[52px] shrink-0" />
      </div>

      {/* File rows */}
      {sortedFiles.map((file) => (
        <DiffFileRow
          key={file.filePath}
          file={file}
          activeProjectId={activeProjectId}
          onRefresh={onRefresh}
          onOpenFullDiff={onOpenFullDiff}
          layout="table"
          selected={selectedFiles?.has(file.filePath)}
          onToggleSelect={onToggleSelect}
          colWidths={colWidths}
          externalDiffCommand={externalDiffCommand}
        />
      ))}
    </div>
  );
};
