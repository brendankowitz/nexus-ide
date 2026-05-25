import { describe, it, expect, beforeEach } from 'vitest';
import { useKanbanStore, KanbanCard } from './kanbanStore';

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

const makeCard = (id: string, lane: KanbanCard['lane'] = 'backlog'): KanbanCard => ({
  id,
  lane,
  title: 'Test task',
  project: 'my-project',
  projectId: 'proj-1',
  provider: 'claude',
  story: 'S-1',
  tokens: 0,
  eta: '—',
  age: '0m',
});

describe('addCard', () => {
  it('appends a card to the store', () => {
    useKanbanStore.getState().addCard(makeCard('c1'));
    expect(useKanbanStore.getState().cards).toHaveLength(1);
    expect(useKanbanStore.getState().cards[0].id).toBe('c1');
  });
});

describe('linkRun', () => {
  it('sets runId and sessionId on a card', () => {
    useKanbanStore.getState().addCard(makeCard('c2'));
    useKanbanStore.getState().linkRun('c2', 'run-99', 'sess-99');
    const card = useKanbanStore.getState().cards.find((c) => c.id === 'c2');
    expect(card?.runId).toBe('run-99');
    expect(card?.sessionId).toBe('sess-99');
  });

  it('does not affect other cards', () => {
    useKanbanStore.getState().addCard(makeCard('c3'));
    useKanbanStore.getState().addCard(makeCard('c4'));
    useKanbanStore.getState().linkRun('c3', 'run-99', 'sess-99');
    const other = useKanbanStore.getState().cards.find((c) => c.id === 'c4');
    expect(other?.runId).toBeUndefined();
  });
});

describe('setCardError', () => {
  it('stores the error message on a card', () => {
    useKanbanStore.getState().addCard(makeCard('c5'));
    useKanbanStore.getState().setCardError('c5', 'provider not configured');
    const card = useKanbanStore.getState().cards.find((c) => c.id === 'c5');
    expect(card?.error).toBe('provider not configured');
  });
});

describe('removeCard', () => {
  it('removes the card from the store', () => {
    useKanbanStore.getState().addCard(makeCard('c6'));
    useKanbanStore.getState().removeCard('c6');
    expect(useKanbanStore.getState().cards.find((c) => c.id === 'c6')).toBeUndefined();
  });

  it('does not remove other cards', () => {
    useKanbanStore.getState().addCard(makeCard('c7'));
    useKanbanStore.getState().addCard(makeCard('c8'));
    useKanbanStore.getState().removeCard('c7');
    expect(useKanbanStore.getState().cards.find((c) => c.id === 'c8')).toBeDefined();
  });
});
