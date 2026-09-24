// Layout-Berechnung: Sphaere (deterministisch, cluster-getrennt) und
// Force-Directed (d3-force-3d, Wikilinks ziehen, Cluster gruppieren).
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  forceZ,
} from 'd3-force-3d';
import type { GraphNode } from './types';

const R = 8.6;
/** S11a: Radius wächst mit ∛N — Platz pro Node bleibt konstant. */
const radiusFor = (n: number) => R * Math.cbrt(Math.max(1, n) / 700);

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Punkte gleichmaessig im Kugelvolumen eines Azimut-Segments. */
function segmentPoints(
  count: number,
  rnd: () => number,
  azCenter: number,
  azSpan: number,
  radius: number,
): Array<[number, number, number]> {
  const pts: Array<[number, number, number]> = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * (i + 0.5)) / Math.max(1, count);
    const baseAz = golden * i;
    const az = azCenter + (((baseAz / (2 * Math.PI)) % 1) - 0.5) * azSpan;
    const r = radius * Math.cbrt(0.2 + 0.8 * rnd());
    const hor = Math.sqrt(Math.max(0, 1 - y * y)) * r;
    pts.push([hor * Math.sin(az), y * r, hor * Math.cos(az)]);
  }
  return pts;
}

/** Schreibt node.position in-place — cluster in Kegel-Segmenten der Kugel.
 *  S11a: Kugelradius wächst mit ∛N (Platz pro Node bleibt konstant —
 *  „weitläufig, aber orientierbar"), Relaxation via Spatial Hash. */
export function sphereLayout(nodes: GraphNode[], clusters: string[]): number {
  const radius = radiusFor(nodes.length);
  const rnd = mulberry32(42);
  const order = clusters.length ? clusters : [...new Set(nodes.map((n) => n.cluster ?? '_'))];
  const counter = new Map<string, number>();
  const pts = new Map<string, Array<[number, number, number]>>();
  order.forEach((c, ci) => {
    const members = nodes.filter((n) => (n.cluster ?? '_') === c);
    const azCenter = (ci / order.length) * Math.PI * 2;
    const azSpan = ((Math.PI * 2) / order.length) * 1.1;
    pts.set(c, segmentPoints(members.length, rnd, azCenter, azSpan, radius));
  });
  for (const n of nodes) {
    const c = n.cluster ?? '_';
    const i = counter.get(c) ?? 0;
    counter.set(c, i + 1);
    const arr = pts.get(c);
    n.position = arr && arr[i] ? arr[i] : [0, 0, 0];
    // Hubs leicht nach innen ziehen (nicht zu stark -> Label-Pileup vermeiden)
    if (n.hub) n.position = n.position.map((v) => v * 0.88) as [number, number, number];
  }
  return relaxGrid(nodes, radius, 1.5);
}

/** Kurze Abstoss-Relaxation — Spatial-Hash-Grid (O(n·k) statt O(n²), S11a:
 *  bisher war relax bei 10k Nodes nicht ausführbar). Garantiert minDist
 *  per Nachgelagerter Enforce-Runde; Restverletzungen zählbar (Budget B11). */
