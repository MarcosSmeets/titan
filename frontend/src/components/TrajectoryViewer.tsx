import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Sphere, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { TelemetryPoint } from '../types';

const EARTH_RADIUS = 6371; // km for visualization
const SCALE = 1 / 1000; // Convert km to scene units

interface TrajectoryViewerProps {
  telemetry: TelemetryPoint[];
  overlayTelemetry?: { name: string; data: TelemetryPoint[]; color: string }[];
  targetAltitude?: number;
  stageEvents?: { time: number; index: number }[];
}

function Earth() {
  const meshRef = useRef<THREE.Mesh>(null);
  const radius = EARTH_RADIUS * SCALE;

  return (
    <Sphere ref={meshRef} args={[radius, 64, 64]}>
      <meshStandardMaterial
        color="#2266aa"
        roughness={0.8}
        metalness={0.1}
      />
    </Sphere>
  );
}

function TrajectoryLine({
  points,
  color = '#ff4444',
}: {
  points: THREE.Vector3[];
  color?: string;
}) {
  if (points.length < 2) return null;

  return (
    <Line
      points={points}
      color={color}
      lineWidth={2}
    />
  );
}

function TargetOrbit({ altitude }: { altitude: number }) {
  const radius = (EARTH_RADIUS + altitude / 1000) * SCALE;
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
      color="#44ff44"
      lineWidth={1}
      dashed
      dashSize={0.1}
      gapSize={0.05}
    />
  );
}

function RocketMarker({ position }: { position: THREE.Vector3 }) {
  return (
    <group position={position}>
      <Sphere args={[0.05, 8, 8]}>
        <meshBasicMaterial color="#ffaa00" />
      </Sphere>
      <Html distanceFactor={10}>
        <div style={{
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '10px',
          whiteSpace: 'nowrap',
        }}>
          Rocket
        </div>
      </Html>
    </group>
  );
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
      return {
        position: new THREE.Vector3(
          point.x / 1e6 * SCALE,
          point.y / 1e6 * SCALE,
          point.z / 1e6 * SCALE
        ),
        time: event.time,
        stage: event.index,
      };
    }).filter(Boolean);
  }, [telemetry, events]);

  return (
    <>
      {markers.map((m, i) => m && (
        <group key={i} position={m.position}>
          <Sphere args={[0.03, 8, 8]}>
            <meshBasicMaterial color="#ff8800" />
          </Sphere>
        </group>
      ))}
    </>
  );
}

function Scene({
  telemetry,
  overlayTelemetry,
  targetAltitude,
  stageEvents,
}: TrajectoryViewerProps) {
  const trajectoryPoints = useMemo(() => {
    return telemetry.map(t => new THREE.Vector3(
      t.x / 1e6 * SCALE,
      t.y / 1e6 * SCALE,
      t.z / 1e6 * SCALE
    ));
  }, [telemetry]);

  const overlayLines = useMemo(() => {
    return (overlayTelemetry || []).map(overlay => ({
      name: overlay.name,
      color: overlay.color,
      points: overlay.data.map(t => new THREE.Vector3(
        t.x / 1e6 * SCALE,
        t.y / 1e6 * SCALE,
        t.z / 1e6 * SCALE
      )),
    }));
  }, [overlayTelemetry]);

  const rocketPosition = trajectoryPoints.length > 0
    ? trajectoryPoints[trajectoryPoints.length - 1]
    : new THREE.Vector3(EARTH_RADIUS * SCALE, 0, 0);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Earth />
      {targetAltitude && <TargetOrbit altitude={targetAltitude} />}
      <TrajectoryLine points={trajectoryPoints} color="#ff4444" />
      {overlayLines.map((line, i) => (
        <TrajectoryLine key={i} points={line.points} color={line.color} />
      ))}
      {trajectoryPoints.length > 0 && (
        <RocketMarker position={rocketPosition} />
      )}
      {stageEvents && (
        <StageMarkers telemetry={telemetry} events={stageEvents} />
      )}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={2}
        maxDistance={50}
      />
    </>
  );
}

export default function TrajectoryViewer(props: TrajectoryViewerProps) {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '400px' }}>
      <Canvas
        camera={{
          position: [0, 0, 15],
          fov: 50,
          near: 0.1,
          far: 1000,
        }}
      >
        <Scene {...props} />
      </Canvas>
    </div>
  );
}
