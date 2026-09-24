// Post-Processing: selektives Bloom (Threshold + HDR) + dezente Aberration/Grain/Vignette.
import { Bloom, ChromaticAberration, Noise, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useMemo } from 'react';
import * as THREE from 'three';
import { useTuning } from '../state/theme';

export function Effects({ focusMode = false }: { focusMode?: boolean }) {
  const glow = useTuning().glow;
  const caOffset = useMemo(() => new THREE.Vector2(0.0006, 0.0006), []);
  return (
    <>
      <Bloom
        mipmapBlur
        intensity={1.45 * glow}
        luminanceThreshold={0.88}
        luminanceSmoothing={0.2}
        radius={0.85}
      />
      <ChromaticAberration offset={caOffset} blendFunction={BlendFunction.NORMAL} radialModulation={false} modulationOffset={0} />
      <Noise opacity={0.045} blendFunction={BlendFunction.OVERLAY} />
      <Vignette darkness={0.6} offset={0.32} />
    </>
  );
}
