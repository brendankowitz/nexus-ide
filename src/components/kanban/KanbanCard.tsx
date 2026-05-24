import type { KanbanCard as KanbanCardType } from '@/stores/kanbanStore';
import { PROVIDERS } from '@/components/shared/ProviderPicker';

interface KanbanCardProps {
  card: KanbanCardType;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export const KanbanCard = ({
  card,
  dragging,
  onDragStart,
  onDragEnd,
}: KanbanCardProps): React.JSX.Element => {
  const provider = PROVIDERS.find((p) => p.id === card.provider) ?? PROVIDERS[0];
  const isExecuting = card.lane === 'executing';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{ borderLeftColor: provider.tint, opacity: dragging ? 0.4 : 1 }}
      className="relative cursor-grab rounded-md border border-[var(--v2-border)] border-l-2 bg-[var(--v2-bg2)] p-2.5 select-none"
    >
      {/* Header row: story ID + provider chip */}
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="font-mono text-[9.5px] text-[var(--v2-text-faint)]">{card.story}</span>
        <div className="ml-auto flex-shrink-0">
          <span
            style={{ background: provider.tint, color: '#0e1115' }}
            className="rounded px-1 py-px font-mono text-[9.5px] font-bold"
          >
            {provider.short}
          </span>
        </div>
      </div>

      {/* Title */}
      <p className="mb-2 line-clamp-2 text-[12px] leading-snug text-[var(--v2-text)]">
        {card.title}
      </p>

      {/* Footer */}
      <div className="flex items-center gap-2 font-mono text-[10px] text-[var(--v2-text-faint)]">
        <span className="min-w-0 truncate">{card.project}</span>
        <span className="ml-auto flex-shrink-0">{card.tokens > 0 ? `${(card.tokens / 1000).toFixed(0)}k` : ''}</span>
        <span className="flex-shrink-0">{card.eta}</span>
      </div>

      {/* Executing progress bar */}
      {isExecuting && (
        <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-[var(--v2-bg3)]">
          <div
            style={{ background: provider.tint }}
            className="h-full w-[70%] animate-[kanbanPulse_2.4s_ease-in-out_infinite]"
          />
        </div>
      )}
    </div>
  );
};
