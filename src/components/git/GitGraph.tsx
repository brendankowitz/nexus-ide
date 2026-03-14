import { useMemo } from 'react';
import type { Commit } from '@/types';

// ── Constants ────────────────────────────────────

const LANE_WIDTH = 12;
const ROW_HEIGHT = 44;
const NODE_RADIUS = 3;
const LINE_WIDTH = 1.5;

// ── Graph algorithm types ────────────────────────

interface GraphNode {
  readonly commitHash: string;
  readonly lane: number;
  readonly parentLanes: number[];
}

// ── Lane computation ─────────────────────────────

function computeGraph(commits: readonly Commit[]): GraphNode[] {
  const hashToIndex = new Map<string, number>();
  for (let i = 0; i < commits.length; i++) {
    hashToIndex.set(commits[i].hash, i);
  }

  // Each lane slot holds the hash of the commit that is expected to appear
  // in that lane (i.e., a parent we haven't visited yet).
  const activeLanes: (string | null)[] = [];
  const nodes: GraphNode[] = [];

  for (const commit of commits) {
    // Find the lane this commit was reserved in, or allocate a new one
    let lane = activeLanes.indexOf(commit.hash);
    if (lane === -1) {
      // Not reserved -- find first free lane or append
      lane = activeLanes.indexOf(null);
      if (lane === -1) {
        lane = activeLanes.length;
        activeLanes.push(null);
      }
    }

    // Free this lane -- the commit has arrived
    activeLanes[lane] = null;

    // Close any duplicate reservations for this same hash (can happen with
    // multiple children pointing to the same parent). Free all but keep the
    // first occurrence so merge lines still draw correctly.
    for (let i = 0; i < activeLanes.length; i++) {
      if (i !== lane && activeLanes[i] === commit.hash) {
        activeLanes[i] = null;
      }
    }

    const parentLanes: number[] = [];
    for (let p = 0; p < commit.parents.length; p++) {
      const parentHash = commit.parents[p];
      // Check if this parent is already reserved in a lane
      let pLane = activeLanes.indexOf(parentHash);
      if (pLane === -1) {
        if (p === 0) {
          // First parent continues in the same lane (straight line down)
          pLane = lane;
        } else {
          // Additional parents get a new lane
          pLane = activeLanes.indexOf(null);
          if (pLane === -1) {
            pLane = activeLanes.length;
            activeLanes.push(null);
          }
        }
        activeLanes[pLane] = parentHash;
      }
      parentLanes.push(pLane);
    }

    nodes.push({ commitHash: commit.hash, lane, parentLanes });
  }

  return nodes;
}

// ── SVG path helpers ─────────────────────────────

