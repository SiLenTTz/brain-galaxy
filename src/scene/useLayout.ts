import { useEffect } from 'react';
import { useGraph } from '../state/stores';
import { useTuning } from '../state/theme';

/** Liefert die aktive Positions-Map (sphere | force) und stoesst Force-Berechnung an. */
export function useNodePositions() {
  const layout = useTuning().layout;
  const positions = useGraph((s) => s.positions);
  const ensureLayout = useGraph((s) => s.ensureLayout);
  useEffect(() => {
    ensureLayout(layout);
  }, [layout, ensureLayout]);
  const map = positions[layout] ?? positions.sphere;
  return { map, layout, ready: !!map };
}
