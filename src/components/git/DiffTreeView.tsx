import { useState, useMemo } from 'react';
import type { DiffFile, DiffHunk as DiffHunkType, DiffTreeNode } from '@/types';
import { DiffFileRow } from '@/components/git/DiffFileRow';
import { groupFilesByDirectory } from '@/components/git/diffViewUtils';

interface DiffTreeViewProps {
  files: DiffFile[];
  activeProjectId: string | null;
  onRefresh: () => Promise<void>;
  onOpenFullDiff: (file: DiffFile, hunks: DiffHunkType[]) => void;
  selectedFiles?: Set<string>;
  onToggleSelect?: (filePath: string) => void;
}

export const DiffTreeView = ({
  files,
  activeProjectId,
  onRefresh,
  onOpenFullDiff,
  selectedFiles,
  onToggleSelect,
}: DiffTreeViewProps): React.JSX.Element => {
  const tree = useMemo(() => groupFilesByDirectory(files), [files]);

  return (
    <div>
      {tree.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
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

interface TreeNodeProps {
  node: DiffTreeNode;
  depth: number;
  activeProjectId: string | null;
  onRefresh: () => Promise<void>;
  onOpenFullDiff: (file: DiffFile, hunks: DiffHunkType[]) => void;
  selectedFiles?: Set<string>;
  onToggleSelect?: (filePath: string) => void;
}

const TreeNode = ({
  node,
  depth,
  activeProjectId,
  onRefresh,
  onOpenFullDiff,
  selectedFiles,
  onToggleSelect,
}: TreeNodeProps): React.JSX.Element => {
  const [collapsed, setCollapsed] = useState(false);

  if (node.type === 'file' && node.file) {
    return (
      <div style={{ paddingLeft: depth * 16 }}>
        <DiffFileRow
          file={node.file}
          activeProjectId={activeProjectId}
          onRefresh={onRefresh}
          onOpenFullDiff={onOpenFullDiff}
          layout="compact"
          selected={selectedFiles?.has(node.file.filePath)}
          onToggleSelect={onToggleSelect}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Directory header */}
      <div
        onClick={() => setCollapsed((c) => !c)}
        style={{ paddingLeft: depth * 16 }}
        className="flex cursor-pointer items-center gap-2 px-5 py-[5px] font-mono text-[11px] text-text-secondary transition-colors duration-[var(--duration-fast)] hover:bg-bg-hover"
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

        {/* Folder icon */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="shrink-0 text-text-ghost"
        >
          <path d="M1 3V10H11V4H5.5L4.5 3H1Z" />
        </svg>

        {/* Directory name */}
        <span className="truncate">{node.name}/</span>

        {/* Aggregate stats */}
        <div className="ml-auto flex shrink-0 gap-1.5 text-[10px]">
          {node.totalAdditions > 0 && (
            <span className="text-[var(--color-added)]">+{node.totalAdditions}</span>
          )}
          {node.totalDeletions > 0 && (
            <span className="text-[var(--color-deleted)]">-{node.totalDeletions}</span>
          )}
        </div>
      </div>

      {/* Children */}
      {!collapsed && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              activeProjectId={activeProjectId}
              onRefresh={onRefresh}
              onOpenFullDiff={onOpenFullDiff}
              selectedFiles={selectedFiles}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};
