// Zentrums-Gestalt fuer gebrandete Themes — hinterleuchtete Silhouette.
// Grosser Glutschein dahinter, Gestalt dunkel mit duennem Rand-Licht:
// man liest den Umriss, nicht die Oberflaeche.
//
// Die Formen sind EIGENSTAENDIGE Archetypen (Daemonenfuerst / Schwarm-Gestalt),
// KEIN Nachbau geschuetzter Spiel-Charaktere. Wer ein konkretes Modell will,
// legt eine .glb nach public/models/ und traegt sie im Theme als `modelUrl` ein
// (siehe public/models/README.md).
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { haloTexture } from '../../shaders/textures';

/* ---------------- Silhouetten-Material ---------------- */
const BODY_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  varying float vY;
  void main() {
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = normalize(-mv.xyz);
    vY = position.y;
    gl_Position = projectionMatrix * mv;
  }
`;
const BODY_FRAG = /* glsl */ `
  uniform vec3 uGlow;
  uniform float uTime;
  varying vec3 vN;
  varying vec3 vV;
  varying float vY;
  void main() {
    float rim = pow(1.0 - max(dot(vN, vV), 0.0), 3.0);
    // dezente gluehende Ader, sehr sparsam
    float crack = smoothstep(0.93, 1.0, sin(vY * 2.2 - uTime * 1.1) * 0.5 + 0.5);
    float flicker = 0.82 + 0.12 * sin(uTime * 5.0) + 0.06 * sin(uTime * 19.0);
    vec3 col = vec3(0.012, 0.011, 0.014)
             + uGlow * rim * 2.0 * flicker
             + uGlow * crack * 0.18;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function useBodyMat(glow: string) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: BODY_VERT,
        fragmentShader: BODY_FRAG,
        uniforms: { uGlow: { value: new THREE.Color(glow) }, uTime: { value: 0 } },
        toneMapped: false,
      }),
    [],
  );
  mat.uniforms.uGlow.value.set(glow);
  return mat;
}

/* ---------------- .glb (eigenes Modell) ---------------- */
// Verarbeitet auch rohe generierte Meshes (Hunyuan3D/ComfyUI o.ae.):
// fehlende Normalen berechnen, auf Zielhoehe skalieren, zentrieren,
// Silhouetten-Shader aufziehen (dunkel + Randglut, passt zum Theme).
function GlbFigure({
  url,
  glow,
  accent,
  style = 'silhouette',
  targetHeight = 3.2,
  yOffset = 0,
}: {
  url: string;
  glow: string;
  accent: string;
  style?: 'silhouette' | 'lit';
  targetHeight?: number;
  yOffset?: number;
}) {
  const gltf = useGLTF(url) as any;
  const ref = useRef<THREE.Group>(null);
  const bodyMat = useBodyMat(glow);
  const litMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(glow).multiplyScalar(0.22),
        emissive: new THREE.Color(glow),
        emissiveIntensity: 0.35,
        roughness: 0.55,
        metalness: 0.25,
      }),
    [glow],
  );

  const prepared = useMemo(() => {
    const root: THREE.Object3D = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const scale = targetHeight / Math.max(size.x, size.y, size.z, 0.001);
    root.traverse((o: any) => {
      if (o.isMesh) {
        const g: THREE.BufferGeometry = o.geometry;
        if (!g.getAttribute('normal')) g.computeVertexNormals();
        o.material = style === 'lit' ? litMat : bodyMat;
        o.castShadow = false;
        o.receiveShadow = false;
        o.frustumCulled = false;
      }
    });
    // Mittelpunkt in den Ursprung (vertikale Feinlage macht yOffset)
    root.position.set(-center.x, -center.y, -center.z);
    const wrap = new THREE.Group();
    wrap.add(root);
    wrap.scale.setScalar(scale);
    return wrap;
  }, [gltf, style, litMat, bodyMat, targetHeight]);

  useFrame((s) => {
    bodyMat.uniforms.uTime.value = s.clock.elapsedTime;
    if (ref.current) {
      ref.current.position.y = yOffset + Math.sin(s.clock.elapsedTime * 0.75) * 0.05;
      ref.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.2) * 0.25;
    }
  });

  return (
    <group>
      <sprite position={[0, 0.2, -0.9]} scale={[9, 10, 1]}>
        <spriteMaterial map={haloTexture(glow)} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.5} />
      </sprite>
      <sprite position={[0, -0.3, -0.6]} scale={[5.5, 3.5, 1]}>
        <spriteMaterial map={haloTexture(accent)} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.3} />
      </sprite>
      <group ref={ref}>
        <primitive object={prepared} />
      </group>
      {style === 'lit' && (
        <>
          <pointLight color={accent} distance={16} decay={2} intensity={3} position={[2.5, 3, 3]} />
          <pointLight color={'#ffffff'} distance={14} decay={2} intensity={1.2} position={[-2, 1.5, 2.5]} />
          <hemisphereLight args={[glow, '#0a0a12', 0.5]} />
        </>
      )}
      <pointLight color={glow} distance={22} decay={2} intensity={3.2} position={[0, 0.5, -1.2]} />
    </group>
  );
}

