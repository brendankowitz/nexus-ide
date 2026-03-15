import { useState, useMemo } from 'react';
import type { DiffFile, DiffHunk as DiffHunkType, SortColumn, SortDirection } from '@/types';
import { DiffFileRow } from '@/components/git/DiffFileRow';

interface DiffListViewProps {
  files: DiffFile[];
  activeProjectId: string | null;
  onRefresh: () => Promise<void>;
  onOpenFullDiff: (file: DiffFile, hunks: DiffHunkType[]) => void;
  selectedFiles?: Set<string>;
  onToggleSelect?: (filePath: string) => void;
}

const COLUMN_HEADERS: { key: SortColumn; label: string; className: string }[] = [
  { key: 'name', label: 'File Name', className: 'flex-1 min-w-0' },
  { key: 'path', label: 'Path', className: 'w-[140px] shrink-0' },
  { key: 'state', label: 'State', className: 'w-[60px] shrink-0 text-center' },
  { key: 'changes', label: '+/-', className: 'w-[60px] shrink-0 text-right' },
];

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
}: DiffListViewProps): React.JSX.Element => {
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

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
        {COLUMN_HEADERS.map((col) => (
          <button
            key={col.key}
            onClick={() => handleColumnClick(col.key)}
            className={`cursor-pointer select-none font-mono text-[9px] font-medium uppercase tracking-wider text-text-ghost transition-colors duration-[var(--duration-fast)] hover:text-text-secondary ${col.className}`}
          >
            {col.label}
            {sortColumn === col.key && (
              <span className="ml-0.5 text-text-tertiary">
                {sortDirection === 'asc' ? '\u25B4' : '\u25BE'}
              </span>
            )}
          </button>
        ))}
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
        />
      ))}
    </div>
  );
};
