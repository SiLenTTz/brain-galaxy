// Canvas-Setup + Szenen-Komposition.
import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect } from 'react';
import * as THREE from 'three';
import { Sphere } from './Sphere';
import { GalaxyCores } from './GalaxyCores';
import { Centerpiece } from './Centerpiece';
import { NodeField } from './NodeField';
import { EdgeField } from './EdgeField';
import { Starfield, Dust, Nebula, Asteroids, BrightStars } from './Atmosphere';
import { ThemeBackdrop } from './ThemeBackdrop';
import { PickingHitbox } from './PickingHitbox';
import { CameraRig } from './CameraRig';
import { Effects } from './Effects';
import { useGraph, useSelection } from '../state/stores';
import { useTheme, useTuning } from '../state/theme';

function SceneContent() {
  const graph = useGraph((s) => s.graph);
  const selected = useSelection((s) => s.selected);
  const theme = useTheme((s) => s.theme);
  const layout = useTuning().layout;
  const isMobile = typeof matchMedia !== 'undefined' &&
    (matchMedia('(pointer: coarse)').matches || innerWidth <= 820);
  if (!graph) return null;
  return (
    <>
      <color attach="background" args={[theme.palette.bg]} />
      <fogExp2 attach="fog" args={[theme.palette.fog, isMobile ? 0.02 : layout === 'universe' ? 0.0035 : 0.011]} />
      <ambientLight intensity={0.2} />
      <ThemeBackdrop />
      <Nebula />
      <Starfield />
      <BrightStars />
      {!isMobile && <Asteroids />}
      {/* S15: Galaxien-Kerne — warmer Bulge + ausgedehnter Halo je Cluster */}
      {layout === 'universe' && <GalaxyCores />}
      {/* S13: Sphäre nur noch im SPHÄRE-Layout — Universum braucht keine Hülle */}
      {layout === 'sphere' && <Sphere radius={10} />}
      <Centerpiece />
      <EdgeField graph={graph} />
      <NodeField graph={graph} />
      <PickingHitbox graph={graph} />
      <Dust />
      <CameraRig graph={graph} />
      {!isMobile && <Effects focusMode={!!selected} />}
    </>
  );
}

export function NeuralScene() {
  const load = useGraph((s) => s.load);
  // S12: Performance-Modus mobil — dpr-Cap 1 + Postprocessing aus
  // (Touch-Steuerung selbst kommt von CameraControls nativ).
  const isMobile = typeof matchMedia !== 'undefined' &&
    (matchMedia('(pointer: coarse)').matches || innerWidth <= 820);
  useEffect(() => {
    // nur beim ALLERERSTEN Mount laden — ein Remount (z.B. Graph-Wechsel
    // Vault↔Hive) darf die aktive Quelle NICHT mit Vault-Daten überschreiben
    if (!(window as any).__galaxyLoaded) {
      (window as any).__galaxyLoaded = true;
      load();
    }
  }, [load]);
  return (
    <Canvas
      gl={{ antialias: !isMobile, powerPreference: 'high-performance' }}
      dpr={isMobile ? 1 : [1, 2]}
      camera={{ fov: 42, position: [0, 14, 110], near: 0.1, far: 4000 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
      }}
    >
      <Suspense fallback={null}>
        <SceneContent />
      </Suspense>
    </Canvas>
  );
}
