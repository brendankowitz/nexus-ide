import { useEffect, useRef, useState } from 'react';
import { useToastStore } from '@/stores/toastStore';
import type { DiffFile } from '@/types';

interface MCQuickEditorProps {
  projectId: string | null;
  basePath: string | null;
  file: DiffFile;
  onBack: () => void;
}

function getLanguageLabel(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript JSX', js: 'JavaScript', jsx: 'JavaScript JSX',
    py: 'Python', rb: 'Ruby', go: 'Go', rs: 'Rust', java: 'Java', cs: 'C#',
    cpp: 'C++', c: 'C', h: 'C/C++ Header', json: 'JSON', yaml: 'YAML', yml: 'YAML',
    md: 'Markdown', html: 'HTML', css: 'CSS', scss: 'SCSS', sh: 'Shell',
    toml: 'TOML', xml: 'XML', sql: 'SQL', tf: 'Terraform', env: 'Env',
  };
  return (map[ext] ?? ext.toUpperCase()) || 'Plain Text';
}

export const MCQuickEditor = ({
  projectId,
  basePath,
  file,
  onBack,
}: MCQuickEditorProps): React.JSX.Element => {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumRef = useRef<HTMLDivElement>(null);
  const addToast = useToastStore((s) => s.addToast);

  const isDirty = content !== originalContent;
  const lines = content.split('\n');
  const lineCount = lines.length;

  // Load file content
  useEffect(() => {
    if (projectId === null || window.nexusAPI?.git === undefined) {
      setLoading(false);
      return;
    }
    setLoading(true);
    window.nexusAPI.git.fileContent(projectId, file.filePath)
      .then(({ working }) => {
        setContent(working);
        setOriginalContent(working);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        addToast(`Failed to load file: ${msg}`, 'error');
      })
      .finally(() => setLoading(false));
  }, [projectId, file.filePath, addToast]);

  // Sync line number scroll with textarea
  const syncScroll = (): void => {
    if (lineNumRef.current && textareaRef.current) {
      lineNumRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const updateCursor = (): void => {
    const ta = textareaRef.current;
    if (!ta) return;
    const text = ta.value.slice(0, ta.selectionStart);
    const linesBefore = text.split('\n');
    setCursorLine(linesBefore.length);
    setCursorCol((linesBefore[linesBefore.length - 1]?.length ?? 0) + 1);
  };

  const handleSave = async (): Promise<void> => {
    if (projectId === null || window.nexusAPI?.git === undefined) return;
    setSaving(true);
    try {
      await window.nexusAPI.git.writeFile(projectId, file.filePath, content);
      setOriginalContent(content);
      addToast('File saved', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(`Save failed: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = (): void => {
    setContent(originalContent);
    textareaRef.current?.focus();
  };

  const handleOpenExternal = async (): Promise<void> => {
    if (window.nexusAPI?.shell === undefined || basePath === null) return;
    try {
      const absPath = `${basePath}/${file.filePath}`.replace(/\\/g, '/');
      const err = await window.nexusAPI.shell.openFile(absPath);
      if (err) addToast(`Failed to open: ${err}`, 'error');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(`Failed to open: ${msg}`, 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    // Ctrl/Cmd+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      void handleSave();
    }
    // Tab inserts spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newContent = content.slice(0, start) + '  ' + content.slice(end);
      setContent(newContent);
      requestAnimationFrame(() => {
        ta.selectionStart = start + 2;
        ta.selectionEnd = start + 2;
      });
    }
  };

  const ghostBtn: React.CSSProperties = {
    border: '1px solid var(--v2-border)', background: 'transparent',
    color: 'var(--v2-text-dim)', padding: '4px 9px',
    borderRadius: 5, fontSize: 11, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding: '7px 12px',
          borderBottom: '1px solid var(--v2-border)',
          background: 'var(--v2-bg1)',
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0,
        }}
      >
        <button type="button" onClick={onBack} style={ghostBtn} title="Back to diff">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Diff
        </button>

        <span style={{
          background: 'rgba(255,188,66,0.15)', color: 'var(--v2-amber)',
          fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8,
          padding: '2px 7px', borderRadius: 3, textTransform: 'uppercase',
          fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
        }}>
          Quick Edit
        </span>

        <div
          style={{
            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
            fontSize: 12, color: 'var(--v2-text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320,
          }}
          title={file.filePath}
        >
          {file.filePath}
        </div>

        {isDirty && (
          <span style={{ width: 7, height: 7, borderRadius: 4, background: 'var(--v2-amber)', flexShrink: 0 }} title="Unsaved changes" />
        )}

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={() => { void handleSave(); }}
          disabled={saving || !isDirty || loading}
          style={{
            ...ghostBtn,
            color: isDirty ? 'var(--v2-text)' : 'var(--v2-text-faint)',
            borderColor: isDirty ? 'var(--v2-border)' : 'var(--v2-border)',
            opacity: saving ? 0.6 : 1,
          }}
          title="Save (Ctrl+S)"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>

        <button
          type="button"
          onClick={handleRevert}
          disabled={!isDirty || loading}
          style={{ ...ghostBtn, opacity: isDirty ? 1 : 0.4 }}
          title="Revert changes"
        >
          Revert
        </button>

        <div style={{ width: 1, height: 16, background: 'var(--v2-border)', margin: '0 2px' }} />

        <button
          type="button"
          onClick={() => { void handleOpenExternal(); }}
          style={ghostBtn}
          title="Open in external editor"
        >
          Open in Editor ↗
        </button>
      </div>

      {/* Editor body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, background: 'var(--v2-bg0)' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--v2-text-faint)', fontSize: 12, fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)' }}>
            Loading…
          </div>
        ) : (
          <>
            {/* Line numbers */}
            <div
              ref={lineNumRef}
              style={{
                width: 52, flexShrink: 0,
                overflowY: 'hidden', overflowX: 'hidden',
                background: 'var(--v2-bg1)',
                borderRight: '1px solid var(--v2-border)',
                paddingTop: 10, paddingRight: 8,
                fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                fontSize: 12, lineHeight: '20px',
                textAlign: 'right', color: 'var(--v2-text-faint)',
                userSelect: 'none', pointerEvents: 'none',
              }}
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div
                  key={i}
                  style={{ color: i + 1 === cursorLine ? 'var(--v2-text-dim)' : undefined }}
                >
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => { setContent(e.target.value); updateCursor(); }}
              onScroll={syncScroll}
              onClick={updateCursor}
              onKeyDown={handleKeyDown}
              onKeyUp={updateCursor}
              spellCheck={false}
              style={{
                flex: 1, resize: 'none', border: 'none', outline: 'none',
                background: 'transparent', color: 'var(--v2-text)',
                fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                fontSize: 12, lineHeight: '20px',
                padding: '10px 14px', tabSize: 2,
                overflowY: 'auto', whiteSpace: 'pre', overflowWrap: 'normal',
                overflowX: 'auto',
              }}
            />
          </>
        )}
      </div>

      {/* Status bar */}
      <div
        style={{
          flexShrink: 0, height: 22,
          borderTop: '1px solid var(--v2-border)',
          background: 'var(--v2-bg1)',
          display: 'flex', alignItems: 'center',
          padding: '0 12px', gap: 14,
        }}
      >
        <span style={{ fontSize: 10, color: 'var(--v2-text-faint)', fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)' }}>
          Ln {cursorLine}, Col {cursorCol}
        </span>
        <span style={{ fontSize: 10, color: 'var(--v2-text-faint)', fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)' }}>
          {lineCount} lines
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--v2-text-faint)' }}>
          {getLanguageLabel(file.filePath)}
        </span>
        <span style={{ fontSize: 10, color: 'var(--v2-text-faint)' }}>UTF-8</span>
      </div>
    </div>
  );
};
