import { useRef, useMemo, useEffect, useState, Suspense, lazy } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { TelemetryPoint } from '../types';

const EARTH_RADIUS_KM = 6371;
const SCALE = 1; // 1 unit = 1 km

interface Viewer3DProps {
  telemetry: TelemetryPoint[];
  targetAltitude: number; // meters
  isLive: boolean;
}

// --- Earth ---
function Earth() {
  return (
    <group>
      {/* Main Earth sphere */}
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS_KM * SCALE, 64, 64]} />
        <meshStandardMaterial
          color="#1a3a6a"
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>
      {/* Grid lines on Earth */}
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS_KM * SCALE * 1.001, 32, 32]} />
        <meshBasicMaterial
          color="#2255aa"
          wireframe
          transparent
          opacity={0.08}
        />
      </mesh>
      {/* Atmosphere glow */}
      <mesh>
        <sphereGeometry args={[(EARTH_RADIUS_KM + 100) * SCALE, 48, 48]} />
        <meshBasicMaterial
          color="#4488ff"
          transparent
          opacity={0.04}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

// --- Rocket Marker ---
function RocketMarker({ telemetry }: { telemetry: TelemetryPoint[] }) {
  const meshRef = useRef<THREE.Group>(null);
  const latest = telemetry[telemetry.length - 1];

  useFrame(() => {
    if (!meshRef.current || !latest) return;
    const x = (latest.x ?? 0) / 1000 * SCALE;
    const y = (latest.y ?? 0) / 1000 * SCALE;
    const z = (latest.z ?? 0) / 1000 * SCALE;
    meshRef.current.position.set(x, y, z);

    // Apply attitude quaternion
    const w = latest.attitudeW ?? 1;
    const qx = latest.attitudeX ?? 0;
    const qy = latest.attitudeY ?? 0;
    const qz = latest.attitudeZ ?? 0;
    meshRef.current.quaternion.set(qx, qy, qz, w);
  });

  if (!latest) return null;

  return (
    <group ref={meshRef}>
      {/* Rocket body - cone + cylinder */}
      <mesh position={[0, 15, 0]}>
        <coneGeometry args={[8, 20, 8]} />
        <meshStandardMaterial color="#ff4444" emissive="#ff2222" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[8, 8, 20, 8]} />
        <meshStandardMaterial color="#cccccc" emissive="#666666" emissiveIntensity={0.1} />
      </mesh>
      {/* Glow point for visibility */}
      <pointLight color="#ff4444" intensity={100} distance={500} />
    </group>
  );
}

// --- Velocity Arrow ---
function VelocityArrow({ telemetry }: { telemetry: TelemetryPoint[] }) {
  const arrowRef = useRef<THREE.ArrowHelper>(null);
  const latest = telemetry[telemetry.length - 1];

  useFrame(() => {
    if (!arrowRef.current || !latest) return;
    const pos = new THREE.Vector3(
      (latest.x ?? 0) / 1000 * SCALE,
      (latest.y ?? 0) / 1000 * SCALE,
      (latest.z ?? 0) / 1000 * SCALE
    );
    const vel = new THREE.Vector3(
      (latest.vx ?? 0) / 1000,
      (latest.vy ?? 0) / 1000,
      (latest.vz ?? 0) / 1000
    );
    const speed = vel.length();
    if (speed > 0.01) {
      vel.normalize();
      arrowRef.current.position.copy(pos);
      arrowRef.current.setDirection(vel);
      arrowRef.current.setLength(Math.min(speed * 30, 500), 30, 15);
      arrowRef.current.visible = true;
    } else {
      arrowRef.current.visible = false;
    }
  });

  if (!latest) return null;

  return (
    <arrowHelper
      ref={arrowRef}
      args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 100, 0x44ff88]}
    />
  );
}

// --- Trajectory Trail ---
const MAX_TRAIL_POINTS = 2000;

