/**
 * Safe accessor for window.nexusAPI.
 * Returns the real API when running in Electron with the preload bridge,
 * or undefined when running in a plain browser (dev/test without Electron).
 */
export function getNexusAPI() {
  return typeof window !== 'undefined' ? window.nexusAPI : undefined;
}

/** Returns true when the Electron preload bridge is available. */
export function hasNexusAPI(): boolean {
  return typeof window !== 'undefined' && window.nexusAPI !== undefined;
}
