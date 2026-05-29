import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface MCDropdownOption {
  value: string;
  label: string;
  sub?: string;
  right?: ReactNode;
  disabled?: boolean;
}

interface MCDropdownProps {
  icon?: ReactNode;
  label: string;
  value: string;
  options: MCDropdownOption[];
  onChange: (value: string) => void;
  /** Minimum panel width; defaults to 300. */
  minWidth?: number;
}

/**
 * MCDropdown — Mission Control v2 styled dropdown with click-outside-close.
 * Trigger is a pill with icon + uppercase label + value. Panel pops down.
 */
export const MCDropdown = ({
  icon,
  label,
  value,
  options,
  onChange,
  minWidth = 300,
}: MCDropdownProps): React.JSX.Element => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent): void => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 cursor-pointer"
        style={{
          padding: '4px 8px 4px 10px',
          background: open ? 'var(--v2-bg3)' : 'var(--v2-bg2)',
          border: '1px solid var(--v2-border)',
          borderRadius: 6,
          color: 'var(--v2-text)',
          fontFamily: 'inherit',
          fontSize: 12,
        }}
      >
        {icon}
        <span
          style={{
            color: 'var(--v2-text-faint)',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
            fontSize: 12,
            maxWidth: 220,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ color: 'var(--v2-text-faint)', marginLeft: 2 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 20,
            minWidth,
            background: 'var(--v2-bg1)',
            border: '1px solid var(--v2-border)',
            borderRadius: 6,
            boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
            padding: 4,
            maxHeight: 360,
            overflowY: 'auto',
          }}
        >
          {options.length === 0 && (
            <div
              style={{
                padding: '8px',
                color: 'var(--v2-text-faint)',
                fontSize: 11,
                fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
              }}
            >
              No options
            </div>
          )}
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <div
                key={o.value}
                onClick={() => {
                  if (o.disabled === true) return;
                  onChange(o.value);
                  setOpen(false);
                }}
                onMouseEnter={(e) => {
                  if (!selected && o.disabled !== true) {
                    e.currentTarget.style.background = 'var(--v2-bg2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!selected) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  alignItems: 'center',
                  columnGap: 8,
                  padding: '6px 8px',
                  borderRadius: 4,
                  cursor: o.disabled === true ? 'not-allowed' : 'pointer',
                  background: selected ? 'var(--v2-bg3)' : 'transparent',
                  color: selected ? 'var(--v2-text)' : 'var(--v2-text-dim)',
                  opacity: o.disabled === true ? 0.5 : 1,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily:
                        'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                      fontSize: 12,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {o.label}
                  </div>
                  {o.sub !== undefined && (
                    <div
                      style={{
                        fontFamily:
                          'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                        fontSize: 10.5,
                        color: 'var(--v2-text-faint)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {o.sub}
                    </div>
                  )}
                </div>
                {o.right}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