function TrajectoryTrail({ telemetry }: { telemetry: TelemetryPoint[] }) {
  const lineRef = useRef<THREE.Line>(null);
  const positionsRef = useRef(new Float32Array(MAX_TRAIL_POINTS * 3));
  const countRef = useRef(0);

  useEffect(() => {
    if (!lineRef.current) return;
    const positions = positionsRef.current;
    const count = Math.min(telemetry.length, MAX_TRAIL_POINTS);

    // Sample evenly if telemetry exceeds buffer
    const step = telemetry.length > MAX_TRAIL_POINTS
      ? telemetry.length / MAX_TRAIL_POINTS
      : 1;

    for (let i = 0; i < count; i++) {
      const idx = Math.min(Math.floor(i * step), telemetry.length - 1);
      const t = telemetry[idx];
      positions[i * 3] = (t.x ?? 0) / 1000 * SCALE;
      positions[i * 3 + 1] = (t.y ?? 0) / 1000 * SCALE;
      positions[i * 3 + 2] = (t.z ?? 0) / 1000 * SCALE;
    }

    const geom = lineRef.current.geometry as THREE.BufferGeometry;
    geom.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, count * 3), 3));
    geom.setDrawRange(0, count);
    geom.attributes.position.needsUpdate = true;
    countRef.current = count;
  }, [telemetry]);

  return (
    <line ref={lineRef as any}>
      <bufferGeometry />
      <lineBasicMaterial color="#ffaa00" linewidth={1} transparent opacity={0.8} />
    </line>
  );
}

// --- Target Orbit Ring ---
function TargetOrbitRing({ targetAltitude }: { targetAltitude: number }) {
  const radius = (EARTH_RADIUS_KM + targetAltitude / 1000) * SCALE;
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      pts.push([Math.cos(angle) * radius, Math.sin(angle) * radius, 0]);
    }
    return pts;
  }, [radius]);

  return (
    <Line
      points={points}
      color="#44ff88"
      lineWidth={1}
      transparent
      opacity={0.4}
      dashed
      dashSize={50}
      gapSize={30}
    />
  );
}

// --- Predicted Orbit Ellipse ---
function PredictedOrbit({ telemetry }: { telemetry: TelemetryPoint[] }) {
  const latest = telemetry[telemetry.length - 1];
  const points = useMemo(() => {
    if (!latest || latest.eccentricity >= 1 || latest.semiMajorAxis <= 0) return null;

    const a = latest.semiMajorAxis / 1000 * SCALE;
    const e = latest.eccentricity;
    const b = a * Math.sqrt(1 - e * e);
    const c = a * e;

    const pts: [number, number, number][] = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      pts.push([Math.cos(angle) * a - c, Math.sin(angle) * b, 0]);
    }
    return pts;
  }, [latest?.semiMajorAxis, latest?.eccentricity]);

  if (!points) return null;

  return (
    <Line
      points={points}
      color="#8844ff"
      lineWidth={1}
      transparent
      opacity={0.3}
      dashed
      dashSize={40}
      gapSize={20}
    />
  );
}

// --- Apoapsis/Periapsis Markers ---
function ApsisMarkers({ telemetry }: { telemetry: TelemetryPoint[] }) {
  const latest = telemetry[telemetry.length - 1];
  if (!latest || latest.eccentricity >= 1 || latest.semiMajorAxis <= 0) return null;

  const apoR = (EARTH_RADIUS_KM + (latest.apoapsis ?? 0) / 1000) * SCALE;
  const periR = (EARTH_RADIUS_KM + Math.max(latest.periapsis ?? 0, 0) / 1000) * SCALE;

  return (
    <group>
      {/* Apoapsis */}
      <mesh position={[apoR, 0, 0]}>
        <sphereGeometry args={[15, 8, 8]} />
        <meshBasicMaterial color="#44cc66" />
      </mesh>
      {/* Periapsis */}
      <mesh position={[-periR, 0, 0]}>
        <sphereGeometry args={[15, 8, 8]} />
        <meshBasicMaterial color="#ff8844" />
      </mesh>
    </group>
  );
}

