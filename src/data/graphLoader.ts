// Graph-Loader: laedt /graph.json (echter Vault-Indexer) und mappt auf ein
// 3D-Sphaeren-Layout. Fallback: prozeduraler Mock-Vault.
import type { Graph, GraphNode, GraphEdge, Category } from './types';
import { sphereLayout } from './layout';

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fallback-Beispielmapping (generische Johnny-Decimal-Ordner). Das echte
// Mapping liefert der Indexer — Cluster-Namen kommen aus dem Backend.
const CLUSTER_TO_CATEGORY: Record<string, Category> = {
  '00_inbox': 'neutral',
  '10_archive': 'neutral',
  '20_areas': 'knowledge',
  '30_topics': 'knowledge',
  '40_projects': 'data',
  '50_jobs': 'core',
  coding: 'neutral',
  System: 'neutral',
};

function categoryFor(cluster: string, idx: number): Category {
  if (CLUSTER_TO_CATEGORY[cluster]) return CLUSTER_TO_CATEGORY[cluster];
  return (['knowledge', 'data', 'logic', 'neutral', 'core'] as Category[])[idx % 5];
}

export function graphFromIndexer(json: any): Graph {
  const rnd = mulberry32(42);
  let rawNodes: any[] = json.nodes ?? [];
  let rawEdges: any[] = json.edges ?? [];

  // SCALE GUARD (2026-09-09): 24.8k Nodes / 190k Edges killen den Browser
  // (EdgeField: 25M Vertices). Sampling-Strategie: Wikilink-Grad als
  // Relevanz — Top-N behalten, Ordner-Kanten nur zwischen behaltenen Nodes.
  // Guard bleibt als Notbremse gegen pathologische Graphen (Mail-Archive
  // dominieren jeden Vault — draußen halten);
  // mit Edge-Budget + adaptiven Segmenten (S10) ist 4000er-Sampling entbehrlich.
  const MAX_NODES = 20000;
  if (rawNodes.length > MAX_NODES) {
    const deg = new Map<string, number>();
    for (const e of rawEdges) {
      if (e.type === 'wikilink') {
        deg.set(e.source, (deg.get(e.source) ?? 0) + 1);
        deg.set(e.target, (deg.get(e.target) ?? 0) + 1);
      }
    }
    // Relevanz: Wikilink-Grad, dann Wörter als Tie-Breaker
    rawNodes = [...rawNodes]
      .sort((a, b) =>
        ((deg.get(b.id) ?? 0) - (deg.get(a.id) ?? 0)) ||
        ((b.words ?? 0) - (a.words ?? 0)))
      .slice(0, MAX_NODES);
    const keep = new Set(rawNodes.map((n) => n.id));
    rawEdges = rawEdges.filter((e) => keep.has(e.source) && keep.has(e.target));
  }

  const clusters: string[] = [...new Set(rawNodes.map((n) => n.cluster as string))];
  const clusterIdx = new Map(clusters.map((c, i) => [c, i]));

  // Grad (echte Wikilinks) pro Node zaehlen
  const degree = new Map<string, number>();
  for (const e of rawEdges) {
    if (e.type === 'wikilink') {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
  }
  const maxWords = Math.max(1, ...rawNodes.map((n) => n.words ?? 0));

  // S10: Hub-Ranking — bei dichten Graphen (10k+) würden tausende Einzel-Hub-
  // Objekte den Renderer ersticken; nur die Top-400 nach Grad bleiben Hubs.
  const hubCand = [...rawNodes]
    .map((n) => ({ id: n.id as string, deg: degree.get(n.id) ?? 0, words: n.words ?? 0 }))
    .filter((c) => c.deg >= 3 || c.words > maxWords * 0.6)
    .sort((a, b) => b.deg - a.deg || b.words - a.words)
    .slice(0, 400);
  const hubIds = new Set(hubCand.map((c) => c.id));

  const nodes: GraphNode[] = rawNodes.map((n) => {
    const deg = degree.get(n.id) ?? 0;
    const words = n.words ?? 60;
    const ci = clusterIdx.get(n.cluster) ?? 0;
    const hub = hubIds.has(n.id);
    const norm = Math.sqrt(words / maxWords);
    return {
      id: n.id,
      label: n.title ?? n.id,
      category: categoryFor(n.cluster, ci),
      cluster: n.cluster,
      community: n.community ?? undefined,
      hub,
      path: n.path,
      mtime: n.mtime,
      words,
      tags: n.tags ?? [],
      degree: deg,
      position: [0, 0, 0],
      size: hub ? 0.34 + norm * 0.22 : 0.1 + norm * 0.13,
      activity: 0.2 + rnd() * 0.6,
      edges: [],
    };
  });

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: GraphEdge[] = [];
  let ei = 0;
  const seen = new Set<string>();
  for (const e of rawEdges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    const key = [e.source, e.target].sort().join('|') + e.type;
    if (seen.has(key)) continue;
    seen.add(key);
    const id = `e${ei++}`;
    edges.push({
      id,
      source: e.source,
      target: e.target,
      weight: e.type === 'wikilink' ? 1 : 0.4,
      kind: e.type === 'wikilink' ? 'wikilink' : 'folder',
    });
    byId.get(e.source)!.edges.push(id);
    byId.get(e.target)!.edges.push(id);
  }

  const minDistViolations = sphereLayout(nodes, clusters);
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('bench')) {
    (window as any).__minDistViolations = minDistViolations; // Budget B11
  }

  // ---- DRILL-DOWN-EBENE (2026-09-09): Ordner-Hubs ----
  // Top-Level-Ordner des Vaults werden zu eigenen Hub-Knoten ('📁 Name'),
  // jede Notiz bekommt eine folder-Kante dorthin. Klick auf Ordner-Hub →
  // Auto-Drill-Down zeigt genau diesen Bereich. Reicht für Ebene 1;
  // tiefere Ebenen (Unterordner) folgen nach Bedarf.
  const folderNodes = new Map<string, GraphNode>();
  for (const n of nodes) {
    const segs = String(n.path ?? '').split('/').filter(Boolean);
    if (segs.length < 2 || String(n.id).startsWith('folder:')) continue;
    const folder = segs[0];
    if (!folderNodes.has(folder)) {
      folderNodes.set(folder, {
        id: `folder:${folder}`,
        label: `📁 ${folder}`,
        category: n.category,
        cluster: n.cluster,
        hub: true,
        words: 0,
        degree: 0,
        position: [...n.position],
        size: 0.4,
        activity: 0.5,
        edges: [],
      });
    }
    const f = folderNodes.get(folder)!;
    f.degree++;
  }
  for (const f of folderNodes.values()) {
    f.size = 0.34 + Math.min(0.3, Math.sqrt(f.degree) * 0.04);
    nodes.push(f);
    byId.set(f.id, f);
  }
  let fei = 0;
  for (const n of nodes) {
    if (String(n.id).startsWith('folder:')) continue;
    const segs = String(n.path ?? '').split('/').filter(Boolean);
    if (segs.length < 2) continue;
    const fid = `folder:${segs[0]}`;
    if (!folderNodes.has(fid)) continue;
    const id = `fe${fei++}`;
    edges.push({ id, source: n.id, target: fid, weight: 0.6, kind: 'folder' });
    byId.get(n.id)?.edges.push(id);
    folderNodes.get(fid)!.edges.push(id);
  }

  const wikilinkCount = edges.filter((e) => e.kind === 'wikilink').length;
  const orphanCount = nodes.filter((n) => n.degree === 0).length;
  const largest = [...nodes].sort((a, b) => (b.words ?? 0) - (a.words ?? 0))[0];

  return {
    nodes,
    edges,
    meta: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      wikilinkCount,
      folderEdgeCount: edges.length - wikilinkCount,
      orphanCount,
      clusterNames: clusters,
      communities: Array.isArray(json.communities)
        ? json.communities.map((c: any) => ({
            id: String(c.id), label: String(c.label), anchor: c.anchor,
            nodes: c.nodes ?? 0, words: c.words ?? 0, wikilinks: c.wikilinks ?? 0,
          }))
        : undefined,
      largestNote: largest ? { label: largest.label, words: largest.words ?? 0 } : undefined,
      generatedAt: json.generated_at ?? new Date().toISOString(),
      vault: json.vault,
    },
  };
}

