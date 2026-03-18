/**
 * electron/ipc/git.ts
 *
 * Git operations wrapper using dugite for real git execution.
 * dugite bundles its own git binary; GitProcess.exec(args, path) returns
 * { stdout, stderr, exitCode }.
 *
 * Windows notes:
 *   - All paths are normalized to forward slashes before passing to git.
 *   - All output parsing uses \r?\n for CRLF-safe line splitting.
 *   - Spawn options include windowsHide: true (handled inside dugite).
 */

import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { exec as dugiteExec } from 'dugite';

import type {
  Branch,
  Commit,
  DiffFile,
  DiffHunk,
  DiffLine,
  GitStatus,
  RemoteBranch,
  Worktree,
} from '../../src/types/index.js';

/* ─── Path helpers ─────────────────────────────────────────────────────────── */

/** Normalize a filesystem path to forward slashes for git consumption. */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

/** Split git output safely on both LF and CRLF, filtering trailing empties. */
function splitLines(output: string): string[] {
  if (!output.trim()) return [];
  const lines = output.split(/\r?\n/);
  // Remove trailing empty string from split
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

/* ─── Low-level executor ───────────────────────────────────────────────────── */

export interface GitExecResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

/**
 * Execute a git command in the given repository path.
 */
export async function execGit(
  repoPath: string,
  args: string[],
): Promise<GitExecResult> {
  const normalizedPath = normalizePath(repoPath);
  const result = await dugiteExec(args, normalizedPath);
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
}

/* ─── getStatus ────────────────────────────────────────────────────────────── */

/**
 * Parse `git status --porcelain=v1 -b` output into a structured GitStatus.
 */
export async function getStatus(projectPath: string): Promise<GitStatus> {
  try {
    const result = await execGit(projectPath, ['status', '--porcelain=v1', '-b']);
    if (result.exitCode !== 0) {
      return { branch: '', changeCount: 0, staged: 0, unstaged: 0, untracked: 0, ahead: 0, behind: 0 };
    }

    const lines = splitLines(result.stdout);
    let branch = '';
    let ahead = 0;
    let behind = 0;
    let staged = 0;
    let unstaged = 0;
    let untracked = 0;

    for (const line of lines) {
      if (line.startsWith('## ')) {
        // Parse branch line: ## branch...tracking [ahead N, behind M]
        const branchLine = line.slice(3);
        const dotIndex = branchLine.indexOf('...');
        if (dotIndex !== -1) {
          branch = branchLine.slice(0, dotIndex);
        } else {
          // No tracking info, might have additional info after space
          const spaceIdx = branchLine.indexOf(' ');
          branch = spaceIdx !== -1 ? branchLine.slice(0, spaceIdx) : branchLine;
        }

        const aheadMatch = /\[.*?ahead (\d+)/.exec(branchLine);
        const behindMatch = /\[.*?behind (\d+)/.exec(branchLine);
        if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);
        if (behindMatch) behind = parseInt(behindMatch[1], 10);
        continue;
      }

      if (line.length < 2) continue;

      const x = line[0];
      const y = line[1];

      if (x === '?' && y === '?') {
        untracked++;
        continue;
      }

      // Staged: X is not ' ' and not '?'
      if (x !== ' ' && x !== '?') {
        staged++;
      }

      // Unstaged: Y is not ' ' and not '?'
      if (y !== ' ' && y !== '?') {
        unstaged++;
      }
    }

    const changeCount = staged + unstaged + untracked;
    return { branch, changeCount, staged, unstaged, untracked, ahead, behind };
  } catch {
    return { branch: '', changeCount: 0, staged: 0, unstaged: 0, untracked: 0, ahead: 0, behind: 0 };
  }
}

/* ─── getBranches ──────────────────────────────────────────────────────────── */

/**
 * List local branches with tracking information.
 */
export async function getBranches(projectPath: string): Promise<Branch[]> {
  try {
    const result = await execGit(projectPath, [
      'branch',
      '-vv',
      '--format=%(refname:short)|%(HEAD)|%(upstream:short)|%(upstream:track)',
    ]);
    if (result.exitCode !== 0) return [];

    const lines = splitLines(result.stdout);
    const branches: Branch[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      const parts = line.split('|');
      if (parts.length < 4) continue;

      if (!parts[0]?.trim()) continue;
      const name = parts[0].trim();
      const isHead = parts[1]?.trim() === '*';
      const upstream = parts[2]?.trim() || undefined;
      const track = parts[3];

      let ahead = 0;
      let behind = 0;

      if (track) {
        const aheadMatch = /ahead (\d+)/.exec(track);
        const behindMatch = /behind (\d+)/.exec(track);
        if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);
        if (behindMatch) behind = parseInt(behindMatch[1], 10);
      }

      branches.push({ name, isHead, upstream, ahead, behind });
    }

    return branches;
  } catch {
    return [];
  }
}

/* ─── getWorktrees ─────────────────────────────────────────────────────────── */

/**
 * Parse `git worktree list --porcelain` output into a Worktree array.
 */
export async function getWorktrees(projectPath: string): Promise<Worktree[]> {
  try {
    const result = await execGit(projectPath, ['worktree', 'list', '--porcelain']);
    if (result.exitCode !== 0) return [];

    const output = result.stdout.trim();
    if (!output) return [];

    // Split into blocks separated by empty lines
    const blocks = output.split(/\r?\n\r?\n/);
    const worktrees: Worktree[] = [];
    let isFirst = true;

    for (const block of blocks) {
      const blockLines = splitLines(block);
      let wtPath = '';
      let branch = '';

      for (const bLine of blockLines) {
        if (bLine.startsWith('worktree ')) {
          wtPath = normalizePath(bLine.slice(9));
        } else if (bLine.startsWith('branch refs/heads/')) {
          branch = bLine.slice(18);
        } else if (bLine === 'detached') {
          branch = 'HEAD (detached)';
        }
      }

      if (!wtPath) continue;

      // Check if worktree is dirty
      let isDirty = false;
      try {
        const statusResult = await execGit(wtPath, ['status', '--porcelain']);
        isDirty = statusResult.exitCode === 0 && statusResult.stdout.trim().length > 0;
      } catch {
        // If we can't check, assume not dirty
      }

      worktrees.push({
        path: wtPath,
        branch,
        isMainWorktree: isFirst,
        isDirty,
      });
      isFirst = false;
    }

    return worktrees;
  } catch {
    return [];
  }
}

/* ─── createWorktree ───────────────────────────────────────────────────────── */

/**
 * Run `git worktree add <targetPath> <branch>`.
 */
export async function createWorktree(
  projectPath: string,
  branch: string,
  targetPath?: string,
): Promise<Worktree> {
  const normalizedRoot = normalizePath(projectPath);
  const resolved = targetPath
    ? normalizePath(targetPath)
    : `${normalizedRoot}-${branch.replace(/\//g, '-')}`;

  // Check whether the branch already exists locally
  const refCheck = await execGit(projectPath, [
    'show-ref', '--verify', '--quiet', `refs/heads/${branch}`,
  ]);
  const branchExists = refCheck.exitCode === 0;

  // If branch exists: checkout into worktree; otherwise create it fresh (-b)
  const args = branchExists
    ? ['worktree', 'add', resolved, branch]
    : ['worktree', 'add', '-b', branch, resolved];

  const result = await execGit(projectPath, args);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || 'Failed to create worktree');
  }

  // Find the new worktree in the list
  const worktrees = await getWorktrees(projectPath);
  const created = worktrees.find((wt) => normalizePath(wt.path) === resolved);
  if (created) return created;

  // Fallback if not found in list (shouldn't happen)
  return {
    path: resolved,
    branch,
    isMainWorktree: false,
    isDirty: false,
  };
}

