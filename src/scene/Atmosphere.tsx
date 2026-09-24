// Sternenfeld (aussen) + Staub (innen). Beides theme-gesteuert.
import type { RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTheme } from '../state/theme';
import { haloTexture, starTexture, nebulaTexture } from '../shaders/textures';

export function Starfield({ count = 5200 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const enabled = useTheme((s) => s.theme.background.stars);
  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 240 + Math.random() * 480;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      const b = 0.5 + Math.random() * 0.65;
      const warm = Math.random() > 0.78;
      col[i * 3] = b * (warm ? 1.0 : 0.82);
      col[i * 3 + 1] = b * 0.88;
      col[i * 3 + 2] = b * (warm ? 0.72 : 1.0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, [count]);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.003;
  });
  if (!enabled) return null;
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={1.5} vertexColors sizeAttenuation transparent opacity={0.9} depthWrite={false} />
    </points>
  );
}

export function Dust({ count = 340 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const color = useTheme((s) => s.theme.palette.dust);
  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 3 + Math.random() * 6.2;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count]);
  useFrame((s) => {
    if (ref.current) ref.current.rotation.y = s.clock.elapsedTime * 0.008;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial
        size={0.08}
        color={color}
        sizeAttenuation
        transparent
        opacity={0.4}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/** S13 Cosmic-Web: Nebel-Hauch — wenige riesige weiche Sprites in Theme-
 *  Nebelfarbe hinter dem Graph, langsam driftend. Erzeugt die wolkige
 *  Tiefe des Vorbilds ohne teure Shader. */
export function Nebula({ count = 12 }: { count?: number }) {
  const grp = useRef<THREE.Group>(null);
  const theme = useTheme((s) => s.theme);
  const sprites = useMemo(() => {
    const tex = nebulaTexture(7);
    const warm = nebulaTexture(23);
    const rnd = mulberry32(13);
    return Array.from({ length: count }, (_, i) => ({
      tex: i % 2 ? warm : tex,
      pos: [
        (rnd() - 0.5) * 260,
        (rnd() - 0.5) * 140,
        -60 - rnd() * 120,
      ] as [number, number, number],
      scale: 90 + rnd() * 130,
      opacity: 0.08 + rnd() * 0.08,
      spin: (rnd() - 0.5) * 0.01,
    }));
  }, [theme]);
  useFrame((_, dt) => {
    if (grp.current) grp.current.rotation.z += dt * 0.004;
  });
  return (
    <group ref={grp}>
      {sprites.map((s, i) => (
        <sprite key={i} position={s.pos} scale={s.scale}>
          <spriteMaterial
            map={s.tex}
            color={i % 2 ? theme.palette.accent : theme.palette.soft}
            transparent
            opacity={s.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
    </group>
  );
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** S14: Asteroiden-Gürtel — instanzierte, unregelmäßige Brocken in weitem
 *  Orbit um das Universum. Deterministisch (seed), langsame Drift-Drehung. */
export function Asteroids({ count = 180 }: { count?: number }) {
  const grp = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    // unregelmäßiger Brocken: Ikosaeder mit zufällig skalierten Vertices
    const g = new THREE.IcosahedronGeometry(1, 0);
    const p = g.attributes.position as THREE.BufferAttribute;
    const rnd = mulberry32(77);
    for (let i = 0; i < p.count; i++) {
      const s = 0.7 + rnd() * 0.6;
      p.setXYZ(i, p.getX(i) * s, p.getY(i) * (0.6 + rnd() * 0.7), p.getZ(i) * s);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  useFrame((_, dt) => {
    if (mesh.current) mesh.current.rotation.y += dt * 0.01;
    if (grp.current) grp.current.rotation.y -= dt * 0.004;
  });
  return (
    <group ref={grp}>
      <instancedMesh
        ref={mesh}
        args={[geo, undefined, count]}
        frustumCulled={false}
        raycast={() => null}
      >
        <meshStandardMaterial color="#4a4f5c" roughness={0.95} metalness={0.1} flatShading />
      </instancedMesh>
      <AsteroidPlacements mesh={mesh} count={count} />
    </group>
  );
}

function AsteroidPlacements({ mesh, count }: { mesh: RefObject<THREE.InstancedMesh | null>; count: number }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current || !mesh.current) return;
    done.current = true;
    const rnd = mulberry32(2026);
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const ang = rnd() * Math.PI * 2;
      const r = 120 + rnd() * 90;                 // Orbit weit außen
      const y = (rnd() - 0.5) * 40;
      const s = 0.6 + rnd() * rnd() * 6;
      m.makeScale(s, s, s);
      m.setPosition(Math.cos(ang) * r, y, Math.sin(ang) * r);
      mesh.current.setMatrixAt(i, m);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return null;
}

/** S15: helle Vordergrund-Sterne mit Beugungs-Spitzen (Astro-Look) —
 *  wenige, groß, mit echter Stern-Textur statt Punkten. */
export function BrightStars({ count = 320 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const tex = useMemo(() => starTexture(), []);
  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const rnd = mulberry32(99);
    for (let i = 0; i < count; i++) {
      const r = 160 + rnd() * 520;
      const th = rnd() * Math.PI * 2;
      const ph = Math.acos(2 * rnd() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph) * 0.8;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count]);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.0012;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial
        map={tex}
        size={7}
        sizeAttenuation
        transparent
        opacity={0.95}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
