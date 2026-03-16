import { describe, it, expect } from 'vitest';
import {
  groupBranches,
  groupRemoteBranches,
  findHeadPrefix,
  initCollapsedState,
  isPushRejectedNeedingForce,
} from './branchUtils';
import type { Branch, RemoteBranch } from '@/types';

// ── helpers ────────────────────────────────────────

function branch(name: string, isHead = false): Branch {
  return { name, isHead, ahead: 0, behind: 0 };
}

function remote(name: string): RemoteBranch {
  const slash = name.indexOf('/');
  return { name, remoteName: name.slice(0, slash), shortName: name.slice(slash + 1) };
}

// ── groupBranches ──────────────────────────────────

describe('groupBranches', () => {
  it('splits top-level and prefixed branches', () => {
    const result = groupBranches([
      branch('main'),
      branch('feat/login'),
      branch('feat/dashboard'),
      branch('fix/typo'),
    ]);
    expect(result.topLevel.map((b) => b.name)).toEqual(['main']);
    expect(result.groups).toHaveLength(2);
    const feat = result.groups.find((g) => g.prefix === 'feat');
    expect(feat?.branches).toHaveLength(2);
    const fix = result.groups.find((g) => g.prefix === 'fix');
    expect(fix?.branches).toHaveLength(1);
  });

  it('handles all top-level branches', () => {
    const result = groupBranches([branch('main'), branch('dev')]);
    expect(result.topLevel).toHaveLength(2);
    expect(result.groups).toHaveLength(0);
  });

  it('handles empty input', () => {
    const result = groupBranches([]);
    expect(result.topLevel).toHaveLength(0);
    expect(result.groups).toHaveLength(0);
  });
});

// ── groupRemoteBranches ────────────────────────────

describe('groupRemoteBranches', () => {
  it('groups by short-name prefix', () => {
    const result = groupRemoteBranches([
      remote('origin/main'),
      remote('origin/feat/x'),
      remote('origin/feat/y'),
    ]);
    expect(result.topLevel.map((b) => b.shortName)).toEqual(['main']);
    expect(result.groups[0]?.prefix).toBe('feat');
    expect(result.groups[0]?.branches).toHaveLength(2);
  });
});

// ── findHeadPrefix ─────────────────────────────────

describe('findHeadPrefix', () => {
  it('returns the prefix of the HEAD branch', () => {
    expect(findHeadPrefix([branch('main'), branch('feat/login', true)])).toBe('feat');
  });

  it('returns null when HEAD is top-level', () => {
    expect(findHeadPrefix([branch('main', true), branch('feat/x')])).toBeNull();
  });

  it('returns null when no HEAD', () => {
    expect(findHeadPrefix([branch('main'), branch('dev')])).toBeNull();
  });
});

// ── initCollapsedState ─────────────────────────────

describe('initCollapsedState', () => {
  it('collapses all groups except the one containing HEAD', () => {
    const groups = [
      { prefix: 'feat', branches: [] },
      { prefix: 'fix', branches: [] },
    ];
    const state = initCollapsedState(groups, 'feat');
    expect(state['feat']).toBe(false);
    expect(state['fix']).toBe(true);
  });

  it('collapses all groups when headPrefix is null', () => {
    const groups = [{ prefix: 'feat', branches: [] }];
    const state = initCollapsedState(groups, null);
    expect(state['feat']).toBe(true);
  });
});

// ── isPushRejectedNeedingForce ─────────────────────

describe('isPushRejectedNeedingForce', () => {
  it('detects non-fast-forward rejection', () => {
    expect(isPushRejectedNeedingForce(
      "error: failed to push some refs\n! [rejected] main -> main (non-fast-forward)",
    )).toBe(true);
  });

  it('detects "Updates were rejected" message', () => {
    expect(isPushRejectedNeedingForce(
      "Updates were rejected because the tip of your current branch is behind its remote counterpart.",
    )).toBe(true);
  });

  it('detects "fetch first" message', () => {
    expect(isPushRejectedNeedingForce(
      "Updates were rejected because the remote contains work that you do not have locally. Integrate the remote changes (e.g.\n'git pull ...') before pushing again.\nSee the 'Note about fast-forwards' in 'git push --help' for details.\nHint: Updates were rejected because the remote contains work that you do\nnot have locally. If you want to force push, use '--force'. But if you have something locally that the remote doesn't, you may want to 'fetch first'.",
    )).toBe(true);
  });

  it('does not match auth failures', () => {
    expect(isPushRejectedNeedingForce(
      "remote: Permission denied.\nfatal: unable to access 'https://github.com/...': The requested URL returned error: 403",
    )).toBe(false);
  });

  it('does not match network errors', () => {
    expect(isPushRejectedNeedingForce(
      "fatal: unable to connect to github.com",
    )).toBe(false);
  });
});
