import { useKanbanStore } from '@/stores/kanbanStore';
import { PROVIDERS } from '@/components/shared/ProviderPicker';

export const RunsStrip = (): React.JSX.Element => {
  const cards = useKanbanStore((s) => s.cards);
  const liveCards = cards.filter((c) => c.lane === 'executing' || c.lane === 'review');

  return (
    <div className="shrink-0 border-b border-[var(--v2-border)] bg-[var(--v2-bg1)] px-3.5 py-2.5">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-[0.8px] text-[var(--v2-text-faint)]">
          Active runs · {liveCards.length}
        </span>
        <div className="h-px flex-1 bg-[var(--v2-border-soft)]" />
        <span className="font-mono text-[10px] text-[var(--v2-text-faint)]">5min · 1hr · today</span>
      </div>

      {/* Scrollable cards */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {liveCards.map((card) => {
          const provider = PROVIDERS.find((p) => p.id === card.provider) ?? PROVIDERS[0];
          const isRunning = card.lane === 'executing';

          return (
            <div
              key={card.id}
              style={{ minWidth: 220, maxWidth: 240 }}
              className="flex-shrink-0 rounded-lg border border-[var(--v2-border)] bg-[var(--v2-bg2)] p-2.5"
            >
              {/* Provider chip + story + status badge */}
              <div className="mb-1.5 flex items-center gap-1.5">
                <span
                  style={{ background: provider.tint, color: '#0e1115' }}
                  className="rounded px-1 py-px font-mono text-[9px] font-bold"
                >
                  {provider.short}
                </span>
                <span className="font-mono text-[10px] text-[var(--v2-text-faint)]">{card.story}</span>
                <div className="ml-auto flex-shrink-0">
                  <span
                    style={{
                      background: isRunning ? 'rgba(95,180,122,.15)' : 'rgba(230,193,104,.15)',
                      color: isRunning ? 'var(--v2-green)' : 'var(--v2-yellow)',
                    }}
                    className="rounded px-1.5 py-px font-mono text-[9px]"
                  >
                    {isRunning ? 'running' : 'review'}
                  </span>
                </div>
              </div>

              {/* Title */}
              <p className="mb-2 line-clamp-2 text-[11.5px] leading-snug text-[var(--v2-text)]">
                {card.title}
              </p>

              {/* Footer */}
              <div className="flex items-center gap-2 font-mono text-[10px] text-[var(--v2-text-faint)]">
                <span className="min-w-0 truncate">{card.project}</span>
                <span className="ml-auto flex-shrink-0">{card.eta}</span>
              </div>

              {/* Progress bar */}
              {isRunning && (
                <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-[var(--v2-bg3)]">
                  <div
                    style={{ background: provider.tint }}
                    className="h-full w-[70%] animate-[kanbanPulse_2s_ease-in-out_infinite]"
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Placeholder when empty */}
        {liveCards.length === 0 && (
          <span className="text-[11px] text-[var(--v2-text-faint)] italic">No active runs.</span>
        )}
      </div>
    </div>
  );
};
