import { useState, useMemo } from 'react';
import type { DiffFile, DiffHunk as DiffHunkType, DiffFeatureGroup } from '@/types';
import { DiffFileRow } from '@/components/git/DiffFileRow';
import { groupFilesByFeature } from '@/components/git/diffViewUtils';

interface DiffGroupsViewProps {
  files: DiffFile[];
  activeProjectId: string | null;
  onRefresh: () => Promise<void>;
  onOpenFullDiff: (file: DiffFile, hunks: DiffHunkType[]) => void;
  selectedFiles?: Set<string>;
  onToggleSelect?: (filePath: string) => void;
}

export const DiffGroupsView = ({
  files,
  activeProjectId,
  onRefresh,
  onOpenFullDiff,
  selectedFiles,
  onToggleSelect,
}: DiffGroupsViewProps): React.JSX.Element => {
  const groups = useMemo(() => groupFilesByFeature(files), [files]);

  return (
    <div>
      {groups.map((group) => (
        <GroupSection
          key={group.heading}
          group={group}
          activeProjectId={activeProjectId}
          onRefresh={onRefresh}
          onOpenFullDiff={onOpenFullDiff}
          selectedFiles={selectedFiles}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
};

interface GroupSectionProps {
  group: DiffFeatureGroup;
  activeProjectId: string | null;
  onRefresh: () => Promise<void>;
  onOpenFullDiff: (file: DiffFile, hunks: DiffHunkType[]) => void;
  selectedFiles?: Set<string>;
  onToggleSelect?: (filePath: string) => void;
}

const GroupSection = ({
  group,
  activeProjectId,
  onRefresh,
  onOpenFullDiff,
  selectedFiles,
  onToggleSelect,
}: GroupSectionProps): React.JSX.Element => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="border-b border-border-subtle">
      {/* Group header */}
      <div
        onClick={() => setCollapsed((c) => !c)}
        className="flex cursor-pointer items-center gap-2.5 px-5 py-2 transition-colors duration-[var(--duration-fast)] hover:bg-bg-hover"
      >
        {/* Chevron */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-text-ghost transition-transform duration-[var(--duration-fast)] ${collapsed ? '' : 'rotate-90'}`}
        >
          <polyline points="3,1 7,5 3,9" />
        </svg>

        {/* Heading + subtitle */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-[12px] font-medium text-text-primary">
              {group.heading}
            </span>
            <span className="shrink-0 font-mono text-[10px] text-text-ghost">
              {group.files.length} {group.files.length === 1 ? 'file' : 'files'}
            </span>
          </div>
          {group.subtitle && (
            <p className="mt-0.5 truncate font-mono text-[10px] text-text-tertiary">
              {group.subtitle}
            </p>
          )}
        </div>

        {/* Aggregate stats */}
        <div className="flex shrink-0 gap-1.5 font-mono text-[10px]">
          {group.totalAdditions > 0 && (
            <span className="text-[var(--color-added)]">+{group.totalAdditions}</span>
          )}
          {group.totalDeletions > 0 && (
            <span className="text-[var(--color-deleted)]">-{group.totalDeletions}</span>
          )}
        </div>
      </div>

      {/* Divider */}
      {!collapsed && (
        <div className="mx-5 border-t border-border-subtle" />
      )}

      {/* Files */}
      {!collapsed && (
        <div>
          {group.files.map((file) => (
            <DiffFileRow
              key={file.filePath}
              file={file}
              activeProjectId={activeProjectId}
              onRefresh={onRefresh}
              onOpenFullDiff={onOpenFullDiff}
              layout="default"
              selected={selectedFiles?.has(file.filePath)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};
