import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import type { TelemetryPoint } from '../types';

const EARTH_RADIUS_KM = 6371;
const MU = 3.986004418e5; // km^3/s^2

interface TrajectoryViewerProps {
  telemetry: TelemetryPoint[];
  targetAltitude?: number; // meters
  stageEvents?: { time: number; index: number }[];
  isLive?: boolean;
}

interface ViewState {
  cx: number;
  cy: number;
  scale: number;
}

// Simulation coords (meters) -> scene coords (km, y-flipped for SVG)
function simToScene(xm: number, ym: number): { x: number; y: number } {
  return { x: xm / 1000, y: -ym / 1000 };
}

// Compute predicted Keplerian orbit from current position/velocity
function computeOrbitPath(
  px: number, py: number, vx: number, vy: number, nPoints: number = 200
): { points: { x: number; y: number }[]; apoapsis: { x: number; y: number } | null; periapsis: { x: number; y: number } | null } {
  // Position/velocity in km and km/s
  const r = Math.sqrt(px * px + py * py);
  const v = Math.sqrt(vx * vx + vy * vy);
  if (r < EARTH_RADIUS_KM * 0.5 || v < 0.01) return { points: [], apoapsis: null, periapsis: null };

  // Specific orbital energy and angular momentum
  const energy = 0.5 * v * v - MU / r;
  const h = px * vy - py * vx; // angular momentum (scalar, 2D)

  // Semi-latus rectum
  const p = h * h / MU;

  // Eccentricity vector
  const ex = (vy * h / MU) - px / r;
  const ey = -(vx * h / MU) - py / r;
  const e = Math.sqrt(ex * ex + ey * ey);

  // Semi-major axis
  const a = e < 0.9999 ? p / (1 - e * e) : p; // hyperbolic/parabolic fallback

  if (a < 0 && e > 1) {
    // Hyperbolic — skip for now
    return { points: [], apoapsis: null, periapsis: null };
  }

  // Argument of periapsis (angle of eccentricity vector)
  const omega = Math.atan2(ey, ex);

  // Generate orbit points
  const points: { x: number; y: number }[] = [];
  const thetaRange = e >= 1 ? Math.PI * 0.8 : Math.PI * 2;
  const thetaStart = e >= 1 ? -thetaRange / 2 : 0;

  for (let i = 0; i <= nPoints; i++) {
    const theta = thetaStart + (i / nPoints) * thetaRange;
    const denom = 1 + e * Math.cos(theta);
    if (denom <= 0.01) continue;
    const rr = p / denom;
    if (rr > EARTH_RADIUS_KM * 20) continue; // clip very far points

    const xLocal = rr * Math.cos(theta);
    const yLocal = rr * Math.sin(theta);

    // Rotate by argument of periapsis
    const xScene = xLocal * Math.cos(omega) - yLocal * Math.sin(omega);
    const yScene = xLocal * Math.sin(omega) + yLocal * Math.cos(omega);

    // SVG y-flip
    points.push({ x: xScene, y: -yScene });
  }

  // Apoapsis (theta = pi)
  let apoapsis: { x: number; y: number } | null = null;
  if (e < 1) {
    const rApo = a * (1 + e);
    const xA = rApo * Math.cos(Math.PI);
    const yA = rApo * Math.sin(Math.PI);
    const xS = xA * Math.cos(omega) - yA * Math.sin(omega);
    const yS = xA * Math.sin(omega) + yA * Math.cos(omega);
    apoapsis = { x: xS, y: -yS };
  }

  // Periapsis (theta = 0)
  const rPeri = a * (1 - e);
  const xP = rPeri;
  const yP = 0;
  const xPS = xP * Math.cos(omega) - yP * Math.sin(omega);
  const yPS = xP * Math.sin(omega) + yP * Math.cos(omega);
  const periapsis = { x: xPS, y: -yPS };

  return { points, apoapsis, periapsis };
}

