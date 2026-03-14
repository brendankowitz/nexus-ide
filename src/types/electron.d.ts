/**
 * src/types/electron.d.ts
 *
 * Global type augmentation so the renderer can access window.nexusAPI with
 * full TypeScript inference.
 *
 * The NexusAPI interface is the single source of truth defined in
 * src/types/index.ts and re-used in both the preload script and this
 * declaration.
 */

import type { NexusAPI } from './index.js';

declare global {
  interface Window {
    /** Nexus IPC bridge — populated by the preload contextBridge call. */
    readonly nexusAPI: NexusAPI;
  }
}

export {};