/**
 * Themen-Sicht (S7, ADR-003 rev.): gleiche Notizen, Gruppierung nach
 * Communities (Label-Propagation über Wikilinks) statt Ordnern.
 * Community-Hubs (🧠) ersetzen die Ordner-Hubs; Layout neu geworfen.
 */
export function themedGraph(src: Graph): Graph {
  const comms = src.meta.communities ?? [];
  if (!comms.length) return src;
  const commIdx = new Map(comms.map((c, i) => [c.id, i]));

  const real = src.nodes.filter((n) => !String(n.id).startsWith('folder:'));
  const nodes: GraphNode[] = real.map((n) => ({
    ...n,
    cluster: n.community ?? '__solo',
    edges: [],
  }));

  // Supernode je Community (ab 2 Mitgliedern) — Ankerposition des größten Members
  const hubs = new Map<string, GraphNode>();
  for (const c of comms) {
    if ((c.nodes ?? 0) < 2) continue;
    const ci = commIdx.get(c.id) ?? 0;
    hubs.set(c.id, {
      id: `community:${c.id}`,
      label: `🧠 ${c.label}`,
      category: (['knowledge', 'data', 'logic', 'neutral', 'core'] as Category[])[ci % 5],
      cluster: c.id,
      hub: true,
      words: c.words ?? 0,
      degree: c.wikilinks ?? 0,
      position: [0, 0, 0],
      size: 0.34 + Math.min(0.3, Math.sqrt(c.nodes ?? 1) * 0.045),
      activity: 0.5,
      edges: [],
    });
  }
  for (const n of nodes) {
    const h = n.community ? hubs.get(n.community) : undefined;
    if (h) h.degree += 1;
  }

  // Kanten: echte Wikilinks zwischen echten Notizen + Community-Stammkanten
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: GraphEdge[] = [];
  let ei = 0;
  for (const e of src.edges) {
    if (e.kind !== 'wikilink') continue;
    const s = byId.get(e.source), t = byId.get(e.target);
    if (!s || !t) continue;
    const id = `e${ei++}`;
    edges.push({ ...e, id });
    s.edges.push(id); t.edges.push(id);
  }
  for (const n of nodes) {
    const h = n.community ? hubs.get(n.community) : undefined;
    if (!h) continue;
    const id = `ce${ei++}`;
    edges.push({ id, source: n.id, target: h.id, weight: 0.6, kind: 'folder' });
    n.edges.push(id); h.edges.push(id);
  }

  const clusterNames = [...new Set(nodes.map((n) => n.cluster ?? '_'))];
  sphereLayout(nodes, clusterNames);

  const wikilinkCount = edges.filter((e) => e.kind === 'wikilink').length;
  return {
    nodes: [...nodes, ...hubs.values()],
    edges,
    meta: {
      ...src.meta,
      nodeCount: nodes.length + hubs.size,
      edgeCount: edges.length,
      wikilinkCount,
      folderEdgeCount: edges.length - wikilinkCount,
      clusterNames,
    },
  };
}