/* ─── removeWorktree ───────────────────────────────────────────────────────── */

/**
 * Run `git worktree remove <worktreePath> --force`.
 */
export async function removeWorktree(
  projectPath: string,
  worktreePath: string,
): Promise<void> {
  const result = await execGit(projectPath, [
    'worktree', 'remove', normalizePath(worktreePath), '--force',
  ]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || 'Failed to remove worktree');
  }
}

/* ─── checkout ─────────────────────────────────────────────────────────────── */

/**
 * Run `git checkout <branch>`.
 */
export async function checkout(
  projectPath: string,
  branch: string,
): Promise<void> {
  const result = await execGit(projectPath, ['checkout', branch]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || 'Failed to checkout branch');
  }
}

/* ─── createBranch ─────────────────────────────────────────────────────────── */

/**
 * Run `git checkout -b <branchName>` to create and checkout a new branch.
 */
export async function createBranch(
  projectPath: string,
  branchName: string,
): Promise<void> {
  const result = await execGit(projectPath, ['checkout', '-b', branchName]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || 'Failed to create branch');
  }
}

/* ─── getRemoteBranches ────────────────────────────────────────────────────── */

/**
 * List remote branches via `git branch -r`.
 */
export async function getRemoteBranches(projectPath: string): Promise<RemoteBranch[]> {
  try {
    const result = await execGit(projectPath, [
      'branch', '-r', '--format=%(refname:short)',
    ]);
    if (result.exitCode !== 0) return [];
    const branches: RemoteBranch[] = [];
    for (const line of splitLines(result.stdout)) {
      const name = line.trim();
      if (!name || name.includes(' -> ')) continue; // skip HEAD pointer lines
      const slashIdx = name.indexOf('/');
      if (slashIdx === -1) continue;
      const remoteName = name.slice(0, slashIdx);
      const shortName = name.slice(slashIdx + 1);
      branches.push({ name, remoteName, shortName });
    }
    return branches;
  } catch {
    return [];
  }
}

