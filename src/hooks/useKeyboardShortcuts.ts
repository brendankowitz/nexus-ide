import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import type { MainTab } from '@/stores/uiStore';

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

const TAB_KEY_MAP: Record<string, MainTab> = {
  b: 'branches',
  w: 'worktrees',
  d: 'diffs',
  l: 'log',
  p: 'pipeline',
} as const;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Registers global keyboard shortcuts for Nexus IDE.
 *
 * Shortcuts:
 *   Ctrl/Cmd + K         → toggle command palette
 *   Ctrl/Cmd + `         → toggle agent panel
 *   Ctrl/Cmd + B         → switch to Branches tab
 *   Ctrl/Cmd + W         → switch to Worktrees tab
 *   Ctrl/Cmd + D         → switch to Diffs tab
 *   Ctrl/Cmd + L         → switch to Log tab
 *   Ctrl/Cmd + P         → switch to Pipeline tab
 *   Ctrl/Cmd + ,         → open Settings
 *   Ctrl/Cmd + 1-9       → switch to project by index (1-based)
 */
export function useKeyboardShortcuts(): void {
  const { toggleCommandPalette, toggleAgentPanel, setActiveTab, setLastKeyPressed } = useUIStore();
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

      // Ctrl/Cmd + ` — agent panel
      if (key === '`') {
        event.preventDefault();
        setLastKeyPressed('`');
        toggleAgentPanel();
        return;
      }

      // Ctrl/Cmd + , — settings
      if (key === ',') {
        event.preventDefault();
        setLastKeyPressed(',');
        setActiveTab('settings');
        return;
      }

      // Ctrl/Cmd + B/W/D/L/P — tab switch
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
    toggleAgentPanel,
    setActiveTab,
    setLastKeyPressed,
    projects,
    setActiveProject,
  ]);
}
