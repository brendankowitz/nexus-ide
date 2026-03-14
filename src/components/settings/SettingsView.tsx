import { useState, useCallback, useEffect } from 'react';

// Settings are persisted via electron-store IPC (settings:get / settings:set).
// Local component state is used for the form; saved to disk on "Save" click.

// ---------------------------------------------------------------------------
// Store data mapping helpers
// ---------------------------------------------------------------------------

function fromStoreData(data: Record<string, unknown>): Partial<SettingsState> {
  const result: Partial<SettingsState> = {};

  const theme = data['theme'];
  if (theme === 'dark' || theme === 'light') result.theme = theme;

  const editor = data['editor'] as Record<string, unknown> | undefined;
  if (editor) {
    if (typeof editor['command'] === 'string') result.editorCommand = editor['command'];
    const args = editor['args'];
    if (Array.isArray(args)) result.editorArgs = (args as string[]).join(' ');
  }

  const terminal = data['terminal'] as Record<string, unknown> | undefined;
  if (terminal) {
    if (typeof terminal['shell'] === 'string') result.defaultShell = terminal['shell'];
    if (typeof terminal['fontSize'] === 'number') result.terminalFontSize = terminal['fontSize'];
    if (typeof terminal['fontFamily'] === 'string') result.terminalFontFamily = terminal['fontFamily'];
  }

  const git = data['git'] as Record<string, unknown> | undefined;
  if (git) {
    if (typeof git['statusPollInterval'] === 'number') result.statusPollInterval = git['statusPollInterval'];
    if (typeof git['autoFetchInterval'] === 'number') result.autoFetchInterval = git['autoFetchInterval'];
  }

  const pipeline = data['pipeline'] as Record<string, unknown> | undefined;
  if (pipeline) {
    if (typeof pipeline['defaultPlan'] === 'string') result.defaultPlanPlugin = pipeline['defaultPlan'];
    if (typeof pipeline['defaultExecute'] === 'string') result.defaultExecutePlugin = pipeline['defaultExecute'];
    const chain = pipeline['defaultValidateChain'];
    if (Array.isArray(chain)) result.defaultValidationChain = chain as string[];
  }

  const agents = data['agents'] as Record<string, unknown> | undefined;
  if (agents) {
    const claudeCode = agents['claudeCode'] as Record<string, unknown> | undefined;
    if (claudeCode && typeof claudeCode['command'] === 'string') result.claudeCodePath = claudeCode['command'];
    if (claudeCode && typeof claudeCode['mode'] === 'string') result.claudeCodeMode = claudeCode['mode'];
    const copilotCli = agents['copilotCli'] as Record<string, unknown> | undefined;
    if (copilotCli && typeof copilotCli['command'] === 'string') result.githubCopilotPath = copilotCli['command'];
    if (copilotCli && typeof copilotCli['mode'] === 'string') result.copilotMode = copilotCli['mode'];
    const aider = agents['aider'] as Record<string, unknown> | undefined;
    if (aider && typeof aider['command'] === 'string') result.aiderPath = aider['command'];
    const az = agents['az'] as Record<string, unknown> | undefined;
    if (az && typeof az['command'] === 'string') result.azureCLIPath = az['command'];
    const gh = agents['gh'] as Record<string, unknown> | undefined;
    if (gh && typeof gh['command'] === 'string') result.githubCLIPath = gh['command'];
    const dotnet = agents['dotnet'] as Record<string, unknown> | undefined;
    if (dotnet && typeof dotnet['command'] === 'string') result.dotnetPath = dotnet['command'];
  }

  return result;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustomTool {
  id: string;
  name: string;
  command: string;
}

interface SettingsState {
  // General
  theme: 'dark' | 'light';
  editorCommand: string;
  editorArgs: string;
  // Terminal
  defaultShell: string;
  terminalFontSize: number;
  terminalFontFamily: string;
  // Git
  gitBinaryPath: string;
  statusPollInterval: number;
  autoFetchInterval: number;
  longPaths: boolean;
  // Tool Paths
  claudeCodePath: string;
  claudeCodeMode: string;
  githubCopilotPath: string;
  copilotMode: string;
  aiderPath: string;
  azureCLIPath: string;
  githubCLIPath: string;
  dotnetPath: string;
  customTools: CustomTool[];
  // Pipeline Defaults
  defaultPlanPlugin: string;
  defaultExecutePlugin: string;
  defaultValidationChain: string[];
}

const PLAN_PLUGINS = ['fn-investigation', 'spec-kit', 'claude-planner', 'custom-prompt'] as const;
const EXECUTE_PLUGINS = ['fn-task', 'copilot-cli', 'aider', 'manual'] as const;
const VALIDATE_PLUGINS = ['lint', 'typecheck', 'test', 'build', 'custom'] as const;

function detectShell(): string {
  if (typeof window !== 'undefined' && (window as unknown as { electron?: { process?: { env?: { SHELL?: string; COMSPEC?: string } } } }).electron?.process?.env?.SHELL) {
    return (window as unknown as { electron: { process: { env: { SHELL: string } } } }).electron.process.env.SHELL;
  }
  return navigator.platform.toLowerCase().includes('win') ? 'cmd.exe' : '/bin/bash';
}

const defaultSettings: SettingsState = {
  theme: 'dark',
  editorCommand: 'code',
  editorArgs: '--goto',
  defaultShell: detectShell(),
  terminalFontSize: 13,
  terminalFontFamily: 'JetBrains Mono',
  gitBinaryPath: '',
  statusPollInterval: 3000,
  autoFetchInterval: 60000,
  longPaths: false,
  claudeCodePath: 'claude',
  claudeCodeMode: '',
  githubCopilotPath: 'copilot',
  copilotMode: '',
  aiderPath: 'aider',
  azureCLIPath: 'az',
  githubCLIPath: 'gh',
  dotnetPath: 'dotnet',
  customTools: [],
  defaultPlanPlugin: 'fn-investigation',
  defaultExecutePlugin: 'fn-task',
  defaultValidationChain: ['typecheck', 'lint', 'test'],
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section = ({ title, children }: SectionProps): React.JSX.Element => (
  <section className="mb-8">
    <h2 className="mb-4 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
      {title}
    </h2>
    <div className="space-y-3">{children}</div>
  </section>
);

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

const Field = ({ label, hint, children }: FieldProps): React.JSX.Element => (
  <div className="flex items-start gap-6">
    <div className="w-48 shrink-0 pt-[7px]">
      <label className="font-sans text-[12px] text-text-secondary">{label}</label>
      {hint !== undefined && (
        <p className="mt-0.5 font-mono text-[10px] text-text-tertiary">{hint}</p>
      )}
    </div>
    <div className="flex-1">{children}</div>
  </div>
);

const inputClass =
  'w-full rounded-[var(--radius-sm)] border border-border-default bg-bg-surface px-2.5 py-[6px] font-mono text-[12px] text-text-primary placeholder:text-text-ghost outline-none focus:border-border-strong transition-colors duration-[var(--duration-fast)]';

const selectClass =
  'rounded-[var(--radius-sm)] border border-border-default bg-bg-surface px-2.5 py-[6px] font-mono text-[12px] text-text-primary outline-none focus:border-border-strong transition-colors duration-[var(--duration-fast)] cursor-pointer';

interface TextInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  suffix?: React.ReactNode;
}

const TextInput = ({ value, onChange, placeholder, disabled, suffix }: TextInputProps): React.JSX.Element => (
  <div className="flex items-center gap-2">
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={inputClass + (disabled === true ? ' opacity-40 cursor-not-allowed' : '')}
    />
    {suffix}
  </div>
);

interface NumberInputProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}