/**
 * S7b: Graph aus einer LOD-Antwort (`/api/v1/graph?folder=…|community=…`).
 * Server-Supernodes (folder:…) bleiben Hubs — Klick drillt tiefer (stores).
 */
export function graphFromLod(json: any): Graph {
  const rawNodes: any[] = json.nodes ?? [];
  const rawEdges: any[] = json.edges ?? [];
  const clusters: string[] = [...new Set(rawNodes.map((n) => n.cluster as string))];
  const clusterIdx = new Map(clusters.map((c, i) => [c, i]));
  const rnd = mulberry32(42);
  const maxWords = Math.max(1, ...rawNodes.map((n) => n.words ?? 0));

  const nodes: GraphNode[] = rawNodes.map((n) => {
    const isSuper = String(n.id).startsWith('folder:');
    const deg = n.degree ?? 0;
    const words = n.words ?? 60;
    const norm = Math.sqrt(words / maxWords);
    const ci = clusterIdx.get(n.cluster) ?? 0;
    const hub = isSuper || deg >= 3 || words > maxWords * 0.6;
    return {
      id: n.id,
      label: isSuper ? `📁 ${n.title}` : (n.title ?? n.id),
      category: categoryFor(n.cluster, ci),
      cluster: n.cluster,
      community: n.community ?? undefined,
      hub,
      path: n.path,
      mtime: n.mtime,
      words,
      tags: n.tags ?? [],
      degree: deg,
      position: [0, 0, 0],
      size: isSuper ? 0.34 + Math.min(0.3, Math.sqrt(Math.max(1, deg)) * 0.045)
        : hub ? 0.34 + norm * 0.22 : 0.1 + norm * 0.13,
      activity: 0.2 + rnd() * 0.6,
      edges: [],
    };
  });

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: GraphEdge[] = [];
  let ei = 0;
  for (const e of rawEdges) {
    const s = byId.get(e.source), t = byId.get(e.target);
    if (!s || !t) continue;
    const id = `le${ei++}`;
    const kind = e.type === 'wikilink' ? 'wikilink' : 'folder';
    edges.push({ id, source: e.source, target: e.target,
                 weight: e.weight ?? (kind === 'wikilink' ? 1 : 0.4), kind });
    s.edges.push(id); t.edges.push(id);
  }

  sphereLayout(nodes, clusters);

  const wikilinkCount = edges.filter((e) => e.kind === 'wikilink').length;
  return {
    nodes,
    edges,
    meta: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      wikilinkCount,
      folderEdgeCount: edges.length - wikilinkCount,
      orphanCount: nodes.filter((n) => n.degree === 0 && !String(n.id).startsWith('folder:')).length,
      clusterNames: clusters,
      largestNote: undefined,
      generatedAt: new Date().toISOString(),
    },
  };
}