function relaxGrid(nodes: GraphNode[], radius: number, min: number): number {
  const key = (x: number, y: number, z: number) =>
    `${Math.floor(x / min)},${Math.floor(y / min)},${Math.floor(z / min)}`;
  const want = (i: number, j: number) =>
    min * ((nodes[i].hub ? 1.8 : 1) + (nodes[j].hub ? 1.8 : 1)) * 0.5;

  const buildGrid = () => {
    const grid = new Map<string, number[]>();
    for (let i = 0; i < nodes.length; i++) {
      const p = nodes[i].position;
      const k = key(p[0], p[1], p[2]);
      const arr = grid.get(k);
      if (arr) arr.push(i);
      else grid.set(k, [i]);
    }
    return grid;
  };

  const separate = (mode: 'relax' | 'enforce' | 'count') => {
    const grid = buildGrid();
    let violations = 0;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i].position;
      const cx = Math.floor(a[0] / min), cy = Math.floor(a[1] / min), cz = Math.floor(a[2] / min);
      for (let ox = -1; ox <= 1; ox++)
        for (let oy = -1; oy <= 1; oy++)
          for (let oz = -1; oz <= 1; oz++) {
            const arr = grid.get(`${cx + ox},${cy + oy},${cz + oz}`);
            if (!arr) continue;
            for (const j of arr) {
              if (j <= i) continue;
              const b = nodes[j].position;
              let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
              let d = Math.hypot(dx, dy, dz) || 0.001;
              const w = want(i, j);
              if (d < w) {
                violations++;
                if (mode === 'count') continue;
                // enforce: exakt auf minDist; relax: halber Weg
                const push = mode === 'enforce' ? (w - d) / d : (w - d) / d / 2;
                dx *= push; dy *= push; dz *= push;
                a[0] -= dx; a[1] -= dy; a[2] -= dz;
                b[0] += dx; b[1] += dy; b[2] += dz;
              }
            }
          }
    }
    return violations;
  };

  const clampTo = (rad: number) => {
    for (const n of nodes) {
      const d = Math.hypot(...n.position) || 1;
      const max = n.hub ? rad * 0.78 : rad * 0.99;
      if (d > max) n.position = n.position.map((v) => (v * max) / d) as [number, number, number];
    }
  };

  for (let iter = 0; iter < 26; iter++) separate('relax');
  // Enforce mit Garantie (B11): Klemmung staucht erfahrungsgemäß zurück —
  // deshalb Radius pro Runde 8 % vergrößern, bis 0 Überlappungen übrig sind
  // (Weitläufigkeit ist Feature, kein Bug: „weitläufig, aber orientierbar").
  let rad = radius;
  let violations = 0;
  for (let round = 0; round < 14; round++) {
    separate('enforce');
    clampTo(rad);
    violations = separate('count');
    if (violations === 0) break;
    rad *= 1.10;
    for (const n of nodes) {
      n.position = n.position.map((v) => v * 1.10) as [number, number, number];
    }
  }
  return violations;
}

/**
 * S13/S15 „Universum": Jeder Cluster wird zu einer eigenen SPIRAL-GALAXIE
 * (flache Scheibe, heller Kern aus den schwersten Knoten, 2-3 Spiralarme),
 * die Galaxien weit auseinander in einer Scheibe verteilt → klare visuelle
 * Abgrenzung („was gehört zusammen"), Voids dazwischen, Wikilinks spannen
 * Filamente quer durchs All. Deterministisch (hash-Seed je Node-ID).
 */
