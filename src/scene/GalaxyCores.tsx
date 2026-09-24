// GalaxyCores — S15: warmer Bulge + ausgedehnter Halo je Cluster-Zentrum.
// Macht jede „Galaxie" des Universum-Layouts als Leuchtkörper ablesbar,
// noch bevor einzelne Knoten auflösbar sind (auch aus der Distanz).
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGraph } from '../state/stores';
import { useTheme, useTuning } from '../state/theme';
import { haloTexture } from '../shaders/textures';
import { useNodePositions } from './useLayout';

export function GalaxyCores() {
  const graph = useGraph((s) => s.graph);
  const theme = useTheme((s) => s.theme);
  const glow = useTuning().glow;
  const { map } = useNodePositions();
  const grp = useRef<THREE.Group>(null);

  const cores = useMemo(() => {
    if (!graph || !map) return [];
    // Cluster → Schwerpunkt + Streuungsradius
    const byCluster = new Map<string, number[][]>();
    for (const n of graph.nodes) {
      const p = map.get(n.id) ?? n.position;
      const k = n.cluster ?? '_';
      const arr = byCluster.get(k);
      if (arr) arr.push(p as number[]);
      else byCluster.set(k, [p as number[]]);
    }
    return [...byCluster.entries()]
      .map(([k, pts]) => {
        let cx = 0, cy = 0, cz = 0;
        for (const p of pts) { cx += p[0]; cy += p[1]; cz += p[2]; }
        cx /= pts.length; cy /= pts.length; cz /= pts.length;
        let r = 0;
        for (const p of pts) r = Math.max(r, Math.hypot(p[0] - cx, p[1] - cy, p[2] - cz));
        return { key: k, pos: [cx, cy, cz] as [number, number, number], r, count: pts.length };
      })
      .filter((c) => c.count >= 4)
      .sort((a, b) => b.count - a.count)
      .slice(0, 24); // die 24 größten Galaxien
  }, [graph, map]);

  const bulgeTex = useMemo(() => haloTexture(theme.palette.accent), [theme]);
  const haloTex = useMemo(() => haloTexture(theme.palette.soft), [theme]);

  useFrame((s) => {
    if (grp.current) grp.current.rotation.y = 0; // Positionen sind absolut
  });

  return (
    <group ref={grp}>
      {cores.map((c) => (
        <group key={c.key} position={c.pos}>
          {/* Bulge: kleiner, heller Kern */}
          <sprite scale={Math.max(3, c.r * 0.5)}>
            <spriteMaterial map={bulgeTex} color={theme.palette.accent}
              transparent opacity={0.34 * glow} depthWrite={false}
              blending={THREE.AdditiveBlending} />
          </sprite>
          {/* Ausgedehnter, dezenter Scheiben-Halo */}
          <sprite scale={c.r * 2.6}>
            <spriteMaterial map={haloTex} color={theme.palette.soft}
              transparent opacity={0.12 * glow} depthWrite={false}
              blending={THREE.AdditiveBlending} />
          </sprite>
        </group>
      ))}
    </group>
  );
}
