import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import type { ProviderId } from '@/stores/uiStore';

const PROVIDERS: { id: ProviderId; short: string; label: string; tint: string }[] = [
  { id: 'claude',  short: 'CC', label: 'Claude Code',  tint: '#d97757' },
  { id: 'copilot', short: 'GH', label: 'Copilot CLI',  tint: '#7c8cff' },
  { id: 'codex',   short: 'CX', label: 'Codex',        tint: '#10a37f' },
  { id: 'gemini',  short: 'GM', label: 'Gemini',       tint: '#4a90ff' },
  { id: 'custom',  short: '··', label: 'Custom CLI',   tint: '#9aa0a8' },
];

export { PROVIDERS };

interface ProviderPickerProps {
  className?: string;
}

export const ProviderPicker = ({ className }: ProviderPickerProps): React.JSX.Element => {
  const activeProvider = useUIStore((s) => s.activeProvider);
  const setActiveProvider = useUIStore((s) => s.setActiveProvider);

  // Load persisted provider on first mount
  useEffect(() => {
    window.nexusAPI.settings.get().then((s) => {
      const saved = s['ui.activeProvider'] as ProviderId | undefined;
      if (saved !== undefined) setActiveProvider(saved);
    }).catch((err: unknown) => {
      // In tests/preload window.nexusAPI is not wired — safe to ignore.
      // In production this means the provider preference was not restored.
      console.warn('[ProviderPicker] settings.get() failed — provider preference not restored', err);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (id: ProviderId) => {
    setActiveProvider(id);
    window.nexusAPI.settings.set({ 'ui.activeProvider': id }).catch((err: unknown) => {
      console.warn('[ProviderPicker] settings.set() failed — provider preference not persisted', err);
    });
  };

  return (
    <div
      className={`flex gap-0.5 rounded-md border border-[var(--v2-border)] bg-[var(--v2-bg2)] p-0.5 ${className ?? ''}`}
    >
      {PROVIDERS.map((p) => {
        const active = p.id === activeProvider;
        return (
          <button
            key={p.id}
            title={p.label}
            onClick={() => handleSelect(p.id)}
            style={active ? { background: p.tint, color: '#0e1115' } : undefined}
            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold transition-colors duration-100 [-webkit-app-region:no-drag] ${
              active
                ? 'shadow-[inset_0_-1px_0_rgba(0,0,0,.18)]'
                : 'text-[var(--v2-text-faint)] hover:text-[var(--v2-text-dim)]'
            }`}
          >
            {p.short}
          </button>
        );
      })}
    </div>
  );
};
