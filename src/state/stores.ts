// Zustand-Stores: graph / selection / ui
import { create } from 'zustand';
import type { Graph, GraphNode, Category } from '../data/types';

type PosMap = Map<string, [number, number, number]>;

export type DataSource = 'vault' | 'hive';

/** Aktiver Drill-down-Zustand (S7b): Ordnerpfad oder Community-ID. */
export interface DrillState {
  kind: 'folder' | 'community';
  id: string;
  label: string;
}

interface GraphState {
  graph: Graph | null;
  /** Ordner-Sicht (Ausgangsgraph) für den 📁/🧠-Umschalter. */
  baseGraph: Graph | null;
  basePositions: PosMap | null;
  /** Sicht-Modus: Ordner-Hierarchie oder Themen (Communities). */
  groupMode: 'folder' | 'theme';
  setGroupMode: (m: 'folder' | 'theme') => void;
  /** S7b: aktiver Drill-down (null = Übersicht). */
  drill: DrillState | null;
  drillInto: (node: { id: string; label: string }) => void;
  drillUp: () => void;
  /** Positionen je Layout — 'force'/'universe' werden lazy berechnet. */
  positions: Record<'sphere' | 'force' | 'universe', PosMap | null>;
  load: () => Promise<void>;
  loadHive: () => Promise<void>;
  /** S8: Quelle neu laden (getriggert vom Indexer-Push via SSE). */
  refresh: () => void;
  source: DataSource;
  setSource: (s: DataSource) => void;
  ensureLayout: (mode: 'sphere' | 'force' | 'universe') => void;
  hiddenCats: Set<Category>;
  toggleCat: (c: Category) => void;
  soloCat: (c: Category | null) => void;
  /** Zeit-Filter: Notizen mit mtime > cutoff ausblenden. */
  cutoff: string | null;
  setCutoff: (d: string | null) => void;
  /** Themen-Filter (Assistent): nur diese IDs zeigen. */
  filterIds: string[] | null;
  setFilterIds: (ids: string[] | null) => void;
}