/* ─── fetchRemote ──────────────────────────────────────────────────────────── */

/**
 * Run `git fetch [remote] [branch]`.
 */
export async function fetchRemote(
  projectPath: string,
  remote = 'origin',
  branch?: string,
): Promise<void> {
  const args = branch ? ['fetch', remote, branch] : ['fetch', remote];
  const result = await execGit(projectPath, args);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || 'Fetch failed');
  }
}

/* ─── pullBranch ───────────────────────────────────────────────────────────── */

/**
 * Run `git pull` in the given path (uses tracked upstream).
 */
export async function pullBranch(projectPath: string): Promise<void> {
  const result = await execGit(projectPath, ['pull']);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || 'Pull failed');
  }
}

/* ─── pushBranch ───────────────────────────────────────────────────────────── */

/**
 * Run `git push [--force-with-lease] [-u] origin <branch>`.
 * If no upstream is set, passes `-u` to set tracking.
 */
export async function pushBranch(
  projectPath: string,
  branchName: string,
  options: { force?: boolean; setUpstream?: boolean } = {},
): Promise<void> {
  const args: string[] = ['push'];
  if (options.force) args.push('--force-with-lease');
  if (options.setUpstream) args.push('-u');
  args.push('origin', branchName);
  const result = await execGit(projectPath, args);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || 'Push failed');
  }
}

/* ─── renameBranch ─────────────────────────────────────────────────────────── */

/**
 * Run `git branch -m <oldName> <newName>`.
 */
export async function renameBranch(
  projectPath: string,
  oldName: string,
  newName: string,
): Promise<void> {
  const result = await execGit(projectPath, ['branch', '-m', oldName, newName]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || 'Rename failed');
  }
}

/* ─── setUpstream ──────────────────────────────────────────────────────────── */

/**
 * Run `git branch --set-upstream-to=<upstream> <branchName>`.
 * upstream should be like "origin/main".
 */
export async function setUpstream(
  projectPath: string,
  branchName: string,
  upstream: string,
): Promise<void> {
  const result = await execGit(projectPath, [
    'branch', `--set-upstream-to=${upstream}`, branchName,
  ]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || 'Failed to set upstream');
  }
}

/* ─── unsetUpstream ────────────────────────────────────────────────────────── */

/**
 * Run `git branch --unset-upstream <branchName>`.
 */
export async function unsetUpstream(
  projectPath: string,
  branchName: string,
): Promise<void> {
  const result = await execGit(projectPath, [
    'branch', '--unset-upstream', branchName,
  ]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || 'Failed to unset upstream');
  }
}

