import { describe, expect, it } from 'vitest';
import { forceLayout, sphereLayout, universeLayout } from './layout';
import type { Category, GraphNode } from './types';

// Deterministic synthetic graph — no Math.random anywhere, so every
// assertion is reproducible.
const CATS: Category[] = ['core', 'knowledge', 'logic', 'data', 'neutral'];
const CLUSTERS = ['00_inbox', '20_areas', '40_projects', 'coding'];

function makeNodes(count: number, clusters: string[] = CLUSTERS): GraphNode[] {
  const nodes: GraphNode[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push({
      id: `n${i}`,
      label: `Note ${i}`,
      category: CATS[i % CATS.length],
      cluster: clusters[i % clusters.length],
      hub: i % 17 === 0,
      words: 50 + ((i * 37) % 4000),
      degree: (i * 7) % 12,
      mtime: `2026-0${(i % 9) + 1}-1${i % 9}`,
      position: [0, 0, 0],
      size: 0.2,
      activity: 0.5,
      edges: [],
    });
  }
  return nodes;
}

function clone(nodes: GraphNode[]): GraphNode[] {
  return nodes.map((n) => ({
    ...n,
    position: [...n.position] as [number, number, number],
    edges: [...n.edges],
  }));
}

function edgesOf(nodes: GraphNode[]) {
  return nodes.slice(1).map((n, i) => ({
    source: nodes[i].id,
    target: n.id,
    kind: 'wikilink' as const,
    weight: 1,
  }));
}

function minPairDist(nodes: GraphNode[]): number {
  let min = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i].position;
      const b = nodes[j].position;
      min = Math.min(min, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
    }
  }
  return min;
}

describe('sphereLayout', () => {
  it('is deterministic: same input → same output', () => {
    const a = makeNodes(300);
    const b = clone(makeNodes(300));
    sphereLayout(a, CLUSTERS);
    sphereLayout(b, CLUSTERS);
    expect(b.map((n) => n.position)).toEqual(a.map((n) => n.position));
  });

  it('reports zero min-dist violations on a synthetic graph', () => {
    expect(sphereLayout(makeNodes(500), CLUSTERS)).toBe(0);
  });

  it('keeps non-hub nodes at least minDist apart', () => {
    const nodes = makeNodes(150).filter((n) => !n.hub);
    sphereLayout(nodes, CLUSTERS);
    expect(minPairDist(nodes)).toBeGreaterThanOrEqual(1.5 - 1e-9);
  });

  it('moves every node to a finite position', () => {
    const nodes = makeNodes(60, ['solo']);
    sphereLayout(nodes, []);
    for (const n of nodes) {
      expect(Number.isFinite(n.position[0])).toBe(true);
      expect(Number.isFinite(n.position[1])).toBe(true);
      expect(Number.isFinite(n.position[2])).toBe(true);
    }
  });
});

describe('universeLayout', () => {
  it('is deterministic: same input → same output', () => {
    const a = makeNodes(300);
    const b = clone(makeNodes(300));
    const e = edgesOf(a);
    universeLayout(a, e);
    universeLayout(b, e);
    expect(b.map((n) => n.position)).toEqual(a.map((n) => n.position));
  });

  it('reports zero min-dist violations on a synthetic graph', () => {
    const nodes = makeNodes(500);
    expect(universeLayout(nodes, edgesOf(nodes))).toBe(0);
  });
});

describe('forceLayout', () => {
  it('is deterministic and clamps positions into the ∛N-scaled sphere', () => {
    const rad = 8.6 * Math.cbrt(300 / 700);
    const a = makeNodes(300);
    const b = clone(makeNodes(300));
    const e = edgesOf(a);
    forceLayout(a, e);
    forceLayout(b, e);
    expect(b.map((n) => n.position)).toEqual(a.map((n) => n.position));
    for (const n of a) {
      const d = Math.hypot(n.position[0], n.position[1], n.position[2]);
      expect(d).toBeLessThanOrEqual(rad + 1e-6);
      if (n.hub) expect(d).toBeLessThanOrEqual(rad * 0.75 + 1e-6);
    }
  });
});
