import { describe, it, expect, beforeEach } from 'vitest';
import { useKanbanStore } from './kanbanStore';

beforeEach(() => {
  useKanbanStore.setState({ cards: [] });
});

describe('kanbanStore', () => {
  it('starts empty after reset', () => {
    expect(useKanbanStore.getState().cards).toHaveLength(0);
  });

  it('seedCards populates the store', () => {
    useKanbanStore.getState().seedCards();
    expect(useKanbanStore.getState().cards.length).toBeGreaterThan(0);
  });

  it('move changes the card lane', () => {
    useKanbanStore.getState().seedCards();
    const first = useKanbanStore.getState().cards[0];
    useKanbanStore.getState().move(first.id, 'done');
    const updated = useKanbanStore.getState().cards.find((c) => c.id === first.id);
    expect(updated?.lane).toBe('done');
  });

  it('move does not affect other cards', () => {
    useKanbanStore.getState().seedCards();
    const [first, second] = useKanbanStore.getState().cards;
    useKanbanStore.getState().move(first.id, 'done');
    const s = useKanbanStore.getState().cards.find((c) => c.id === second.id);
    expect(s?.lane).toBe(second.lane);
  });

  it('cardsForLane returns only cards in that lane', () => {
    useKanbanStore.getState().seedCards();
    const executing = useKanbanStore.getState().cardsForLane('executing');
    expect(executing.every((c) => c.lane === 'executing')).toBe(true);
  });

  it('liveCards returns executing + review cards only', () => {
    useKanbanStore.getState().seedCards();
    const live = useKanbanStore.getState().liveCards();
    expect(live.every((c) => c.lane === 'executing' || c.lane === 'review')).toBe(true);
  });
});
