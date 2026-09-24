// Generischer Hintergrund, komplett aus theme.background gespeist.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useTheme, useTuning } from '../state/theme';
import type { ThemeBackground } from '../theme/types';

/** Desktop-Hintergrund, stark abgedunkelt + weichgezeichnet, schimmert durch. */
function WallpaperLayer({ strength }: { strength: number }) {
  const { camera } = useThree();
  const ref = useRef<THREE.Mesh>(null);
  const [tex, setTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!alive) return;
      // vorab weichzeichnen + abdunkeln in ein Canvas
      const w = 640;
      const h = Math.round((img.height / img.width) * w);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const x = c.getContext('2d')!;
      x.filter = 'blur(6px) brightness(0.7) saturate(0.85)';
      x.drawImage(img, 0, 0, w, h);
      x.filter = 'none';
      x.fillStyle = 'rgba(0,0,0,0.18)';
      x.fillRect(0, 0, w, h);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      setTex(t);
    };
    img.onerror = () => setTex(null);
    img.src = '/wallpaper.png';
    return () => {
      alive = false;
    };
  }, []);

  // Ebene bleibt vor der Kamera, weit hinten — wie ein statischer Himmel
  useFrame(() => {
    if (!ref.current) return;
    ref.current.quaternion.copy(camera.quaternion);
    ref.current.position.copy(camera.position);
    ref.current.translateZ(-560);
  });

  if (!tex || strength <= 0) return null;
  return (
    <mesh ref={ref} renderOrder={-1}>
      <planeGeometry args={[1400, 800]} />
      <meshBasicMaterial
        map={tex}
        transparent
        opacity={Math.min(0.6, strength * 1.6)}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function gradientTex(stops: Array<[number, string]>): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 512;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, 512);
  for (const [o, col] of stops) g.addColorStop(o, col);
  x.fillStyle = g;
  x.fillRect(0, 0, 16, 512);
  return new THREE.CanvasTexture(c);
}

function blobTex(colors: string[]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d')!;
  let seed = 12345;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  colors.forEach((col) => {
    for (let i = 0; i < 3; i++) {
      const g = x.createRadialGradient(
        90 + rnd() * 330,
        90 + rnd() * 330,
        10,
        256,
        256,
        190 + rnd() * 90,
      );
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 512, 512);
    }
  });
  return new THREE.CanvasTexture(c);
}

function dotTex(color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(16, 16, 1, 16, 16, 16);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

function FallingParticles({
  count,
  color,
  size,
  drift,
}: {
  count: number;
  color: string;
  size: number;
  drift: number;
}) {
  const ref = useRef<THREE.Points>(null);
  const spread = 380;
  const { geo, spd } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * spread;
      pos[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.6;
      pos[i * 3 + 2] = (Math.random() - 0.5) * spread * 0.5;
      spd[i] = 0.4 + Math.random() * 1.4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { geo: g, spd };
  }, [count]);
  const tex = useMemo(() => dotTex(color), [color]);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const p = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      let y = p.getY(i) + drift * spd[i] * dt;
      if (drift < 0 && y < -140) y = 140;
      if (drift > 0 && y > 140) y = -140;
      p.setY(i, y);
    }
    p.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial
        map={tex}
        size={size}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function Backdrop({ bg }: { bg: ThemeBackground }) {
  const grad = useMemo(() => gradientTex(bg.gradient), [bg]);
  const blobs = useMemo(() => blobTex(bg.blobs), [bg]);
  const grp = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (grp.current) grp.current.rotation.y += dt * 0.0016;
  });
  const wallpaper = useTuning().wallpaper;
  return (
    <group>
      <mesh>
        <sphereGeometry args={[700, 32, 24]} />
        <meshBasicMaterial
          map={grad}
          side={THREE.BackSide}
          depthWrite={false}
          transparent
          opacity={wallpaper > 0 ? 1 - Math.min(0.55, wallpaper * 1.8) : 1}
        />
      </mesh>
      {wallpaper > 0 && <WallpaperLayer strength={wallpaper} />}
      <group ref={grp}>
        <sprite position={[-200, 120, -420]} scale={720}>
          <spriteMaterial map={blobs} transparent opacity={bg.blobOpacity} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
        <sprite position={[260, -170, -460]} scale={820}>
          <spriteMaterial map={blobs} transparent opacity={bg.blobOpacity * 0.7} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      </group>
      {bg.particles && (
        <FallingParticles
          count={bg.particles.count}
          color={bg.particles.color}
          size={bg.particles.size}
          drift={bg.particles.drift}
        />
      )}
    </group>
  );
}

export function ThemeBackdrop() {
  const bg = useTheme((s) => s.theme.background);
  return <Backdrop bg={bg} key={JSON.stringify(bg.gradient)} />;
}
