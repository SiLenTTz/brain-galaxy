// NodeField — instanzierte Satelliten (HDR-Kerne + Halos), einzelne Hubs.
// Positionen kommen aus useNodePositions (sphere|force) und werden weich gelerpt.
import { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Graph, Category } from '../data/types';
import { categoryColor } from '../lib/colors';
import { haloTexture } from '../shaders/textures';
import { useGraph, useSelection } from '../state/stores';
// Supernodes (folder:/community:) drillen tiefer (S7b), Notizen wählen.
import { useTheme, useTuning } from '../state/theme';
import { useNodePositions } from './useLayout';
import { useNeighborFocus } from '../hud/Features';

/** direkte Wikilink-Nachbarn eines Knotens (inkl. ihm selbst). */
export function neighborsOf(graph: Graph, id: string | null): Set<string> | null {
  if (!id) return null;
  const s = new Set<string>([id]);
  for (const e of graph.edges) {
    if (e.source === id) s.add(e.target);
    if (e.target === id) s.add(e.source);
  }
  return s;
}

const VERT = /* glsl */ `
  attribute float aPhase;
  attribute float aActivity;
  attribute vec3 aColorHDR;
  attribute float aFocus;      // 1 = im Fokus / kein Fokus aktiv, <1 = gedimmt
  uniform float uTime;
  varying vec3 vColor;
  varying vec3 vN;
  varying vec3 vV;
  varying float vFocus;
  void main() {
    float pulse = 0.72 + 0.42 * sin(uTime * 1.5 + aPhase * 6.2831) * aActivity
             + 0.1 * sin(uTime * 3.7 + aPhase * 12.0) * aActivity;
    vColor = aColorHDR * pulse;
    vFocus = aFocus;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying vec3 vN;
  varying vec3 vV;
  varying float vFocus;
  void main() {
    vec3 L = normalize(vec3(0.4, 0.8, 0.55));
    float diff = max(dot(vN, L), 0.0);
    float fres = pow(1.0 - max(dot(vN, vV), 0.0), 2.4);
    vec3 col = vColor * (0.5 + 0.6 * diff) + vColor * fres * 0.9 + vec3(1.0) * fres * 0.12;
    gl_FragColor = vec4(col * vFocus, 1.0);
  }
`;

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _cur = new THREE.Vector3();