/* ─── checkoutRemoteBranch ─────────────────────────────────────────────────── */

/**
 * Run `git checkout --track <remoteRef>` (e.g. "origin/feature/x").
 * Creates a local tracking branch with the short name of the remote ref.
 */
export async function checkoutRemoteBranch(
  projectPath: string,
  remoteRef: string,
): Promise<void> {
  const result = await execGit(projectPath, ['checkout', '--track', remoteRef]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || 'Failed to checkout remote branch');
  }
}

/* ─── getDiff ──────────────────────────────────────────────────────────────── */

/** Map porcelain status codes to our DiffFile status type. */
function mapStatus(code: string): 'M' | 'A' | 'D' | 'R' {
  if (code.startsWith('R')) return 'R';
  if (code === 'A' || code === '?') return 'A';
  if (code === 'D') return 'D';
  return 'M';
}

/**
 * Combine staged and unstaged diffs into a DiffFile array.
 */
export async function getDiff(projectPath: string): Promise<DiffFile[]> {
  try {
    const [unstagedResult, stagedResult, statusResult] = await Promise.all([
      execGit(projectPath, ['diff', '--numstat']),
      execGit(projectPath, ['diff', '--cached', '--numstat']),
      execGit(projectPath, ['status', '--porcelain=v1']),
    ]);

    // Build a map of file statuses from porcelain output
    const statusMap = new Map<string, { x: string; y: string }>();
    for (const line of splitLines(statusResult.stdout)) {
      if (line.length < 3) continue;
      const x = line[0];
      const y = line[1];
      const filePath = line.slice(3).trim();
      // Handle renames: "R  old -> new"
      const arrowIdx = filePath.indexOf(' -> ');
      const actualPath = arrowIdx !== -1 ? filePath.slice(arrowIdx + 4) : filePath;
      statusMap.set(actualPath, { x, y });
    }

    const fileMap = new Map<string, DiffFile>();

    // Parse unstaged numstat
    for (const line of splitLines(unstagedResult.stdout)) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      if (parts.length < 3) continue;
      const additions = parts[0] === '-' ? 0 : parseInt(parts[0], 10);
      const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10);
      const filePath = parts.slice(2).join('\t'); // filenames can have tabs (unlikely, but safe)

      const st = statusMap.get(filePath);
      const statusCode = st ? mapStatus(st.y) : 'M';

      const existing = fileMap.get(filePath);
      if (existing) {
        existing.additions += additions;
        existing.deletions += deletions;
      } else {
        fileMap.set(filePath, {
          filePath,
          status: statusCode,
          additions,
          deletions,
          hunks: [],
        });
      }
    }

    // Parse staged numstat
    for (const line of splitLines(stagedResult.stdout)) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      if (parts.length < 3) continue;
      const additions = parts[0] === '-' ? 0 : parseInt(parts[0], 10);
      const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10);
      const filePath = parts.slice(2).join('\t');

      const st = statusMap.get(filePath);
      const statusCode = st ? mapStatus(st.x) : 'M';

      const existing = fileMap.get(filePath);
      if (existing) {
        existing.additions += additions;
        existing.deletions += deletions;
      } else {
        fileMap.set(filePath, {
          filePath,
          status: statusCode,
          additions,
          deletions,
          hunks: [],
        });
      }
    }

    // Also add untracked files from status that won't appear in numstat
    for (const [filePath, st] of statusMap) {
      if (st.x === '?' && st.y === '?' && !fileMap.has(filePath)) {
        fileMap.set(filePath, {
          filePath,
          status: 'A',
          additions: 0,
          deletions: 0,
          hunks: [],
        });
      }
    }

    return Array.from(fileMap.values());
  } catch {
    return [];
  }
}

/* ─── getDiffHunks ─────────────────────────────────────────────────────────── */

