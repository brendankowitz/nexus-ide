interface ResizeHandleProps {
  onDelta: (dx: number) => void;
}

export const ResizeHandle = ({ onDelta }: ResizeHandleProps): React.JSX.Element => {
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Capture before React nullifies e.currentTarget after the handler returns
    const el = e.currentTarget;
    const pointerId = e.pointerId;
    let lastX = e.clientX;

    el.setPointerCapture(pointerId);

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - lastX;
      lastX = ev.clientX;
      onDelta(dx);
    };

    const onUp = () => {
      el.releasePointerCapture(pointerId);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      className="relative z-10 w-[4px] shrink-0 cursor-ew-resize bg-border-subtle transition-colors duration-[var(--duration-fast)] hover:bg-phase-execute active:bg-phase-execute"
      style={{ touchAction: 'none' }}
    />
  );
};
