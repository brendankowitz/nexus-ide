import type { Branch, RemoteBranch } from '@/types';

// ── Types ──────────────────────────────────────────

export interface BranchGroup { prefix: string; branches: Branch[]; }
export interface GroupedBranches { topLevel: Branch[]; groups: BranchGroup[]; }
export interface RemoteGroup { prefix: string; branches: RemoteBranch[]; }
export interface GroupedRemotes { topLevel: RemoteBranch[]; groups: RemoteGroup[]; }

// ── Branch grouping ────────────────────────────────

export function groupBranches(branches: Branch[]): GroupedBranches {
  const topLevel: Branch[] = [];
  const groupMap = new Map<string, Branch[]>();
  for (const b of branches) {
    const i = b.name.indexOf('/');
    if (i === -1) { topLevel.push(b); continue; }
    const p = b.name.slice(0, i);
    const ex = groupMap.get(p);
    if (ex) ex.push(b); else groupMap.set(p, [b]);
  }
  return { topLevel, groups: Array.from(groupMap.entries()).map(([prefix, branches]) => ({ prefix, branches })) };
}

export function groupRemoteBranches(branches: RemoteBranch[]): GroupedRemotes {
  const topLevel: RemoteBranch[] = [];
  const groupMap = new Map<string, RemoteBranch[]>();
  for (const b of branches) {
    const i = b.shortName.indexOf('/');
    if (i === -1) { topLevel.push(b); continue; }
    const p = b.shortName.slice(0, i);
    const ex = groupMap.get(p);
    if (ex) ex.push(b); else groupMap.set(p, [b]);
  }
  return { topLevel, groups: Array.from(groupMap.entries()).map(([prefix, branches]) => ({ prefix, branches })) };
}

export function findHeadPrefix(branches: Branch[]): string | null {
  for (const b of branches) {
    if (b.isHead) { const i = b.name.indexOf('/'); return i !== -1 ? b.name.slice(0, i) : null; }
  }
  return null;
}

export function initCollapsedState(
  groups: BranchGroup[],
  headPrefix: string | null,
): Record<string, boolean> {
  const s: Record<string, boolean> = {};
  for (const g of groups) s[g.prefix] = g.prefix !== headPrefix;
  return s;
}

// ── Remote tree (recursive, path-compressed) ───────

export interface RemoteLeaf { branch: RemoteBranch; label: string; }

export interface RemoteTreeNode {
  label: string;
  key: string;
  leaves: RemoteLeaf[];
  children: RemoteTreeNode[];
}

function insertLeaf(node: RemoteTreeNode, parts: string[], branch: RemoteBranch): void {
  if (parts.length === 1) { node.leaves.push({ branch, label: parts[0]! }); return; }
  const [head, ...rest] = parts;
  let child = node.children.find((c) => c.label === head);
  if (!child) {
    child = { label: head!, key: `${node.key}/${head}`, leaves: [], children: [] };
    node.children.push(child);
  }
  insertLeaf(child, rest, branch);
}

function compressNode(node: RemoteTreeNode): void {
  for (const child of node.children) compressNode(child);
  const newLeaves: RemoteLeaf[] = [...node.leaves];
  const newChildren: RemoteTreeNode[] = [];
  for (const child of node.children) {
    const total = child.leaves.length + child.children.length;
    if (total === 1) {
      if (child.leaves.length === 1) {
        const leaf = child.leaves[0]!;
        newLeaves.push({ branch: leaf.branch, label: `${child.label}/${leaf.label}` });
      } else {
        const grandchild = child.children[0]!;
        newChildren.push({ ...grandchild, label: `${child.label}/${grandchild.label}` });
      }
    } else {
      newChildren.push(child);
    }
  }
  node.leaves = newLeaves;
  node.children = newChildren;
}

export function buildRemoteTree(remoteName: string, branches: RemoteBranch[]): RemoteTreeNode {
  const root: RemoteTreeNode = { label: remoteName, key: remoteName, leaves: [], children: [] };
  for (const branch of branches) insertLeaf(root, branch.shortName.split('/'), branch);
  compressNode(root);
  return root;
}

export function collectTreeKeys(node: RemoteTreeNode): string[] {
  return [node.key, ...node.children.flatMap(collectTreeKeys)];
}

// ── Push error detection ───────────────────────────

/**
 * Returns true if the git push error message indicates the remote has diverged
 * and a force push is required (non-fast-forward rejection).
 */
export function isPushRejectedNeedingForce(msg: string): boolean {
  return (
    msg.includes('non-fast-forward') ||
    msg.includes('Updates were rejected') ||
    msg.includes('fetch first') ||
    (msg.includes('rejected') && msg.includes('tip of your current branch is behind'))
  );
}