/** Parse a unified diff string into DiffHunk[]. */
function parseUnifiedDiff(diffOutput: string): DiffHunk[] {
  if (!diffOutput.trim()) return [];

  const lines = splitLines(diffOutput);
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    // Hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    if (line.startsWith('@@')) {
      const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
        currentHunk = { header: line, lines: [] };
        hunks.push(currentHunk);
      }
      continue;
    }

    if (!currentHunk) continue;

    // Skip diff headers (---, +++, diff --git, index, etc.)
    if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) {
      continue;
    }

    // No newline marker
    if (line.startsWith('\\ No newline')) continue;

    let diffLine: DiffLine;
    if (line.startsWith('+')) {
      diffLine = { type: 'added', content: line.slice(1), oldLineNumber: null, newLineNumber: newLine };
      newLine++;
    } else if (line.startsWith('-')) {
      diffLine = { type: 'deleted', content: line.slice(1), oldLineNumber: oldLine, newLineNumber: null };
      oldLine++;
    } else {
      // Context line (starts with ' ' or is empty for blank context lines)
      const content = line.startsWith(' ') ? line.slice(1) : line;
      diffLine = { type: 'context', content, oldLineNumber: oldLine, newLineNumber: newLine };
      oldLine++;
      newLine++;
    }

    currentHunk.lines.push(diffLine);
  }

  return hunks;
}

/**
 * Get diff hunks for a specific file.
 * Tries: unstaged diff → staged diff → untracked (full file as added).
 */
export async function getDiffHunks(
  projectPath: string,
  filePath: string,
): Promise<DiffHunk[]> {
  try {
    // Try unstaged diff first
    const unstaged = await execGit(projectPath, ['diff', '-U3', '--', filePath]);
    if (unstaged.stdout.trim()) {
      return parseUnifiedDiff(unstaged.stdout);
    }

    // Try staged diff
    const staged = await execGit(projectPath, ['diff', '--cached', '-U3', '--', filePath]);
    if (staged.stdout.trim()) {
      return parseUnifiedDiff(staged.stdout);
    }

    // For untracked/newly added files, show full content as all-added lines
    const show = await execGit(projectPath, ['show', `HEAD:${normalizePath(filePath)}`]);
    if (show.exitCode !== 0) {
      // File doesn't exist in HEAD -- it's new. Read the working tree file directly.
      const { readFileSync } = await import('node:fs');
      const { join } = await import('node:path');
      try {
        const fullPath = join(projectPath, filePath).replace(/\\/g, '/');
        const content = readFileSync(fullPath, 'utf8');
        const lines = content.split(/\r?\n/);
        const diffLines: DiffLine[] = lines.map((line, i) => ({
          type: 'added' as const,
          content: line,
          newLineNumber: i + 1,
        }));
        return [{
          header: `@@ -0,0 +1,${lines.length} @@ (new file)`,
          lines: diffLines,
        }];
      } catch {
        return [];
      }
    }

    return [];
  } catch {
    return [];
  }
}

/* ─── getFileContent ───────────────────────────────────────────────────────── */

/**
 * Returns the HEAD and working-tree content of a file.
 * head is null when the file doesn't exist in HEAD (newly added file).
 */
export async function getFileContent(
  projectPath: string,
  filePath: string,
): Promise<{ head: string | null; working: string }> {
  const normalizedPath = normalizePath(filePath);

  let head: string | null = null;
  try {
    const show = await execGit(projectPath, ['show', `HEAD:${normalizedPath}`]);
    if (show.exitCode === 0) {
      head = show.stdout;
    }
  } catch {
    head = null;
  }

  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const working = await readFile(join(projectPath, filePath), 'utf8');

  return { head, working };
}

/* ─── launchExternalDiff ────────────────────────────────────────────────────── */

/**
 * Write HEAD content to a temp file and spawn a configured external diff tool.
 * The process is detached and fire-and-forget.
 */
