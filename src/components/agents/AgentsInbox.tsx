import { useKanbanStore } from '@/stores/kanbanStore';
import type { KanbanCard } from '@/stores/kanbanStore';
import { PROVIDERS } from '@/components/shared/ProviderPicker';

interface Group {
  id: string;
  label: string;
  dotColor: string;
  filter: (c: KanbanCard) => boolean;
}

const GROUPS: Group[] = [
  { id: 'needs',  label: 'Needs your input', dotColor: 'var(--v2-amber)', filter: (c) => c.lane === 'review'                              },
  { id: 'live',   label: 'Running now',      dotColor: 'var(--v2-green)', filter: (c) => c.lane === 'executing'                           },
  { id: 'queued', label: 'Queued',           dotColor: 'var(--v2-blue)',  filter: (c) => c.lane === 'planning' || c.lane === 'backlog'     },
  { id: 'done',   label: 'Recently finished',dotColor: 'var(--v2-text-faint)', filter: (c) => c.lane === 'done'                          },
];

export const AgentsInbox = (): React.JSX.Element => {
  const cards = useKanbanStore((s) => s.cards);
  const move = useKanbanStore((s) => s.move);
  const removeCard = useKanbanStore((s) => s.removeCard);

  return (
    <div className="h-full overflow-y-auto bg-[var(--v2-bg0)] px-5 py-4">
      {GROUPS.map((group) => {
        const items = cards.filter(group.filter);
        if (items.length === 0) return null;
        return (
          <section key={group.id} className="mb-6">
            {/* Group header */}
            <div className="mb-2.5 flex items-center gap-2">
              <span
                style={{ background: group.dotColor }}
                className="h-2 w-2 rounded-full"
              />
              <span className="text-[11px] uppercase tracking-[0.8px] text-[var(--v2-text-dim)]">
                {group.label}
              </span>
              <span className="text-[10px] text-[var(--v2-text-faint)]">· {items.length}</span>
            </div>

            {/* Card grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {items.map((card) => {
                const provider = PROVIDERS.find((p) => p.id === card.provider) ?? PROVIDERS[0];
                return (
                  <div
                    key={card.id}
                    className="flex flex-col gap-2 rounded-lg border border-[var(--v2-border)] bg-[var(--v2-bg1)] p-3"
                  >
                    {/* Header */}
                    <div className="flex items-center gap-2">
                      <span
                        style={{ background: provider.tint, color: '#0e1115' }}
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold"
                      >
                        {provider.short}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium text-[var(--v2-text)]">{card.title}</p>
                        <p className="font-mono text-[10px] text-[var(--v2-text-faint)]">
                          {card.project} · {card.story}
                        </p>
                      </div>
                      <span
                        style={{ color: group.dotColor }}
                        className="flex-shrink-0 font-mono text-[10px]"
                      >
                        {card.age}
                      </span>
                    </div>

                    {/* Needs-input actions */}
                    {group.id === 'needs' && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => move(card.id, 'done')}
                          className="flex flex-1 items-center justify-center gap-1 rounded-md border border-[var(--v2-green)] px-2 py-1 text-[11px] text-[var(--v2-green)] hover:bg-[var(--v2-green)]/10 [-webkit-app-region:no-drag]"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => move(card.id, 'planning')}
                          className="flex flex-1 items-center justify-center gap-1 rounded-md border border-[var(--v2-amber)] px-2 py-1 text-[11px] text-[var(--v2-amber)] hover:bg-[var(--v2-amber)]/10 [-webkit-app-region:no-drag]"
                        >
                          ↻ Iterate
                        </button>
                        <button
                          onClick={() => removeCard(card.id)}
                          className="flex items-center justify-center rounded-md border border-[var(--v2-red)] px-2 py-1 text-[11px] text-[var(--v2-red)] hover:bg-[var(--v2-red)]/10 [-webkit-app-region:no-drag]"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {/* Live progress */}
                    {group.id === 'live' && (
                      <div>
                        <p className="mb-1 font-mono text-[10px] text-[var(--v2-text-dim)]">
                          {card.tokens.toLocaleString()} tok · {card.eta} remaining
                        </p>
                        <div className="h-1 overflow-hidden rounded-full bg-[var(--v2-bg3)]">
                          <div
                            style={{ background: provider.tint }}
                            className="h-full w-[70%]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};