export function NodeField({ graph }: { graph: Graph }) {
  const instRef = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const haloRef = useRef<THREE.Points>(null);

  const hiddenCats = useGraph((s) => s.hiddenCats);
  const cutoff = useGraph((s) => s.cutoff);
  const filterIds = useGraph((s) => s.filterIds);
  const hovered = useSelection((s) => s.hovered);
  const selected = useSelection((s) => s.selected);
  const { neighborSet } = useNeighborFocus();
  const theme = useTheme((s) => s.theme);
  const tuning = useTuning();
  const { map } = useNodePositions();

  const satellites = useMemo(() => graph.nodes.filter((n) => !n.hub), [graph]);
  const hubs = useMemo(() => graph.nodes.filter((n) => n.hub), [graph]);

  // aktuelle (gelerpte) Positionen — persistiert ueber Renders.
  // S13: Bei Layout-/Map-Wechsel SNAPPEN (sonst lerpen hunderte Knoten
  // minutenlang vom alten Layout heran — sah aus wie „ein Ball + Staub").
  const live = useRef<Float32Array>(new Float32Array(satellites.length * 3));
  useLayoutEffect(() => {
    live.current = new Float32Array(
      satellites.flatMap((n) => (map?.get(n.id) ?? n.position) as number[]),
    );
  }, [satellites, graph, map]);

  const { colorArr, phaseArr, actArr, focusArr } = useMemo(() => {
    const colorArr = new Float32Array(satellites.length * 3);
    const phaseArr = new Float32Array(satellites.length);
    const actArr = new Float32Array(satellites.length);
    const focusArr = new Float32Array(satellites.length).fill(1);
    satellites.forEach((n, i) => {
      const c = new THREE.Color(categoryColor(n.category)).multiplyScalar(2.05);
      colorArr.set([c.r, c.g, c.b], i * 3);
      phaseArr[i] = Math.random();
      actArr[i] = n.activity;
    });
    return { colorArr, phaseArr, actArr, focusArr };
  }, [satellites, theme]);

  const focusAttrRef = useRef<THREE.InstancedBufferAttribute | null>(null);
  useLayoutEffect(() => {
    const inst = instRef.current;
    if (!inst) return;
    const geo = inst.geometry;
    geo.setAttribute('aColorHDR', new THREE.InstancedBufferAttribute(colorArr, 3));
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phaseArr, 1));
    geo.setAttribute('aActivity', new THREE.InstancedBufferAttribute(actArr, 1));
    const fa = new THREE.InstancedBufferAttribute(focusArr, 1);
    fa.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aFocus', fa);
    focusAttrRef.current = fa;
  }, [colorArr, phaseArr, actArr, focusArr]);

  const nodeMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { uTime: { value: 0 } },
        toneMapped: false,
      }),
    [],
  );
  matRef.current = nodeMat;

  const haloTex = useMemo(() => haloTexture(theme.palette.soft), [theme]);

  const focusSet = useMemo(
    () => neighborsOf(graph, hovered ?? selected),
    [graph, hovered, selected],
  );

  // S10/S11: Label-Budget — max ~40 Hub-Labels gleichzeitig (nach Grad),
  // Fokus-Mitglieder zeigen ihr Label immer.
  const labelAllowed = useMemo(() => {
    const top = [...hubs].sort((a, b) => (b.degree ?? 0) - (a.degree ?? 0)).slice(0, 40);
    return new Set(top.map((n) => n.id));
  }, [hubs]);

  const focusEase = useRef(1);

  useFrame((s, dt) => {
    const inst = instRef.current;
    if (!inst) return;
    // S10: Render-fps für Bench (window.__renderFps)
    const w = window as any;
    w.__frameCount = (w.__frameCount || 0) + 1;
    if (w.__frameCount === 1 || s.clock.elapsedTime - (w.__fpsFrameT || 0) >= 1) {
      w.__renderFps = w.__frameCount - (w.__fpsFrames || 0);
      w.__fpsFrames = w.__frameCount;
      w.__fpsFrameT = s.clock.elapsedTime;
    }
    if (matRef.current) matRef.current.uniforms.uTime.value = s.clock.elapsedTime;

    const k = 1 - Math.pow(0.0015, dt);
    const arr = live.current;
    const haloPos = haloRef.current
      ? (haloRef.current.geometry.attributes.position as THREE.BufferAttribute)
      : null;
    const fa = focusAttrRef.current;
    const dimTarget = focusSet ? 0.14 : 1;
    focusEase.current += (dimTarget - focusEase.current) * Math.min(1, dt * 8);

    let visCount = 0;
    for (let i = 0; i < satellites.length; i++) {
      const n = satellites[i];
      const target = map?.get(n.id) ?? n.position;
      _cur.set(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]);
      _p.set(target[0], target[1], target[2]);
      _cur.lerp(_p, k);
      arr[i * 3] = _cur.x;
      arr[i * 3 + 1] = _cur.y;
      arr[i * 3 + 2] = _cur.z;

      let vis = !hiddenCats.has(n.category);
      if (vis && neighborSet) vis = neighborSet.has(n.id);
      if (vis && filterIds) vis = filterIds.includes(n.id);
      if (vis && cutoff && n.mtime && n.mtime > cutoff) vis = false;
      // S13/A3: Bedeutungs-Filter — Hubs/Supernodes bleiben immer sichtbar
      if (vis && tuning.minDegree > 0 && !n.hub && n.degree < tuning.minDegree) vis = false;
      const scale = vis ? Math.max(0.02, n.size * 1.7 * tuning.nodeScale) : 0.0001;
      if (vis) visCount++;
      _m.makeScale(scale, scale, scale).setPosition(_cur.x, _cur.y, _cur.z);
      inst.setMatrixAt(i, _m);
      if (haloPos) haloPos.setXYZ(i, _cur.x, _cur.y, _cur.z);
      if (fa) fa.setX(i, focusSet && !focusSet.has(n.id) ? focusEase.current : 1);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (haloPos) haloPos.needsUpdate = true;
    if (fa) fa.needsUpdate = true;
    (window as any).__weaveStats = { satellites: satellites.length, visible: visCount, hubs: hubs.length };
  });

  return (
    <group>
      <instancedMesh
        ref={instRef}
        args={[undefined, undefined, Math.max(1, satellites.length)]}
        material={nodeMat}
        frustumCulled={false}
        raycast={() => null}
      >
        <sphereGeometry args={[1, 20, 14]} />
      </instancedMesh>

      <points ref={haloRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(satellites.length * 3), 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          map={haloTex}
          size={0.64 * tuning.nodeScale}
          sizeAttenuation
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>

      {hubs.map((n, i) => (
        <HubNode
          key={n.id}
          node={n}
          map={map ?? undefined}
          scaleMul={tuning.hubScale}
          dim={focusSet && !focusSet.has(n.id) ? 0.16 : 1}
          showLabel={tuning.labels !== 'none' && (labelAllowed.has(n.id) || !!focusSet?.has(n.id))}
          alwaysLabel={tuning.labels === 'all' || (!!focusSet && focusSet.has(n.id))}
          labelStagger={(i % 4) * 0.32}
        />
      ))}
    </group>
  );
}