export async function launchExternalDiff(
  projectPath: string,
  filePath: string,
  fileStatus: 'M' | 'A' | 'D' | 'R',
  commandTemplate: string,
): Promise<void> {
  const normalizedPath = normalizePath(filePath);

  // 1. Generate temp path preserving the file extension
  const tempPath = join(
    tmpdir(),
    `nexus-diff-${Date.now()}-${Math.random().toString(36).slice(2)}${extname(filePath)}`,
  ).replace(/\\/g, '/');

  // 2. HEAD content: new files have no HEAD counterpart
  let headContent = '';
  if (fileStatus !== 'A') {
    try {
      const show = await execGit(projectPath, ['show', `HEAD:${normalizedPath}`]);
      if (show.exitCode === 0) {
        headContent = show.stdout;
      }
    } catch {
      // Fall through with empty content
    }
  }

  // 3. Write HEAD content to temp file
  await writeFile(tempPath, headContent, 'utf8');

  // 4. Working path (forward-slash normalized)
  const workingPath = join(projectPath, filePath).replace(/\\/g, '/');

  // 5. Substitute placeholders in template
  let finalCommand = commandTemplate;
  if (commandTemplate.includes('{original}') || commandTemplate.includes('{modified}')) {
    finalCommand = commandTemplate
      .replace('{original}', tempPath)
      .replace('{modified}', workingPath);
  } else {
    // No placeholders — append both paths
    finalCommand = `${commandTemplate} ${tempPath} ${workingPath}`;
  }

  // 6. Split and spawn detached
  const parts = finalCommand.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return;
  spawn(parts[0], parts.slice(1), { detached: true, stdio: 'ignore', shell: true }).unref();
}

/* ─── stageFile ────────────────────────────────────────────────────────────── */

/**
 * Run `git add -- <filePath>` to stage a single file.
 */
export async function stageFile(
  projectPath: string,
  filePath: string,
): Promise<void> {
  const result = await execGit(projectPath, ['add', '--', normalizePath(filePath)]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `Failed to stage file: ${filePath}`);
  }
}

/* ─── unstageFile ──────────────────────────────────────────────────────────── */

/**
 * Run `git reset HEAD -- <filePath>` to unstage a single file.
 */
export async function unstageFile(
  projectPath: string,
  filePath: string,
): Promise<void> {
  const result = await execGit(projectPath, ['reset', 'HEAD', '--', normalizePath(filePath)]);
  // git reset HEAD exits with 1 when there is nothing to unstage but it still works;
  // only throw on actual errors (exit 128+).
  if (result.exitCode !== 0 && result.exitCode !== 1) {
    throw new Error(result.stderr || `Failed to unstage file: ${filePath}`);
  }
}

/* ─── revertFile ───────────────────────────────────────────────────────────── */

/**
 * Run `git checkout HEAD -- <filePath>` to discard working-tree changes.
 * Only valid for modified (M) or deleted (D) files — new files have no HEAD.
 */
export async function revertFile(
  projectPath: string,
  filePath: string,
): Promise<void> {
  await execGit(projectPath, ['checkout', 'HEAD', '--', normalizePath(filePath)]);
}

/* ─── deleteFile ───────────────────────────────────────────────────────────── */

/**
 * Delete a file from the working tree by removing it from the filesystem.
 * Only valid for untracked (A) or modified (M) files.
 */
export async function deleteFile(
  projectPath: string,
  filePath: string,
): Promise<void> {
  await unlink(join(projectPath, filePath));
}

/* ─── stageAll ─────────────────────────────────────────────────────────────── */

/**
 * Run `git add -A` to stage all changes.
 */
export async function stageAll(projectPath: string): Promise<void> {
  const result = await execGit(projectPath, ['add', '-A']);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || 'Failed to stage all files');
  }
}

/* ─── commit ───────────────────────────────────────────────────────────────── */

/**
 * Run `git commit -m <message>` and return the new commit hash.
 * Throws if message is empty or the command fails.
 */
export async function commit(
  projectPath: string,
  message: string,
): Promise<string> {
  if (!message.trim()) {
    throw new Error('Commit message must not be empty');
  }

  const result = await execGit(projectPath, ['commit', '-m', message]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || 'Commit failed');
  }

  // Extract the commit hash from stdout, e.g.:
  //   [main (root-commit) abc1234] message
  const match = /\[.*?([0-9a-f]{7,40})\]/.exec(result.stdout);
  if (match) return match[1];

  // Fallback: ask git for the HEAD hash
  const headResult = await execGit(projectPath, ['rev-parse', 'HEAD']);
  return headResult.stdout.trim();
}

