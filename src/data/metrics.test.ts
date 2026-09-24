import { beforeEach, describe, expect, it } from 'vitest';
import type { Category, Graph, GraphNode } from './types';

// stores.ts liest location.search beim Anlegen des UI-Store — im Node-Test-
// Environment gibt es kein location, deshalb vorher einen Stub setzen.
(globalThis as any).location = new URL('http://localhost/');

const { useMetrics } = await import('./metrics');
const { useGraph } = await import('../state/stores');

const CATS: Category[] = ['core', 'knowledge', 'logic', 'data', 'neutral'];

function makeNodes(count: number): GraphNode[] {
  const nodes: GraphNode[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push({
      id: `n${i}`,
      label: `Note ${i}`,
      category: CATS[i % CATS.length],
      cluster: `c${i % 3}`,
      hub: false,
      words: 100 * (i + 1),
      mtime: `2026-01-${String(i + 1).padStart(2, '0')}`,
      degree: i % 4 === 0 ? 0 : 3,
      position: [0, 0, 0],
      size: 0.2,
      activity: 0.5,
      edges: [],
    });
  }
  return nodes;
}

function makeGraph(count: number): Graph {
  const nodes = makeNodes(count);
  const clusters = [...new Set(nodes.map((n) => n.cluster ?? '_'))];
  return {
    nodes,
    edges: nodes.slice(1).map((n, i) => ({
      id: `e${i}`,
      source: nodes[i].id,
      target: n.id,
      weight: 1,
      kind: 'wikilink' as const,
    })),
    meta: {
      nodeCount: nodes.length,
      edgeCount: nodes.length - 1,
      wikilinkCount: nodes.length - 1,
      folderEdgeCount: 0,
      orphanCount: nodes.filter((n) => n.degree === 0).length,
      clusterNames: clusters,
      largestNote: { label: nodes[nodes.length - 1].label, words: nodes[nodes.length - 1].words ?? 0 },
      generatedAt: '2026-09-24T00:00:00Z',
      vault: 'Test Vault',
    },
  };
}

beforeEach(() => {
  useMetrics.setState({ stats: null, activity: [], histogram: [] });
});

describe('useMetrics.recompute', () => {
  it('derives stats from the loaded graph', () => {
    const g = makeGraph(30);
    useGraph.setState({ graph: g });
    useMetrics.getState().recompute();
    const s = useMetrics.getState().stats;
    expect(s).not.toBeNull();
    expect(s!.notes).toBe(30);
    expect(s!.links).toBe(29);
    expect(s!.folderLinks).toBe(0);
    expect(s!.clusters).toBe(3);
    expect(s!.orphans).toBe(g.meta.orphanCount);
    expect(s!.words).toBe(g.nodes.reduce((a, n) => a + (n.words ?? 0), 0));
    expect(s!.largest).toEqual({ label: 'Note 29', words: 3000 });
    expect(s!.vault).toBe('Test Vault');
  });

  it('builds one histogram bucket per cluster summing to the node count', () => {
    useGraph.setState({ graph: makeGraph(30) });
    useMetrics.getState().recompute();
    const h = useMetrics.getState().histogram;
    expect(h).toHaveLength(3);
    expect(h.reduce((a, b) => a + b, 0)).toBe(30);
  });

  it('is a no-op without a graph', () => {
    useGraph.setState({ graph: null });
    useMetrics.getState().recompute();
    expect(useMetrics.getState().stats).toBeNull();
  });
});

describe('useMetrics.loadActivity', () => {
  it('falls back to the newest notes when /activity is unavailable', async () => {
    useGraph.setState({ graph: makeGraph(15) });
    await useMetrics.getState().loadActivity();
    const a = useMetrics.getState().activity;
    expect(a).toHaveLength(10);
    expect(a[0].id).toBe('n14');
    expect(a[0].kind).toBe('edit');
    for (let i = 1; i < a.length; i++) {
      expect(a[i - 1].when >= a[i].when).toBe(true);
    }
  });
});
