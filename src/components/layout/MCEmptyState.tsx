import { useState, useRef, useEffect } from 'react';
import { useProjectStore, selectActiveStatus, selectActiveWorktrees } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { PROVIDERS } from '@/components/shared/ProviderPicker';
import type { ProviderId } from '@/stores/uiStore';
import type { Project } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LaunchOption {
  label: string;
  command?: string;
  args?: string[];
  worktreePath?: string;
}

interface MCEmptyStateProps {
  project: Project;
  onLaunch: (option: LaunchOption) => void;
}

// ── Design tokens (inline to avoid coupling) ──────────────────────────────────

const PROVIDER_COMMANDS: Record<ProviderId, string | undefined> = {
  claude:  'claude',
  copilot: 'copilot',
  codex:   'codex',
  gemini:  'gemini',
  custom:  undefined,
};

const STARTERS = [
  'Fix a bug',
  'Add a feature',
  'Write tests',
  'Investigate',
  'Refactor',
  'Document',
];

const EXAMPLES = [
  { tag: 'feature', title: 'Add streaming responses', body: 'Implement streaming for the /chat endpoint with backpressure and a 30s timeout.' },
  { tag: 'test',    title: 'Write integration tests', body: 'Cover the happy path and error cases for the auth middleware.' },
  { tag: 'refactor', title: 'Extract shared utilities', body: 'Move duplicated helper functions into a shared module with proper exports.' },
  { tag: 'bug',     title: 'Fix flaky retry logic', body: 'The exponential backoff resets on 429s — investigate and harden it.' },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '22px 0 10px' }}>
      <span
        style={{
          fontSize: 10.5,
          color: 'var(--v2-text-faint)',
          textTransform: 'uppercase',
          letterSpacing: '0.7px',
          fontFamily: 'var(--font-mono, ui-monospace, monospace)',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--v2-border-soft)' }} />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export const MCEmptyState = ({ project, onLaunch }: MCEmptyStateProps): React.JSX.Element => {
  const gitStatus = useProjectStore(selectActiveStatus);
  const worktrees = useProjectStore(selectActiveWorktrees);
  const activeWorktreePath = useProjectStore((s) => s.activeWorktreePath);
  const activeProvider = useUIStore((s) => s.activeProvider);
  const setActiveProvider = useUIStore((s) => s.setActiveProvider);

  const [task, setTask] = useState('');
  const [selectedWorktree, setSelectedWorktree] = useState<string>(
    activeWorktreePath ?? project.path,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep worktree selection in sync when store changes
  useEffect(() => {
    setSelectedWorktree(activeWorktreePath ?? project.path);
  }, [activeWorktreePath, project.path]);

  const branch = gitStatus !== null
    ? gitStatus.branch.replace(/^refs\/heads\//, '')
    : '—';
  const dirtyCount = gitStatus?.changeCount ?? 0;

  const handleStart = (prefill?: string): void => {
    const text = prefill ?? task;
    const provider = PROVIDERS.find((p) => p.id === activeProvider) ?? PROVIDERS[0]!;
    const command = PROVIDER_COMMANDS[provider.id];
    const args = text.trim() ? ['-p', text.trim()] : [];
    onLaunch({
      label: provider.label,
      command,
      args,
      worktreePath: selectedWorktree,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleStart();
    }
  };

  const provider = PROVIDERS.find((p) => p.id === activeProvider) ?? PROVIDERS[0]!;
  const mainWorktree = worktrees.find((w) => w.isMainWorktree);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--v2-bg0)' }}>
      {/* Header */}
      <div
        style={{
          padding: '10px 22px',
          borderBottom: '1px solid var(--v2-border-soft)',
          background: 'var(--v2-bg1)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            width: 8, height: 8, borderRadius: 4, flexShrink: 0,
            background: 'var(--v2-text-faint)',
            boxShadow: '0 0 0 3px var(--v2-bg2)',
          }}
        />
        <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--v2-text)' }}>
          No sessions yet for this project
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--v2-text-faint)',
            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
          }}
        >
          {project.name} · {branch}
          {dirtyCount > 0 && (
            <span style={{ color: 'var(--v2-yellow)', marginLeft: 6 }}>●{dirtyCount}</span>
          )}
          {' · ready when you are'}
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => { void window.nexusAPI?.shell?.openFile(`${project.path}/CLAUDE.md`); }}
          style={ghostBtn}
        >
          <DocIcon /> Open CLAUDE.md
        </button>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '8px 22px 40px' }}>

        {/* Composer */}
        <div style={{ marginTop: 18 }}>
          <div
            style={{
              background: 'var(--v2-bg1)',
              border: '1px solid var(--v2-amber-dim, #8b4a2a)',
              borderRadius: 8,
              boxShadow: '0 0 0 4px rgba(217,119,87,0.06)',
              overflow: 'hidden',
            }}
          >
            {/* Composer header */}
            <div
              style={{
                padding: '7px 12px',
                borderBottom: '1px solid var(--v2-border-soft)',
                background: 'var(--v2-bg2)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--v2-text-dim)' }}>
                Start a run
              </span>
              <span style={{ fontSize: 11, color: 'var(--v2-text-faint)', fontFamily: 'var(--font-mono, monospace)' }}>
                · {project.name} · {branch}
              </span>
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={task}
              onChange={(e) => { setTask(e.target.value); }}
              onKeyDown={handleKeyDown}
              placeholder={"Describe what you want to do — e.g. 'Add streaming responses to the /chat endpoint, with backpressure and a 30s timeout.'"}
              style={{
                width: '100%',
                minHeight: 110,
                padding: '12px 14px',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontSize: 13.5,
                lineHeight: 1.55,
                color: 'var(--v2-text)',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />

            {/* Footer controls */}
            <div
              style={{
                padding: '8px 10px',
                borderTop: '1px solid var(--v2-border-soft)',
                background: 'var(--v2-bg1)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              {/* Provider picker */}
              <div style={{ display: 'flex', gap: 2, background: 'var(--v2-bg2)', border: '1px solid var(--v2-border)', borderRadius: 6, padding: 2 }}>
                {PROVIDERS.filter((p) => p.id !== 'custom').map((p) => {
                  const active = p.id === activeProvider;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setActiveProvider(p.id); }}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 10.5,
                        fontFamily: 'var(--font-mono, monospace)',
                        fontWeight: 600,
                        background: active ? provider.tint : 'transparent',
                        color: active ? '#0e1115' : 'var(--v2-text-faint)',
                        transition: 'all 100ms',
                      }}
                    >
                      {p.short}
                    </button>
                  );
                })}
              </div>

              {/* Worktree selector */}
              {worktrees.length > 1 && (
                <select
                  value={selectedWorktree}
                  onChange={(e) => { setSelectedWorktree(e.target.value); }}
                  style={{
                    background: 'var(--v2-bg2)',
                    border: '1px solid var(--v2-border)',
                    borderRadius: 5,
                    color: 'var(--v2-text-dim)',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono, monospace)',
                    padding: '3px 6px',
                    cursor: 'pointer',
                  }}
                >
                  {worktrees.map((wt) => {
                    const label = wt.path.replace(/\\/g, '/').split('/').pop() ?? wt.path;
                    return (
                      <option key={wt.path} value={wt.path}>{label}</option>
                    );
                  })}
                </select>
              )}

              <div style={{ flex: 1 }} />

              <span style={{ fontSize: 10.5, color: 'var(--v2-text-faint)', fontFamily: 'var(--font-mono, monospace)' }}>
                ⌘↵
              </span>

              {/* Start run CTA */}
              <button
                type="button"
                onClick={() => { handleStart(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  background: 'var(--v2-amber)',
                  border: 'none',
                  borderRadius: 5,
                  color: '#0e1115',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <PlayIcon />
                Start run
              </button>
            </div>
          </div>
        </div>

        {/* Quick starts */}
        <SectionTitle>Quick starts</SectionTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setTask(s + ' — '); textareaRef.current?.focus(); }}
              style={{
                background: 'var(--v2-bg1)',
                border: '1px solid var(--v2-border-soft)',
                borderRadius: 999,
                color: 'var(--v2-text-dim)',
                fontSize: 11.5,
                padding: '4px 12px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'border-color 100ms, color 100ms',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--v2-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--v2-text)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--v2-border-soft)'; (e.currentTarget as HTMLElement).style.color = 'var(--v2-text-dim)'; }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Try one of these */}
        <SectionTitle>Try one of these</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.title}
              type="button"
              onClick={() => { setTask(ex.body); textareaRef.current?.focus(); }}
              style={{
                padding: '10px 12px',
                background: 'var(--v2-bg1)',
                border: '1px solid var(--v2-border-soft)',
                borderRadius: 7,
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'border-color 100ms',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--v2-border)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--v2-border-soft)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span
                  style={{
                    background: 'var(--v2-bg3)',
                    color: 'var(--v2-text-faint)',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono, monospace)',
                    padding: '1px 6px',
                    borderRadius: 3,
                  }}
                >
                  {ex.tag}
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--v2-text)', fontWeight: 500 }}>{ex.title}</span>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--v2-text-faint)', lineHeight: 1.5, margin: 0 }}>
                {ex.body}
              </p>
            </button>
          ))}
        </div>

        {/* Set up this repo */}
        <SectionTitle>Set up this repo</SectionTitle>
        <SetupChecklist
          projectName={project.name}
          branch={branch}
          hasWorktrees={(worktrees.length > 1) || (mainWorktree !== undefined && worktrees.length > 0)}
          projectPath={project.path}
        />

      </div>
    </div>
  );
};