/* ─── getCommitDiff ────────────────────────────────────────────────────────── */

/**
 * Return the list of files changed in a specific commit as DiffFile[].
 * Uses `git diff-tree --no-commit-id -r --numstat` for stats and
 * `git diff-tree --no-commit-id -r --name-status` for status codes.
 */
export async function getCommitDiff(
  projectPath: string,
  commitHash: string,
): Promise<DiffFile[]> {
  try {
    const [numstatResult, nameStatusResult] = await Promise.all([
      execGit(projectPath, ['diff-tree', '--no-commit-id', '-r', '--numstat', commitHash]),
      execGit(projectPath, ['diff-tree', '--no-commit-id', '-r', '--name-status', commitHash]),
    ]);

    if (numstatResult.exitCode !== 0) return [];

    // Build status map from name-status output
    // Format: <status>\t<path>  or  R<score>\t<old>\t<new>
    const statusMap = new Map<string, { status: 'M' | 'A' | 'D' | 'R'; oldPath?: string }>();
    for (const line of splitLines(nameStatusResult.stdout)) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      if (parts.length < 2) continue;
      const code = parts[0]?.trim() ?? '';
      if (code.startsWith('R') && parts.length >= 3) {
        const newPath = parts[2]?.trim() ?? '';
        const oldPath = parts[1]?.trim() ?? '';
        statusMap.set(newPath, { status: 'R', oldPath });
      } else {
        const filePath = parts[1]?.trim() ?? '';
        statusMap.set(filePath, { status: mapStatus(code) });
      }
    }

    const files: DiffFile[] = [];

    // Parse numstat: <added>\t<deleted>\t<path>
    for (const line of splitLines(numstatResult.stdout)) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      if (parts.length < 3) continue;
      const additions = parts[0] === '-' ? 0 : parseInt(parts[0] ?? '0', 10);
      const deletions = parts[1] === '-' ? 0 : parseInt(parts[1] ?? '0', 10);
      const filePath = parts.slice(2).join('\t');

      const statusEntry = statusMap.get(filePath);
      files.push({
        filePath,
        status: statusEntry?.status ?? 'M',
        additions,
        deletions,
        hunks: [],
        ...(statusEntry?.oldPath !== undefined ? { oldPath: statusEntry.oldPath } : {}),
      });
    }

    return files;
  } catch {
    return [];
  }
}

/* ─── getCommitFileHunks ───────────────────────────────────────────────────── */

/**
 * Return the diff hunks for a single file within a specific commit.
 * Uses `git show --format= -U3 <hash> -- <file>`.
 */
export async function getCommitFileHunks(
  projectPath: string,
  commitHash: string,
  filePath: string,
): Promise<DiffHunk[]> {
  try {
    const result = await execGit(projectPath, [
      'show',
      '--format=',
      '-U3',
      commitHash,
      '--',
      normalizePath(filePath),
    ]);
    if (result.exitCode !== 0 || !result.stdout.trim()) return [];
    return parseUnifiedDiff(result.stdout);
  } catch {
    return [];
  }
}

/* ─── getLog ───────────────────────────────────────────────────────────────── */

