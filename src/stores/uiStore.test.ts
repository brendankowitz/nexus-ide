import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from './uiStore';

beforeEach(() => {
  useUIStore.setState({
    activeMode: 'workbench',
    activeProvider: 'claude',
  } as any);
});

describe('activeMode', () => {
  it('defaults to workbench', () => {
    expect(useUIStore.getState().activeMode).toBe('workbench');
  });

  it('setActiveMode updates the mode', () => {
    useUIStore.getState().setActiveMode('kanban');
    expect(useUIStore.getState().activeMode).toBe('kanban');
  });

  it('setActiveMode accepts all four modes', () => {
    const modes = ['workbench', 'kanban', 'agents', 'review'] as const;
    for (const m of modes) {
      useUIStore.getState().setActiveMode(m);
      expect(useUIStore.getState().activeMode).toBe(m);
    }
  });
});

describe('activeProvider', () => {
  it('defaults to claude', () => {
    expect(useUIStore.getState().activeProvider).toBe('claude');
  });

  it('setActiveProvider updates the provider', () => {
    useUIStore.getState().setActiveProvider('copilot');
    expect(useUIStore.getState().activeProvider).toBe('copilot');
  });
});
