// EdgeField — gebogene Filamente mit Energiepuls im Shader.
// Wikilinks leuchten, Ordner-Kanten nur wenn tuning.showFolderEdges.
// Geometrie wird bei Layout-/Tuning-Wechsel neu gebaut (nicht pro Frame);
// der Fokus-Zustand (Hover/Selektion) wird nur bei Aenderung aktualisiert.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Graph } from '../data/types';
import { categoryColor } from '../lib/colors';
import { useSelection } from '../state/stores';
import { useTheme, useTuning } from '../state/theme';
import { useNodePositions } from './useLayout';

const VERT = /* glsl */ `
  attribute float aParam;
  attribute vec3 aColorA;
  attribute vec3 aColorB;
  attribute float aEdgeId;
  attribute float aKind;      // 1 = wikilink, 0 = folder
  attribute float aFocus;     // 2 = verbunden, 1 = kein Fokus, <1 = gedimmt
  uniform float uTime;
  uniform float uDim;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vCore;
  void main() {
    vec3 grad = mix(aColorA, aColorB, aParam);
    float pulsePos = fract(uTime * (0.12 + aKind * 0.08) + aEdgeId * 0.61803);
    float d = abs(aParam - pulsePos);
    float pulse = smoothstep(0.06, 0.0, d) * (1.5 + aKind);
    float hi = max(aFocus - 1.0, 0.0);            // 0..1 wenn verbunden
    vColor = grad * (1.0 + pulse) + vec3(1.0, 0.96, 0.9) * hi * 0.9;
    float fade = sin(aParam * 3.14159);
    float base = aKind > 0.5 ? 0.62 : 0.14;
    float focusMul = min(aFocus, 1.0) + hi * 1.4; // gedimmt oder geboostet
    vAlpha = (base + 0.4 * fade) * focusMul * uDim;
    vCore = pulse + hi;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vCore;
  uniform float uUniverse;   // S13: 1 = Cosmic-Web-Filamente (kühler, dezenter)
  void main() {
    vec3 col = mix(vColor * 0.55, vec3(1.0, 0.97, 0.92), clamp(vCore - 1.0, 0.0, 0.6));
    col = mix(col, col * 0.72 + vec3(0.10, 0.11, 0.12), uUniverse * 0.5);
    gl_FragColor = vec4(col, clamp(vAlpha * mix(1.0, 0.5, uUniverse), 0.0, 0.9));
  }
`;

