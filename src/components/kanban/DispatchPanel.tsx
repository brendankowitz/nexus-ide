import { useState } from 'react';
import { useProjectStore, selectActiveProject } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { useKanbanStore } from '@/stores/kanbanStore';
import { PROVIDERS } from '@/components/shared/ProviderPicker';
import { PROVIDER_PLUGIN_MAP } from '@/lib/providerPlugins';
import type { KanbanLane } from '@/stores/kanbanStore';
import type { PipelineConfig, PipelineUpdate } from '@/types';

interface DispatchPanelProps {
  /** The lane the "+" was clicked in (used to seed a new card). */
  lane: KanbanLane;
  /** If promoting an existing card, its id. Undefined means create a new card. */
  existingCardId?: string;
  /** Pre-filled prompt text (card title when promoting). */
  initialTitle?: string;
  onClose: () => void;
}

export const DispatchPanel = ({
  lane: _lane,
  existingCardId,
  initialTitle = '',
  onClose,
}: DispatchPanelProps): React.JSX.Element => {
  const [prompt, setPrompt] = useState(initialTitle);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeProject = useProjectStore(selectActiveProject);
  const activeProvider = useUIStore((s) => s.activeProvider);
  const { addCard, linkRun, setCardError, move } = useKanbanStore();

  const provider = PROVIDERS.find((p) => p.id === activeProvider) ?? PROVIDERS[0];

  const handleSubmit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || activeProject === null) return;

    const pluginId = PROVIDER_PLUGIN_MAP[activeProvider];
    if (pluginId === undefined) {
      setErrorMsg(`"${provider.label}" is not configured. Select Claude Code or Copilot CLI.`);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    // Create a new card if not promoting an existing one
    const cardId = existingCardId ?? crypto.randomUUID();
    if (existingCardId === undefined) {
      addCard({
        id: cardId,
        lane: 'planning',
        title: trimmed.slice(0, 80),
        project: activeProject.name,
        projectId: activeProject.id,
        provider: activeProvider,
        story: '',
        tokens: 0,
        eta: '—',
        age: '0m',
      });
    }

    const config: PipelineConfig = {
      name: trimmed.slice(0, 80),
      projectId: activeProject.id,
      branch: 'main',
      plan: { pluginId: 'manual' },
      execute: { pluginId, config: { prompt: trimmed } },
      validate: { chain: [] as PipelineConfig['validate']['chain'] },
    };

    try {
      const run = await window.nexusAPI.pipeline.create(activeProject.id, config);

      // Subscribe BEFORE start() so we never miss events
      const capturedCardId = cardId;
      const unsub = window.nexusAPI.pipeline.onUpdate(run.id, (update: PipelineUpdate) => {
        try {
          if (update.type === 'phase-start' && update.phase === 'execute') {
            const sid = update.result?.terminalSessionId;
            if (sid) {
              linkRun(capturedCardId, run.id, sid);
            } else {
              console.warn('[DispatchPanel] phase-start received without terminalSessionId', { runId: run.id, cardId: capturedCardId });
            }
          }
          if (update.type === 'complete') {
            move(capturedCardId, 'review');
            unsub();
          }
          if (update.type === 'error') {
            setCardError(capturedCardId, update.data ?? 'Agent failed');
            move(capturedCardId, 'review');
            unsub();
          }
        } catch (callbackErr) {
          console.error('[DispatchPanel] pipeline update handler threw', callbackErr, { runId: run.id, cardId: capturedCardId });
          unsub();
        }
      });

      await window.nexusAPI.pipeline.start(run.id, 'execute');

      // Link card to run (sessionId may arrive later via phase-start onUpdate)
      linkRun(cardId, run.id, run.phases.execute?.terminalSessionId ?? '');
      move(cardId, 'executing');

      setLoading(false);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[DispatchPanel] dispatch failed', { cardId, projectId: activeProject?.id }, err);
      setCardError(cardId, msg);
      if (existingCardId === undefined) {
        move(cardId, 'review');
      }
      setErrorMsg(msg);
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-50 border-t border-[var(--v2-border)] bg-[var(--v2-bg1)] p-4 shadow-2xl">
      <div className="mx-auto max-w-xl">
        {/* Header */}
        <div className="mb-3 flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wide text-[var(--v2-text-faint)]">
            Dispatch task
          </span>
          <span
            style={{ background: provider.tint, color: '#0e1115' }}
            className="rounded px-1.5 py-px font-mono text-[10px] font-bold"
          >
            {provider.short}
          </span>
          <button
            onClick={onClose}
            className="ml-auto font-mono text-[14px] text-[var(--v2-text-faint)] hover:text-[var(--v2-text)] [-webkit-app-region:no-drag]"
          >
            ✕
          </button>
        </div>

        {/* Prompt input */}
        <textarea
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the task for the agent…"
          rows={3}
          className="w-full resize-none rounded-md border border-[var(--v2-border)] bg-[var(--v2-bg2)] p-2.5 font-mono text-[12px] text-[var(--v2-text)] placeholder:text-[var(--v2-text-faint)] focus:border-[var(--v2-amber)] focus:outline-none [-webkit-app-region:no-drag]"
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSubmit();
          }}
        />

        {/* Warnings */}
        {activeProject === null && (
          <p className="mt-1.5 font-mono text-[10px] text-[var(--v2-red)]">
            No active project — select one in the rail first.
          </p>
        )}
        {errorMsg !== null && (
          <p className="mt-1.5 font-mono text-[10px] text-[var(--v2-red)]">{errorMsg}</p>
        )}

        {/* Footer */}
        <div className="mt-2.5 flex items-center justify-between">
          <span className="font-mono text-[10px] text-[var(--v2-text-faint)]">
            {activeProject?.name ?? '—'} · ⌘↵ to dispatch
          </span>
          <button
            onClick={() => void handleSubmit()}
            disabled={loading || !prompt.trim() || activeProject === null}
            style={{ background: provider.tint }}
            className="rounded-md px-4 py-1.5 font-mono text-[11px] font-bold text-[#0e1115] transition-opacity disabled:opacity-40 [-webkit-app-region:no-drag]"
          >
            {loading ? 'dispatching…' : 'Dispatch →'}
          </button>
        </div>
      </div>
    </div>
  );
};
