import { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import { OrbitControls, Stars, Line, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { TelemetryPoint } from '../types';

const EARTH_R = 6371; // km
const S = 1; // scale: 1 unit = 1 km

interface Props {
  telemetry: TelemetryPoint[];
  targetAltitude: number;
  isLive: boolean;
}

/* ── Earth ────────────────────────────────────────────── */
function Earth() {
  const meshRef = useRef<THREE.Mesh>(null);

  // Procedural Earth colors via shader
  const earthMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        sunDir: { value: new THREE.Vector3(1, 0.3, 0.5).normalize() },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 sunDir;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;

        // Simple hash for procedural continents
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 5; i++) {
            v += a * noise(p);
            p *= 2.0;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          float lat = asin(vNormal.y);
          float lon = atan(vNormal.z, vNormal.x);
          vec2 uv = vec2(lon / 6.2832 + 0.5, lat / 3.1416 + 0.5);

          // Continent mask
          float land = fbm(uv * 8.0 + vec2(1.7, 3.2));
          land = smoothstep(0.42, 0.52, land);

          // Ice caps
          float ice = smoothstep(0.82, 0.92, abs(vNormal.y));

          // Ocean color with depth variation
          vec3 deepOcean = vec3(0.02, 0.06, 0.18);
          vec3 shallowOcean = vec3(0.04, 0.12, 0.28);
          float oceanDepth = fbm(uv * 12.0);
          vec3 ocean = mix(deepOcean, shallowOcean, oceanDepth);

          // Land color
          vec3 forest = vec3(0.06, 0.14, 0.05);
          vec3 desert = vec3(0.18, 0.14, 0.08);
          vec3 mountain = vec3(0.12, 0.11, 0.10);
          float biome = fbm(uv * 16.0 + vec2(5.0, 2.0));
          vec3 landColor = mix(forest, desert, smoothstep(0.4, 0.6, biome));
          landColor = mix(landColor, mountain, smoothstep(0.65, 0.8, biome));

          vec3 iceColor = vec3(0.85, 0.88, 0.92);

          vec3 baseColor = mix(ocean, landColor, land);
          baseColor = mix(baseColor, iceColor, ice);

          // Lighting
          float NdotL = max(dot(vNormal, sunDir), 0.0);
          float ambient = 0.08;
          vec3 lit = baseColor * (ambient + NdotL * 0.92);

          // Terminator glow
          float terminator = smoothstep(-0.02, 0.08, NdotL);
          lit = mix(vec3(0.01, 0.01, 0.03), lit, terminator);

          gl_FragColor = vec4(lit, 1.0);
        }
      `,
    });
  }, []);

  return (
    <group>
      <mesh ref={meshRef} material={earthMat}>
        <sphereGeometry args={[EARTH_R * S, 96, 96]} />
      </mesh>
      {/* Atmosphere layers */}
      <mesh>
        <sphereGeometry args={[(EARTH_R + 60) * S, 64, 64]} />
        <meshBasicMaterial color="#4488ff" transparent opacity={0.03} side={THREE.BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[(EARTH_R + 120) * S, 48, 48]} />
        <meshBasicMaterial color="#6699ff" transparent opacity={0.015} side={THREE.BackSide} />
      </mesh>
      {/* Grid overlay */}
      <mesh>
        <sphereGeometry args={[EARTH_R * S * 1.001, 36, 18]} />
        <meshBasicMaterial color="#3366aa" wireframe transparent opacity={0.04} />
      </mesh>
    </group>
  );
}

/* ── Rocket with exhaust ──────────────────────────────── */
function Rocket({ telemetry }: { telemetry: TelemetryPoint[] }) {
  const groupRef = useRef<THREE.Group>(null);
  const exhaustRef = useRef<THREE.Mesh>(null);
  const latest = telemetry[telemetry.length - 1];

  useFrame(({ clock }) => {
    if (!groupRef.current || !latest) return;
    const x = (latest.x ?? 0) / 1000 * S;
    const y = (latest.y ?? 0) / 1000 * S;
    const z = (latest.z ?? 0) / 1000 * S;
    groupRef.current.position.set(x, y, z);

    // Point rocket along velocity vector
    const vx = latest.vx ?? 0;
    const vy = latest.vy ?? 0;
    const vz = latest.vz ?? 0;
    const speed = Math.sqrt(vx*vx + vy*vy + vz*vz);
    if (speed > 10) {
      const dir = new THREE.Vector3(vx, vy, vz).normalize();
      const up = new THREE.Vector3(x, y, z).normalize();
      const mat = new THREE.Matrix4().lookAt(
        new THREE.Vector3(0,0,0), dir, up
      );
      groupRef.current.quaternion.setFromRotationMatrix(mat);
    }

    // Exhaust flicker
    if (exhaustRef.current) {
      const hasThrust = latest.stageIndex !== undefined && speed > 50;
      exhaustRef.current.visible = hasThrust;
      if (hasThrust) {
        const flicker = 0.8 + 0.2 * Math.sin(clock.elapsedTime * 30);
        exhaustRef.current.scale.set(flicker, 1.0 + 0.3 * Math.sin(clock.elapsedTime * 20), flicker);
      }
    }
  });

  if (!latest) return null;

  const rocketScale = 6;

  return (
    <group ref={groupRef}>
      {/* Nose cone */}
      <mesh position={[0, 0, 4 * rocketScale]} rotation={[Math.PI/2, 0, 0]}>
        <coneGeometry args={[1.2 * rocketScale, 3 * rocketScale, 8]} />
        <meshStandardMaterial color="#e8e8ec" metalness={0.4} roughness={0.3} />
      </mesh>
      {/* Body */}
      <mesh rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[1.2 * rocketScale, 1.2 * rocketScale, 6 * rocketScale, 8]} />
        <meshStandardMaterial color="#c8ccd4" metalness={0.3} roughness={0.4} />
      </mesh>
      {/* Engine bell */}
      <mesh position={[0, 0, -4.5 * rocketScale]} rotation={[Math.PI/2, 0, 0]}>
        <coneGeometry args={[1.5 * rocketScale, 2 * rocketScale, 8]} />
        <meshStandardMaterial color="#444" metalness={0.6} roughness={0.2} />
      </mesh>
      {/* Exhaust plume */}
      <mesh ref={exhaustRef} position={[0, 0, -7 * rocketScale]} rotation={[Math.PI/2, 0, 0]}>
        <coneGeometry args={[2 * rocketScale, 8 * rocketScale, 8]} />
        <meshBasicMaterial color="#ff8830" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      {/* Inner exhaust (brighter core) */}
      <mesh position={[0, 0, -6 * rocketScale]} rotation={[Math.PI/2, 0, 0]}>
        <coneGeometry args={[0.8 * rocketScale, 5 * rocketScale, 6]} />
        <meshBasicMaterial color="#ffe8a0" transparent opacity={0.5} />
      </mesh>
      {/* Glow */}
      <pointLight color="#ff6622" intensity={800} distance={600} />
    </group>
  );
}

/* ── Trajectory Trail ─────────────────────────────────── */
const MAX_TRAIL = 3000;

function Trail({ telemetry }: { telemetry: TelemetryPoint[] }) {
  const points = useMemo(() => {
    const step = telemetry.length > MAX_TRAIL ? telemetry.length / MAX_TRAIL : 1;
    const count = Math.min(telemetry.length, MAX_TRAIL);
    const pts: [number, number, number][] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.min(Math.floor(i * step), telemetry.length - 1);
      const t = telemetry[idx];
      pts.push([(t.x ?? 0)/1000*S, (t.y ?? 0)/1000*S, (t.z ?? 0)/1000*S]);
    }
    return pts;
  }, [telemetry]);

  if (points.length < 2) return null;

  return (
    <Line
      points={points}
      color="#f59e0b"
      lineWidth={1.5}
      transparent
      opacity={0.85}
    />
  );
}

/* ── Velocity Arrow ───────────────────────────────────── */
function VelArrow({ telemetry }: { telemetry: TelemetryPoint[] }) {
  const ref = useRef<THREE.ArrowHelper>(null);
  const latest = telemetry[telemetry.length - 1];

  useFrame(() => {
    if (!ref.current || !latest) return;
    const pos = new THREE.Vector3(
      (latest.x??0)/1000*S, (latest.y??0)/1000*S, (latest.z??0)/1000*S
    );
    const vel = new THREE.Vector3(
      (latest.vx??0)/1000, (latest.vy??0)/1000, (latest.vz??0)/1000
    );
    const spd = vel.length();
    if (spd > 0.01) {
      vel.normalize();
      ref.current.position.copy(pos);
      ref.current.setDirection(vel);
      ref.current.setLength(Math.min(spd * 25, 400), 25, 12);
      ref.current.visible = true;
    } else {
      ref.current.visible = false;
    }
  });

  if (!latest) return null;
  return (
    <arrowHelper
      ref={ref}
      args={[new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,0), 100, 0x22c55e]}
    />
  );
}

/* ── Target Orbit ─────────────────────────────────────── */
function TargetOrbit({ alt }: { alt: number }) {
  const r = (EARTH_R + alt / 1000) * S;
  const pts = useMemo(() => {
    const p: [number,number,number][] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      p.push([Math.cos(a) * r, Math.sin(a) * r, 0]);
    }
    return p;
  }, [r]);
  return <Line points={pts} color="#22c55e" lineWidth={1} transparent opacity={0.35} dashed dashSize={40} gapSize={25} />;
}

/* ── Predicted Orbit ──────────────────────────────────── */
function PredOrbit({ telemetry }: { telemetry: TelemetryPoint[] }) {
  const latest = telemetry[telemetry.length - 1];
  const pts = useMemo(() => {
    if (!latest || latest.eccentricity >= 1 || latest.semiMajorAxis <= 0) return null;
    const a = latest.semiMajorAxis / 1000 * S;
    const e = latest.eccentricity;
    const b = a * Math.sqrt(1 - e * e);
    const c = a * e;
    const p: [number,number,number][] = [];
    for (let i = 0; i <= 128; i++) {
      const angle = (i / 128) * Math.PI * 2;
      p.push([Math.cos(angle) * a - c, Math.sin(angle) * b, 0]);
    }
    return p;
  }, [latest?.semiMajorAxis, latest?.eccentricity]);
  if (!pts) return null;
  return <Line points={pts} color="#a855f7" lineWidth={1} transparent opacity={0.25} dashed dashSize={35} gapSize={20} />;
}

/* ── Apsis markers ────────────────────────────────────── */
function ApsisMarkers({ telemetry }: { telemetry: TelemetryPoint[] }) {
  const latest = telemetry[telemetry.length - 1];
  if (!latest || latest.eccentricity >= 1 || latest.semiMajorAxis <= 0) return null;
  const apoR = (EARTH_R + (latest.apoapsis ?? 0) / 1000) * S;
  const periR = (EARTH_R + Math.max(latest.periapsis ?? 0, 0) / 1000) * S;
  return (
    <group>
      <mesh position={[apoR, 0, 0]}>
        <octahedronGeometry args={[12]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.8} />
      </mesh>
      <mesh position={[-periR, 0, 0]}>
        <octahedronGeometry args={[12]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

/* ── Stage sep markers ────────────────────────────────── */
function StageSepMarkers({ telemetry }: { telemetry: TelemetryPoint[] }) {
  const markers = useMemo(() => {
    const res: { x: number; y: number; z: number; stage: number }[] = [];
    for (let i = 1; i < telemetry.length; i++) {
      if (telemetry[i].stageIndex !== telemetry[i-1].stageIndex) {
        res.push({
          x: (telemetry[i].x??0)/1000*S,
          y: (telemetry[i].y??0)/1000*S,
          z: (telemetry[i].z??0)/1000*S,
          stage: telemetry[i].stageIndex,
        });
      }
    }
    return res;
  }, [telemetry]);
  const colors = ['#f59e0b', '#ec4899', '#06b6d4'];
  return (
    <group>
      {markers.map((m, i) => (
        <mesh key={i} position={[m.x, m.y, m.z]}>
          <sphereGeometry args={[8, 8, 8]} />
          <meshBasicMaterial color={colors[m.stage % 3]} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/* ── Camera ───────────────────────────────────────────── */
type CamMode = 'orbit' | 'follow' | 'chase';

function Cam({ telemetry, mode }: { telemetry: TelemetryPoint[]; mode: CamMode }) {
  const { camera } = useThree();
  const ctrlRef = useRef<any>(null);
  const latest = telemetry[telemetry.length - 1];

  useFrame(() => {
    if (!latest) return;
    const target = new THREE.Vector3(
      (latest.x??0)/1000*S, (latest.y??0)/1000*S, (latest.z??0)/1000*S
    );

    if (mode === 'follow') {
      const rocketUp = target.clone().normalize();
      const offset = rocketUp.clone().multiplyScalar(150)
        .add(new THREE.Vector3(80, 80, 80));
      camera.position.lerp(target.clone().add(offset), 0.04);
      camera.lookAt(target);
    }
    if (mode === 'chase') {
      const vel = new THREE.Vector3(
        (latest.vx??0)/1000, (latest.vy??0)/1000, (latest.vz??0)/1000
      ).normalize();
      const rocketUp = target.clone().normalize();
      // Behind and above the rocket
      const behind = vel.clone().multiplyScalar(-200);
      const above = rocketUp.clone().multiplyScalar(60);
      camera.position.lerp(target.clone().add(behind).add(above), 0.03);
      camera.lookAt(target);
    }
    if (mode === 'orbit' && ctrlRef.current) {
      ctrlRef.current.target.lerp(target, 0.02);
    }
  });

  if (mode !== 'orbit') return null;
  return (
    <OrbitControls
      ref={ctrlRef}
      enableDamping dampingFactor={0.08}
      minDistance={EARTH_R * 0.3}
      maxDistance={EARTH_R * 8}
      rotateSpeed={0.5}
    />
  );
}

/* ── HUD overlay ──────────────────────────────────────── */
function HUD({ telemetry, isLive }: { telemetry: TelemetryPoint[]; isLive: boolean }) {
  const latest = telemetry[telemetry.length - 1];
  if (!latest) return null;

  const alt = (latest.altitude / 1000).toFixed(1);
  const vel = latest.velocity.toFixed(0);
  const apo = (latest.apoapsis / 1000).toFixed(1);
  const peri = (latest.periapsis / 1000).toFixed(1);

  return (
    <div style={{
      position: 'absolute', bottom: 12, left: 12, zIndex: 10,
      display: 'flex', gap: 16,
      fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
      background: 'rgba(6,6,12,0.75)', backdropFilter: 'blur(8px)',
      padding: '8px 14px', borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <span style={{ color: '#3b82f6' }}>ALT <span style={{ color: '#e8eaf0' }}>{alt}</span> km</span>
      <span style={{ color: '#ec4899' }}>VEL <span style={{ color: '#e8eaf0' }}>{vel}</span> m/s</span>
      <span style={{ color: '#22c55e' }}>APO <span style={{ color: '#e8eaf0' }}>{apo}</span> km</span>
      <span style={{ color: '#f59e0b' }}>PER <span style={{ color: '#e8eaf0' }}>{peri}</span> km</span>
    </div>
  );
}

/* ── Scene ────────────────────────────────────────────── */
function Scene({ telemetry, targetAltitude, isLive, cam }: Props & { cam: CamMode }) {
  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight position={[15000, 5000, 10000]} intensity={2.0} color="#fffaf0" />
      <directionalLight position={[-8000, -3000, -5000]} intensity={0.15} color="#4466aa" />
      <Stars radius={EARTH_R * 30} depth={EARTH_R * 15} count={4000} factor={120} fade speed={0.3} />
      <Cam telemetry={telemetry} mode={cam} />
      <Earth />
      <TargetOrbit alt={targetAltitude} />
      <Trail telemetry={telemetry} />
      <PredOrbit telemetry={telemetry} />
      <ApsisMarkers telemetry={telemetry} />
      <StageSepMarkers telemetry={telemetry} />
      <Rocket telemetry={telemetry} />
      <VelArrow telemetry={telemetry} />
    </>
  );
}

/* ── Main ─────────────────────────────────────────────── */
export default function Viewer3D({ telemetry, targetAltitude, isLive }: Props) {
  const [cam, setCam] = useState<CamMode>('orbit');

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#020208' }}>
      {/* Camera mode selector */}
      <div style={{
        position: 'absolute', top: 10, left: 10, zIndex: 10,
        display: 'flex', gap: 4,
      }}>
        {(['orbit', 'follow', 'chase'] as CamMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => setCam(mode)}
            style={{
              padding: '5px 12px',
              background: cam === mode ? 'rgba(59,130,246,0.15)' : 'rgba(6,6,12,0.6)',
              border: cam === mode ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: 6,
              color: cam === mode ? '#3b82f6' : '#6b7088',
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              letterSpacing: '0.5px',
              backdropFilter: 'blur(4px)',
              transition: 'all 0.15s',
            }}
          >
            {mode.toUpperCase()}
          </button>
        ))}
      </div>

      <HUD telemetry={telemetry} isLive={isLive} />

      <Canvas
        camera={{
          position: [0, 0, EARTH_R * 2.5],
          fov: 45, near: 1, far: EARTH_R * 60,
        }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <Scene telemetry={telemetry} targetAltitude={targetAltitude} isLive={isLive} cam={cam} />
        </Suspense>
      </Canvas>
    </div>
  );
}