export const useGraph = create<GraphState>((set, get) => ({
  graph: null,
  baseGraph: null,
  basePositions: null,
  groupMode: 'folder',
  drill: null,
  drillInto: (node) => {
    const kind = node.id.startsWith('folder:')
      ? 'folder'
      : node.id.startsWith('community:') ? 'community' : null;
    if (!kind) { useSelection.getState().setSelected(node.id); return; }
    const id = node.id.slice(kind.length + 1);
    const label = node.label.replace(/^[📁🧠]\s*/, '');
    fetch(`/api/v1/graph?${kind}=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((j) => import('../data/graphLoader').then(({ graphFromLod }) => {
        const g = graphFromLod(j);
        if (!g.nodes.length) return;
        const sphere: PosMap = new Map(
          g.nodes.map((n) => [n.id, [...n.position] as [number, number, number]]),
        );
        useSelection.getState().setSelected(null);
        set({ graph: g, drill: { kind, id, label },
              positions: { sphere, force: null, universe: null } });
      }))
      .catch(() => useSelection.getState().setSelected(node.id)); // Fallback: Auswahl
  },
  drillUp: () => {
    const st = get();
    if (!st.drill) return;
    if (st.groupMode === 'theme') {
      import('../data/graphLoader').then(({ themedGraph }) => {
        const g = themedGraph(st.baseGraph ?? st.graph!);
        const sphere: PosMap = new Map(
          g.nodes.map((n) => [n.id, [...n.position] as [number, number, number]]),
        );
        set({ graph: g, drill: null, positions: { sphere, force: null, universe: null } });
      });
    } else {
      const g = st.baseGraph ?? st.graph!;
      const sphere = st.basePositions ?? new Map(
        g.nodes.map((n) => [n.id, [...n.position] as [number, number, number]]));
      set({ graph: g, drill: null, positions: { sphere, force: null, universe: null } });
    }
    useSelection.getState().setSelected(null);
  },
  setGroupMode: (m) => {
    const st = get();
    if (st.groupMode === m || !st.graph) return;
    if (m === 'theme') {
      import('../data/graphLoader').then(({ themedGraph }) => {
        const src = st.baseGraph ?? st.graph!;
        if (!src.meta.communities?.length) return; // alte Graphen: kein Wechsel
        const g = themedGraph(src);
        const sphere: PosMap = new Map(
          g.nodes.map((n) => [n.id, [...n.position] as [number, number, number]]),
        );
        // Auswahl hat in der anderen Sicht evtl. kein Ziel mehr
        const sel = useSelection.getState().selected;
        if (sel && !g.nodes.some((n) => n.id === sel))
          useSelection.getState().setSelected(null);
        set({ graph: g, positions: { sphere, force: null, universe: null }, groupMode: m });
      });
    } else {
      const g = st.baseGraph ?? st.graph!;
      const sphere =
        st.basePositions ??
        new Map(g.nodes.map((n) => [n.id, [...n.position] as [number, number, number]]));
      set({ graph: g, positions: { sphere, force: null, universe: null }, groupMode: m });
    }
  },
  positions: { sphere: null, force: null, universe: null },
  source: 'vault',
  setSource: (s) => {
    set({ source: s });
    if (s === 'hive') get().loadHive(); else get().load();
  },
  load: async () => {
    const { loadGraph } = await import('../data/graphLoader');
    const graph = await loadGraph();
    const sphere: PosMap = new Map(graph.nodes.map((n) => [n.id, [...n.position] as [number, number, number]]));
    set({ graph, baseGraph: graph, basePositions: sphere,
          positions: { sphere, force: null, universe: null }, groupMode: 'folder', drill: null });
  },
  refresh: () => {
    const st = get();
    if (st.source === 'hive') st.loadHive();
    else st.load();
  },
  loadHive: async () => {
    // Echter Graph vom Remote-Brain (Librarian): GET /graph liefert
    // nodes[{id,type,content,content_snippet,degree}] + edges[{source,target,type}]
    try {
      const r = await fetch('/hive-brain/graph?limit=400');
      const j = await r.json();
      const data = j?.data ?? j;
      const rawNodes: any[] = data.nodes ?? [];
      const rawEdges: any[] = data.edges ?? [];
      if (!rawNodes.length) throw new Error('empty graph');

      const TYPE_CAT: Record<string, Category> = {
        capability: 'core', skill: 'knowledge', experience: 'logic',
        fact: 'data', decision: 'data', lesson: 'logic',
      };
      const nodes: any[] = rawNodes.map((n, i) => ({
        id: String(n.id),
        label: (n.content_snippet || n.content || n.id).slice(0, 48),
        path: `hive:${n.type ?? 'neuron'}`,
        category: TYPE_CAT[n.type] ?? 'neutral',
        cluster: n.type ?? 'neuron',
        degree: n.degree ?? 1,
        hub: (n.degree ?? 0) > 8,
        // Renderer braucht size/activity — sonst NaN-Skalierung (unsichtbar)
        size: 0.1 + Math.min(0.2, ((n.degree ?? 1) / 40)),
        activity: 0.3,
        edges: [],
      }));
      const nodeIds = new Set(nodes.map((n) => n.id));
      const edges: any[] = rawEdges
        .filter((e) => nodeIds.has(String(e.source)) && nodeIds.has(String(e.target)))
        .map((e, i) => ({
          id: 'he' + i, source: String(e.source), target: String(e.target),
          weight: 1, kind: 'wikilink' as const,
        }));

      // Force-Layout übernimmt die Positionen (echte Kanten!) — yield vorher,
      // damit der UI-Click nicht auf das Layout wartet
      const { forceLayout } = await import('../data/layout');
      await new Promise((r) => setTimeout(r, 0));
      const work = nodes.map((n, i) => ({
        ...n,
        position: [Math.cos(i) * 20, Math.sin(i * 1.3) * 20, Math.sin(i) * 20],
      }));
      forceLayout(work, edges);
      const graph = {
        nodes: work,
        edges,
        meta: { nodeCount: nodes.length, edgeCount: edges.length,
                wikilinkCount: edges.length, folderEdgeCount: 0, orphanCount: 0,
                clusterNames: [...new Set(rawNodes.map((n) => n.type))] as string[],
                generatedAt: new Date().toISOString() },
      } as any;
      const sphere: PosMap = new Map(work.map((n: any) => [n.id, [...n.position] as [number, number, number]]));
      set({ graph, baseGraph: graph, basePositions: sphere, groupMode: 'folder', drill: null,
            positions: { sphere, force: null, universe: null } });
    } catch {
      // Librarian nicht erreichbar → beim Vault bleiben
      set({ source: 'vault' });
      get().load();
    }
  },
  ensureLayout: (mode) => {
    const st = get();
    if (mode === 'sphere' || st.positions[mode] || !st.graph) return;
    import('../data/layout').then(({ forceLayout, universeLayout }) => {
      const g = st.graph!;
      const work = g.nodes.map((n) => ({ ...n, position: [...n.position] })) as GraphNode[];
      if (mode === 'universe') universeLayout(work, g.edges);
      else forceLayout(work, g.edges);
      const map: PosMap = new Map(work.map((n) => [n.id, n.position as [number, number, number]]));
      set((s) => ({ positions: { ...s.positions, [mode]: map } }));
    });
  },
  hiddenCats: new Set(),
  toggleCat: (c) =>
    set((s) => {
      const h = new Set(s.hiddenCats);
      if (h.has(c)) h.delete(c);
      else h.add(c);
      return { hiddenCats: h };
    }),
  soloCat: (c) =>
    set(() => {
      if (!c) return { hiddenCats: new Set<Category>() };
      const all: Category[] = ['core', 'knowledge', 'logic', 'data', 'neutral'];
      return { hiddenCats: new Set(all.filter((x) => x !== c)) };
    }),
  cutoff: null,
  setCutoff: (d) => set({ cutoff: d }),
  filterIds: null,
  setFilterIds: (ids) => set({ filterIds: ids }),
}));

interface SelectionState {
  hovered: string | null;
  selected: string | null;
  setHovered: (id: string | null) => void;
  setSelected: (id: string | null) => void;
}
export const useSelection = create<SelectionState>((set) => ({
  hovered: null,
  selected: null,
  setHovered: (id) => set({ hovered: id }),
  setSelected: (id) => set({ selected: id }),
}));

interface UiState {
  paletteOpen: boolean;
  paletteQuery: string;        // extern gesetzter Suchbegriff (Voice/Gesten)
  tuningOpen: boolean;
  /** G2: Phone-Verbindungs-Panel (QR/URL/Anleitung). */
  phonePanelOpen: boolean;
  setPhonePanel: (b: boolean) => void;
  /** K: Hand-Kalibrierung (Taste C). */
  calibOpen: boolean;
  setCalib: (b: boolean) => void;
  /** v5 F: Autopilot — autonomer Flug durchs Universum. */
  autopilot: boolean;
  setAutopilot: (b: boolean) => void;
  detailNode: GraphNode | null;
  /** B1: Gesten-Engine zur Laufzeit schaltbar ('off' | 'phone' | 'webcam'). */
  hands: 'off' | 'phone' | 'webcam';
  setHands: (h: 'off' | 'phone' | 'webcam') => void;
  setPalette: (b: boolean) => void;
  setPaletteQuery: (q: string) => void;
  setTuning: (b: boolean) => void;
  setDetail: (n: GraphNode | null) => void;
}
export const useUi = create<UiState>((set) => ({
  paletteOpen: false,
  paletteQuery: '',
  tuningOpen: false,
  phonePanelOpen: false,
  calibOpen: false,
  autopilot: false,
  detailNode: null,
  hands: (() => {
    const m = new URLSearchParams(location.search).get('hands');
    return m === 'webcam' ? 'webcam' : m === '1' ? 'phone' : 'off';
  })(),
  setHands: (h) => set({ hands: h }),
  setPhonePanel: (b) => set({ phonePanelOpen: b }),
  setCalib: (b) => set({ calibOpen: b }),
  setAutopilot: (b) => set({ autopilot: b }),
  setPalette: (b) => set({ paletteOpen: b }),
  setPaletteQuery: (q) => set({ paletteQuery: q }),
  setTuning: (b) => set({ tuningOpen: b }),
  setDetail: (n) => set({ detailNode: n }),
}));
