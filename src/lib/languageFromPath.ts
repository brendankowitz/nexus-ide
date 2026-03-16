/** Extension → language ID map for Shiki and Monaco. */
interface LangIds {
  shiki: string;
  monaco: string;
}

const EXT_MAP: Array<[RegExp, LangIds]> = [
  [/\.cs$/, { shiki: 'csharp', monaco: 'csharp' }],
  [/\.(fs|fsi|fsx)$/, { shiki: 'fsharp', monaco: 'fsharp' }],
  [/\.vb$/, { shiki: 'vb', monaco: 'vb' }],
  [/\.tsx$/, { shiki: 'tsx', monaco: 'typescript' }],
  [/\.ts$/, { shiki: 'typescript', monaco: 'typescript' }],
  [/\.jsx$/, { shiki: 'jsx', monaco: 'javascript' }],
  [/\.(js|mjs)$/, { shiki: 'javascript', monaco: 'javascript' }],
  [/\.(cshtml|razor)$/, { shiki: 'html', monaco: 'html' }],
  [/\.html?$/, { shiki: 'html', monaco: 'html' }],
  [/\.css$/, { shiki: 'css', monaco: 'css' }],
  [/\.scss$/, { shiki: 'scss', monaco: 'scss' }],
  [/\.jsonc$/, { shiki: 'jsonc', monaco: 'json' }],
  [/\.json$/, { shiki: 'json', monaco: 'json' }],
  [/\.(csproj|props|targets|xml)$/, { shiki: 'xml', monaco: 'xml' }],
  [/\.(yaml|yml)$/, { shiki: 'yaml', monaco: 'yaml' }],
  [/\.toml$/, { shiki: 'toml', monaco: 'plaintext' }],
  [/\.md$/, { shiki: 'markdown', monaco: 'markdown' }],
  [/\.sql$/, { shiki: 'sql', monaco: 'sql' }],
  [/\.(ps1|psm1)$/, { shiki: 'powershell', monaco: 'powershell' }],
  [/\.(sh|bash)$/, { shiki: 'shellscript', monaco: 'shell' }],
  [/\.py$/, { shiki: 'python', monaco: 'python' }],
  [/\.go$/, { shiki: 'go', monaco: 'go' }],
];

function resolve(filePath: string): LangIds | null {
  const lower = filePath.toLowerCase();
  const basename = lower.split('/').pop() ?? lower;

  // Dockerfile (with or without extension)
  if (basename === 'dockerfile' || basename.endsWith('.dockerfile')) {
    return { shiki: 'dockerfile', monaco: 'dockerfile' };
  }

  for (const [pattern, ids] of EXT_MAP) {
    if (pattern.test(basename)) return ids;
  }
  return null;
}

export function shikiLang(filePath: string): string {
  return resolve(filePath)?.shiki ?? 'text';
}

export function monacoLang(filePath: string): string {
  return resolve(filePath)?.monaco ?? 'plaintext';
}
