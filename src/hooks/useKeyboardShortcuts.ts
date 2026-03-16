import { useEffect } from 'react';
import { useUIStore, type SCTab } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

const isMac = typeof navigator !== 'undefined'
  ? navigator.platform.toLowerCase().includes('mac')
  : false;

/**
 * Returns true when the "primary modifier" key is held:
 * - macOS: Meta (Cmd)
 * - Windows/Linux: Ctrl
 */
function isPrimaryModifier(event: KeyboardEvent): boolean {
  return isMac ? event.metaKey : event.ctrlKey;
}

// ---------------------------------------------------------------------------
// Tab key mapping
// ---------------------------------------------------------------------------

const TAB_KEY_MAP: Record<string, SCTab> = {
  b: 'branches',
  d: 'diffs',
  l: 'log',
} as const;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Registers global keyboard shortcuts for Nexus IDE.
 *
 * Shortcuts:
 *   Ctrl/Cmd + K         → toggle command palette
 *   Ctrl/Cmd + B         → switch to Branches tab
 *   Ctrl/Cmd + D         → switch to Diffs tab
 *   Ctrl/Cmd + L         → switch to Log tab
 *   Ctrl/Cmd + ,         → open Settings modal
 *   Ctrl/Cmd + 1-9       → switch to project by index (1-based)
 */
export function useKeyboardShortcuts(): void {
  const { toggleCommandPalette, setActiveTab, setLastKeyPressed, setSettingsModalOpen } = useUIStore();
  const projects = useProjectStore((s) => s.projects);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (!isPrimaryModifier(event)) return;

      const key = event.key.toLowerCase();

      // Ctrl/Cmd + K — command palette
      if (key === 'k') {
        event.preventDefault();
        setLastKeyPressed('k');
        toggleCommandPalette();
        return;
      }

      // Ctrl/Cmd + , — settings modal
      if (key === ',') {
        event.preventDefault();
        setLastKeyPressed(',');
        setSettingsModalOpen(true);
        return;
      }

      // Ctrl/Cmd + B/D/L — SC tab switch
      const tab = TAB_KEY_MAP[key];
      if (tab !== undefined) {
        event.preventDefault();
        setLastKeyPressed(key);
        setActiveTab(tab);
        return;
      }

      // Ctrl/Cmd + 1-9 — project switch
      const digit = parseInt(key, 10);
      if (!isNaN(digit) && digit >= 1 && digit <= 9) {
        event.preventDefault();
        setLastKeyPressed(key);
        const project = projects[digit - 1];
        if (project !== undefined) {
          setActiveProject(project.id);
        }
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    toggleCommandPalette,
    setActiveTab,
    setLastKeyPressed,
    setSettingsModalOpen,
    projects,
    setActiveProject,
  ]);
}
