import { createHighlighter } from 'shiki';
import type { Highlighter, ThemedToken } from 'shiki';
import { shikiLang } from './languageFromPath';

const LANGS = [
  'csharp', 'fsharp', 'vb',
  'typescript', 'tsx', 'javascript', 'jsx',
  'html', 'css', 'scss',
  'json', 'jsonc', 'xml', 'yaml', 'toml',
  'markdown', 'sql', 'powershell', 'shellscript',
  'dockerfile', 'python', 'go',
] as const;

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['dark-plus'],
      langs: [...LANGS],
    });
  }
  return highlighterPromise;
}

/**
 * Tokenise an array of lines using Shiki.
 * Returns token arrays per line, or null on error / unknown language.
 */
export async function tokeniseLines(
  lines: string[],
  filePath: string,
): Promise<ThemedToken[][] | null> {
  const lang = shikiLang(filePath);
  if (lang === 'text') return null;

  try {
    const highlighter = await getHighlighter();
    const code = lines.join('\n');
    const result = highlighter.codeToTokens(code, { lang, theme: 'dark-plus' });
    return result.tokens;
  } catch {
    return null;
  }
}
