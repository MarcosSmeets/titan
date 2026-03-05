import { useRef, useMemo, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line, Sphere, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { TelemetryPoint } from '../types';

const EARTH_RADIUS_KM = 6371;

interface TrajectoryViewerProps {
  telemetry: TelemetryPoint[];
  targetAltitude?: number;
  stageEvents?: { time: number; index: number }[];
  isLive?: boolean;
}

function toScenePos(x: number, y: number, z: number): THREE.Vector3 {
  // x, y, z are in meters from engine. Convert to km (scene units).
  return new THREE.Vector3(x / 1e6, y / 1e6, z / 1e6);
}

function Earth() {
  const meshRef = useRef<THREE.Mesh>(null);
  const radius = EARTH_RADIUS_KM / 1000; // 6.371 scene units

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.02;
    }
  });

  return (
    <group>
      <Sphere ref={meshRef} args={[radius, 64, 64]}>
        <meshStandardMaterial
          color="#1a4488"
          roughness={0.85}
          metalness={0.05}
        />
      </Sphere>
      <Sphere args={[radius * 1.015, 32, 32]}>
        <meshBasicMaterial
          color="#4488cc"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </Sphere>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.999, radius * 1.001, 128]} />
        <meshBasicMaterial color="#334466" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function TrajectoryLine({ points, isLive }: { points: THREE.Vector3[]; isLive?: boolean }) {
  if (points.length < 2) return null;
  return (
    <Line
      points={points}
      color={isLive ? '#ff6644' : '#ff4444'}
      lineWidth={2.5}
    />
  );
}

function TargetOrbit({ altitude }: { altitude: number }) {
  const radius = (EARTH_RADIUS_KM + altitude / 1000) / 1000;
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const angle = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        0
      ));
    }
    return pts;
  }, [radius]);

  return (
    <Line
      points={points}
      color="#22aa44"
      lineWidth={1}
      dashed
      dashSize={0.08}
      gapSize={0.04}
    />
  );
}

function RocketModel({ position, velocity, isLive }: {
  position: THREE.Vector3;
  velocity?: THREE.Vector3;
  isLive?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const flameRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (groupRef.current && velocity && velocity.length() > 0.001) {
      // Orient rocket along velocity direction
      const dir = velocity.clone().normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const quat = new THREE.Quaternion();
      const mat = new THREE.Matrix4();
      mat.lookAt(new THREE.Vector3(), dir, up);
      quat.setFromRotationMatrix(mat);
      groupRef.current.quaternion.slerp(quat, 0.15);
    }
    if (flameRef.current && isLive) {
      const scale = 0.8 + Math.sin(Date.now() * 0.01) * 0.3;
      flameRef.current.scale.set(1, scale, 1);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Body (cylinder along +Z) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.03, 0.12, 8]} />
        <meshStandardMaterial color="#ccccdd" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Nose cone */}
      <mesh position={[0, 0, 0.085]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.025, 0.05, 8]} />
        <meshStandardMaterial color="#ffffff" metalness={0.4} roughness={0.4} />
      </mesh>
      {/* Flame exhaust */}
      {isLive && (
        <mesh ref={flameRef} position={[0, 0, -0.09]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.025, 0.08, 8]} />
          <meshBasicMaterial color="#ff6600" transparent opacity={0.6} />
        </mesh>
      )}
      {/* Outer glow when live */}
      {isLive && (
        <mesh position={[0, 0, -0.08]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color="#ff4400" transparent opacity={0.2} />
        </mesh>
      )}
    </group>
  );
}