export default function TrajectoryViewer({
  telemetry,
  targetAltitude,
  stageEvents,
  isLive,
}: TrajectoryViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<'auto' | 'manual'>('auto');
  const [manualView, setManualView] = useState<ViewState>({ cx: 0, cy: 0, scale: 16000 });
  const pulsePhase = useRef(0);
  const rafRef = useRef<number>(0);

  const trajectoryPts = useMemo(() => {
    return telemetry.map(t => simToScene(t.x, t.y));
  }, [telemetry]);

  // Predicted orbit from latest state
  const orbitPrediction = useMemo(() => {
    if (telemetry.length < 2) return { points: [], apoapsis: null, periapsis: null };
    const t = telemetry[telemetry.length - 1];
    // Convert to km and km/s for orbit computation
    const px = t.x / 1000;
    const py = t.y / 1000;
    const vx = (t.vx ?? 0) / 1000;
    const vy = (t.vy ?? 0) / 1000;
    return computeOrbitPath(px, py, vx, vy, 300);
  }, [telemetry]);

  // Velocity vector at current position
  const velocityVec = useMemo(() => {
    if (telemetry.length < 1) return null;
    const t = telemetry[telemetry.length - 1];
    const pos = simToScene(t.x, t.y);
    const vx = (t.vx ?? 0) / 1000;
    const vy = (t.vy ?? 0) / 1000;
    const vMag = Math.sqrt(vx * vx + vy * vy);
    if (vMag < 0.001) return null;
    return { pos, vx, vy: -vy, vMag }; // flip vy for SVG
  }, [telemetry]);

  const autoView = useMemo((): ViewState => {
    if (trajectoryPts.length === 0) {
      return { cx: 0, cy: 0, scale: 16000 };
    }

    let minX = -EARTH_RADIUS_KM * 0.3;
    let maxX = EARTH_RADIUS_KM * 0.3;
    let minY = -EARTH_RADIUS_KM * 1.15;
    let maxY = EARTH_RADIUS_KM * 0.3;

    for (const p of trajectoryPts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    // Include predicted orbit
    for (const p of orbitPrediction.points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    if (targetAltitude) {
      const orbitR = EARTH_RADIUS_KM + targetAltitude / 1000;
      minX = Math.min(minX, -orbitR);
      maxX = Math.max(maxX, orbitR);
      minY = Math.min(minY, -orbitR);
      maxY = Math.max(maxY, orbitR);
    }

    const padding = 1.12;
    const rangeX = (maxX - minX) * padding;
    const rangeY = (maxY - minY) * padding;
    const scale = Math.max(rangeX, rangeY);

    return {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      scale: Math.max(500, scale),
    };
  }, [trajectoryPts, targetAltitude, orbitPrediction.points]);

  const view = viewMode === 'auto' ? autoView : manualView;

  const viewBox = useMemo(() => {
    const w = view.scale;
    const h = view.scale;
    return `${view.cx - w / 2} ${view.cy - h / 2} ${w} ${h}`;
  }, [view]);

  // Pulse animation
  useEffect(() => {
    if (!isLive) return;
    const animate = () => {
      pulsePhase.current = (pulsePhase.current + 2) % 360;
      const el = svgRef.current?.querySelector('#rocket-pulse') as SVGCircleElement | null;
      if (el) {
        const t = Math.sin((pulsePhase.current / 360) * Math.PI * 2);
        el.setAttribute('r', String(view.scale * 0.012 * (1 + t * 0.5)));
        el.setAttribute('opacity', String(0.6 - t * 0.3));
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isLive, view.scale]);

  const stageMarkers = useMemo(() => {
    if (!stageEvents || stageEvents.length === 0 || telemetry.length === 0) return [];
    return stageEvents.map(event => {
      const point = telemetry.find(t => t.time >= event.time);
      if (!point) return null;
      const pos = simToScene(point.x, point.y);
      return { ...pos, index: event.index, time: event.time };
    }).filter((p): p is { x: number; y: number; index: number; time: number } => p !== null);
  }, [telemetry, stageEvents]);

  const rocketPos = trajectoryPts.length > 0 ? trajectoryPts[trajectoryPts.length - 1] : null;
  const rocketAngle = useMemo(() => {
    if (trajectoryPts.length < 2) return -Math.PI / 2;
    const curr = trajectoryPts[trajectoryPts.length - 1];
    const prev = trajectoryPts[Math.max(0, trajectoryPts.length - 4)];
    return Math.atan2(curr.y - prev.y, curr.x - prev.x);
  }, [trajectoryPts]);

  const targetOrbitR = targetAltitude ? EARTH_RADIUS_KM + targetAltitude / 1000 : null;

  const polylineStr = useMemo(() => {
    if (trajectoryPts.length < 2) return '';
    const pts = trajectoryPts.length > 600
      ? trajectoryPts.filter((_, i) => i % Math.ceil(trajectoryPts.length / 600) === 0 || i === trajectoryPts.length - 1)
      : trajectoryPts;
    return pts.map(p => `${p.x},${p.y}`).join(' ');
  }, [trajectoryPts]);

  const predictedOrbitStr = useMemo(() => {
    if (orbitPrediction.points.length < 2) return '';
    return orbitPrediction.points.map(p => `${p.x},${p.y}`).join(' ');
  }, [orbitPrediction.points]);

  // Zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.12 : 0.89;
    if (viewMode === 'auto') {
      setViewMode('manual');
      setManualView({ ...autoView, scale: autoView.scale * factor });
    } else {
      setManualView(v => ({ ...v, scale: Math.max(200, Math.min(100000, v.scale * factor)) }));
    }
  }, [viewMode, autoView]);

  // Pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = ((e.clientX - dragStart.x) / rect.width) * view.scale;
    const dy = ((e.clientY - dragStart.y) / rect.height) * view.scale;
    if (viewMode === 'auto') {
      setViewMode('manual');
      setManualView({ cx: autoView.cx - dx, cy: autoView.cy - dy, scale: autoView.scale });
    } else {
      setManualView(v => ({ ...v, cx: v.cx - dx, cy: v.cy - dy }));
    }
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [dragging, dragStart, view.scale, viewMode, autoView]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const s = view.scale;
  const markerR = s * 0.005;
  const fontSize = s * 0.011;
  const rocketSize = s * 0.007;
  const strokeW = s * 0.0015;
  const velArrowLen = s * 0.06;

  const altitudeMarks = useMemo(() => {
    const marks: { alt: number; label: string; color: string }[] = [];
    marks.push({ alt: 100, label: '100 km', color: '#335566' });
    if (targetAltitude) {
      marks.push({ alt: targetAltitude / 1000, label: `${(targetAltitude / 1000).toFixed(0)} km TARGET`, color: '#22aa44' });
    }
    return marks;
  }, [targetAltitude]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', background: '#020208' }}
    >
      <svg
        ref={svgRef}
        viewBox={viewBox}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', cursor: dragging ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <linearGradient id="trail-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff6644" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#ff6644" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ffcc44" stopOpacity="1" />
          </linearGradient>
          <radialGradient id="earth-grad" cx="40%" cy="35%">
            <stop offset="0%" stopColor="#1a5588" />
            <stop offset="50%" stopColor="#143d66" />
            <stop offset="85%" stopColor="#0d2a4a" />
            <stop offset="100%" stopColor="#081828" />
          </radialGradient>
          <radialGradient id="atmo-outer" cx="50%" cy="50%">
            <stop offset="88%" stopColor="#4488cc" stopOpacity="0" />
            <stop offset="94%" stopColor="#3377bb" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#2266aa" stopOpacity="0" />
          </radialGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={s * 0.002} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="softglow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation={s * 0.005} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Marker arrow for velocity vector */}
          <marker id="vel-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0,0 8,3 0,6" fill="#44ff88" />
          </marker>
          <pattern id="stars" x="0" y="0" width={s * 0.08} height={s * 0.08} patternUnits="userSpaceOnUse">
            {Array.from({ length: 12 }, (_, i) => (
              <circle
                key={i}
                cx={((i * 37 + 13) % 100) / 100 * s * 0.08}
                cy={((i * 59 + 7) % 100) / 100 * s * 0.08}
                r={s * 0.0004 * (0.4 + (i % 3) * 0.3)}
                fill="#fff"
                opacity={0.1 + (i % 5) * 0.06}
              />
            ))}
          </pattern>
        </defs>

        {/* Star background */}
        <rect x={view.cx - s} y={view.cy - s} width={s * 2} height={s * 2} fill="url(#stars)" />

        {/* Atmosphere glow */}
        <circle cx={0} cy={0} r={EARTH_RADIUS_KM * 1.06} fill="url(#atmo-outer)" />

        {/* Earth */}
        <circle cx={0} cy={0} r={EARTH_RADIUS_KM} fill="url(#earth-grad)" />
        <circle cx={0} cy={0} r={EARTH_RADIUS_KM} fill="none" stroke="#1a4477" strokeWidth={s * 0.0008} opacity={0.4} />

        {/* Earth continent hints (simplified arcs) */}
        {[15, 45, 90, 135, 200, 250, 310].map((deg, i) => {
          const a1 = (deg - 8) * Math.PI / 180;
          const a2 = (deg + 8 + i * 3) * Math.PI / 180;
          const r = EARTH_RADIUS_KM * 0.998;
          return (
            <path
              key={i}
              d={`M ${r * Math.cos(a1)} ${r * Math.sin(a1)} A ${r} ${r} 0 0 1 ${r * Math.cos(a2)} ${r * Math.sin(a2)}`}
              fill="none"
              stroke="#1a5533"
              strokeWidth={s * 0.002 + (i % 3) * s * 0.001}
              opacity={0.25}
              strokeLinecap="round"
            />
          );
        })}

        {/* Altitude reference rings */}
        {altitudeMarks.map((mark, i) => {
          const r = EARTH_RADIUS_KM + mark.alt;
          return (
            <g key={i}>
              <circle
                cx={0} cy={0} r={r}
                fill="none"
                stroke={mark.color}
                strokeWidth={s * 0.0006}
                strokeDasharray={`${s * 0.004} ${s * 0.008}`}
                opacity={0.35}
              />
              <text
                x={fontSize * 0.5}
                y={-r - fontSize * 0.3}
                fill={mark.color}
                fontSize={fontSize * 0.65}
                fontFamily="monospace"
                opacity={0.6}
              >
                {mark.label}
              </text>
            </g>
          );
        })}

        {/* Target orbit ring */}
        {targetOrbitR && (
          <circle
            cx={0} cy={0} r={targetOrbitR}
            fill="none"
            stroke="#22aa44"
            strokeWidth={s * 0.0015}
            strokeDasharray={`${s * 0.006} ${s * 0.004}`}
            opacity={0.5}
          />
        )}

        {/* Predicted orbit path */}
        {predictedOrbitStr && (
          <polyline
            points={predictedOrbitStr}
            fill="none"
            stroke="#4488ff"
            strokeWidth={strokeW * 0.8}
            strokeDasharray={`${s * 0.003} ${s * 0.004}`}
            opacity={0.35}
            strokeLinejoin="round"
          />
        )}

        {/* Apoapsis marker */}
        {orbitPrediction.apoapsis && (
          <g>
            <circle cx={orbitPrediction.apoapsis.x} cy={orbitPrediction.apoapsis.y} r={markerR * 1.8} fill="none" stroke="#44cc66" strokeWidth={s * 0.001} opacity={0.7} />
            <line
              x1={orbitPrediction.apoapsis.x - markerR * 0.8}
              y1={orbitPrediction.apoapsis.y}
              x2={orbitPrediction.apoapsis.x + markerR * 0.8}
              y2={orbitPrediction.apoapsis.y}
              stroke="#44cc66" strokeWidth={s * 0.001} opacity={0.7}
            />
            <line
              x1={orbitPrediction.apoapsis.x}
              y1={orbitPrediction.apoapsis.y - markerR * 0.8}
              x2={orbitPrediction.apoapsis.x}
              y2={orbitPrediction.apoapsis.y + markerR * 0.8}
              stroke="#44cc66" strokeWidth={s * 0.001} opacity={0.7}
            />
            <text
              x={orbitPrediction.apoapsis.x + markerR * 2.5}
              y={orbitPrediction.apoapsis.y + fontSize * 0.3}
              fill="#44cc66"
              fontSize={fontSize * 0.6}
              fontFamily="monospace"
              opacity={0.8}
            >
              AP {telemetry.length > 0 ? `${(telemetry[telemetry.length - 1].apoapsis / 1000).toFixed(0)} km` : ''}
            </text>
          </g>
        )}

        {/* Periapsis marker */}
        {orbitPrediction.periapsis && (
          <g>
            <circle cx={orbitPrediction.periapsis.x} cy={orbitPrediction.periapsis.y} r={markerR * 1.8} fill="none" stroke="#ff8844" strokeWidth={s * 0.001} opacity={0.7} />
            <line
              x1={orbitPrediction.periapsis.x - markerR * 0.8}
              y1={orbitPrediction.periapsis.y}
              x2={orbitPrediction.periapsis.x + markerR * 0.8}
              y2={orbitPrediction.periapsis.y}
              stroke="#ff8844" strokeWidth={s * 0.001} opacity={0.7}
            />
            <line
              x1={orbitPrediction.periapsis.x}
              y1={orbitPrediction.periapsis.y - markerR * 0.8}
              x2={orbitPrediction.periapsis.x}
              y2={orbitPrediction.periapsis.y + markerR * 0.8}
              stroke="#ff8844" strokeWidth={s * 0.001} opacity={0.7}
            />
            <text
              x={orbitPrediction.periapsis.x + markerR * 2.5}
              y={orbitPrediction.periapsis.y + fontSize * 0.3}
              fill="#ff8844"
              fontSize={fontSize * 0.6}
              fontFamily="monospace"
              opacity={0.8}
            >
              PE {telemetry.length > 0 ? `${(telemetry[telemetry.length - 1].periapsis / 1000).toFixed(0)} km` : ''}
            </text>
          </g>
        )}

        {/* Launch site marker */}
        {trajectoryPts.length > 0 && (
          <g>
            <circle cx={trajectoryPts[0].x} cy={trajectoryPts[0].y} r={markerR * 0.6} fill="#44ff44" opacity={0.7} />
            <text
              x={trajectoryPts[0].x + markerR * 1.5}
              y={trajectoryPts[0].y + fontSize * 0.3}
              fill="#44ff44"
              fontSize={fontSize * 0.6}
              fontFamily="monospace"
              opacity={0.5}
            >
              LAUNCH
            </text>
          </g>
        )}

        {/* Trajectory trail glow */}
        {polylineStr && (
          <polyline
            points={polylineStr}
            fill="none"
            stroke="#ff6644"
            strokeWidth={strokeW * 3}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.1}
          />
        )}

        {/* Trajectory line */}
        {polylineStr && (
          <polyline
            points={polylineStr}
            fill="none"
            stroke={isLive ? 'url(#trail-grad)' : '#ff5533'}
            strokeWidth={strokeW * 1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Stage separation markers */}
        {stageMarkers.map((marker, i) => (
          <g key={i}>
            <circle cx={marker.x} cy={marker.y} r={markerR * 1.2} fill="#ffaa00" opacity={0.15} />
            <circle cx={marker.x} cy={marker.y} r={markerR * 0.6} fill="#ffaa00" />
            <text
              x={marker.x + markerR * 2}
              y={marker.y - markerR}
              fill="#ffaa00"
              fontSize={fontSize * 0.55}
              fontFamily="monospace"
              fontWeight="bold"
              opacity={0.8}
            >
              S{marker.index + 1}
            </text>
          </g>
        ))}

        {/* Velocity vector arrow */}
        {velocityVec && rocketPos && (
          <g filter="url(#glow)">
            <line
              x1={rocketPos.x}
              y1={rocketPos.y}
              x2={rocketPos.x + (velocityVec.vx / velocityVec.vMag) * velArrowLen}
              y2={rocketPos.y + (velocityVec.vy / velocityVec.vMag) * velArrowLen}
              stroke="#44ff88"
              strokeWidth={s * 0.0012}
              opacity={0.7}
              markerEnd="url(#vel-arrow)"
            />
            <text
              x={rocketPos.x + (velocityVec.vx / velocityVec.vMag) * velArrowLen * 1.15}
              y={rocketPos.y + (velocityVec.vy / velocityVec.vMag) * velArrowLen * 1.15 + fontSize * 0.3}
              fill="#44ff88"
              fontSize={fontSize * 0.55}
              fontFamily="monospace"
              opacity={0.6}
            >
              {(velocityVec.vMag * 1000).toFixed(0)} m/s
            </text>
          </g>
        )}

        {/* Rocket marker */}
        {rocketPos && (
          <g filter="url(#glow)">
            {isLive && (
              <polygon
                points={flameTriangle(rocketPos.x, rocketPos.y, rocketAngle + Math.PI, rocketSize * 2.5)}
                fill="#ff6600"
                opacity={0.5}
              />
            )}
            {isLive && (
              <circle
                id="rocket-pulse"
                cx={rocketPos.x}
                cy={rocketPos.y}
                r={rocketSize * 2}
                fill="none"
                stroke="#ff6644"
                strokeWidth={s * 0.0012}
                opacity={0.4}
              />
            )}
            <polygon
              points={rocketTriangle(rocketPos.x, rocketPos.y, rocketAngle, rocketSize)}
              fill={isLive ? '#ffffff' : '#ccccdd'}
              stroke={isLive ? '#ff6644' : '#888'}
              strokeWidth={s * 0.0008}
            />
          </g>
        )}

        {/* Altitude line from surface to rocket */}
        {rocketPos && telemetry.length > 0 && (() => {
          const dist = Math.sqrt(rocketPos.x * rocketPos.x + rocketPos.y * rocketPos.y);
          if (dist < EARTH_RADIUS_KM * 1.001) return null;
          const nx = rocketPos.x / dist;
          const ny = rocketPos.y / dist;
          const surfX = nx * EARTH_RADIUS_KM;
          const surfY = ny * EARTH_RADIUS_KM;
          return (
            <g>
              <line
                x1={surfX} y1={surfY} x2={rocketPos.x} y2={rocketPos.y}
                stroke="#4488ff" strokeWidth={s * 0.0005}
                strokeDasharray={`${s * 0.002} ${s * 0.003}`} opacity={0.25}
              />
              <text
                x={(surfX + rocketPos.x) / 2 + fontSize * 0.8}
                y={(surfY + rocketPos.y) / 2}
                fill="#4488ff" fontSize={fontSize * 0.55}
                fontFamily="monospace" opacity={0.45}
              >
                {(telemetry[telemetry.length - 1].altitude / 1000).toFixed(1)} km
              </text>
            </g>
          );
        })()}
      </svg>

      {/* View controls */}
      <div style={{ position: 'absolute', bottom: '8px', left: '8px', display: 'flex', gap: '4px', zIndex: 5 }}>
        {viewMode === 'manual' && (
          <button onClick={() => setViewMode('auto')} style={viewBtnStyle}>FIT</button>
        )}
        <button onClick={() => zoom(0.7)} style={viewBtnStyle}>+</button>
        <button onClick={() => zoom(1.4)} style={viewBtnStyle}>-</button>
      </div>

      {/* Legend overlay */}
      <div style={{ position: 'absolute', top: '6px', right: '6px', display: 'flex', flexDirection: 'column', gap: '2px', zIndex: 5 }}>
        <LegendItem color="#ff6644" label="Trajectory" />
        <LegendItem color="#4488ff" dashed label="Predicted orbit" />
        <LegendItem color="#44ff88" label="Velocity" />
        <LegendItem color="#22aa44" dashed label="Target orbit" />
        <LegendItem color="#44cc66" label="Apoapsis" marker />
        <LegendItem color="#ff8844" label="Periapsis" marker />
      </div>
    </div>
  );

  function zoom(factor: number) {
    if (viewMode === 'auto') {
      setManualView({ ...autoView, scale: autoView.scale * factor });
      setViewMode('manual');
    } else {
      setManualView(v => ({ ...v, scale: Math.max(200, Math.min(100000, v.scale * factor)) }));
    }
  }
}

function LegendItem({ color, label, dashed, marker }: { color: string; label: string; dashed?: boolean; marker?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.6)', padding: '1px 6px', borderRadius: '2px' }}>
      {marker ? (
        <svg width="10" height="10" viewBox="0 0 10 10">
          <circle cx="5" cy="5" r="3.5" fill="none" stroke={color} strokeWidth="1.5" />
        </svg>
      ) : (
        <svg width="14" height="4" viewBox="0 0 14 4">
          <line x1="0" y1="2" x2="14" y2="2" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '3 2' : 'none'} />
        </svg>
      )}
      <span style={{ fontSize: '8px', color: '#889', fontFamily: 'monospace', letterSpacing: '0.5px' }}>{label}</span>
    </div>
  );
}

const viewBtnStyle: React.CSSProperties = {
  padding: '3px 8px',
  background: 'rgba(0,0,0,0.65)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '3px',
  color: '#999',
  cursor: 'pointer',
  fontSize: '10px',
  fontWeight: 700,
};

function rocketTriangle(cx: number, cy: number, angle: number, size: number): string {
  const tip = { x: cx + Math.cos(angle) * size * 2.5, y: cy + Math.sin(angle) * size * 2.5 };
  const pa = angle + Math.PI * 0.8;
  const pb = angle - Math.PI * 0.8;
  const base1 = { x: cx + Math.cos(pa) * size, y: cy + Math.sin(pa) * size };
  const base2 = { x: cx + Math.cos(pb) * size, y: cy + Math.sin(pb) * size };
  return `${tip.x},${tip.y} ${base1.x},${base1.y} ${base2.x},${base2.y}`;
}

function flameTriangle(cx: number, cy: number, angle: number, size: number): string {
  const tip = { x: cx + Math.cos(angle) * size, y: cy + Math.sin(angle) * size };
  const pa = angle + Math.PI * 0.85;
  const pb = angle - Math.PI * 0.85;
  const base1 = { x: cx + Math.cos(pa) * size * 0.3, y: cy + Math.sin(pa) * size * 0.3 };
  const base2 = { x: cx + Math.cos(pb) * size * 0.3, y: cy + Math.sin(pb) * size * 0.3 };
  return `${tip.x},${tip.y} ${base1.x},${base1.y} ${base2.x},${base2.y}`;
}