const NumberInput = ({ value, onChange, min, max, suffix }: NumberInputProps): React.JSX.Element => (
  <div className="flex items-center gap-2">
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value))}
      className={inputClass + ' w-28'}
    />
    {suffix !== undefined && (
      <span className="font-mono text-[11px] text-text-tertiary">{suffix}</span>
    )}
  </div>
);

interface DetectButtonProps {
  onClick: () => void;
  label?: string;
}

const DetectButton = ({ onClick, label = 'detect' }: DetectButtonProps): React.JSX.Element => (
  <button
    onClick={onClick}
    className="shrink-0 rounded-[var(--radius-sm)] border border-border-default bg-bg-overlay px-2.5 py-[6px] font-mono text-[11px] text-text-secondary hover:border-border-strong hover:text-text-primary transition-colors duration-[var(--duration-fast)] cursor-pointer"
  >
    {label}
  </button>
);

// ---------------------------------------------------------------------------
// Validation Chain reorderable list
// ---------------------------------------------------------------------------

interface ValidationChainProps {
  chain: string[];
  onChange: (chain: string[]) => void;
}

const ValidationChainEditor = ({ chain, onChange }: ValidationChainProps): React.JSX.Element => {
  const moveUp = (index: number): void => {
    if (index === 0) return;
    const next = [...chain];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  };

  const moveDown = (index: number): void => {
    if (index === chain.length - 1) return;
    const next = [...chain];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  };

  const remove = (index: number): void => {
    onChange(chain.filter((_, i) => i !== index));
  };

  const available = VALIDATE_PLUGINS.filter((p) => !chain.includes(p));

  const add = (plugin: string): void => {
    if (plugin && !chain.includes(plugin)) {
      onChange([...chain, plugin]);
    }
  };

  return (
    <div className="space-y-1.5">
      {chain.map((item, i) => (
        <div
          key={item}
          className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-border-subtle bg-bg-surface px-2.5 py-1.5"
        >
          <span className="w-4 shrink-0 font-mono text-[10px] text-text-ghost">{i + 1}</span>
          <span className="flex-1 font-mono text-[12px] text-text-primary">{item}</span>
          <div className="flex items-center gap-1">
            <ChevronButton direction="up" disabled={i === 0} onClick={() => moveUp(i)} />
            <ChevronButton direction="down" disabled={i === chain.length - 1} onClick={() => moveDown(i)} />
            <RemoveButton onClick={() => remove(i)} />
          </div>
        </div>
      ))}
      {available.length > 0 && (
        <select
          defaultValue=""
          onChange={(e) => { add(e.target.value); e.target.value = ''; }}
          className={selectClass + ' w-full mt-1'}
        >
          <option value="" disabled>+ add validator</option>
          {available.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      )}
    </div>
  );
};

const ChevronButton = ({
  direction,
  disabled,
  onClick,
}: {
  direction: 'up' | 'down';
  disabled: boolean;
  onClick: () => void;
}): React.JSX.Element => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex h-5 w-5 items-center justify-center rounded text-text-tertiary hover:text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
  >
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
      {direction === 'up' ? (
        <path d="M1 6L4 2L7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M1 2L4 6L7 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  </button>
);

const RemoveButton = ({ onClick }: { onClick: () => void }): React.JSX.Element => (
  <button
    onClick={onClick}
    className="flex h-5 w-5 items-center justify-center rounded text-text-tertiary hover:text-sem-danger cursor-pointer"
  >
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
      <path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  </button>
);

// ---------------------------------------------------------------------------
// Custom Tools editor
// ---------------------------------------------------------------------------

interface CustomToolsEditorProps {
  tools: CustomTool[];
  onChange: (tools: CustomTool[]) => void;
}

const CustomToolsEditor = ({ tools, onChange }: CustomToolsEditorProps): React.JSX.Element => {
  const add = (): void => {
    onChange([...tools, { id: crypto.randomUUID(), name: '', command: '' }]);
  };

  const remove = (id: string): void => {
    onChange(tools.filter((t) => t.id !== id));
  };

  const update = (id: string, field: 'name' | 'command', value: string): void => {
    onChange(tools.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  return (
    <div className="space-y-2">
      {tools.map((tool) => (
        <div key={tool.id} className="flex items-center gap-2">
          <input
            type="text"
            value={tool.name}
            onChange={(e) => update(tool.id, 'name', e.target.value)}
            placeholder="name"
            className={inputClass + ' w-32'}
          />
          <input
            type="text"
            value={tool.command}
            onChange={(e) => update(tool.id, 'command', e.target.value)}
            placeholder="command or path"
            className={inputClass}
          />
          <RemoveButton onClick={() => remove(tool.id)} />
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-dashed border-border-default px-2.5 py-[6px] font-mono text-[11px] text-text-tertiary hover:border-border-strong hover:text-text-secondary transition-colors duration-[var(--duration-fast)] cursor-pointer"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M5 1V9M1 5H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        add tool
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main SettingsView
// ---------------------------------------------------------------------------

export const SettingsView = (): React.JSX.Element => {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load persisted settings on mount
  useEffect(() => {
    const load = async (): Promise<void> => {
      if (!window.nexusAPI?.settings) { setLoading(false); return; }
      try {
        const data = await window.nexusAPI.settings.get();
        const partial = fromStoreData(data);
        setSettings((prev) => ({ ...prev, ...partial }));
      } catch (err) {
        console.error('[SettingsView] failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const set = useCallback(<K extends keyof SettingsState>(key: K, value: SettingsState[K]): void => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(async (): Promise<void> => {
    try {
      await window.nexusAPI.settings.set({
        theme: settings.theme,
        editor: {
          command: settings.editorCommand,
          args: settings.editorArgs.split(/\s+/).filter(Boolean),
        },
        terminal: {
          shell: settings.defaultShell,
          fontSize: settings.terminalFontSize,
          fontFamily: settings.terminalFontFamily,
        },
        git: {
          statusPollInterval: settings.statusPollInterval,
          autoFetchInterval: settings.autoFetchInterval,
        },
        pipeline: {
          defaultPlan: settings.defaultPlanPlugin,
          defaultExecute: settings.defaultExecutePlugin,
          defaultValidateChain: settings.defaultValidationChain,
        },
        agents: {
          claudeCode: { command: settings.claudeCodePath, ...(settings.claudeCodeMode ? { mode: settings.claudeCodeMode } : {}), available: true },
          copilotCli: { command: settings.githubCopilotPath, ...(settings.copilotMode ? { mode: settings.copilotMode } : {}), available: true },
          aider: { command: settings.aiderPath, available: false },
          az: { command: settings.azureCLIPath, available: true },
          gh: { command: settings.githubCLIPath, available: true },
          dotnet: { command: settings.dotnetPath, available: true },
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('[SettingsView] save failed:', err);
    }
  }, [settings]);

  const handleDetectGit = useCallback((): void => {
    set('gitBinaryPath', 'auto (dugite bundled)');
    void window.nexusAPI.settings.set({
      git: {
        statusPollInterval: settings.statusPollInterval,
        autoFetchInterval: settings.autoFetchInterval,
      },
    });
  }, [set, settings.statusPollInterval, settings.autoFetchInterval]);

  const handleDetectTool = useCallback(
    (key: 'claudeCodePath' | 'githubCopilotPath' | 'aiderPath' | 'azureCLIPath' | 'githubCLIPath' | 'dotnetPath'): void => {
      // Mark the currently configured command as detected by persisting it
      const command = settings[key];
      void window.nexusAPI.settings.set({
        agents: {
          claudeCode: { command: settings.claudeCodePath, ...(settings.claudeCodeMode ? { mode: settings.claudeCodeMode } : {}), available: true },
          copilotCli: { command: settings.githubCopilotPath, ...(settings.copilotMode ? { mode: settings.copilotMode } : {}), available: true },
          aider: { command: settings.aiderPath, available: false },
          az: { command: settings.azureCLIPath, available: true },
          gh: { command: settings.githubCLIPath, available: true },
          dotnet: { command: settings.dotnetPath, available: true },
          ...(key === 'claudeCodePath' ? { claudeCode: { command, available: true } } : {}),
          ...(key === 'githubCopilotPath' ? { copilotCli: { command, available: true } } : {}),
          ...(key === 'aiderPath' ? { aider: { command, available: true } } : {}),
          ...(key === 'azureCLIPath' ? { az: { command, available: true } } : {}),
          ...(key === 'githubCLIPath' ? { gh: { command, available: true } } : {}),
          ...(key === 'dotnetPath' ? { dotnet: { command, available: true } } : {}),
        },
      });
    },
    [settings],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-[11px] text-text-ghost">
        loading…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg-base">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-8 py-4">
        <div>
          <h1 className="font-mono text-[13px] font-medium text-text-primary">settings</h1>
          <p className="mt-0.5 font-sans text-[11px] text-text-tertiary">
            Nexus IDE configuration
          </p>
        </div>
        <button
          onClick={() => { void handleSave(); }}
          className={`rounded-[var(--radius-md)] px-4 py-1.5 font-mono text-[12px] font-medium transition-all duration-[var(--duration-fast)] cursor-pointer ${
            saved
              ? 'bg-phase-execute-dim text-phase-execute border border-phase-execute'
              : 'bg-phase-execute text-bg-void hover:opacity-90'
          }`}
        >
          {saved ? 'saved' : 'save changes'}
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-2xl">

          {/* General */}
          <Section title="general">
            <Field label="Theme" hint="Light theme coming soon">
              <div className="flex gap-2">
                <button
                  onClick={() => set('theme', 'dark')}
                  className={`rounded-[var(--radius-sm)] border px-3 py-[6px] font-mono text-[11px] transition-colors duration-[var(--duration-fast)] cursor-pointer ${
                    settings.theme === 'dark'
                      ? 'border-border-strong bg-bg-active text-text-primary'
                      : 'border-border-subtle bg-bg-surface text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  dark
                </button>
                <button
                  disabled
                  className="rounded-[var(--radius-sm)] border border-border-subtle bg-bg-surface px-3 py-[6px] font-mono text-[11px] text-text-ghost cursor-not-allowed opacity-40"
                >
                  light
                </button>
              </div>
            </Field>

            <Field label="Editor command">
              <TextInput
                value={settings.editorCommand}
                onChange={(v) => set('editorCommand', v)}
                placeholder="code"
              />
            </Field>

            <Field label="Editor args" hint="Passed before the file path">
              <TextInput
                value={settings.editorArgs}
                onChange={(v) => set('editorArgs', v)}
                placeholder="--goto"
              />
            </Field>
          </Section>

          {/* Terminal */}
          <Section title="terminal">
            <Field label="Default shell">
              <TextInput
                value={settings.defaultShell}
                onChange={(v) => set('defaultShell', v)}
                placeholder="/bin/bash"
              />
            </Field>

            <Field label="Font size">
              <NumberInput
                value={settings.terminalFontSize}
                onChange={(v) => set('terminalFontSize', v)}
                min={8}
                max={32}
                suffix="px"
              />
            </Field>

            <Field label="Font family">
              <TextInput
                value={settings.terminalFontFamily}
                onChange={(v) => set('terminalFontFamily', v)}
                placeholder="JetBrains Mono"
              />
            </Field>
          </Section>

          {/* Git */}
          <Section title="git">
            <Field label="Git binary path" hint="Leave blank to use bundled dugite">
              <TextInput
                value={settings.gitBinaryPath}
                onChange={(v) => set('gitBinaryPath', v)}
                placeholder="auto (dugite)"
                suffix={
                  <DetectButton onClick={handleDetectGit} label="auto-detect" />
                }
              />
            </Field>

            <Field label="Status poll interval">
              <NumberInput
                value={settings.statusPollInterval}
                onChange={(v) => set('statusPollInterval', v)}
                min={500}
                suffix="ms"
              />
            </Field>

            <Field label="Auto-fetch interval">
              <NumberInput
                value={settings.autoFetchInterval}
                onChange={(v) => set('autoFetchInterval', v)}
                min={10000}
                suffix="ms"
              />
            </Field>

            <Field label="Long paths" hint="Enable core.longpaths (Windows)">
              <label className="flex cursor-pointer items-center gap-2">
                <div
                  onClick={() => set('longPaths', !settings.longPaths)}
                  className={`relative h-[18px] w-8 rounded-full transition-colors duration-[var(--duration-fast)] ${
                    settings.longPaths ? 'bg-phase-execute' : 'bg-bg-active'
                  }`}
                >
                  <div
                    className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-text-primary shadow-sm transition-transform duration-[var(--duration-fast)] ${
                      settings.longPaths ? 'translate-x-[14px]' : 'translate-x-[2px]'
                    }`}
                  />
                </div>
                <span className="font-mono text-[11px] text-text-tertiary">
                  {settings.longPaths ? 'enabled' : 'disabled'}
                </span>
              </label>
            </Field>
          </Section>

          {/* Tool Paths */}
          <Section title="tool paths">
            <Field label="Claude Code">
              <div className="flex flex-col gap-1.5">
                <TextInput
                  value={settings.claudeCodePath}
                  onChange={(v) => set('claudeCodePath', v)}
                  placeholder="claude"
                  suffix={
                    <DetectButton onClick={() => handleDetectTool('claudeCodePath')} />
                  }
                />
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-text-tertiary w-10 shrink-0">mode</span>
                  <select
                    value={settings.claudeCodeMode}
                    onChange={(e) => set('claudeCodeMode', e.target.value)}
                    className={selectClass + ' flex-1'}
                  >
                    <option value="">normal</option>
                    <option value="--dangerously-skip-permissions">--dangerously-skip-permissions (yolo)</option>
                  </select>
                </div>
              </div>
            </Field>

            <Field label="GitHub Copilot CLI">
              <div className="flex flex-col gap-1.5">
                <TextInput
                  value={settings.githubCopilotPath}
                  onChange={(v) => set('githubCopilotPath', v)}
                  placeholder="copilot"
                  suffix={
                    <DetectButton onClick={() => handleDetectTool('githubCopilotPath')} />
                  }
                />
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-text-tertiary w-10 shrink-0">mode</span>
                  <select
                    value={settings.copilotMode}
                    onChange={(e) => set('copilotMode', e.target.value)}
                    className={selectClass + ' flex-1'}
                  >
                    <option value="">normal</option>
                    <option value="--yolo">--yolo (skip confirmations)</option>
                  </select>
                </div>
              </div>
            </Field>

            <Field label="Aider">
              <TextInput
                value={settings.aiderPath}
                onChange={(v) => set('aiderPath', v)}
                placeholder="aider"
                suffix={
                  <DetectButton onClick={() => handleDetectTool('aiderPath')} />
                }
              />
            </Field>

            <Field label="Azure CLI">
              <TextInput
                value={settings.azureCLIPath}
                onChange={(v) => set('azureCLIPath', v)}
                placeholder="az"
                suffix={
                  <DetectButton onClick={() => handleDetectTool('azureCLIPath')} />
                }
              />
            </Field>

            <Field label="GitHub CLI">
              <TextInput
                value={settings.githubCLIPath}
                onChange={(v) => set('githubCLIPath', v)}
                placeholder="gh"
                suffix={
                  <DetectButton onClick={() => handleDetectTool('githubCLIPath')} />
                }
              />
            </Field>

            <Field label="dotnet">
              <TextInput
                value={settings.dotnetPath}
                onChange={(v) => set('dotnetPath', v)}
                placeholder="dotnet"
                suffix={
                  <DetectButton onClick={() => handleDetectTool('dotnetPath')} />
                }
              />
            </Field>

            <Field label="Custom tools" hint="name + command pairs">
              <CustomToolsEditor
                tools={settings.customTools}
                onChange={(v) => set('customTools', v)}
              />
            </Field>
          </Section>

          {/* Pipeline Defaults */}
          <Section title="pipeline defaults">
            <Field label="Default plan plugin">
              <select
                value={settings.defaultPlanPlugin}
                onChange={(e) => set('defaultPlanPlugin', e.target.value)}
                className={selectClass}
              >
                {PLAN_PLUGINS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>

            <Field label="Default execute plugin">
              <select
                value={settings.defaultExecutePlugin}
                onChange={(e) => set('defaultExecutePlugin', e.target.value)}
                className={selectClass}
              >
                {EXECUTE_PLUGINS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>

            <Field label="Validation chain" hint="Drag to reorder validators">
              <ValidationChainEditor
                chain={settings.defaultValidationChain}
                onChange={(v) => set('defaultValidationChain', v)}
              />
            </Field>
          </Section>

        </div>
      </div>
    </div>
  );
};