function CameraFollower({ target, isFollowing, isLive }: {
  target: THREE.Vector3;
  isFollowing: boolean;
  isLive?: boolean;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useFrame(() => {
    if (!isFollowing || !isLive) return;
    if (target.length() < 0.01) return;

    // Position camera behind & above rocket relative to Earth center
    const dir = target.clone().normalize();
    const offset = dir.clone().multiplyScalar(1.5);
    // Cross with arbitrary to get tangent
    const tangent = new THREE.Vector3(0, 1, 0).cross(dir).normalize().multiplyScalar(0.5);
    const camTarget = target.clone().add(offset).add(tangent);

    camera.position.lerp(camTarget, 0.03);
    camera.lookAt(target);
  });

  return null;
}

function StageMarkers({
  telemetry,
  events,
}: {
  telemetry: TelemetryPoint[];
  events: { time: number; index: number }[];
}) {
  const markers = useMemo(() => {
    return events.map(event => {
      const point = telemetry.find(t => t.time >= event.time);
      if (!point) return null;
      return toScenePos(point.x, point.y, point.z);
    }).filter((p): p is THREE.Vector3 => p !== null);
  }, [telemetry, events]);

  return (
    <>
      {markers.map((pos, i) => (
        <group key={i} position={pos}>
          <Sphere args={[0.03, 8, 8]}>
            <meshBasicMaterial color="#ffaa00" />
          </Sphere>
          <Html distanceFactor={12}>
            <div style={{
              background: 'rgba(0,0,0,0.8)',
              color: '#ffaa00',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '9px',
              whiteSpace: 'nowrap',
              border: '1px solid rgba(255,170,0,0.3)',
            }}>
              STAGE SEP
            </div>
          </Html>
        </group>
      ))}
    </>
  );
}

function Scene({ telemetry, targetAltitude, stageEvents, isLive, followMode }: TrajectoryViewerProps & { followMode: boolean }) {
  const trajectoryPoints = useMemo(() => {
    return telemetry.map(t => toScenePos(t.x, t.y, t.z));
  }, [telemetry]);

  const rocketPosition = trajectoryPoints.length > 0
    ? trajectoryPoints[trajectoryPoints.length - 1]
    : new THREE.Vector3((EARTH_RADIUS_KM / 1000) + 0.001, 0, 0);

  // Compute velocity vector for orientation
  const rocketVelocity = useMemo(() => {
    if (telemetry.length < 2) return new THREE.Vector3(0, 1, 0);
    const curr = trajectoryPoints[trajectoryPoints.length - 1];
    const prev = trajectoryPoints[trajectoryPoints.length - 2];
    return curr.clone().sub(prev).normalize();
  }, [telemetry, trajectoryPoints]);

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[15, 10, 5]} intensity={0.9} />
      <pointLight position={[-10, -10, -5]} intensity={0.2} color="#4488ff" />

      <color attach="background" args={['#020208']} />

      <Earth />
      {targetAltitude && <TargetOrbit altitude={targetAltitude} />}
      <TrajectoryLine points={trajectoryPoints} isLive={isLive} />
      {trajectoryPoints.length > 0 && (
        <RocketModel
          position={rocketPosition}
          velocity={rocketVelocity}
          isLive={isLive}
        />
      )}
      {stageEvents && stageEvents.length > 0 && (
        <StageMarkers telemetry={telemetry} events={stageEvents} />
      )}

      <CameraFollower
        target={rocketPosition}
        isFollowing={followMode}
        isLive={isLive}
      />

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={0.5}
        maxDistance={40}
        autoRotate={!isLive && telemetry.length === 0}
        autoRotateSpeed={0.5}
      />
    </>
  );
}

export default function TrajectoryViewer(props: TrajectoryViewerProps) {
  const [followMode, setFollowMode] = useState(true);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '400px', position: 'relative' }}>
      <Canvas
        camera={{
          position: [0, 0, 14],
          fov: 50,
          near: 0.01,
          far: 500,
        }}
      >
        <Scene {...props} followMode={followMode} />
      </Canvas>

      {/* Follow mode toggle */}
      {props.isLive && (
        <button
          onClick={() => setFollowMode(f => !f)}
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            padding: '6px 12px',
            background: followMode
              ? 'rgba(68,136,255,0.25)'
              : 'rgba(0,0,0,0.6)',
            border: followMode
              ? '1px solid rgba(68,136,255,0.5)'
              : '1px solid rgba(255,255,255,0.15)',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            letterSpacing: '1px',
          }}
        >
          {followMode ? 'FOLLOW CAM' : 'FREE ORBIT'}
        </button>
      )}
    </div>
  );
}