// ── SetupChecklist ────────────────────────────────────────────────────────────

interface SetupChecklistProps {
  projectName: string;
  branch: string;
  hasWorktrees: boolean;
  projectPath: string;
}

function SetupChecklist({ projectName, branch, hasWorktrees, projectPath }: SetupChecklistProps): React.JSX.Element {
  const items: { done: boolean; text: React.ReactNode; action?: { label: string; onClick: () => void } }[] = [
    {
      done: true,
      text: <>Detected <strong style={{ color: 'var(--v2-text-dim)', fontWeight: 500 }}>{projectName}</strong> on branch <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--v2-blue)' }}>{branch}</span></>,
    },
    {
      done: false,
      text: <>CLAUDE.md in repo root · helps agents understand your project</>,
      action: { label: 'Open', onClick: () => { void window.nexusAPI?.shell?.openFile(`${projectPath}/CLAUDE.md`); } },
    },
    {
      done: hasWorktrees,
      text: hasWorktrees
        ? <>Worktrees configured · runs will use isolated checkouts</>
        : <>No worktrees configured · runs will use the main checkout</>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            background: 'var(--v2-bg1)',
            border: '1px solid var(--v2-border-soft)',
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              flexShrink: 0,
              background: item.done ? 'var(--v2-green)' : 'transparent',
              border: item.done ? 'none' : '1px dashed var(--v2-text-faint)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {item.done && (
              <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="#0e1115" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2 6 5 9 10 3" />
              </svg>
            )}
          </span>
          <span style={{ flex: 1, color: item.done ? 'var(--v2-text-dim)' : 'var(--v2-text-faint)' }}>
            {item.text}
          </span>
          {item.action !== undefined && (
            <button
              type="button"
              onClick={item.action.onClick}
              style={ghostBtn}
            >
              {item.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Shared styles & icons ─────────────────────────────────────────────────────

const ghostBtn: React.CSSProperties = {
  border: '1px solid var(--v2-border)',
  background: 'transparent',
  color: 'var(--v2-text-dim)',
  padding: '4px 10px',
  borderRadius: 5,
  fontSize: 11,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  fontFamily: 'inherit',
  flexShrink: 0,
};

const PlayIcon = (): React.JSX.Element => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const DocIcon = (): React.JSX.Element => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);