/* ---------------- Archetyp: Daemonenfuerst ---------------- */
function DemonForm({ mat }: { mat: THREE.ShaderMaterial }) {
  const horn = useMemo(() => {
    // aus dem Kopf heraus, weit nach aussen und dann nach hinten-oben geschwungen
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.35, 0.2, -0.1),
      new THREE.Vector3(0.62, 0.55, -0.35),
      new THREE.Vector3(0.6, 1.0, -0.7),
      new THREE.Vector3(0.35, 1.35, -0.95),
    ]);
    const g = new THREE.TubeGeometry(c, 32, 0.14, 8, false);
    return g;
  }, []);
  const arm = useMemo(() => {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.35, -0.5, 0.2),
      new THREE.Vector3(0.55, -1.1, 0.35),
      new THREE.Vector3(0.42, -1.6, 0.55),
    ]);
    return new THREE.TubeGeometry(c, 24, 0.16, 8, false);
  }, []);
  const claw = useMemo(() => new THREE.ConeGeometry(0.05, 0.32, 5), []);
  return (
    <group>
      {/* Umhang, breit auslaufend + zerfranst */}
      <mesh material={mat} position={[0, -0.25, 0]}>
        <coneGeometry args={[1.02, 3.2, 11, 1, true]} />
      </mesh>
      {[...Array(9)].map((_, i) => {
        const a = (i / 9) * Math.PI * 2;
        return (
          <mesh key={i} material={mat} position={[Math.cos(a) * 0.96, -1.7, Math.sin(a) * 0.96]} rotation={[0.25, -a, 0]}>
            <coneGeometry args={[0.14, 0.7, 4]} />
          </mesh>
        );
      })}
      {/* massiver Brustkorb */}
      <mesh material={mat} position={[0, 0.55, 0]} scale={[1.2, 1.15, 0.95]}>
        <sphereGeometry args={[0.6, 28, 20]} />
      </mesh>
      {/* hochgezogene Schulterspitzen */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={mat} position={[s * 0.66, 1.1, -0.05]} rotation={[0, 0, s * -0.5]}>
          <coneGeometry args={[0.22, 0.6, 6]} />
        </mesh>
      ))}
      {/* Arme + Klauen, gebeugt nach vorn */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.6, 0.75, 0.1]} scale={[s, 1, 1]}>
          <mesh geometry={arm} material={mat} />
          {[-0.12, 0, 0.12].map((o, k) => (
            <mesh key={k} geometry={claw} material={mat} position={[0.42 + o * 0.4, -1.7, 0.55 + o]} rotation={[1.2, 0, o * 2]} />
          ))}
        </group>
      ))}
      {/* Kapuzen-Kopf, vorgebeugt, kein Gesicht */}
      <mesh material={mat} position={[0, 1.28, 0.12]} scale={[0.85, 1.0, 0.9]}>
        <sphereGeometry args={[0.42, 22, 18]} />
      </mesh>
      <mesh material={mat} position={[0, 1.55, -0.16]} rotation={[0.55, 0, 0]}>
        <coneGeometry args={[0.4, 0.7, 14]} />
      </mesh>
      {/* geschwungene Haupthoerner */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={horn} material={mat} position={[s * 0.22, 1.2, 0.05]} scale={[s, 1, 1]} />
      ))}
      {/* Augenglut */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.15, 1.24, 0.42]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshBasicMaterial color={'#ffcf9a'} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------- Archetyp: Schwarm-Gestalt ---------------- */
