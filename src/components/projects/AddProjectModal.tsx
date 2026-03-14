import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type { DiscoveredRepo } from '@/types';

interface AddProjectModalProps {
  onClose: () => void;
}

export const AddProjectModal = ({ onClose }: AddProjectModalProps): React.JSX.Element => {
  const addProject = useProjectStore((s) => s.addProject);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);

  const [path, setPath] = useState('');
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveredRepo[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  async function handleBrowse(): Promise<void> {
    setError(null);
    try {
      const dir = await window.nexusAPI.dialog.openDirectory();
      if (dir === null) return;

      setPath(dir);
      setDiscovered([]);

      // Auto-trigger scan
      setScanning(true);
      const repos = await window.nexusAPI.projects.scan(dir);
      setDiscovered(repos);
      if (repos.length === 0) {
        setError('No git repositories found in that directory');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed: ${msg}`);
      console.error('[AddProjectModal] browse failed:', err);
    } finally {
      setScanning(false);
    }
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const target = path.trim();
    if (target === '') {
      setError('Path cannot be empty');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const project = await window.nexusAPI.projects.add(target);
      addProject(project);
      setActiveProject(project.id);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to add project: ${msg}`);
      console.error('[AddProjectModal] add failed:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSelectDiscovered(repo: DiscoveredRepo): Promise<void> {
    setPath(repo.path);
    setDiscovered([]);
    setError(null);
    setSubmitting(true);
    try {
      const project = await window.nexusAPI.projects.add(repo.path);
      addProject(project);
      setActiveProject(project.id);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to add project: ${msg}`);
      console.error('[AddProjectModal] add failed:', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/60 pt-[15vh] backdrop-blur-[4px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-[480px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border-strong bg-bg-raised shadow-[0_24px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)] animate-[palette-enter_150ms_var(--ease-out)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <span className="font-mono text-[12px] font-semibold text-text-primary">
            Add project
          </span>
          <button
            onClick={onClose}
            className="font-mono text-[11px] text-text-ghost transition-colors hover:text-text-secondary"
          >
            esc
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => { void handleSubmit(e); }} className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] font-semibold uppercase tracking-[1px] text-text-ghost">
              Directory path
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={path}
                onChange={(e) => {
                  setPath(e.target.value);
                  setError(null);
                  setDiscovered([]);
                }}
                placeholder="E:/data/src/my-project"
                disabled={submitting}
                className="flex-1 rounded-[var(--radius-sm)] border border-border-strong bg-bg-surface px-3 py-2 font-mono text-[12px] text-text-primary caret-phase-plan outline-none placeholder:text-text-ghost focus:border-phase-plan disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => { void handleBrowse(); }}
                disabled={scanning || submitting}
                className="shrink-0 cursor-pointer rounded-[var(--radius-sm)] border border-border-strong bg-bg-surface px-3 py-2 font-mono text-[11px] text-text-secondary transition-all duration-[var(--duration-fast)] hover:border-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {scanning ? 'Scanning...' : 'Browse'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error !== null && (
            <span className="font-mono text-[11px] text-[var(--color-deleted,#f87171)]">
              {error}
            </span>
          )}

          {/* Discovered repos list */}
          {discovered.length > 0 && (
            <div className="flex flex-col gap-0.5 rounded-[var(--radius-sm)] border border-border-subtle bg-bg-surface">
              <div className="px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[1px] text-text-ghost">
                Found {discovered.length} {discovered.length === 1 ? 'repo' : 'repos'}
              </div>
              <div className="max-h-[160px] overflow-y-auto">
                {discovered.map((repo) => (
                  <button
                    key={repo.path}
                    type="button"
                    onClick={() => { void handleSelectDiscovered(repo); }}
                    className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-bg-hover"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--phase-plan-glow)] font-mono text-[10px] text-phase-plan">
                      P
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-mono text-[12px] text-text-primary">
                        {repo.name}
                      </span>
                      {repo.defaultBranch !== undefined && (
                        <span className="font-mono text-[10px] text-text-ghost">
                          {repo.defaultBranch}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-[var(--radius-sm)] border border-border-strong bg-transparent px-4 py-1.5 font-mono text-[11px] text-text-secondary transition-all duration-[var(--duration-fast)] hover:bg-bg-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || path.trim() === ''}
              className="cursor-pointer rounded-[var(--radius-sm)] border border-phase-plan bg-[var(--phase-plan-glow)] px-4 py-1.5 font-mono text-[11px] text-phase-plan transition-all duration-[var(--duration-fast)] hover:bg-[var(--phase-plan-dim)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