// --- Stage Separation Markers ---
function StageSeparationMarkers({ telemetry }: { telemetry: TelemetryPoint[] }) {
  const markers = useMemo(() => {
    const result: { x: number; y: number; z: number; stage: number }[] = [];
    for (let i = 1; i < telemetry.length; i++) {
      if (telemetry[i].stageIndex !== telemetry[i - 1].stageIndex) {
        result.push({
          x: (telemetry[i].x ?? 0) / 1000 * SCALE,
          y: (telemetry[i].y ?? 0) / 1000 * SCALE,
          z: (telemetry[i].z ?? 0) / 1000 * SCALE,
          stage: telemetry[i].stageIndex,
        });
      }
    }
    return result;
  }, [telemetry]);

  return (
    <group>
      {markers.map((m, i) => (
        <mesh key={i} position={[m.x, m.y, m.z]}>
          <sphereGeometry args={[12, 8, 8]} />
          <meshBasicMaterial color={['#ffaa00', '#ff44aa', '#44aaff'][m.stage % 3]} />
        </mesh>
      ))}
    </group>
  );
}

// --- Camera Controller ---
type CameraMode = 'orbit' | 'follow' | 'free';

function CameraController({ telemetry, mode }: { telemetry: TelemetryPoint[]; mode: CameraMode }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const latest = telemetry[telemetry.length - 1];

  useFrame(() => {
    if (mode === 'follow' && latest) {
      const target = new THREE.Vector3(
        (latest.x ?? 0) / 1000 * SCALE,
        (latest.y ?? 0) / 1000 * SCALE,
        (latest.z ?? 0) / 1000 * SCALE
      );
      camera.position.lerp(
        target.clone().add(new THREE.Vector3(200, 200, 200)),
        0.05
      );
      camera.lookAt(target);
    }
    if (mode === 'free' && latest && controlsRef.current) {
      const target = new THREE.Vector3(
        (latest.x ?? 0) / 1000 * SCALE,
        (latest.y ?? 0) / 1000 * SCALE,
        (latest.z ?? 0) / 1000 * SCALE
      );
      controlsRef.current.target.copy(target);
    }
  });

  if (mode === 'follow') return null;

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.1}
      minDistance={EARTH_RADIUS_KM * 0.5}
      maxDistance={EARTH_RADIUS_KM * 6}
    />
  );
}

// --- Main Scene ---
function Scene({ telemetry, targetAltitude, isLive, cameraMode }: Viewer3DProps & { cameraMode: CameraMode }) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[10000, 5000, 10000]} intensity={1.5} />
      <Stars radius={EARTH_RADIUS_KM * 20} depth={EARTH_RADIUS_KM * 10} count={3000} factor={100} fade />
      <CameraController telemetry={telemetry} mode={cameraMode} />
      <Earth />
      <TargetOrbitRing targetAltitude={targetAltitude} />
      <TrajectoryTrail telemetry={telemetry} />
      <PredictedOrbit telemetry={telemetry} />
      <ApsisMarkers telemetry={telemetry} />
      <StageSeparationMarkers telemetry={telemetry} />
      <RocketMarker telemetry={telemetry} />
      <VelocityArrow telemetry={telemetry} />
    </>
  );
}

export default function Viewer3D({ telemetry, targetAltitude, isLive }: Viewer3DProps) {
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>
      {/* Camera mode buttons */}
      <div style={{
        position: 'absolute', top: 8, left: 8, zIndex: 10,
        display: 'flex', gap: 4,
      }}>
        {(['orbit', 'follow', 'free'] as CameraMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => setCameraMode(mode)}
            style={{
              padding: '4px 10px',
              background: cameraMode === mode ? 'rgba(68,136,255,0.2)' : 'rgba(0,0,0,0.5)',
              border: cameraMode === mode ? '1px solid #4488ff' : '1px solid #333',
              borderRadius: 4,
              color: cameraMode === mode ? '#4488ff' : '#888',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            {mode.toUpperCase()}
          </button>
        ))}
      </div>

      <Canvas
        camera={{
          position: [0, 0, EARTH_RADIUS_KM * 2.5],
          fov: 45,
          near: 1,
          far: EARTH_RADIUS_KM * 50,
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <Scene
            telemetry={telemetry}
            targetAltitude={targetAltitude}
            isLive={isLive}
            cameraMode={cameraMode}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
