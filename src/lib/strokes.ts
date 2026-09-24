// strokes.ts — Ein-Strich-Buchstabenerkennung (Protractor/$1-Familie).
// Wobbrock et al. $1 Unistroke / Li Protractor: Strecke resamplen, zentrieren,
// skalieren, Kosinus-Ähnlichkeit zu Vorlagen. Keine Rotations-Suche —
// Buchstaben müssen aufrecht bleiben (sonst wären V/A, C/U verwechselbar).
export interface Pt { x: number; y: number; t?: number }

const N = 32;

export function resample(pts: Pt[], n = N): Pt[] {
  if (pts.length < 2) return pts;
  const len = pts.reduce((a, p, i) =>
    i ? a + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) : 0, 0);
  if (len < 1) return pts;
  const step = len / (n - 1);
  const out: Pt[] = [pts[0]];
  let D = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (D + d >= step) {
      const t = (step - D) / d;
      const q = { x: pts[i - 1].x + t * (pts[i].x - pts[i - 1].x),
                  y: pts[i - 1].y + t * (pts[i].y - pts[i - 1].y) };
      out.push(q); pts.splice(i, 0, q); D = 0;
    } else D += d;
  }
  while (out.length < n) out.push(pts[pts.length - 1]);
  return out.slice(0, n);
}

/** Vektor für Kosinus-Vergleich: zentriert + Bounding-Box-skaliert
 *  ($1-Standard; translations- und größen-invariant, NICHT rotations-
 *  invariant — Buchstaben müssen aufrecht bleiben). */
export function toVector(pts: Pt[]): number[] {
  const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const s = Math.max(maxX - minX, maxY - minY) || 1;
  return pts.flatMap((p) => [(p.x - cx) / s, (p.y - cy) / s]);
}

/** $1-Punktdistanz: resample → aufs Einheits-Quadrat normalisieren →
 *  mittlere punktweise Distanz. Score = 1 - dist/HALF_DIAG. Ecken-robust. */
export function unitSquare(pts: Pt[]): Pt[] {
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const w = (maxX - minX) || 1, h = (maxY - minY) || 1;
  return pts.map((p) => ({ x: (p.x - minX) / w, y: (p.y - minY) / h }));
}
const HALF_DIAG = Math.SQRT2 / 2;
export function strokeDistance(a: Pt[], b: Pt[]): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return d / a.length / HALF_DIAG;
}

// Vorlagen (aufrechte Handschrift, y wächst nach unten) — je Buchstabe
// MEHRERE Varianten ($1-Praxis): eckig + rund geschrieben.
const raw: Record<string, [number, number][][]> = {
  S: [
    [[20, 14], [46, 6], [70, 16], [70, 32], [54, 44], [30, 50], [18, 64], [28, 84], [56, 92], [80, 82]],
    [[24, 10], [50, 8], [66, 20], [56, 36], [34, 44], [22, 58], [34, 80], [64, 90], [82, 76]],
  ],
  M: [
    [[10, 88], [13, 16], [42, 58], [70, 16], [74, 88]],
    [[16, 86], [20, 22], [48, 66], [72, 20], [76, 90]],
  ],
  O: [
    Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2 - Math.PI / 2;
      return [50 + 38 * Math.sin(a), 50 + 40 * Math.cos(a)] as [number, number];
    }),
    Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2;
      return [50 + 40 * Math.sin(a), 52 + 36 * Math.cos(a)] as [number, number];
    }),
  ],
  V: [
    [[14, 10], [50, 90], [86, 10]],
    [[20, 12], [52, 86], [84, 14]],
  ],
  C: [
    [[80, 20], [58, 6], [30, 12], [14, 38], [16, 68], [34, 88], [62, 92], [82, 80]],
    [[76, 16], [52, 8], [26, 16], [12, 44], [18, 72], [40, 90], [66, 90], [84, 76]],
  ],
  A: [
    [[12, 90], [50, 8], [88, 90]],
    [[18, 88], [52, 12], [86, 88], [84, 84]],
  ],
  L: [
    [[26, 8], [24, 86], [84, 88]],
    [[32, 10], [30, 90], [88, 90]],
  ],
  F: [
    [[26, 12], [82, 8], [28, 16], [26, 88], [80, 70]],
    [[22, 10], [86, 10], [26, 18], [24, 90], [84, 66]],
  ],
};

const TEMPLATES: Array<{ letter: string; pts: Pt[] }> = Object.entries(raw)
  .flatMap(([letter, variants]) =>
    variants.map((v) => ({ letter, pts: unitSquare(resample(v.map(([x, y]) => ({ x, y })))) })));

/** Erkennt einen gemalten Strich ($1-Punktdistanz): beste Vorlage mit
 *  deutlichem Abstand zur besten ANDEREN Buchstabe-Vorlage. */
export function recognizeStroke(pts: Pt[]): { letter: string; score: number } | null {
  if (pts.length < 3) return null;
  const c = unitSquare(resample(pts));
  const ranked = TEMPLATES
    .map((t) => ({ letter: t.letter, score: 1 - strokeDistance(c, t.pts) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const secondOther = ranked.find((r) => r.letter !== best?.letter);
  if (!best || best.score < 0.75) return null;
  if (secondOther && best.score - secondOther.score < 0.03) return null;
  return best;
}
