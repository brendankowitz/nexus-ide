import '@/styles/globals.css';
import { TitleBar } from '@/components/layout/TitleBar';
import { Shell } from '@/components/layout/Shell';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { ToastContainer } from '@/components/shared/ToastContainer';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useWatcher } from '@/hooks/useWatcher';

export const App = (): React.JSX.Element => {
  useKeyboardShortcuts();
  useWatcher();

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg-base text-text-primary">
      <TitleBar />
      <Shell />
      <CommandPalette />
      <ToastContainer />
    </div>
  );
};
