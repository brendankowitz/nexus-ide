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
