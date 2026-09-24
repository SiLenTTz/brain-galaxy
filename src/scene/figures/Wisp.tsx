// Irrlicht / Flamme / Orb — der bewegte Startpunkt fuer Themes ohne Branding.
// Feuert gelegentlich blitzartige Strukturen aus dem Kern.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { haloTexture } from '../../shaders/textures';

const SEGS = 9;

/** Ein Pool von Blitzen, die zufaellig aus dem Zentrum schiessen und schnell verglimmen. */
function LightningBolts({ color, motion }: { color: string; motion: number }) {
  const COUNT = 4;
  const linesRef = useRef<Array<THREE.Line | null>>([]);
  const state = useRef(
    Array.from({ length: COUNT }, () => ({ life: 0, cooldown: 0.4 + Math.random() * 2.5, dir: new THREE.Vector3(), len: 2 })),
  );
  const geos = useMemo(
    () =>
      Array.from({ length: COUNT }, () => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEGS + 1) * 3), 3));
        return g;
      }),
    [],
  );
  const mat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(2.4),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [color],
  );
  mat.color.set(color).multiplyScalar(2.4);

  const rebuild = (i: number) => {
    const st = state.current[i];
    st.dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    st.len = 1.6 + Math.random() * 1.8;
    const perp = new THREE.Vector3(st.dir.y, -st.dir.x, st.dir.z).normalize();
    const perp2 = new THREE.Vector3().crossVectors(st.dir, perp).normalize();
    const pos = geos[i].getAttribute('position') as THREE.BufferAttribute;
    for (let s = 0; s <= SEGS; s++) {
      const f = s / SEGS;
      const jitter = f * (1 - f) * st.len * 0.9;
      const p = st.dir.clone().multiplyScalar(f * st.len);
      p.addScaledVector(perp, (Math.random() - 0.5) * jitter);
      p.addScaledVector(perp2, (Math.random() - 0.5) * jitter);
      pos.setXYZ(s, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
  };

  useFrame((_, dt) => {
    let anyAlive = false;
    for (let i = 0; i < COUNT; i++) {
      const st = state.current[i];
      const line = linesRef.current[i];
      if (st.life > 0) {
        st.life -= dt * 6;
        if (Math.random() < 0.4) rebuild(i); // flackern
        if (line) line.visible = true;
        anyAlive = true;
      } else {
        if (line) line.visible = false;
        st.cooldown -= dt * (0.4 + motion);
        if (st.cooldown <= 0) {
          st.life = 1;
          st.cooldown = 1.5 + Math.random() * 4;
          rebuild(i);
        }
      }
    }
    mat.opacity = anyAlive
      ? Math.max(...state.current.map((s) => Math.max(0, s.life))) * 0.9
      : 0;
  });

  return (
    <group>
      {geos.map((g, i) => (
        // @ts-expect-error three line element
        <line key={i} ref={(el: any) => (linesRef.current[i] = el)} geometry={g} material={mat} visible={false} />
      ))}
    </group>
  );
}

const CORE_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uWobble;
  varying float vGlow;
  varying vec3 vN;
  varying vec3 vV;
  // billiger 3D-Noise
  float hash(vec3 p){ return fract(sin(dot(p, vec3(27.61, 57.58, 91.13))) * 43758.5453); }
  float noise(vec3 p){
    vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
    float n = mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                  mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
    return n;
  }
  void main() {
    vec3 p = position;
    float d = noise(normalize(position) * 2.4 + uTime * 0.6);
    p += normal * (d - 0.5) * uWobble;
    vGlow = d;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const CORE_FRAG = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vGlow;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float fres = pow(1.0 - max(dot(vN, vV), 0.0), 2.2);
    vec3 col = mix(uColorB, uColorA, vGlow) + fres * uColorA * 0.5;
    col += uColorA * pow(vGlow, 3.0) * 0.35;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function Wisp({
  form,
  colorA,
  colorB,
  motion = 1,
}: {
  form: 'wisp' | 'flame' | 'orb';
  colorA: string;
  colorB: string;
  motion?: number;
}) {
  const grp = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Sprite>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const sparksRef = useRef<THREE.Points>(null);

  const cA = useMemo(() => new THREE.Color(colorA).multiplyScalar(1.7), [colorA]);
  const cB = useMemo(() => new THREE.Color(colorB).multiplyScalar(1.0), [colorB]);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CORE_VERT,
        fragmentShader: CORE_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uWobble: { value: form === 'orb' ? 0.12 : 0.32 },
          uColorA: { value: cA },
          uColorB: { value: cB },
        },
        toneMapped: false,
      }),
    [form],
  );
  mat.uniforms.uColorA.value = cA;
  mat.uniforms.uColorB.value = cB;

  const halo = useMemo(() => haloTexture(colorA), [colorA]);

  const sparks = useMemo(() => {
    const n = 60;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 0.5 + Math.random() * 1.6;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    mat.uniforms.uTime.value = t;
    const m = motion;
    if (grp.current) {
      if (form === 'wisp') {
        grp.current.position.set(
          Math.sin(t * 0.7) * 1.1 * m,
          Math.sin(t * 1.1 + 1) * 0.8 * m,
          Math.cos(t * 0.5) * 1.1 * m,
        );
      } else if (form === 'flame') {
        grp.current.position.set(Math.sin(t * 3.1) * 0.06 * m, 0, Math.cos(t * 2.3) * 0.06 * m);
      }
      grp.current.rotation.y = t * 0.3 * m;
    }
    const flick =
      form === 'flame'
        ? 1 + Math.sin(t * 13) * 0.12 + Math.sin(t * 27) * 0.06
        : 1 + Math.sin(t * 2.2) * 0.08;
    if (coreRef.current) {
      coreRef.current.scale.set(
        form === 'flame' ? 0.82 * flick : flick,
        form === 'flame' ? 1.5 * flick : flick,
        form === 'flame' ? 0.82 * flick : flick,
      );
    }
    if (haloRef.current) haloRef.current.scale.setScalar((form === 'orb' ? 5.5 : 6.5) * flick);
    if (lightRef.current) lightRef.current.intensity = 4 * flick;
    if (sparksRef.current) {
      sparksRef.current.rotation.y = -t * 0.6 * m;
      sparksRef.current.rotation.x = Math.sin(t * 0.4) * 0.4;
    }
  });

  return (
    <group ref={grp}>
      <mesh ref={coreRef} material={mat}>
        <icosahedronGeometry args={[0.6, 6]} />
      </mesh>
      <sprite ref={haloRef} scale={6.5}>
        <spriteMaterial map={halo} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.7} />
      </sprite>
      <points ref={sparksRef} geometry={sparks}>
        <pointsMaterial
          map={halo}
          size={0.16}
          sizeAttenuation
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          color={colorA}
          opacity={0.9}
          toneMapped={false}
        />
      </points>
      <LightningBolts color={colorA} motion={motion} />
      <pointLight ref={lightRef} color={colorA} distance={16} decay={2} intensity={4} />
    </group>
  );
}
