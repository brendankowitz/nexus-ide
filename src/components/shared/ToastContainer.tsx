import { useToastStore } from '@/stores/toastStore';

const borderColorMap: Record<'error' | 'success' | 'info', string> = {
  error: 'var(--color-danger)',
  success: 'var(--phase-execute)',
  info: 'var(--phase-plan)',
};

export const ToastContainer = (): React.JSX.Element | null => {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" style={{ maxWidth: 400 }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-start gap-3 rounded-lg border border-border-default bg-bg-surface px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-[slideInRight_150ms_var(--ease-out)]"
          style={{ borderLeftWidth: 4, borderLeftColor: borderColorMap[toast.type] }}
        >
          <span className="min-w-0 flex-1 font-mono text-[11px] leading-relaxed text-text-primary">
            {toast.message}
          </span>
          <button
            onClick={() => { removeToast(toast.id); }}
            className="mt-px shrink-0 cursor-pointer font-mono text-[11px] text-text-tertiary transition-colors duration-[var(--duration-fast)] hover:text-text-secondary"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};