/** Build an SVG path from a node to a parent lane in the next row using a bezier curve. */
function connectionPath(
  fromLane: number,
  fromRow: number,
  toLane: number,
): string {
  const x1 = fromLane * LANE_WIDTH + LANE_WIDTH / 2;
  const y1 = fromRow * ROW_HEIGHT + ROW_HEIGHT / 2;
  const x2 = toLane * LANE_WIDTH + LANE_WIDTH / 2;
  const y2 = (fromRow + 1) * ROW_HEIGHT + ROW_HEIGHT / 2;

  if (x1 === x2) {
    // Straight vertical line
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  // Bezier curve for merge/fork lines
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}

/** Build pass-through lines for lanes that continue through a row without a node. */
function passThroughPaths(
  row: number,
  activeLanesAtRow: Set<number>,
  nodeLane: number,
): string[] {
  const paths: string[] = [];
  for (const lane of activeLanesAtRow) {
    if (lane === nodeLane) continue;
    const x = lane * LANE_WIDTH + LANE_WIDTH / 2;
    const y1 = row * ROW_HEIGHT + ROW_HEIGHT / 2;
    const y2 = (row + 1) * ROW_HEIGHT + ROW_HEIGHT / 2;
    paths.push(`M ${x} ${y1} L ${x} ${y2}`);
  }
  return paths;
}

// ── Ref label helpers ────────────────────────────

function formatRef(ref: string): string {
  if (ref.startsWith('refs/heads/')) return ref.slice(11);
  if (ref.startsWith('refs/remotes/')) return ref.slice(13);
  if (ref.startsWith('refs/tags/')) return ref.slice(10);
  return ref;
}

function getRefColorClasses(ref: string): string {
  const lower = ref.toLowerCase();
  if (lower === 'head' || lower === 'main' || lower === 'master') {
    return 'bg-[var(--phase-execute-glow)] text-[var(--phase-execute)] border-[var(--phase-execute-dim)]';
  }
  if (lower.startsWith('feat/') || lower.startsWith('feature/')) {
    return 'bg-[var(--phase-plan-glow)] text-[var(--phase-plan)] border-[var(--phase-plan-dim)]';
  }
  if (lower.startsWith('fix/') || lower.startsWith('hotfix/') || lower.startsWith('bugfix/')) {
    return 'bg-[var(--phase-validate-glow)] text-[var(--phase-validate)] border-[var(--phase-validate-dim)]';
  }
  if (lower.startsWith('origin/')) {
    return 'bg-bg-active text-text-secondary border-border-default';
  }
  // Tags and other refs
  if (lower.startsWith('v') && /^v?\d/.test(lower)) {
    return 'bg-[var(--color-modified)]/.15 text-[var(--color-modified)] border-[var(--color-modified)]/.3';
  }
  return 'bg-bg-active text-text-secondary border-border-default';
}

// ── Component ────────────────────────────────────

interface GitGraphProps {
  readonly commits: readonly Commit[];
}

export const GitGraph = ({ commits }: GitGraphProps): React.JSX.Element => {
  const { nodes, maxLanes } = useMemo(() => {
    const graphNodes = computeGraph(commits);
    let max = 1;
    for (const node of graphNodes) {
      const nodeLaneMax = node.lane + 1;
      if (nodeLaneMax > max) max = nodeLaneMax;
      for (const pl of node.parentLanes) {
        if (pl + 1 > max) max = pl + 1;
      }
    }
    return { nodes: graphNodes, maxLanes: max };
  }, [commits]);

  // Pre-compute which lanes are "active" (have a pass-through line) at each row
  const { connectionPaths, passThroughPathsAll, nodePositions } = useMemo(() => {
    const connections: string[] = [];
    const passThrough: string[] = [];
    const positions: Array<{ x: number; y: number; isHead: boolean }> = [];

    // Track active lanes: after processing row i, which lanes have a line
    // continuing to the next row.
    const active = new Set<number>();

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const commit = commits[i];

      // Node position
      const cx = node.lane * LANE_WIDTH + LANE_WIDTH / 2;
      const cy = i * ROW_HEIGHT + ROW_HEIGHT / 2;
      const isHead = commit.refs.some(r => r === 'HEAD');
      positions.push({ x: cx, y: cy, isHead });

      // Pass-through lines: active lanes that aren't this node's lane
      passThrough.push(...passThroughPaths(i, active, node.lane));

      // Remove this node's lane from active (it terminates here)
      active.delete(node.lane);

      // Draw connection lines to parent lanes and mark them active
      for (const pLane of node.parentLanes) {
        connections.push(connectionPath(node.lane, i, pLane));
        active.add(pLane);
      }
    }

    return {
      connectionPaths: connections,
      passThroughPathsAll: passThrough,
      nodePositions: positions,
    };
  }, [nodes, commits]);

  const svgWidth = maxLanes * LANE_WIDTH;
  const svgHeight = commits.length * ROW_HEIGHT;

  return (
    <div className="relative shrink-0" style={{ width: svgWidth + 4 }}>
      <svg
        width={svgWidth + 4}
        height={svgHeight}
        className="block"
        style={{ marginLeft: 2 }}
      >
        {/* Pass-through lines (background) */}
        {passThroughPathsAll.map((d, i) => (
          <path
            key={`pt-${i}`}
            d={d}
            fill="none"
            stroke="var(--text-ghost)"
            strokeWidth={LINE_WIDTH}
          />
        ))}
        {/* Connection lines (parent links) */}
        {connectionPaths.map((d, i) => (
          <path
            key={`cn-${i}`}
            d={d}
            fill="none"
            stroke="var(--text-ghost)"
            strokeWidth={LINE_WIDTH}
          />
        ))}
        {/* Commit nodes */}
        {nodePositions.map((pos, i) => (
          <circle
            key={`nd-${i}`}
            cx={pos.x}
            cy={pos.y}
            r={NODE_RADIUS}
            fill={pos.isHead ? 'var(--phase-plan)' : 'var(--text-secondary)'}
            stroke={pos.isHead ? 'var(--phase-plan)' : 'var(--text-secondary)'}
            strokeWidth={0.5}
          />
        ))}
      </svg>
    </div>
  );
};

// ── Ref badges (exported for use by CommitLog) ───

interface RefBadgesProps {
  readonly refs: readonly string[];
}

export const RefBadges = ({ refs }: RefBadgesProps): React.JSX.Element | null => {
  if (refs.length === 0) return null;

  return (
    <span className="inline-flex gap-1 ml-1.5">
      {refs.map((ref) => (
        <span
          key={ref}
          className={`inline-block px-1.5 py-px rounded-sm border font-mono text-[9px] font-medium leading-tight ${getRefColorClasses(ref)}`}
        >
          {formatRef(ref)}
        </span>
      ))}
    </span>
  );
};
