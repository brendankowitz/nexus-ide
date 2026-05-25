import type { ProviderId } from '@/stores/kanbanStore';

export const PROVIDER_PLUGIN_MAP: Partial<Record<ProviderId, string>> = {
  claude:  'fn-task',
  copilot: 'copilot-cli',
};
