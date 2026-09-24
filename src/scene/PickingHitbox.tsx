// PickingHitbox — unsichtbare, groessere Kollisionskugeln ueber den Satelliten,
// damit kleine Nodes komfortabel klick- und hoverbar werden.
import { useMemo, useCallback } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { Graph } from '../data/types';
import { useGraph, useSelection } from '../state/stores';
import { useTuning } from '../state/theme';
import { useNodePositions } from './useLayout';

export function PickingHitbox({ graph }: { graph: Graph }) {
  const setSelected = useSelection((s) => s.setSelected);
  const setHovered = useSelection((s) => s.setHovered);
  const hiddenCats = useGraph((s) => s.hiddenCats);
  const nodeScale = useTuning().nodeScale;
  const { map } = useNodePositions();
  const satellites = useMemo(() => graph.nodes.filter((n) => !n.hub), [graph]);

  const onClick = useCallback(
    (id: string) => (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      setSelected(id);
    },
    [setSelected],
  );

  return (
    <group>
      {satellites.map((n) => {
        if (hiddenCats.has(n.category)) return null;
        const p = map?.get(n.id) ?? n.position;
        const radius = Math.max(0.32, n.size * 2.5 * nodeScale * 1.6);
        return (
          <mesh
            key={n.id}
            position={p}
            onClick={onClick(n.id)}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(n.id); }}
            onPointerOut={() => setHovered(null)}
          >
            <sphereGeometry args={[radius, 8, 6]} />
            <meshBasicMaterial visible={false} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}
