import { useState, useEffect } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { DiffHunk } from '@/components/git/DiffHunk';
import { monacoLang } from '@/lib/languageFromPath';
import '@/lib/monacoSetup';
import type { DiffFile, DiffHunk as DiffHunkType } from '@/types';

interface FullDiffPanelProps {
  file: DiffFile;
  hunks: DiffHunkType[];
  activeProjectId: string | null;
  onClose: () => void;
}

export const FullDiffPanel = ({ file, hunks, activeProjectId, onClose }: FullDiffPanelProps): React.JSX.Element => {
  const [fileContent, setFileContent] = useState<{ head: string | null; working: string } | null>(null);
  const [contentLoading, setContentLoading] = useState(true);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fetch full file content for Monaco
  useEffect(() => {
    if (!activeProjectId || !window.nexusAPI?.git) {
      setContentLoading(false);
      return;
    }
    setContentLoading(true);
    void window.nexusAPI.git
      .fileContent(activeProjectId, file.filePath)
      .then(setFileContent)
      .catch(() => setFileContent(null))
      .finally(() => setContentLoading(false));
  }, [activeProjectId, file.filePath]);

  const lastSlash = file.filePath.lastIndexOf('/');
  const dir = lastSlash >= 0 ? file.filePath.slice(0, lastSlash + 1) : '';
  const filename = lastSlash >= 0 ? file.filePath.slice(lastSlash + 1) : file.filePath;

  const statusStyles: Record<string, string> = {
    M: 'bg-[var(--color-modified)] text-[var(--bg-void)]',
    A: 'bg-[var(--color-added)] text-[var(--bg-void)]',
    D: 'bg-[var(--color-deleted)] text-white',
    R: 'bg-[var(--color-info)] text-[var(--bg-void)]',
  };

  const renderContent = (): React.JSX.Element => {
    if (contentLoading) {
      return (
        <div className="flex items-center gap-2 px-5 py-4">
          <div className="h-2.5 w-2.5 animate-spin rounded-full border border-text-ghost border-t-phase-plan" />
          <span className="font-mono text-[10px] text-text-tertiary">Loading...</span>
        </div>
      );
    }

    if (fileContent !== null) {
      return (
        <DiffEditor
          height="100%"
          original={fileContent.head ?? ''}
          modified={fileContent.working}
          language={monacoLang(file.filePath)}
          theme="vs-dark"
          options={{
            readOnly: true,
            renderSideBySide: false,
            folding: true,
            foldingStrategy: 'indentation',
            minimap: { enabled: true },
          }}
        />
      );
    }

    // Fallback: hunk list with Shiki
    return (
      <>
        {hunks.length === 0 ? (
          <div className="px-5 py-3 font-mono text-[10px] text-text-ghost">No changes to display</div>
        ) : (
          hunks.map((hunk) => (
            <DiffHunk key={hunk.header} hunk={hunk} filePath={file.filePath} />
          ))
        )}
      </>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop — left 30% — click to close */}
      <div
        className="w-[30%] shrink-0 bg-bg-void/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel — right 70% — slide in from right */}
      <div
        className="flex w-[70%] flex-col border-l border-border-subtle bg-bg-raised"
        style={{
          animation: 'fullDiffSlideIn 200ms ease-out',
        }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2.5 border-b border-border-subtle px-5 py-3">
          {/* Status badge */}
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] font-mono text-[10px] font-bold ${statusStyles[file.status] ?? ''}`}
          >
            {file.status}
          </span>

          {/* File path */}
          <span className="flex-1 truncate font-mono text-[12px] text-text-primary">
            {dir !== '' && <span className="text-text-tertiary">{dir}</span>}
            {filename}
            {file.status === 'R' && file.oldPath !== undefined && (
              <span className="text-text-tertiary"> &larr; {file.oldPath.split('/').pop()}</span>
            )}
          </span>

          {/* Stats */}
          <div className="flex shrink-0 gap-1.5 font-mono text-[10px]">
            {file.additions > 0 && (
              <span className="text-[var(--color-added)]">+{file.additions}</span>
            )}
            {file.deletions > 0 && (
              <span className="text-[var(--color-deleted)]">-{file.deletions}</span>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            title="Close full diff"
            className="ml-1 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-[3px] border border-border-default bg-transparent text-text-ghost transition-all duration-[var(--duration-fast)] hover:border-border-strong hover:text-text-primary"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="1" y1="1" x2="9" y2="9" />
              <line x1="9" y1="1" x2="1" y2="9" />
            </svg>
          </button>
        </div>

        {/* Content area */}
        <div className={`flex-1 min-h-0 ${fileContent !== null && !contentLoading ? '' : 'overflow-auto'}`}>
          {renderContent()}
        </div>
      </div>

      <style>{`
        @keyframes fullDiffSlideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};