function HubNode({
  node,
  map,
  scaleMul,
  dim,
  showLabel,
  alwaysLabel,
  labelStagger,
}: {
  node: { id: string; label: string; position: [number, number, number]; size: number; category: Category; activity: number };
  map: Map<string, [number, number, number]> | undefined;
  scaleMul: number;
  dim: number;
  showLabel: boolean;
  alwaysLabel: boolean;
  labelStagger: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.MeshBasicMaterial>(null);
  const setSelected = useSelection((s) => s.setSelected);
  const setHovered = useSelection((s) => s.setHovered);
  const hiddenCats = useGraph((s) => s.hiddenCats);
  const base = useMemo(() => new THREE.Color(categoryColor(node.category)), [node.category]);
  const halo = useMemo(() => haloTexture(categoryColor(node.category)), [node.category]);
  const dimEase = useRef(1);
  // Label nur nah oder im Fokus zeigen -> keine Ueberfuellung in der Uebersicht
  const [labelNear, setLabelNear] = useState(false);

  useFrame((s, dt) => {
    if (!ref.current) return;
    const target = map?.get(node.id) ?? node.position;
    ref.current.position.lerp(_p.set(target[0], target[1], target[2]), 1 - Math.pow(0.0015, dt));
    const pulse = 1 + Math.sin(s.clock.elapsedTime * 1.3 + node.activity * 6) * 0.05;
    const hidden = hiddenCats.has(node.category);
    ref.current.scale.setScalar(hidden ? 0.0001 : pulse * scaleMul);
    ref.current.visible = !hidden;
    dimEase.current += (dim - dimEase.current) * Math.min(1, dt * 8);
    if (coreRef.current) coreRef.current.color.copy(base).multiplyScalar(2.0 * dimEase.current);
    const d = s.camera.position.distanceTo(ref.current.position);
    if (d < 17 && !labelNear) setLabelNear(true);
    else if (d > 19 && labelNear) setLabelNear(false);
  });

  const showLabelNow = showLabel && (alwaysLabel || labelNear);

  return (
    <group
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        const id = String(node.id);
        if (id.startsWith('folder:') || id.startsWith('community:'))
          useGraph.getState().drillInto({ id, label: node.label });
        else setSelected(node.id);
      }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(node.id); }}
      onPointerOut={() => setHovered(null)}
    >
      <mesh>
        <sphereGeometry args={[node.size * 0.9, 28, 20]} />
        <meshBasicMaterial ref={coreRef} toneMapped={false} />
      </mesh>
      <sprite scale={node.size * 9}>
        <spriteMaterial map={halo} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.78 * dim} />
      </sprite>
      <sprite scale={node.size * 19}>
        <spriteMaterial map={halo} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.12 * dim} />
      </sprite>
      {showLabelNow && (
        <Html
          position={[0, node.size * 1.9 + 0.35 + labelStagger, 0]}
          center
          zIndexRange={[10, 0]}
          occlude={false}
          style={{ pointerEvents: 'none', opacity: dim, transition: 'opacity .2s' }}
        >
          <div className="node-label">{node.label}</div>
        </Html>
      )}
    </group>
  );
}
