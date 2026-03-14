import { useState, useEffect, useCallback, useRef } from 'react';
import { RunSidebar } from '@/components/pipeline/RunSidebar';
import { PhaseHeader } from '@/components/pipeline/PhaseHeader';
import { ValidationChain } from '@/components/pipeline/ValidationChain';
import { TerminalTab } from '@/components/terminals/TerminalTab';
import { useProjectStore } from '@/stores/projectStore';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useTerminalStore } from '@/stores/terminalStore';
import type {
  Phase,
  NexusPlugin,
  NexusPluginConfigField,
  PipelineConfig,
  PipelineRun,
  PipelineUpdate,
} from '@/types';

/* ─── Empty State ──────────────────────────────────────────────────────────── */

const PipelineEmptyState = ({ onCreateRun }: { onCreateRun: () => void }): React.JSX.Element => (
  <div className="flex h-full flex-col items-center justify-center gap-4 px-8">
    <div className="relative">
      <div
        className="absolute inset-0 rounded-2xl opacity-30 blur-2xl"
        style={{ background: 'var(--phase-validate)' }}
      />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-border-default bg-bg-surface">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      </div>
    </div>
    <div className="text-center">
      <p className="font-mono text-[13px] font-medium text-text-primary">No pipeline runs</p>
      <p className="mt-1 text-[11px] text-text-tertiary">Create a run to start plan-execute-validate</p>
    </div>
    <button
      onClick={onCreateRun}
      className="cursor-pointer rounded-[var(--radius-md)] border border-[var(--phase-validate-dim)] bg-[var(--phase-validate-dim)] px-4 py-2 font-mono text-[11px] font-medium text-phase-validate transition-all duration-[var(--duration-normal)] hover:bg-phase-validate hover:text-[var(--bg-void)]"
    >
      Create Run
    </button>
  </div>
);

/* ─── Loading State ─────────────────────────────────────────────────────────── */

const PipelineLoading = (): React.JSX.Element => (
  <div className="flex h-full items-center justify-center">
    <div className="flex items-center gap-2.5">
      <div className="h-3 w-3 animate-spin rounded-full border border-text-ghost border-t-phase-validate" />
      <span className="font-mono text-[11px] text-text-tertiary">Loading pipeline runs...</span>
    </div>
  </div>
);

/* ─── Plugin Config Fields ──────────────────────────────────────────────────── */