function SwarmForm({ mat }: { mat: THREE.ShaderMaterial }) {
  const blade = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.05, 0.9, 0.35, 1.7, 0.75, 2.3);
    shape.bezierCurveTo(0.35, 1.5, 0.16, 0.8, 0.13, 0);
    shape.lineTo(0, 0);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
  }, []);
  const tendril = useMemo(() => {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.25, -0.5, 0.3),
      new THREE.Vector3(0.15, -1.2, 0.5),
      new THREE.Vector3(-0.1, -1.7, 0.4),
    ]);
    return new THREE.TubeGeometry(c, 24, 0.06, 6, false);
  }, []);
  const bladePos = [-3, -2, -1, 1, 2, 3];
  return (
    <group>
      {/* schlanker, bio-organischer Torso */}
      <mesh material={mat} position={[0, 0.2, 0]} scale={[0.58, 2.0, 0.46]}>
        <capsuleGeometry args={[0.4, 1.15, 12, 24]} />
      </mesh>
      {/* Carapax-Schultern */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={mat} position={[s * 0.42, 1.5, 0]} rotation={[0, 0, s * 0.7]} scale={[1, 0.55, 0.8]}>
          <sphereGeometry args={[0.32, 18, 14]} />
        </mesh>
      ))}
      {/* Kopf + langer Schaedelkamm */}
      <mesh material={mat} position={[0, 1.85, 0.02]} scale={[0.6, 1.15, 0.72]}>
        <icosahedronGeometry args={[0.26, 3]} />
      </mesh>
      <mesh material={mat} position={[0, 2.15, -0.28]} rotation={[-0.9, 0, 0]}>
        <coneGeometry args={[0.11, 0.9, 6]} />
      </mesh>
      {/* gefaecherter Klingen-Kamm im Ruecken */}
      {bladePos.map((i) => (
        <mesh
          key={i}
          geometry={blade}
          material={mat}
          position={[i * 0.14, 1.1, -0.4]}
          rotation={[0.35, 0, i * 0.2]}
          scale={[i < 0 ? -1 : 1, 0.75 + (3 - Math.abs(i)) * 0.18, 1]}
        />
      ))}
      {/* vordere Greif-Tendrils */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.4, 1.25, 0.15]} scale={[s, 1, 1]}>
          <mesh geometry={tendril} material={mat} />
        </group>
      ))}
      {/* Beine, spinnenartig gebeugt */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={mat} position={[s * 0.28, -0.85, 0.05]} rotation={[0.2, 0, s * 0.35]}>
          <capsuleGeometry args={[0.09, 1.2, 6, 10]} />
        </mesh>
      ))}
      {/* Bio-Glut */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.1, 1.88, 0.28]}>
          <sphereGeometry args={[0.04, 10, 10]} />
          <meshBasicMaterial color={'#d8ffff'} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, 0.7, 0.24]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshBasicMaterial color={'#9be8ff'} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ---------------- Wrapper ---------------- */
export function Figure({
  form,
  glow,
  accent,
  modelUrl,
  modelStyle,
  modelHeight,
  modelY,
}: {
  form: 'demon' | 'queen';
  glow: string;
  accent: string;
  modelUrl?: string;
  modelStyle?: 'silhouette' | 'lit';
  modelHeight?: number;
  modelY?: number;
}) {
  const grp = useRef<THREE.Group>(null);
  const mat = useBodyMat(glow);
  const backGlow = useMemo(() => haloTexture(glow), [glow]);
  const rimGlow = useMemo(() => haloTexture(accent), [accent]);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    mat.uniforms.uTime.value = t;
    if (grp.current) {
      grp.current.position.y = -1.4 + Math.sin(t * 0.75) * 0.05;
      grp.current.rotation.y = Math.sin(t * 0.2) * 0.22;
    }
    if (lightRef.current) lightRef.current.intensity = 3.4 + Math.sin(t * 4.5) * 0.7;
  });

  if (modelUrl)
    return (
      <GlbFigure
        url={modelUrl}
        glow={glow}
        accent={accent}
        style={modelStyle}
        targetHeight={modelHeight}
        yOffset={modelY ?? 0.2}
      />
    );

  return (
    <group>
      {/* Hinterleuchtung */}
      <sprite position={[0, 0.2, -0.9]} scale={[9, 10, 1]}>
        <spriteMaterial map={backGlow} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.5} />
      </sprite>
      <sprite position={[0, -0.3, -0.6]} scale={[5.5, 3.5, 1]}>
        <spriteMaterial map={rimGlow} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.32} />
      </sprite>
      <group ref={grp} scale={1.25}>
        {form === 'demon' ? <DemonForm mat={mat} /> : <SwarmForm mat={mat} />}
      </group>
      <pointLight ref={lightRef} color={glow} distance={22} decay={2} intensity={3.4} position={[0, 0.5, -1.2]} />
    </group>
  );
}