function timeAgo(isoTimestamp: string): string {
  const diff = Date.now() - new Date(isoTimestamp).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Parse the %D (decoration) field from git log into clean ref names.
 * Examples:
 *   "HEAD -> main, origin/main, tag: v1.0" -> ["HEAD", "main", "origin/main", "v1.0"]
 *   "" -> []
 */
function parseRefs(decoration: string): string[] {
  if (!decoration.trim()) return [];
  const refs: string[] = [];
  for (const raw of decoration.split(',')) {
    let ref = raw.trim();
    if (!ref) continue;
    // "HEAD -> main" produces two refs: HEAD and main
    if (ref.includes(' -> ')) {
      const [left, right] = ref.split(' -> ');
      if (left?.trim()) refs.push(left.trim());
      if (right?.trim()) refs.push(right.trim());
      continue;
    }
    // "tag: v1.0" -> "v1.0"
    if (ref.startsWith('tag: ')) {
      ref = ref.slice(5);
    }
    refs.push(ref);
  }
  return refs;
}

/**
 * Parse git log with numstat into Commit[].
 * Format includes parent hashes (%P) and decorations (%D) for graph rendering.
 */
export async function getLog(
  projectPath: string,
  count = 50,
): Promise<Commit[]> {
  try {
    // Use a delimiter unlikely to appear in commit messages
    const SEP = '---nexus-commit-sep---';
    const result = await execGit(projectPath, [
      'log',
      `--format=${SEP}%n%H|%P|%s|%an|%ae|%aI|%D`,
      '--numstat',
      `-n${count}`,
    ]);

    if (result.exitCode !== 0 || !result.stdout.trim()) return [];

    const commits: Commit[] = [];
    const blocks = result.stdout.split(SEP).filter((b) => b.trim());

    for (const block of blocks) {
      const blockLines = splitLines(block).filter((l) => l.trim());
      if (blockLines.length === 0) continue;

      // First line is the formatted commit info:
      // %H|%P|%s|%an|%ae|%aI|%D
      const infoLine = blockLines[0];

      // Parse fields by pipe delimiter. We need exactly 7 fields but the
      // message (%s) and decoration (%D) can contain pipes, so we parse
      // positionally: hash is first, parents is second, then we parse from
      // the right for the unambiguous fields.
      const pipeIdx1 = infoLine.indexOf('|');
      if (pipeIdx1 === -1) continue;
      const hash = infoLine.slice(0, pipeIdx1);
      const afterHash = infoLine.slice(pipeIdx1 + 1);

      // Parents field: space-separated hashes (or empty for root commit)
      const pipeIdx2 = afterHash.indexOf('|');
      if (pipeIdx2 === -1) continue;
      const parentsRaw = afterHash.slice(0, pipeIdx2);
      const parents = parentsRaw.trim() ? parentsRaw.trim().split(/\s+/) : [];
      const afterParents = afterHash.slice(pipeIdx2 + 1);

      // Remaining: %s|%an|%ae|%aI|%D
      // Parse from the right to handle pipes in the message.
      // %D is after the last pipe, %aI before that, %ae before that, %an before that.
      // Find the last 4 pipes from the right.
      const rightPipes: number[] = [];
      for (let i = afterParents.length - 1; i >= 0 && rightPipes.length < 4; i--) {
        if (afterParents[i] === '|') {
          rightPipes.push(i);
        }
      }

      if (rightPipes.length < 4) continue;

      // rightPipes[0] = before %D, rightPipes[1] = before %aI, etc.
      const message = afterParents.slice(0, rightPipes[3]);
      const author = afterParents.slice(rightPipes[3] + 1, rightPipes[2]);
      // _email parsed for correct field alignment
      const _email = afterParents.slice(rightPipes[2] + 1, rightPipes[1]);
      const timestamp = afterParents.slice(rightPipes[1] + 1, rightPipes[0]);
      const decorationRaw = afterParents.slice(rightPipes[0] + 1);

      const refs = parseRefs(decorationRaw);

      // Parse numstat lines for additions/deletions
      let additions = 0;
      let deletions = 0;
      for (let i = 1; i < blockLines.length; i++) {
        const parts = blockLines[i].split('\t');
        if (parts.length >= 3) {
          const add = parts[0] === '-' ? 0 : parseInt(parts[0], 10);
          const del = parts[1] === '-' ? 0 : parseInt(parts[1], 10);
          if (!isNaN(add)) additions += add;
          if (!isNaN(del)) deletions += del;
        }
      }

      // Heuristic for AI-generated commits
      const isAIGenerated =
        /\bco-authored-by:.*\b(copilot|claude|gpt|ai|bot)\b/i.test(message) ||
        /\b(ai|generated|auto-generated)\b/i.test(message);

      commits.push({
        hash,
        message,
        author,
        authorInitials: initials(author),
        timestamp,
        timeAgo: timeAgo(timestamp),
        additions,
        deletions,
        isAIGenerated,
        parents,
        refs,
      });
    }

    return commits;
  } catch {
    return [];
  }
}
