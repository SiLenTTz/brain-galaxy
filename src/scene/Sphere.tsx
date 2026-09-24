// Glashuelle: Fresnel-Rim (atmend) + dezenter Innen-Schimmer.
// Blendet aus, wenn die Kamera hineinzoomt.
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useTheme } from '../state/theme';

const frag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uTime;
  uniform float uOpacity;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
    float shimmer = 0.82 + 0.18 * sin(uTime * 0.5 + vN.y * 3.5);
    gl_FragColor = vec4(uColor * shimmer, f * uOpacity);
  }
`;
const vert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export function Sphere({ radius = 10 }: { radius?: number }) {
  const { camera } = useThree();
  const rimRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const theme = useTheme((s) => s.theme);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: {
          uColor: { value: new THREE.Color(theme.palette.shell) },
          uPower: { value: 3.0 },
          uTime: { value: 0 },
          uOpacity: { value: 0.85 },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [],
  );
  // Farbe bei Theme-Wechsel aktualisieren
  mat.uniforms.uColor.value.set(theme.palette.shell);

  const innerColor = useMemo(() => new THREE.Color(theme.palette.fog).multiplyScalar(1.4), [theme]);

  useFrame((s) => {
    const dist = camera.position.length();
    const fade = THREE.MathUtils.clamp((dist - radius * 0.55) / (radius * 0.5), 0, 1);
    mat.uniforms.uTime.value = s.clock.elapsedTime;
    mat.uniforms.uOpacity.value = 0.85 * fade;
    if (innerRef.current) (innerRef.current.material as THREE.MeshBasicMaterial).opacity = 0.3 * fade;
  });

  return (
    <group>
      <mesh ref={rimRef} material={mat}>
        <sphereGeometry args={[radius * 1.012, 64, 48]} />
      </mesh>
      <mesh ref={innerRef}>
        <sphereGeometry args={[radius * 0.99, 48, 32]} />
        <meshBasicMaterial color={innerColor} transparent opacity={0.3} side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </group>
  );
}
