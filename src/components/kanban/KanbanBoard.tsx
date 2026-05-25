import { useState, useEffect } from 'react';
import { useKanbanStore } from '@/stores/kanbanStore';
import type { KanbanLane } from '@/stores/kanbanStore';
import { KanbanLane as KanbanLaneCmp } from './KanbanLane';
import { RunsStrip } from './RunsStrip';
import { DispatchPanel } from './DispatchPanel';

const LANES: KanbanLane[] = ['backlog', 'planning', 'executing', 'review', 'done'];

export const KanbanBoard = (): React.JSX.Element => {
  const cards = useKanbanStore((s) => s.cards);
  const cardsForLane = useKanbanStore((s) => s.cardsForLane);
  const move = useKanbanStore((s) => s.move);
  const seedCards = useKanbanStore((s) => s.seedCards);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dispatchLane, setDispatchLane] = useState<KanbanLane | null>(null);
  const [dispatchCardId, setDispatchCardId] = useState<string | undefined>(undefined);
  const [dispatchInitialTitle, setDispatchInitialTitle] = useState('');

  // Seed once on mount if the store is empty
  useEffect(() => {
    if (cards.length === 0) seedCards();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrop = (lane: KanbanLane) => {
    if (draggingId) move(draggingId, lane);
    setDraggingId(null);
  };

  const openDispatch = (lane: KanbanLane, cardId?: string, title = '') => {
    setDispatchLane(lane);
    setDispatchCardId(cardId);
    setDispatchInitialTitle(title);
  };

  const closeDispatch = () => {
    setDispatchLane(null);
    setDispatchCardId(undefined);
    setDispatchInitialTitle('');
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[var(--v2-bg0)]">
      <RunsStrip />
      <div className="flex min-h-0 flex-1 gap-2.5 overflow-hidden p-3">
        {LANES.map((lane) => (
          <KanbanLaneCmp
            key={lane}
            id={lane}
            cards={cardsForLane(lane)}
            draggingId={draggingId}
            onDragStart={(id) => setDraggingId(id)}
            onDragEnd={() => setDraggingId(null)}
            onDrop={handleDrop}
            onAdd={() => openDispatch(lane)}
            onCardDispatch={(cardId, title) => openDispatch(lane, cardId, title)}
          />
        ))}
      </div>

      {dispatchLane !== null && (
        <DispatchPanel
          lane={dispatchLane}
          existingCardId={dispatchCardId}
          initialTitle={dispatchInitialTitle}
          onClose={closeDispatch}
        />
      )}
    </div>
  );
};
