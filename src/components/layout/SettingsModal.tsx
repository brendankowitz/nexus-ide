import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { SettingsView } from '@/components/settings/SettingsView';

export const SettingsModal = (): React.JSX.Element | null => {
  const open = useUIStore((s) => s.settingsModalOpen);
  const setOpen = useUIStore((s) => s.setSettingsModalOpen);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center bg-black/60 backdrop-blur-[4px]"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-[680px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border-strong bg-bg-raised shadow-[0_24px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)]"
      >
        <SettingsView />
      </div>
    </div>
  );
};
