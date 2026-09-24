// CameraControls + Idle-Auto-Rotation + Fly-to bei Selektion.
import { useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import * as THREE from 'three';
import { useSelection } from '../state/stores';
import { useHand } from '../lib/handControl';
import { useUi } from '../state/stores';
import { useTuning, currentTuning } from '../state/theme';
import type { Graph } from '../data/types';
import { useNodePositions } from './useLayout';

export function CameraRig({ graph }: { graph: Graph }) {
  const controlsRef = useRef<any>(null);
  const selected = useSelection((s) => s.selected);
  const setSelected = useSelection((s) => s.setSelected);
  const idle = useRef({ t: 0 });
  const motion = useTuning().motion;
  const { map } = useNodePositions();
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);

  useEffect(() => {
    const cc = controlsRef.current;
    if (!cc) return;
    if (selected) {
      const n = byId.get(selected);
      const p = map?.get(selected) ?? n?.position;
      if (n && p) {
        const v = new THREE.Vector3(...p);
        // komfortabler Abstand: sichtbarer Radius (Kern+Halo) + Marge
        const dist = Math.max(5.5, n.size * (n.hub ? 20 : 34));
        // Kamera leicht nach links -> Node erscheint rechts vom Detail-Panel
        cc.setLookAt(v.x - dist * 0.18, v.y + dist * 0.28, v.z + dist * 0.95, v.x, v.y, v.z, true);
      }
    } else {
      // S13: Universum ist weiter aufgespannt als die alte Sphäre — Kamera
      // je Layout unterschiedlich weit zurückziehen.
      const far = currentTuning().layout === 'universe' ? 120 : 25;
      cc.setLookAt(0, 6, far, 0, 0, 0, true);
    }
  }, [selected, byId, map]);

  const autopilot = useUi((s) => s.autopilot);
  const apTarget = useRef<{ az: number; el: number; r: number } | null>(null);
  const apNext = useRef(0);

  useFrame((_, dt) => {
    const cc = controlsRef.current;
    if (!cc) return;
    // v5 F: AUTOPILOT — gemütliche Zufallsroute durchs Universum
    if (autopilot) {
      const now = performance.now();
      if (!apTarget.current || now > apNext.current) {
        apNext.current = now + 6000 + Math.random() * 6000;
        apTarget.current = {
          az: (Math.random() - 0.5) * 2.4,
          el: (Math.random() - 0.5) * 1.1,
          r: 40 + Math.random() * 90,
        };
      }
      const t = apTarget.current;
      cc.rotate(t.az * dt * 0.12, t.el * dt * 0.12, false);
      cc.dolly(-dt * 2.2, false);
      // sanft auf Zielradius zurückfedern
      const d = cc.distance;
      if (d < 18) cc.dolly(dt * 3, false);
      if (d > t.r + 30) cc.dolly(dt * 4, false);
      return;
    }
    // v4: Flug/Zoom — Schlangeln = vorwärts+lenken, Handpaar-Abstand = Zoom
    const fly = useHand.getState().fly;
    if (fly.active) {
      idle.current.t = 0;
      if (Math.abs(fly.rotate) > 0.05) cc.rotate(-fly.rotate * 0.004, 0, false);
      if (Math.abs(fly.dolly) > 0.02) cc.dolly(fly.dolly, false);
      if (Math.abs(fly.zoom) > 0.3) cc.dolly(fly.zoom, false);
      return;
    }
    idle.current.t += dt;
    if (idle.current.t > 7 && !selected && motion > 0.05) {
      cc.rotate(dt * 0.06 * motion, 0, true);
    }
  });

  useEffect(() => {
    const reset = () => {
      idle.current.t = 0;
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('pointerdown', reset);
    window.addEventListener('wheel', reset);
    window.addEventListener('keydown', reset);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', reset);
      window.removeEventListener('wheel', reset);
      window.removeEventListener('keydown', reset);
      window.removeEventListener('keydown', esc);
    };
  }, [setSelected]);

  // S15: maxDistance hoch — das ganze Universum muss überblickbar sein
  return (
    <CameraControls
      ref={controlsRef}
      smoothTime={0.35}
      draggingSmoothTime={0.12}
      minDistance={2.4}
      maxDistance={900}
    />
  );
}
