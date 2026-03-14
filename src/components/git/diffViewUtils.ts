import type { DiffFile, DiffTreeNode, DiffFeatureGroup } from '@/types';

// ── Tree Structure Utilities ─────────────────────

export function groupFilesByDirectory(files: DiffFile[]): DiffTreeNode[] {
  const root: DiffTreeNode = {
    name: '',
    path: '',
    type: 'directory',
    children: [],
    totalAdditions: 0,
    totalDeletions: 0,
  };

  for (const file of files) {
    const parts = file.filePath.split('/');
    let current = root;

    // Walk/create directory nodes for all path segments except the filename
    for (let i = 0; i < parts.length - 1; i++) {
      const dirName = parts[i];
      const dirPath = parts.slice(0, i + 1).join('/');
      let child = current.children.find(
        (c) => c.type === 'directory' && c.name === dirName,
      );
      if (!child) {
        child = {
          name: dirName,
          path: dirPath,
          type: 'directory',
          children: [],
          totalAdditions: 0,
          totalDeletions: 0,
        };
        current.children.push(child);
      }
      current = child;
    }

    // Add file node
    const fileName = parts[parts.length - 1];
    current.children.push({
      name: fileName,
      path: file.filePath,
      type: 'file',
      file,
      children: [],
      totalAdditions: file.additions,
      totalDeletions: file.deletions,
    });
  }

  // Roll up aggregate stats
  aggregateStats(root);

  // If root has a single directory child, don't return the empty root
  return root.children;
}

function aggregateStats(node: DiffTreeNode): void {
  if (node.type === 'file') return;

  let additions = 0;
  let deletions = 0;
  for (const child of node.children) {
    aggregateStats(child);
    additions += child.totalAdditions;
    deletions += child.totalDeletions;
  }
  node.totalAdditions = additions;
  node.totalDeletions = deletions;

  // Sort: directories first, then files, both alphabetical
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// ── AI-Organized Groups Utilities ────────────────

const TEST_PATTERNS = /\/(tests?|spec|__tests__)\//i;
const CONFIG_PATTERNS = /\/(config|settings)\//i;
const CONFIG_EXTENSIONS = /\.(json|ya?ml|env|toml|ini)$/i;

function isTestFile(filePath: string): boolean {
  return TEST_PATTERNS.test('/' + filePath) ||
    /\.(test|spec)\.[^.]+$/.test(filePath);
}

function isConfigFile(filePath: string): boolean {
  return CONFIG_PATTERNS.test('/' + filePath) || CONFIG_EXTENSIONS.test(filePath);
}

function getGroupKey(filePath: string): string {
  // Use deepest meaningful directory
  const parts = filePath.split('/');
  if (parts.length <= 1) return '(root)';
  // Use the parent directory path (drop filename)
  return parts.slice(0, -1).join('/');
}

function formatHeading(dirPath: string, files: DiffFile[]): string {
  if (dirPath === '(root)') return 'Root Files';

  const dirName = dirPath.split('/').pop() ?? dirPath;
  // Capitalize and add context from status
  const hasNew = files.some((f) => f.status === 'A');
  const hasDeleted = files.some((f) => f.status === 'D');
  const hasModified = files.some((f) => f.status === 'M');

  const capitalized = dirName.charAt(0).toUpperCase() + dirName.slice(1);

  if (hasNew && !hasModified && !hasDeleted) return `${capitalized} (New)`;
  if (hasDeleted && !hasNew && !hasModified) return `${capitalized} (Removed)`;
  if (hasModified && hasNew) return `${capitalized} Implementation`;
  return capitalized;
}

function formatSubtitle(files: DiffFile[]): string {
  const statuses: string[] = [];
  const added = files.filter((f) => f.status === 'A').length;
  const modified = files.filter((f) => f.status === 'M').length;
  const deleted = files.filter((f) => f.status === 'D').length;
  const renamed = files.filter((f) => f.status === 'R').length;

  if (added > 0) statuses.push(`${added} added`);
  if (modified > 0) statuses.push(`${modified} modified`);
  if (deleted > 0) statuses.push(`${deleted} deleted`);
  if (renamed > 0) statuses.push(`${renamed} renamed`);

  return statuses.join(', ');
}

export function groupFilesByFeature(files: DiffFile[]): DiffFeatureGroup[] {
  const groups: DiffFeatureGroup[] = [];

  const testFiles: DiffFile[] = [];
  const configFiles: DiffFile[] = [];
  const remaining: DiffFile[] = [];

  // Phase 1: separate test and config files
  for (const file of files) {
    if (isTestFile(file.filePath)) {
      testFiles.push(file);
    } else if (isConfigFile(file.filePath)) {
      configFiles.push(file);
    } else {
      remaining.push(file);
    }
  }

  // Phase 2: group remaining by deepest common directory
  const dirGroups = new Map<string, DiffFile[]>();
  for (const file of remaining) {
    const key = getGroupKey(file.filePath);
    const existing = dirGroups.get(key);
    if (existing) {
      existing.push(file);
    } else {
      dirGroups.set(key, [file]);
    }
  }

  // Merge small groups (1 file) into their parent directory
  const mergedGroups = new Map<string, DiffFile[]>();
  for (const [key, groupFiles] of dirGroups) {
    if (groupFiles.length === 1 && key !== '(root)') {
      const parts = key.split('/');
      const parentKey = parts.length > 1 ? parts.slice(0, -1).join('/') : key;
      const existing = mergedGroups.get(parentKey);
      if (existing) {
        existing.push(...groupFiles);
      } else {
        mergedGroups.set(parentKey, [...groupFiles]);
      }
    } else {
      const existing = mergedGroups.get(key);
      if (existing) {
        existing.push(...groupFiles);
      } else {
        mergedGroups.set(key, [...groupFiles]);
      }
    }
  }

  // Build feature groups from directory groups
  for (const [dirPath, groupFiles] of mergedGroups) {
    groups.push({
      heading: formatHeading(dirPath, groupFiles),
      subtitle: formatSubtitle(groupFiles),
      files: groupFiles,
      totalAdditions: groupFiles.reduce((sum, f) => sum + f.additions, 0),
      totalDeletions: groupFiles.reduce((sum, f) => sum + f.deletions, 0),
    });
  }

  // Add test group
  if (testFiles.length > 0) {
    groups.push({
      heading: 'Test Coverage',
      subtitle: formatSubtitle(testFiles),
      files: testFiles,
      totalAdditions: testFiles.reduce((sum, f) => sum + f.additions, 0),
      totalDeletions: testFiles.reduce((sum, f) => sum + f.deletions, 0),
    });
  }

  // Add config group
  if (configFiles.length > 0) {
    groups.push({
      heading: 'Configuration',
      subtitle: formatSubtitle(configFiles),
      files: configFiles,
      totalAdditions: configFiles.reduce((sum, f) => sum + f.additions, 0),
      totalDeletions: configFiles.reduce((sum, f) => sum + f.deletions, 0),
    });
  }

  // Sort groups: feature groups first (by heading), then test, then config
  // The test/config are already at the end due to push order

  return groups;
}