export function universeLayout(
  nodes: GraphNode[],
  _edges: Array<{ source: string; target: string; kind: string; weight: number }>,
): number {
  const maxDeg = Math.max(1, ...nodes.map((n) => n.degree));
  const massOf = (n: GraphNode) =>
    1 + 9 * Math.sqrt(n.degree / maxDeg) + Math.min(2, (n.words ?? 0) / 4000);

  const rndOf = (id: string) => {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
    return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507)) >>> 0) / 4294967296;
  };

  // Cluster sammeln + nach Größe sortieren (große Galaxien zuerst, bekommen
  // zentrale Anker-Plätze)
  const byCluster = new Map<string, GraphNode[]>();
  for (const n of nodes) {
    const k = n.cluster ?? '_';
    const arr = byCluster.get(k);
    if (arr) arr.push(n); else byCluster.set(k, [n]);
  }
  const galaxies: Array<{ key: string; members: GraphNode[]; R: number; anchor?: [number, number, number] }> =
    [...byCluster.entries()]
      .map(([k, m]) => ({ key: k, members: m, R: 5 + 1.5 * Math.sqrt(m.length) }))
      .sort((a, b) => b.members.length - a.members.length);

  // Galaxie-Anker: golden-angle über eine große SCHEIBE (planar-lastig,
  // leichte y-Streuung) — wie Karten der großräumigen Struktur
  const G = galaxies.length;
  const spread = 14 + 2.6 * Math.sqrt(galaxies[0]?.R ?? 5);
  galaxies.forEach((g, i) => {
    const t = i * Math.PI * (3 - Math.sqrt(5));
    const rad = (i === 0 ? 0 : spread * (0.35 + 0.75 * Math.sqrt(i / Math.max(1, G))));
    const r = rndOf('anchor:' + g.key);
    g.anchor = [
      Math.cos(t) * rad,
      (r() - 0.5) * spread * 0.5,
      Math.sin(t) * rad,
    ] as [number, number, number];
  });

  // Pro Galaxie: Kern (schwerste Knoten) + 2-3 Spiralarme
  for (const g of galaxies) {
    const members = [...g.members].sort((a, b) => massOf(b) - massOf(a));
    const coreCount = Math.max(1, Math.round(members.length * 0.12));
    const r0 = g.R * 0.22;                       // Kernradius
    members.forEach((n, i) => {
      const r = rndOf(n.id);
      const j1 = r(), j2 = r(), j3 = r();
      let x: number, y: number, z: number;
      if (i < coreCount) {
        // Kern-Bulge: dichte Kugel
        const th = j1 * Math.PI * 2;
        const ph = Math.acos(2 * j2 - 1);
        const rad = r0 * Math.cbrt(j3);
        x = rad * Math.sin(ph) * Math.cos(th);
        y = rad * Math.cos(ph) * 0.8;
        z = rad * Math.sin(ph) * Math.sin(th);
      } else {
        // Spiralarme: Radius wächst mit Index, Winkel = Arm + Swirl
        const arm = i % 3;
        const t = (i - coreCount) / Math.max(1, members.length - coreCount);
        const rad = r0 + Math.sqrt(t) * (g.R - r0) * (0.85 + 0.3 * j1);
        const swirl = t * 2.4 + arm * (Math.PI * 2 / 3) + (j2 - 0.5) * 0.5;
        x = Math.cos(swirl) * rad + (j3 - 0.5) * g.R * 0.14;
        z = Math.sin(swirl) * rad + (j1 - 0.5) * g.R * 0.14;
        y = (j2 - 0.5) * g.R * 0.14 * (1 - t * 0.6); // Scheibe flacht nach außen
      }
      const a = g.anchor ?? [0, 0, 0];
      n.position = [a[0] + x, a[1] + y, a[2] + z];
    });
  }

  // Leichte Anti-Overlap-Passage (Kerne entzerren, Scheibenform bleibt)
  return relaxGrid(nodes, spread * 8 * G, 0.9);
}

/** Force-Directed 3D. Gibt eine Kopie mit neuen Positionen zurueck (in-place ok). */
export function forceLayout(
  nodes: GraphNode[],
  edges: Array<{ source: string; target: string; kind: string; weight: number }>,
): void {
  const clusters = [...new Set(nodes.map((n) => n.cluster ?? '_'))];
  const clusterAngle = new Map(clusters.map((c, i) => [c, (i / clusters.length) * Math.PI * 2]));

  const sim = forceSimulation(nodes as any, 3)
    .force(
      'link',
      forceLink(
        edges.map((e) => ({ ...e })) as any,
      )
        .id((d: any) => d.id)
        .distance((l: any) => (l.kind === 'wikilink' ? 2.4 : 4.2))
        .strength((l: any) => (l.kind === 'wikilink' ? 0.7 : 0.04)),
    )
    .force('charge', forceManyBody().strength(-14))
    .force('center', forceCenter(0, 0, 0))
    .force('collide', forceCollide().radius((d: any) => (d.hub ? 1.1 : 0.5)))
    // Cluster raeumlich gruppieren
    .force('cx', forceX((d: any) => Math.cos(clusterAngle.get(d.cluster ?? '_') ?? 0) * 5.5).strength(0.08))
    .force('cz', forceZ((d: any) => Math.sin(clusterAngle.get(d.cluster ?? '_') ?? 0) * 5.5).strength(0.08))
    .force('cy', forceY(0).strength(0.03))
    .stop();

  const ticks = 260;
  for (let i = 0; i < ticks; i++) sim.tick();

  // in die Kugel klemmen (∛N-skaliert, S11a)
  const rad = radiusFor(nodes.length);
  for (const n of nodes as any[]) {
    const d = Math.hypot(n.x, n.y, n.z) || 1;
    const max = n.hub ? rad * 0.75 : rad * 0.98;
    const s = d > max ? max / d : 1;
    n.position = [n.x * s, n.y * s, n.z * s];
  }
}