/** Prozeduraler Demo-Vault (Fallback / Demo-Modus). */
export function mockGraph(): Graph {
  const rnd = mulberry32(7);
  const clusters = ['00_inbox', '10_archive', '20_areas', '30_topics', '40_projects', '50_jobs', 'coding', 'System'];
  const titles = [
    'Zettelkasten-Methode', 'Second Brain Setup', 'Obsidian Workflow', 'LLM Wiki', 'Trading Journal',
    'ETF Watchlist', 'Home Server Architektur', 'Docker Notes', 'VSCode Setup', 'Daily Note Template',
    'Buch: Building a Second Brain', 'Buch: How to Take Smart Notes', 'Prompt Library', 'Agent Skills',
    'Meeting Notes', 'Email Summary', 'Crypto Newsletter', 'Backup-Kette', 'Wiki Schema', 'Inbox',
  ];
  const raw = {
    generated_at: new Date().toISOString(),
    vault: 'Demo Vault',
    nodes: [] as any[],
    edges: [] as any[],
  };
  for (let i = 0; i < 64; i++) {
    const cluster = clusters[Math.floor(rnd() * clusters.length)];
    raw.nodes.push({
      id: `n${i}`,
      title: i < titles.length ? titles[i] : `${cluster.split(' ')[0]} Note ${i}`,
      path: `${cluster}/note-${i}.md`,
      cluster,
      words: Math.floor(20 + rnd() * rnd() * 3200),
      mtime: new Date(Date.now() - rnd() * 3.15e10).toISOString().slice(0, 10),
      tags: [],
    });
  }
  // ein paar echte Wikilinks
  for (let i = 0; i < 34; i++) {
    const a = Math.floor(rnd() * 64);
    let b = Math.floor(rnd() * 64);
    if (b === a) b = (b + 1) % 64;
    raw.edges.push({ source: `n${a}`, target: `n${b}`, type: 'wikilink' });
  }
  // Ordner-Kanten
  const byCluster = new Map<string, string[]>();
  raw.nodes.forEach((n) => {
    if (!byCluster.has(n.cluster)) byCluster.set(n.cluster, []);
    byCluster.get(n.cluster)!.push(n.id);
  });
  for (const ids of byCluster.values()) {
    for (let i = 0; i < ids.length - 1; i++) raw.edges.push({ source: ids[i], target: ids[i + 1], type: 'folder' });
  }
  return graphFromIndexer(raw);
}

export async function loadGraph(): Promise<Graph> {
  try {
    // ?benchgraph=<url> — Bench-Zweitinstanz (S10), sonst der normale Indexer.
    const bench = new URLSearchParams(location.search).get('benchgraph');
    const r = await fetch(bench || '/graph.json');
    if (!r.ok) throw new Error(String(r.status));
    return graphFromIndexer(await r.json());
  } catch {
    return mockGraph();
  }
}
