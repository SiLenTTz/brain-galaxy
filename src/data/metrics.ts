// Echte Vault-Kennzahlen (aus dem geladenen Graph) + optionaler Aktivitaets-Feed.
import { create } from 'zustand';
import { useGraph } from '../state/stores';

export interface VaultStats {
  notes: number;
  links: number;
  folderLinks: number;
  clusters: number;
  orphans: number;
  words: number;
  largest: { label: string; words: number } | null;
  vault: string;
}

export interface ActivityItem {
  id?: string;
  title: string;
  detail: string;
  when: string;
  kind: 'edit' | 'commit' | 'new';
}

interface MetricsState {
  stats: VaultStats | null;
  activity: ActivityItem[];
  histogram: number[]; // Notizen pro Cluster (fuer den Balken)
  recompute: () => void;
  loadActivity: () => Promise<void>;
}

export const useMetrics = create<MetricsState>((set) => ({
  stats: null,
  activity: [],
  histogram: [],
  recompute: () => {
    const g = useGraph.getState().graph;
    if (!g) return;
    const byCluster = new Map<string, number>();
    let words = 0;
    for (const n of g.nodes) {
      byCluster.set(n.cluster ?? '—', (byCluster.get(n.cluster ?? '—') ?? 0) + 1);
      words += n.words ?? 0;
    }
    set({
      stats: {
        notes: g.meta.nodeCount,
        links: g.meta.wikilinkCount,
        folderLinks: g.meta.folderEdgeCount,
        clusters: g.meta.clusterNames.length,
        orphans: g.meta.orphanCount,
        words,
        largest: g.meta.largestNote ?? null,
        vault: g.meta.vault ?? 'Demo Vault',
      },
      histogram: [...byCluster.values()],
    });
  },
  loadActivity: async () => {
    const g = useGraph.getState().graph;
    // 1) versuche echten Endpunkt (Git-Log des Vaults)
    try {
      const r = await fetch('/activity');
      if (r.ok) {
        const j = await r.json();
        if (Array.isArray(j.items) && j.items.length) {
          set({ activity: j.items.slice(0, 12) });
          return;
        }
      }
    } catch {}
    // 2) Fallback: zuletzt geaenderte Notizen nach mtime
    if (!g) return;
    const items: ActivityItem[] = [...g.nodes]
      .filter((n) => n.mtime)
      .sort((a, b) => (b.mtime! < a.mtime! ? -1 : 1))
      .slice(0, 10)
      .map((n) => ({
        id: n.id,
        title: n.label,
        detail: n.cluster ?? n.path ?? '',
        when: n.mtime!,
        kind: 'edit' as const,
      }));
    set({ activity: items });
  },
}));

export function startMetricsLoop() {
  const tick = () => {
    useMetrics.getState().recompute();
  };
  // sobald der Graph da ist
  const unsub = useGraph.subscribe((s) => {
    if (s.graph) {
      tick();
      useMetrics.getState().loadActivity();
    }
  });
  tick();
  setInterval(() => useMetrics.getState().loadActivity(), 30000);
  return unsub;
}
