import { useState, useEffect, useCallback } from 'react';
import { RunSidebar } from '@/components/pipeline/RunSidebar';
import { PhaseHeader } from '@/components/pipeline/PhaseHeader';
import { ValidationChain } from '@/components/pipeline/ValidationChain';
import { mockPipelineRuns, mockExecuteOutput } from '@/lib/mock-data';
import { useProjectStore } from '@/stores/projectStore';
import { usePipelineStore } from '@/stores/pipelineStore';
import type { Phase, PipelineConfig, PipelineRun } from '@/types';

/* ─── New-run form ─────────────────────────────────────────────────────────── */

interface NewRunFormProps {
  onSubmit: (name: string, branch: string) => Promise<void>;
  onCancel: () => void;
}

const NewRunForm = ({ onSubmit, onCancel }: NewRunFormProps): React.JSX.Element => {
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!name.trim() || !branch.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(name.trim(), branch.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(e) => { void handleSubmit(e); }}
      className="border-b border-border-subtle bg-bg-surface px-4 py-3"
    >
      <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[1.5px] text-text-tertiary">
        New Run
      </div>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Run name"
        className="mb-2 w-full rounded-[var(--radius-sm)] border border-border-default bg-bg-void px-2 py-1.5 font-mono text-[11px] text-text-primary placeholder:text-text-ghost focus:border-border-strong focus:outline-none"
      />
      <input
        value={branch}
        onChange={(e) => setBranch(e.target.value)}
        placeholder="Branch"
        className="mb-3 w-full rounded-[var(--radius-sm)] border border-border-default bg-bg-void px-2 py-1.5 font-mono text-[11px] text-text-primary placeholder:text-text-ghost focus:border-border-strong focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || !name.trim() || !branch.trim()}
          className="flex-1 rounded-[var(--radius-sm)] border border-border-strong bg-bg-active py-1.5 font-mono text-[11px] text-text-secondary transition-colors hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-[var(--radius-sm)] border border-border-subtle bg-transparent py-1.5 font-mono text-[11px] text-text-tertiary transition-colors hover:bg-bg-hover"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

/* ─── PipelineView ─────────────────────────────────────────────────────────── */

export const PipelineView = (): React.JSX.Element => {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const { runs, addRun, activeRunId, setActiveRun } = usePipelineStore();

  const [activePhase, setActivePhase] = useState<Phase>('execute');
  const [showNewRunForm, setShowNewRunForm] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  /* ── Load runs from IPC on mount / project change ──────────────────────── */

  const loadRuns = useCallback(async (): Promise<void> => {
    if (activeProjectId === null) return;

    const api = (window as unknown as { nexusAPI?: { pipeline?: { list?(id: string): Promise<PipelineRun[]> } } }).nexusAPI;
    if (!api?.pipeline?.list) return;

    try {
      const fetched = await api.pipeline.list(activeProjectId);
      for (const run of fetched) {
        addRun(run);
      }
      setLoadError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Only show the error if it's not the "not implemented" stub
      if (!msg.includes('NOT_IMPLEMENTED')) {
        setLoadError(msg);
      }
    }
  }, [activeProjectId, addRun]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  /* ── Determine displayed runs (real or fallback mock) ──────────────────── */

  const displayRuns: PipelineRun[] =
    runs.length > 0 ? runs : mockPipelineRuns;

  const resolvedActiveRunId: string | null =
    activeRunId ?? displayRuns[0]?.id ?? null;

  const activeRun: PipelineRun | null =
    displayRuns.find((r) => r.id === resolvedActiveRunId) ?? displayRuns[0] ?? null;

  /* ── New-run handler ───────────────────────────────────────────────────── */

  const handleNewRun = async (name: string, branch: string): Promise<void> => {
    if (activeProjectId === null) return;

    const api = (window as unknown as { nexusAPI?: { pipeline?: { create?(id: string, cfg: PipelineConfig): Promise<PipelineRun> } } }).nexusAPI;
    if (!api?.pipeline?.create) {
      setShowNewRunForm(false);
      return;
    }

    const config: PipelineConfig = {
      name,
      projectId: activeProjectId,
      branch,
      plan: { pluginId: 'fn-investigation' },
      execute: { pluginId: 'fn-task' },
      validate: {
        chain: [
          { pluginId: 'fn-review' },
          { pluginId: 'unit-test' },
        ],
      },
    };

    const run = await api.pipeline.create(activeProjectId, config);
    addRun(run);
    setActiveRun(run.id);
    setShowNewRunForm(false);
  };

  /* ── Empty state ───────────────────────────────────────────────────────── */

  if (resolvedActiveRunId === null || activeRun === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="font-mono text-[11px] text-text-ghost">No pipeline runs yet.</span>
      </div>
    );
  }

  /* ── Main layout ───────────────────────────────────────────────────────── */

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="flex w-60 min-w-[240px] flex-col border-r border-border-subtle bg-bg-void">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-3.5 py-3">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[1.5px] text-text-tertiary">
            Runs
          </span>
          <button
            onClick={() => setShowNewRunForm((v) => !v)}
            className="flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-border-strong bg-transparent text-[12px] text-text-tertiary transition-all duration-[var(--duration-fast)] hover:border-text-secondary hover:bg-bg-hover hover:text-text-secondary"
          >
            +
          </button>
        </div>

        {/* Inline new-run form */}
        {showNewRunForm && (
          <NewRunForm
            onSubmit={async (name, branch) => { await handleNewRun(name, branch); }}
            onCancel={() => setShowNewRunForm(false)}
          />
        )}

        {/* Error banner */}
        {loadError !== null && (
          <div className="border-b border-border-subtle bg-[var(--color-danger-dim,#3b1515)] px-3.5 py-2 font-mono text-[10px] text-[var(--color-danger,#f87171)]">
            {loadError}
          </div>
        )}

        {/* Run list */}
        <RunSidebar
          activeRunId={resolvedActiveRunId}
          onSelectRun={setActiveRun}
          runs={displayRuns}
        />
      </div>

      {/* Phase detail pane */}
      <div className="flex flex-1 flex-col overflow-auto">
        <PhaseHeader
          run={activeRun}
          activePhase={activePhase}
          onSelectPhase={setActivePhase}
        />

        <div className="flex-1 p-5">
          {/* Validation chain */}
          {activeRun.phases.validate !== null && (
            <div className="mb-4">
              <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.5px] text-text-tertiary">
                Validation Chain ({activeRun.phases.validate.status})
              </div>
              <ValidationChain steps={activeRun.phases.validate.steps} />
            </div>
          )}

          {/* Execute output */}
          {activePhase === 'execute' && activeRun.phases.execute !== null && (
            <div>
              <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.5px] text-text-tertiary">
                Execute Output (live)
              </div>
              <div className="max-h-[400px] overflow-auto whitespace-pre-wrap rounded-[var(--radius-md)] border border-border-subtle bg-bg-void p-4 font-mono text-[11px] leading-[1.7] text-text-secondary">
                {activeRun.phases.execute.output ?? mockExecuteOutput}
              </div>
            </div>
          )}

          {/* Plan output */}
          {activePhase === 'plan' && activeRun.phases.plan !== null && (
            <div>
              <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.5px] text-text-tertiary">
                Plan Output
              </div>
              <div className="max-h-[400px] overflow-auto whitespace-pre-wrap rounded-[var(--radius-md)] border border-border-subtle bg-bg-void p-4 font-mono text-[11px] leading-[1.7] text-text-secondary">
                {activeRun.phases.plan.output ?? 'No output available.'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
