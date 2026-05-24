import type { KanbanCard, KanbanLane as LaneId } from '@/stores/kanbanStore';
import { KanbanCard as KanbanCardCmp } from './KanbanCard';

const LANE_META: Record<LaneId, { label: string; dotColor: string }> = {
  backlog:   { label: 'Backlog',   dotColor: 'var(--v2-text-faint)' },
  planning:  { label: 'Planning',  dotColor: 'var(--v2-blue)'       },
  executing: { label: 'Executing', dotColor: 'var(--v2-amber)'      },
  review:    { label: 'Review',    dotColor: 'var(--v2-yellow)'     },
  done:      { label: 'Done',      dotColor: 'var(--v2-green)'      },
};

interface KanbanLaneProps {
  id: LaneId;
  cards: KanbanCard[];
  draggingId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (lane: LaneId) => void;
}

export const KanbanLane = ({
  id,
  cards,
  draggingId,
  onDragStart,
  onDragEnd,
  onDrop,
}: KanbanLaneProps): React.JSX.Element => {
  const meta = LANE_META[id];

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--v2-border-soft)] bg-[var(--v2-bg1)]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDrop(id)}
    >
      {/* Lane header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--v2-border-soft)] px-2.5 py-2">
        <span
          style={{ background: meta.dotColor }}
          className="h-1.5 w-1.5 rounded-full"
        />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--v2-text)]">
          {meta.label}
        </span>
        <span className="font-mono text-[10px] text-[var(--v2-text-faint)]">{cards.length}</span>
      </div>

      {/* Scrollable card list */}
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-1.5">
        {cards.map((card) => (
          <KanbanCardCmp
            key={card.id}
            card={card}
            dragging={draggingId === card.id}
            onDragStart={() => onDragStart(card.id)}
            onDragEnd={onDragEnd}
          />
        ))}
        {cards.length === 0 && (
          <div className="rounded-md border border-dashed border-[var(--v2-border)] p-4 text-center text-[11px] text-[var(--v2-text-faint)]">
            drop a task here
          </div>
        )}
      </div>
    </div>
  );
};
