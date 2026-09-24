// Waehlt das Zentrums-Element nach Theme: Wisp (ambient) oder Figur (branded).
// Per Tuning abschaltbar (tuning.avatar).
import { Component, Suspense, type ReactNode } from 'react';
import { useTheme, useTuning } from '../state/theme';
import { Wisp } from './figures/Wisp';
import { Figure } from './figures/Figure';

class FigureBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function Centerpiece() {
  const cp = useTheme((s) => s.theme);
  const tuning = useTuning();

  if (!tuning.avatar) {
    // dezenter Kern-Schein, damit die Mitte nicht tot wirkt
    return <pointLight color={cp.palette.accent} distance={10} decay={2} intensity={0.9} />;
  }

  const c = cp.centerpiece;
  const s = tuning.avatarScale;
  if (c.kind === 'wisp') {
    return (
      <group scale={s}>
        <Wisp form={c.form} colorA={c.colorA} colorB={c.colorB} motion={tuning.motion} />
      </group>
    );
  }

  const procedural = (
    <group scale={s}>
      <Figure form={c.form} glow={c.glow} accent={c.accent} />
    </group>
  );
  if (!c.modelUrl) return procedural;

  return (
    <FigureBoundary fallback={procedural}>
      <Suspense fallback={null}>
        <group scale={s}>
          <Figure
            form={c.form}
            glow={c.glow}
            accent={c.accent}
            modelUrl={c.modelUrl}
            modelStyle={c.modelStyle}
            modelHeight={c.modelHeight}
            modelY={c.modelY}
          />
        </group>
      </Suspense>
    </FigureBoundary>
  );
}
