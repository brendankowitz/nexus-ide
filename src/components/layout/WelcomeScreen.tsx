import { useState, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';

// ── Terminal icon (CSS/SVG) ──────────────────────

const TerminalIcon = (): React.JSX.Element => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

// ── WelcomeScreen ────────────────────────────────

export const WelcomeScreen = (): React.JSX.Element => {
  const addProject = useProjectStore((s) => s.addProject);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const setAddProjectModalOpen = useUIStore((s) => s.setAddProjectModalOpen);
  const [error, setError] = useState<string | null>(null);

  const handleBrowse = useCallback(async (): Promise<void> => {
    if (!window.nexusAPI?.dialog) return;
    try {
      const dir = await window.nexusAPI.dialog.openDirectory();
      if (dir === null) return;
      const project = await window.nexusAPI.projects.add(dir);
      addProject(project);
      setActiveProject(project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add project');
      setTimeout(() => { setError(null); }, 4000);
    }
  }, [addProject, setActiveProject]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 px-8">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <div
          className="h-[320px] w-[320px] rounded-full opacity-[0.07] blur-[100px]"
          style={{ background: 'var(--phase-plan)' }}
        />
      </div>

      {/* Glowing icon */}
      <div className="relative">
        <div
          className="absolute inset-0 rounded-2xl opacity-30 blur-2xl"
          style={{ background: 'var(--phase-plan)' }}
        />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-border-default bg-bg-surface text-phase-plan">
          <TerminalIcon />
        </div>
      </div>

      {/* Title + subtitle */}
      <div className="relative text-center">
        <h1 className="font-mono text-[20px] font-semibold tracking-[-0.02em] text-text-primary">
          Welcome to Nexus
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-text-tertiary">
          Add a project to get started
        </p>
      </div>

      {/* CTA buttons */}
      <div className="relative flex flex-col items-center gap-2.5">
        <button
          onClick={() => { void handleBrowse(); }}
          className="cursor-pointer rounded-[var(--radius-md)] border border-phase-plan bg-[var(--phase-plan-dim)] px-5 py-2.5 font-mono text-[12px] font-medium text-phase-plan transition-all duration-[var(--duration-normal)] hover:bg-phase-plan hover:text-[var(--bg-void)]"
        >
          Browse Directory
        </button>
        <button
          onClick={() => setAddProjectModalOpen(true)}
          className="cursor-pointer font-mono text-[11px] text-text-tertiary underline-offset-2 hover:text-text-secondary hover:underline transition-colors duration-[var(--duration-fast)]"
        >
          or enter path manually
        </button>
      </div>

      {/* Error */}
      {error !== null && (
        <p className="relative font-mono text-[11px] text-[var(--color-deleted)]">{error}</p>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="relative mt-2 flex gap-4 font-mono text-[10px] text-text-ghost">
        <span>Ctrl+K search</span>
        <span>Ctrl+, settings</span>
      </div>
    </div>
  );
};