interface PluginConfigFieldsProps {
  fields: NexusPluginConfigField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

const PluginConfigFields = ({ fields, values, onChange }: PluginConfigFieldsProps): React.JSX.Element => (
  <div className="mt-2 flex flex-wrap gap-2">
    {fields.map((field) => {
      const val = values[field.key] ?? field.default ?? '';
      if (field.type === 'select' && field.options) {
        return (
          <label key={field.key} className="flex flex-col gap-0.5">
            <span className="font-mono text-[9px] uppercase tracking-wider text-text-ghost">{field.label}</span>
            <select
              value={String(val)}
              onChange={(e) => onChange(field.key, e.target.value)}
              className="rounded-[var(--radius-sm)] border border-border-default bg-bg-void px-2 py-1 font-mono text-[11px] text-text-primary focus:border-border-strong focus:outline-none"
            >
              {field.options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
        );
      }
      if (field.type === 'boolean') {
        return (
          <label key={field.key} className="flex items-center gap-1.5 py-1">
            <input
              type="checkbox"
              checked={Boolean(val)}
              onChange={(e) => onChange(field.key, e.target.checked)}
              className="h-3 w-3"
            />
            <span className="font-mono text-[10px] text-text-secondary">{field.label}</span>
          </label>
        );
      }
      if (field.type === 'number') {
        return (
          <label key={field.key} className="flex flex-col gap-0.5">
            <span className="font-mono text-[9px] uppercase tracking-wider text-text-ghost">{field.label}</span>
            <input
              type="number"
              value={Number(val)}
              onChange={(e) => onChange(field.key, Number(e.target.value))}
              className="w-20 rounded-[var(--radius-sm)] border border-border-default bg-bg-void px-2 py-1 font-mono text-[11px] text-text-primary focus:border-border-strong focus:outline-none"
            />
          </label>
        );
      }
      // string
      return (
        <label key={field.key} className="flex flex-1 flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-wider text-text-ghost">{field.label}</span>
          <input
            type="text"
            value={String(val)}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.label}
            className="rounded-[var(--radius-sm)] border border-border-default bg-bg-void px-2 py-1 font-mono text-[11px] text-text-primary placeholder:text-text-ghost focus:border-border-strong focus:outline-none"
          />
        </label>
      );
    })}
  </div>
);

/* ─── Plugin Selector ───────────────────────────────────────────────────────── */

interface PluginSelectorProps {
  label: string;
  labelColor: string;
  plugins: NexusPlugin[];
  selectedId: string;
  onSelect: (id: string) => void;
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
}

const PluginSelector = ({
  label,
  labelColor,
  plugins,
  selectedId,
  onSelect,
  config,
  onConfigChange,
}: PluginSelectorProps): React.JSX.Element => {
  const selectedPlugin = plugins.find((p) => p.id === selectedId);

  return (
    <div className="rounded-[var(--radius-md)] border border-border-default bg-bg-surface p-3">
      <div className={`mb-2 font-mono text-[10px] font-semibold uppercase tracking-[1px] ${labelColor}`}>
        {label}
      </div>
      <select
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full rounded-[var(--radius-sm)] border border-border-default bg-bg-void px-2 py-1.5 font-mono text-[11px] text-text-primary focus:border-border-strong focus:outline-none"
      >
        {plugins.map((p) => (
          <option key={p.id} value={p.id}>{p.name} -- {p.description}</option>
        ))}
      </select>
      {selectedPlugin?.configSchema?.fields && (
        <PluginConfigFields
          fields={selectedPlugin.configSchema.fields}
          values={config}
          onChange={onConfigChange}
        />
      )}
    </div>
  );
};

/* ─── Validate Chain Builder ────────────────────────────────────────────────── */

interface ValidateChainEntry {
  pluginId: string;
  config: Record<string, unknown>;
}

interface ValidateChainBuilderProps {
  availablePlugins: NexusPlugin[];
  chain: ValidateChainEntry[];
  onChange: (chain: ValidateChainEntry[]) => void;
}

const ValidateChainBuilder = ({
  availablePlugins,
  chain,
  onChange,
}: ValidateChainBuilderProps): React.JSX.Element => {
  const addStep = (): void => {
    const defaultPlugin = availablePlugins[0];
    if (!defaultPlugin) return;
    onChange([...chain, { pluginId: defaultPlugin.id, config: {} }]);
  };

  const removeStep = (idx: number): void => {
    onChange(chain.filter((_, i) => i !== idx));
  };

  const updateStep = (idx: number, pluginId: string): void => {
    const next = [...chain];
    next[idx] = { pluginId, config: {} };
    onChange(next);
  };

  const updateStepConfig = (idx: number, key: string, value: unknown): void => {
    const next = [...chain];
    const entry = next[idx];
    if (!entry) return;
    next[idx] = { ...entry, config: { ...entry.config, [key]: value } };
    onChange(next);
  };

  return (
    <div className="rounded-[var(--radius-md)] border border-border-default bg-bg-surface p-3">
      <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[1px] text-phase-validate">
        Validation Chain
      </div>
      <div className="flex flex-col gap-2">
        {chain.map((entry, idx) => {
          const plugin = availablePlugins.find((p) => p.id === entry.pluginId);
          return (
            <div key={idx} className="flex items-start gap-2">
              <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bg-active font-mono text-[10px] font-semibold text-text-secondary">
                {idx + 1}
              </span>
              <div className="flex-1">
                <select
                  value={entry.pluginId}
                  onChange={(e) => updateStep(idx, e.target.value)}
                  className="w-full rounded-[var(--radius-sm)] border border-border-default bg-bg-void px-2 py-1.5 font-mono text-[11px] text-text-primary focus:border-border-strong focus:outline-none"
                >
                  {availablePlugins.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {plugin?.configSchema?.fields && (
                  <PluginConfigFields
                    fields={plugin.configSchema.fields}
                    values={entry.config}
                    onChange={(key, value) => updateStepConfig(idx, key, value)}
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => removeStep(idx)}
                className="mt-1 cursor-pointer px-1 font-mono text-[12px] text-text-ghost transition-colors hover:text-[var(--color-danger)]"
              >
                x
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={addStep}
        className="mt-2 cursor-pointer font-mono text-[10px] text-phase-validate transition-colors hover:text-text-primary"
      >
        + add validator
      </button>
    </div>
  );
};

/* ─── New-run form ─────────────────────────────────────────────────────────── */

interface NewRunFormProps {
  onSubmit: (config: PipelineConfig, autoStart: boolean) => Promise<void>;
  onCancel: () => void;
  projectId: string;
}

const NewRunForm = ({ onSubmit, onCancel, projectId }: NewRunFormProps): React.JSX.Element => {
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Plugin lists
  const [planPlugins, setPlanPlugins] = useState<NexusPlugin[]>([]);
  const [executePlugins, setExecutePlugins] = useState<NexusPlugin[]>([]);
  const [validatePlugins, setValidatePlugins] = useState<NexusPlugin[]>([]);

  // Selected plugins + config
  const [planPluginId, setPlanPluginId] = useState('');
  const [planConfig, setPlanConfig] = useState<Record<string, unknown>>({});
  const [executePluginId, setExecutePluginId] = useState('');
  const [executeConfig, setExecuteConfig] = useState<Record<string, unknown>>({});
  const [validateChain, setValidateChain] = useState<ValidateChainEntry[]>([]);

  // Load plugins on mount
  useEffect(() => {
    const load = async (): Promise<void> => {
      const api = window.nexusAPI?.plugins;
      if (!api) return;

      const [plan, exec, validate] = await Promise.all([
        api.list('plan'),
        api.list('execute'),
        api.list('validate'),
      ]);

      setPlanPlugins(plan);
      setExecutePlugins(exec);
      setValidatePlugins(validate);

      if (plan[0]) setPlanPluginId(plan[0].id);
      if (exec[0]) setExecutePluginId(exec[0].id);
      if (validate.length > 0) {
        setValidateChain([
          { pluginId: validate.find((p) => p.id === 'fn-review')?.id ?? validate[0]!.id, config: {} },
          ...(validate.find((p) => p.id === 'unit-test')
            ? [{ pluginId: 'unit-test', config: {} }]
            : []),
        ]);
      }
    };
    void load();
  }, []);

  const buildConfig = (): PipelineConfig => ({
    name: name.trim(),
    projectId,
    branch: branch.trim(),
    plan: { pluginId: planPluginId, config: Object.keys(planConfig).length > 0 ? planConfig : undefined },
    execute: { pluginId: executePluginId, config: Object.keys(executeConfig).length > 0 ? executeConfig : undefined },
    validate: {
      chain: validateChain.map((entry) => ({
        pluginId: entry.pluginId,
        config: Object.keys(entry.config).length > 0 ? entry.config : undefined,
      })),
    },
  });

  const handleSubmit = async (autoStart: boolean): Promise<void> => {
    if (!name.trim() || !branch.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(buildConfig(), autoStart);
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = name.trim() !== '' && branch.trim() !== '' && planPluginId !== '' && executePluginId !== '';

  return (
    <div className="border-b border-border-subtle bg-bg-surface px-4 py-3">
      <div className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[1.5px] text-text-tertiary">
        New Run
      </div>

      {/* Name + Branch */}
      <div className="mb-3 flex gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Run name"
          className="flex-1 rounded-[var(--radius-sm)] border border-border-default bg-bg-void px-2 py-1.5 font-mono text-[11px] text-text-primary placeholder:text-text-ghost focus:border-border-strong focus:outline-none"
        />
        <input
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          placeholder="Branch"
          className="flex-1 rounded-[var(--radius-sm)] border border-border-default bg-bg-void px-2 py-1.5 font-mono text-[11px] text-text-primary placeholder:text-text-ghost focus:border-border-strong focus:outline-none"
        />
      </div>

      {/* Plugin selections */}
      <div className="mb-3 flex flex-col gap-2">
        {planPlugins.length > 0 && (
          <PluginSelector
            label="Plan Plugin"
            labelColor="text-phase-plan"
            plugins={planPlugins}
            selectedId={planPluginId}
            onSelect={(id) => { setPlanPluginId(id); setPlanConfig({}); }}
            config={planConfig}
            onConfigChange={(k, v) => setPlanConfig((prev) => ({ ...prev, [k]: v }))}
          />
        )}

        {executePlugins.length > 0 && (
          <PluginSelector
            label="Execute Plugin"
            labelColor="text-phase-execute"
            plugins={executePlugins}
            selectedId={executePluginId}
            onSelect={(id) => { setExecutePluginId(id); setExecuteConfig({}); }}
            config={executeConfig}
            onConfigChange={(k, v) => setExecuteConfig((prev) => ({ ...prev, [k]: v }))}
          />
        )}

        {validatePlugins.length > 0 && (
          <ValidateChainBuilder
            availablePlugins={validatePlugins}
            chain={validateChain}
            onChange={setValidateChain}
          />
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={submitting || !isValid}
          onClick={() => { void handleSubmit(true); }}
          className="flex-1 cursor-pointer rounded-[var(--radius-sm)] border border-phase-validate bg-phase-validate py-1.5 font-mono text-[11px] font-medium text-[var(--bg-void)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create & Start'}
        </button>
        <button
          type="button"
          disabled={submitting || !isValid}
          onClick={() => { void handleSubmit(false); }}
          className="flex-1 cursor-pointer rounded-[var(--radius-sm)] border border-border-strong bg-bg-active py-1.5 font-mono text-[11px] text-text-secondary transition-colors hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Create Draft
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-[var(--radius-sm)] border border-border-subtle bg-transparent px-3 py-1.5 font-mono text-[11px] text-text-tertiary transition-colors hover:bg-bg-hover"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

/* ─── Phase Detail Pane ────────────────────────────────────────────────────── */

interface PhaseDetailProps {
  run: PipelineRun;
  activePhase: Phase;
  onRunValidateStep: (stepIndex: number) => void;
  onStartPhase: (phase: Phase) => void;
}

const PhaseDetail = ({
  run,
  activePhase,
  onRunValidateStep,
  onStartPhase,
}: PhaseDetailProps): React.JSX.Element => {
  /* ── Draft state — big start button ─────────────────────────────────────── */
  if (run.status === 'draft' && activePhase === 'plan') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="text-center">
          <p className="font-mono text-[13px] font-medium text-text-primary">
            Ready to start
          </p>
          <p className="mt-1 text-[11px] text-text-tertiary">
            Run &quot;{run.config.plan.pluginId}&quot; to generate the plan
          </p>
        </div>
        <button
          onClick={() => onStartPhase('plan')}
          className="cursor-pointer rounded-[var(--radius-md)] border border-[var(--phase-plan-dim)] bg-[var(--phase-plan-dim)] px-6 py-2.5 font-mono text-[12px] font-medium text-phase-plan transition-all duration-[var(--duration-normal)] hover:bg-phase-plan hover:text-[var(--bg-void)]"
        >
          Start Plan
        </button>
      </div>
    );
  }

  /* ── Plan phase ─────────────────────────────────────────────────────────── */
  if (activePhase === 'plan') {
    const planResult = run.phases.plan;

    // Running — show terminal
    if (planResult?.status === 'running' && planResult.terminalSessionId) {
      return (
        <div className="flex flex-1 flex-col overflow-hidden">
          <PhaseRunningBanner phase="plan" startedAt={planResult.startedAt} />
          <div className="min-h-0 flex-1">
            <TerminalTab sessionId={planResult.terminalSessionId} borderless />
          </div>
        </div>
      );
    }

    // Complete/failed — show output
    if (planResult && (planResult.status === 'complete' || planResult.status === 'failed')) {
      return (
        <div className="flex flex-1 flex-col overflow-auto p-5">
          <PhaseCompleteBanner phase="plan" result={planResult} />
          <PhaseOutputBlock output={planResult.output} />
          {/* If execute hasn't started, show prompt */}
          {run.phases.execute === null && planResult.status === 'complete' && (
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => onStartPhase('execute')}
                className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--phase-execute-dim)] bg-[var(--phase-execute-dim)] px-4 py-1.5 font-mono text-[11px] font-medium text-phase-execute transition-all duration-[var(--duration-fast)] hover:bg-phase-execute hover:text-[var(--bg-void)]"
              >
                Start Execute
              </button>
              <span className="font-mono text-[10px] text-text-ghost">Plan complete. Ready for execution.</span>
            </div>
          )}
        </div>
      );
    }

    // Pending — waiting
    return <PhasePendingMessage phase="plan" />;
  }

  /* ── Execute phase ──────────────────────────────────────────────────────── */
  if (activePhase === 'execute') {
    const execResult = run.phases.execute;

    // Not started yet, but plan is complete
    if (!execResult && run.phases.plan?.status === 'complete') {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="text-center">
            <p className="font-mono text-[13px] font-medium text-text-primary">Plan complete</p>
            <p className="mt-1 text-[11px] text-text-tertiary">
              Start execution with &quot;{run.config.execute.pluginId}&quot;
            </p>
          </div>
          <button
            onClick={() => onStartPhase('execute')}
            className="cursor-pointer rounded-[var(--radius-md)] border border-[var(--phase-execute-dim)] bg-[var(--phase-execute-dim)] px-6 py-2.5 font-mono text-[12px] font-medium text-phase-execute transition-all duration-[var(--duration-normal)] hover:bg-phase-execute hover:text-[var(--bg-void)]"
          >
            Start Execute
          </button>
        </div>
      );
    }

    // Running — show terminal with plan reference above
    if (execResult?.status === 'running' && execResult.terminalSessionId) {
      return (
        <div className="flex flex-1 flex-col overflow-hidden">
          <PhaseRunningBanner phase="execute" startedAt={execResult.startedAt} />
          {/* Collapsed plan reference */}
          {run.phases.plan?.output && (
            <PlanReferenceCollapsed output={run.phases.plan.output} />
          )}
          <div className="min-h-0 flex-1">
            <TerminalTab sessionId={execResult.terminalSessionId} borderless />
          </div>
        </div>
      );
    }

    // Complete/failed
    if (execResult && (execResult.status === 'complete' || execResult.status === 'failed')) {
      return (
        <div className="flex flex-1 flex-col overflow-auto p-5">
          <PhaseCompleteBanner phase="execute" result={execResult} />
          <PhaseOutputBlock output={execResult.output} />
          {run.phases.validate === null && execResult.status === 'complete' && (
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => onStartPhase('validate')}
                className="cursor-pointer rounded-[var(--radius-sm)] border border-[var(--phase-validate-dim)] bg-[var(--phase-validate-dim)] px-4 py-1.5 font-mono text-[11px] font-medium text-phase-validate transition-all duration-[var(--duration-fast)] hover:bg-phase-validate hover:text-[var(--bg-void)]"
              >
                Start Validation
              </button>
              <span className="font-mono text-[10px] text-text-ghost">Execute complete. Ready for validation.</span>
            </div>
          )}
        </div>
      );
    }

    return <PhasePendingMessage phase="execute" />;
  }

  /* ── Validate phase ─────────────────────────────────────────────────────── */
  if (activePhase === 'validate') {
    const validateResult = run.phases.validate;

    if (!validateResult && run.phases.execute?.status === 'complete') {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="text-center">
            <p className="font-mono text-[13px] font-medium text-text-primary">Execute complete</p>
            <p className="mt-1 text-[11px] text-text-tertiary">
              Initialize the validation chain ({run.config.validate.chain.length} steps)
            </p>
          </div>
          <button
            onClick={() => onStartPhase('validate')}
            className="cursor-pointer rounded-[var(--radius-md)] border border-[var(--phase-validate-dim)] bg-[var(--phase-validate-dim)] px-6 py-2.5 font-mono text-[12px] font-medium text-phase-validate transition-all duration-[var(--duration-normal)] hover:bg-phase-validate hover:text-[var(--bg-void)]"
          >
            Start Validation
          </button>
        </div>
      );
    }

    if (validateResult) {
      // Find any running step with a terminal session
      const runningStep = validateResult.steps.find(
        (s) => s.status === 'running' && s.terminalSessionId,
      );

      return (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="shrink-0 p-5 pb-3">
            <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.5px] text-text-tertiary">
              Validation Chain ({validateResult.status})
            </div>
            <ValidationChain
              steps={validateResult.steps}
              onRunStep={onRunValidateStep}
            />
          </div>
          {/* Show terminal for running step */}
          {runningStep?.terminalSessionId && (
            <div className="min-h-0 flex-1 border-t border-border-subtle">
              <TerminalTab sessionId={runningStep.terminalSessionId} borderless />
            </div>
          )}
        </div>
      );
    }

    return <PhasePendingMessage phase="validate" />;
  }

  return <PhasePendingMessage phase={activePhase} />;
};

/* ─── Small helper components ──────────────────────────────────────────────── */

const PhaseRunningBanner = ({ phase, startedAt }: { phase: Phase; startedAt?: string }): React.JSX.Element => {
  const [elapsed, setElapsed] = useState('0m 00s');

  useEffect(() => {
    if (!startedAt) return;
    const tick = (): void => {
      const diff = Date.now() - new Date(startedAt).getTime();
      const s = Math.floor(diff / 1000);
      const m = Math.floor(s / 60);
      setElapsed(`${m}m ${(s % 60).toString().padStart(2, '0')}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const color = phase === 'plan' ? 'text-phase-plan' : phase === 'execute' ? 'text-phase-execute' : 'text-phase-validate';
  const bg = phase === 'plan' ? 'bg-[var(--phase-plan-dim)]' : phase === 'execute' ? 'bg-[var(--phase-execute-dim)]' : 'bg-[var(--phase-validate-dim)]';

  return (
    <div className={`flex shrink-0 items-center gap-2.5 px-5 py-2 ${bg}`}>
      <div className={`h-2 w-2 animate-pulse rounded-full ${
        phase === 'plan' ? 'bg-phase-plan' : phase === 'execute' ? 'bg-phase-execute' : 'bg-phase-validate'
      }`} />
      <span className={`font-mono text-[11px] font-medium ${color}`}>
        Running... {elapsed}
      </span>
    </div>
  );
};

const PhaseCompleteBanner = ({ phase, result }: { phase: Phase; result: { status: string; startedAt?: string; completedAt?: string } }): React.JSX.Element => {
  let duration = '';
  if (result.startedAt && result.completedAt) {
    const diff = new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime();
    const s = Math.floor(diff / 1000);
    const m = Math.floor(s / 60);
    duration = ` in ${m}m ${(s % 60).toString().padStart(2, '0')}s`;
  }

  const isSuccess = result.status === 'complete';
  const color = isSuccess ? 'text-[var(--color-clean)]' : 'text-[var(--color-danger)]';
  const icon = isSuccess ? 'checkmark' : 'x';

  return (
    <div className="mb-3 flex items-center gap-2">
      <span className={`font-mono text-[12px] font-semibold ${color}`}>
        {icon === 'checkmark' ? '\u2713' : '\u2717'} {phase} {result.status}{duration}
      </span>
    </div>
  );
};

const PhaseOutputBlock = ({ output }: { output?: string }): React.JSX.Element => (
  <div className="max-h-[500px] overflow-auto whitespace-pre-wrap rounded-[var(--radius-md)] border border-border-subtle bg-bg-void p-4 font-mono text-[11px] leading-[1.7] text-text-secondary">
    {output ?? 'No output available.'}
  </div>
);

const PhasePendingMessage = ({ phase }: { phase: Phase }): React.JSX.Element => (
  <div className="flex flex-1 items-center justify-center">
    <span className="font-mono text-[11px] text-text-ghost">
      {phase} phase has not started yet
    </span>
  </div>
);

const PlanReferenceCollapsed = ({ output }: { output: string }): React.JSX.Element => {
  const [open, setOpen] = useState(false);
  const preview = output.slice(0, 200);

  return (
    <div className="shrink-0 border-b border-border-subtle bg-bg-surface px-5 py-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-1.5 bg-transparent p-0 text-left"
      >
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[1px] text-phase-plan">
          Plan output
        </span>
        <span className="font-mono text-[10px] text-text-ghost">{open ? '\u25BC' : '\u25B6'}</span>
      </button>
      {open ? (
        <div className="mt-2 max-h-[200px] overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-[1.6] text-text-tertiary">
          {output}
        </div>
      ) : (
        <div className="mt-1 truncate font-mono text-[10px] text-text-ghost">
          {preview}{output.length > 200 ? '...' : ''}
        </div>
      )}
    </div>
  );
};

/* ─── Run Summary (for complete/failed runs) ───────────────────────────────── */

const RunSummary = ({ run }: { run: PipelineRun }): React.JSX.Element => {
  const phases: Array<{ label: string; phase: Phase; color: string }> = [
    { label: 'Plan', phase: 'plan', color: 'text-phase-plan' },
    { label: 'Execute', phase: 'execute', color: 'text-phase-execute' },
    { label: 'Validate', phase: 'validate', color: 'text-phase-validate' },
  ];

  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="font-mono text-[12px] font-semibold text-text-primary">
        Run Summary: {run.config.name}
      </div>
      {phases.map(({ label, phase, color }) => {
        const result = run.phases[phase];
        if (!result) {
          return (
            <div key={phase} className="flex items-center gap-2 font-mono text-[11px] text-text-ghost">
              <span className={color}>{label}</span>
              <span>-- skipped</span>
            </div>
          );
        }
        return (
          <div key={phase} className="flex items-center gap-2 font-mono text-[11px]">
            <span className={color}>{label}</span>
            <span className={result.status === 'complete' || result.status === 'passed' ? 'text-[var(--color-clean)]' : result.status === 'failed' ? 'text-[var(--color-danger)]' : 'text-text-tertiary'}>
              {result.status}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/* ─── PipelineView ─────────────────────────────────────────────────────────── */

export const PipelineView = (): React.JSX.Element => {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const { runs, addRun, replaceRun, activeRunId, setActiveRun } = usePipelineStore();
  const addTerminalSession = useTerminalStore((s) => s.addSession);

  const [activePhase, setActivePhase] = useState<Phase>('plan');
  const [showNewRunForm, setShowNewRunForm] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Track cleanup function for pipeline updates
  const updateCleanupRef = useRef<(() => void) | null>(null);

  /* ── Load runs from IPC on mount / project change ──────────────────────── */

  const loadRuns = useCallback(async (): Promise<void> => {
    if (activeProjectId === null) return;
    if (!window.nexusAPI?.pipeline) return;

    setLoading(true);
    try {
      const fetched = await window.nexusAPI.pipeline.list(activeProjectId);
      for (const run of fetched) {
        addRun(run);
      }
      setLoadError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('NOT_IMPLEMENTED')) {
        setLoadError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, addRun]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  /* ── Determine displayed runs ──────────────────────────────────────────── */

  const resolvedActiveRunId: string | null =
    activeRunId ?? runs[0]?.id ?? null;

  const activeRun: PipelineRun | null =
    runs.find((r) => r.id === resolvedActiveRunId) ?? runs[0] ?? null;

  /* ── Subscribe to pipeline updates for active run ──────────────────────── */

  useEffect(() => {
    // Clean up previous subscription
    updateCleanupRef.current?.();
    updateCleanupRef.current = null;

    if (!activeRun?.id) return;
    if (!window.nexusAPI?.pipeline?.onUpdate) return;

    const cleanup = window.nexusAPI.pipeline.onUpdate(activeRun.id, (update: PipelineUpdate) => {
      if (update.run) {
        replaceRun(update.run);
      }
    });

    updateCleanupRef.current = cleanup;
    return cleanup;
  }, [activeRun?.id, replaceRun]);

  /* ── New-run handler ───────────────────────────────────────────────────── */

  const handleNewRun = async (config: PipelineConfig, autoStart: boolean): Promise<void> => {
    if (activeProjectId === null) return;
    if (!window.nexusAPI?.pipeline) {
      setShowNewRunForm(false);
      return;
    }

    const run = await window.nexusAPI.pipeline.create(activeProjectId, config);
    addRun(run);
    setActiveRun(run.id);
    setShowNewRunForm(false);
    setActivePhase('plan');

    if (autoStart) {
      await window.nexusAPI.pipeline.start(run.id, 'plan');
    }
  };

  /* ── Phase actions ─────────────────────────────────────────────────────── */

  const handleStartPhase = async (phase: Phase): Promise<void> => {
    if (!activeRun?.id) return;
    if (!window.nexusAPI?.pipeline) return;

    await window.nexusAPI.pipeline.start(activeRun.id, phase);
    setActivePhase(phase);

    // Register the terminal session from the phase result if available
    // The update subscription will handle state refresh
  };

  const handleAbort = async (): Promise<void> => {
    if (!activeRun?.id) return;
    if (!window.nexusAPI?.pipeline) return;

    await window.nexusAPI.pipeline.abort(activeRun.id);
  };

  const handleRunValidateStep = async (stepIndex: number): Promise<void> => {
    if (!activeRun?.id) return;
    if (!window.nexusAPI?.pipeline) return;

    await window.nexusAPI.pipeline.runValidateStep(activeRun.id, stepIndex);
  };

  /* ── Loading state ────────────────────────────────────────────────────── */

  if (loading && runs.length === 0) {
    return <PipelineLoading />;
  }

  /* ── Empty state ───────────────────────────────────────────────────────── */

  if (resolvedActiveRunId === null || activeRun === null) {
    return (
      <div className="flex h-full flex-col">
        {showNewRunForm && activeProjectId !== null ? (
          <div className="overflow-auto p-4">
            <NewRunForm
              onSubmit={handleNewRun}
              onCancel={() => setShowNewRunForm(false)}
              projectId={activeProjectId}
            />
          </div>
        ) : (
          <PipelineEmptyState onCreateRun={() => { setShowNewRunForm(true); }} />
        )}
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
        {showNewRunForm && activeProjectId !== null && (
          <div className="max-h-[60vh] overflow-auto">
            <NewRunForm
              onSubmit={async (config, autoStart) => { await handleNewRun(config, autoStart); }}
              onCancel={() => setShowNewRunForm(false)}
              projectId={activeProjectId}
            />
          </div>
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
          runs={runs}
        />
      </div>

      {/* Phase detail pane */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <PhaseHeader
          run={activeRun}
          activePhase={activePhase}
          onSelectPhase={setActivePhase}
          onStartPhase={(phase) => { void handleStartPhase(phase); }}
          onAbort={() => { void handleAbort(); }}
        />

        <PhaseDetail
          run={activeRun}
          activePhase={activePhase}
          onRunValidateStep={(idx) => { void handleRunValidateStep(idx); }}
          onStartPhase={(phase) => { void handleStartPhase(phase); }}
        />
      </div>
    </div>
  );
};