export function EdgeField({ graph }: { graph: Graph }) {
  const hovered = useSelection((s) => s.hovered);
  const selected = useSelection((s) => s.selected);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const theme = useTheme((s) => s.theme);
  const tuning = useTuning();
  const { map } = useNodePositions();

  const { geo, edgeMeta, vertsPerEdge } = useMemo(() => {
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const pos: number[] = [];
    const cA: number[] = [];
    const cB: number[] = [];
    const par: number[] = [];
    const eIds: number[] = [];
    const kinds: number[] = [];
    const idx: number[] = [];
    const edgeMeta: Array<[string, string]> = [];
    let vOff = 0;
    let eid = 0;
    const ca = new THREE.Color();
    const cb = new THREE.Color();
    const bi = new THREE.Vector3();
    const nrm = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    let edges = graph.edges.filter((e) => e.kind === 'wikilink' || tuning.showFolderEdges);

    // ---- S10: adaptive Auflösung + Edge-Budget ----------------//////////////
    // Verts/Kante sinkt bei großen Graphen (26×5=135 → 6×3=18); sehr viele
    // Kanten werden nach Relevanz (wikilink > folder) auf ein Budget gekappt.
    const EDGE_BUDGET = 9000;
    if (edges.length > EDGE_BUDGET) {
      edges = [...edges]
        .sort((a, b) => (b.kind === 'wikilink' ? 1 : 0) - (a.kind === 'wikilink' ? 1 : 0))
        .slice(0, EDGE_BUDGET);
    }
    const SEG = edges.length > 20000 ? 6 : edges.length > 8000 ? 12 : 26;
    const RAD = edges.length > 20000 ? 3 : 5;
    const vertsPerEdge = (SEG + 1) * RAD;

    for (const e of edges) {
      const a = byId.get(e.source);
      const b = byId.get(e.target);
      if (!a || !b) continue;
      const pa = map?.get(a.id) ?? a.position;
      const pb = map?.get(b.id) ?? b.position;
      const va = new THREE.Vector3(...pa);
      const vb = new THREE.Vector3(...pb);
      const mid = va.clone().add(vb).multiplyScalar(0.5);
      mid.setLength(Math.max(va.length(), vb.length(), 2.6) * 1.04);
      const curve = new THREE.QuadraticBezierCurve3(va, mid, vb);
      const pts = curve.getSpacedPoints(SEG);
      // S13 Cosmic-Web: Filamente = kühle dünne Grau-Töne ohne Glow; Farben
      // nur noch als Hauch (30 %) Richtung Kategorie — Glow gehört den Knoten.
      const GRAY = new THREE.Color(0x8a8f96);
      ca.set(categoryColor(a.category)).lerp(GRAY, 0.62).multiplyScalar(1.3);
      cb.set(categoryColor(b.category)).lerp(GRAY, 0.62).multiplyScalar(1.3);
      const RADIUS = (e.kind === 'wikilink'
        ? (tuning.layout === 'universe' ? 0.014 : 0.028)
        : (tuning.layout === 'universe' ? 0.006 : 0.013)) * tuning.edgeWidth;
      const kindV = e.kind === 'wikilink' ? 1 : 0;
      for (let i = 0; i <= SEG; i++) {
        const t = i / SEG;
        const p = pts[i];
        const tan = curve.getTangent(t).normalize();
        bi.crossVectors(up, tan).normalize();
        if (bi.lengthSq() < 0.01) bi.set(1, 0, 0);
        nrm.crossVectors(tan, bi).normalize();
        const rad = RADIUS * (0.5 + 0.5 * Math.sin(t * Math.PI));
        for (let r = 0; r < RAD; r++) {
          const ang = (r / RAD) * Math.PI * 2;
          const c = Math.cos(ang);
          const s = Math.sin(ang);
          pos.push(
            p.x + (bi.x * c + nrm.x * s) * rad,
            p.y + (bi.y * c + nrm.y * s) * rad,
            p.z + (bi.z * c + nrm.z * s) * rad,
          );
          cA.push(ca.r, ca.g, ca.b);
          cB.push(cb.r, cb.g, cb.b);
          par.push(t);
          eIds.push(eid % 97);
          kinds.push(kindV);
        }
      }
      for (let i = 0; i < SEG; i++) {
        for (let r = 0; r < RAD; r++) {
          const a0 = vOff + i * RAD + r;
          const b0 = vOff + (i + 1) * RAD + r;
          const c0 = vOff + (i + 1) * RAD + ((r + 1) % RAD);
          const d0 = vOff + i * RAD + ((r + 1) % RAD);
          idx.push(a0, b0, c0, a0, c0, d0);
        }
      }
      vOff += vertsPerEdge;
      edgeMeta.push([e.source, e.target]);
      eid++;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aColorA', new THREE.Float32BufferAttribute(cA, 3));
    g.setAttribute('aColorB', new THREE.Float32BufferAttribute(cB, 3));
    g.setAttribute('aParam', new THREE.Float32BufferAttribute(par, 1));
    g.setAttribute('aEdgeId', new THREE.Float32BufferAttribute(eIds, 1));
    g.setAttribute('aKind', new THREE.Float32BufferAttribute(kinds, 1));
    const focus = new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3).fill(1), 1);
    focus.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aFocus', focus);
    g.setIndex(idx);
    return { geo: g, edgeMeta, vertsPerEdge };
  }, [graph, map, theme, tuning.showFolderEdges, tuning.edgeWidth, tuning.layout]);

  // Fokus-Attribut nur bei Hover/Selektions-Wechsel neu schreiben
  useEffect(() => {
    const focus = geo.getAttribute('aFocus') as THREE.BufferAttribute;
    const id = hovered ?? selected;
    const arr = focus.array as Float32Array;
    if (!id) {
      arr.fill(1);
    } else {
      for (let e = 0; e < edgeMeta.length; e++) {
        const connected = edgeMeta[e][0] === id || edgeMeta[e][1] === id;
        const v = connected ? 2 : 0.1;
        arr.fill(v, e * vertsPerEdge, (e + 1) * vertsPerEdge);
      }
    }
    focus.needsUpdate = true;
  }, [geo, edgeMeta, vertsPerEdge, hovered, selected]);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { uTime: { value: 0 }, uDim: { value: 1 }, uUniverse: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  );
  matRef.current = mat;
  mat.uniforms.uDim.value = tuning.edgeOpacity;
  mat.uniforms.uUniverse.value = tuning.layout === 'universe' ? 1 : 0;

  useFrame((s) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = s.clock.elapsedTime;
      matRef.current.uniforms.uDim.value = tuning.edgeOpacity;
      matRef.current.uniforms.uUniverse.value = tuning.layout === 'universe' ? 1 : 0;
    }
  });

  if (!tuning.showEdges) return null;
  return <mesh geometry={geo} material={mat} frustumCulled={false} />;
}
