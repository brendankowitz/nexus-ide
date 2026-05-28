import { useEffect, useState } from 'react';
import { useProjectStore, selectActiveProject } from '@/stores/projectStore';
import { useTerminalStore } from '@/stores/terminalStore';

export const StatusBar = (): React.JSX.Element => {
  const [cpu, setCpu] = useState(14);

  useEffect(() => {
    const id = setInterval(() => setCpu(11 + Math.floor(Math.random() * 9)), 1100);
    return () => clearInterval(id);
  }, []);

  const activeProject = useProjectStore(selectActiveProject);
  const gitStatus = useProjectStore((s) =>
    s.activeProjectId !== null ? (s.gitStatus[s.activeProjectId] ?? null) : null
  );
  const sessions = useTerminalStore((s) => s.sessions);
  const running = sessions.filter((s) => s.status === 'running').length;

  const branch = gitStatus?.branch ?? 'main';
  const name = activeProject?.name ?? '—';

  return (
    <div
      className="flex h-[26px] shrink-0 items-center gap-3.5 border-t border-[var(--v2-border)] bg-[var(--v2-bg1)] px-3 font-mono text-[11px] text-[var(--v2-text-faint)]"
    >
      <span>{name}</span>
      <span>·</span>
      <span>{branch}</span>
      <span>·</span>
      <span style={{ color: running > 0 ? 'var(--v2-green)' : 'var(--v2-text-faint)' }}>
        {running > 0 ? 'LIVE' : 'IDLE'}
      </span>
      <span>·</span>
      <span>{running} agent{running !== 1 ? 's' : ''} · cpu {cpu}%</span>
      <div className="flex-1" />
    </div>
  );
};
