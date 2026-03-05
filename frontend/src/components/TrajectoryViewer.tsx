import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import type { TelemetryPoint } from '../types';

const EARTH_RADIUS_KM = 6371;
const EARTH_RADIUS_M = EARTH_RADIUS_KM * 1000;

interface TrajectoryViewerProps {
  telemetry: TelemetryPoint[];
  targetAltitude?: number;
  stageEvents?: { time: number; index: number }[];
  isLive?: boolean;
}

interface ViewState {
  cx: number;
  cy: number;
  scale: number;
}

// Convert simulation coordinates (meters) to scene coordinates (km)
// The simulation uses x=horizontal, y=vertical from Earth center
// SVG: x=right, y=down, so we flip y
function simToScene(xm: number, ym: number): { x: number; y: number } {
  return { x: xm / 1000, y: -ym / 1000 };
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

  // Trajectory points in km
  const trajectoryPts = useMemo(() => {
    return telemetry.map(t => simToScene(t.x, t.y));
  }, [telemetry]);

  // Auto-fit view: focus on trajectory with some padding
  const autoView = useMemo((): ViewState => {
    if (trajectoryPts.length === 0) {
      // Default: show Earth with some space above for launch
      return { cx: 0, cy: 0, scale: 16000 };
    }

    // Include Earth center and all trajectory points in bounds
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    // Include a portion of Earth for context
    minX = -EARTH_RADIUS_KM * 0.3;
    maxX = EARTH_RADIUS_KM * 0.3;
    minY = -EARTH_RADIUS_KM * 1.15;
    maxY = EARTH_RADIUS_KM * 0.3;

    for (const p of trajectoryPts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    // Add target orbit to bounds
    if (targetAltitude) {
      const orbitR = EARTH_RADIUS_KM + targetAltitude / 1000;
      minX = Math.min(minX, -orbitR);
      maxX = Math.max(maxX, orbitR);
      minY = Math.min(minY, -orbitR);
      maxY = Math.max(maxY, orbitR);
    }

    const padding = 1.15;
    const rangeX = (maxX - minX) * padding;
    const rangeY = (maxY - minY) * padding;
    const scale = Math.max(rangeX, rangeY * (4 / 3));

    return {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      scale: Math.max(500, scale),
    };
  }, [trajectoryPts, targetAltitude]);

  const view = viewMode === 'auto' ? autoView : manualView;

  // SVG viewBox
  const svgWidth = 800;
  const svgHeight = 600;
  const aspectRatio = svgHeight / svgWidth;
  const viewBox = useMemo(() => {
    const w = view.scale;
    const h = view.scale * aspectRatio;
    return `${view.cx - w / 2} ${view.cy - h / 2} ${w} ${h}`;
  }, [view, aspectRatio]);

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

  // Stage markers
  const stageMarkers = useMemo(() => {
    if (!stageEvents || stageEvents.length === 0 || telemetry.length === 0) return [];
    return stageEvents.map(event => {
      const point = telemetry.find(t => t.time >= event.time);
      if (!point) return null;
      const pos = simToScene(point.x, point.y);
      return { ...pos, index: event.index, time: event.time };
    }).filter((p): p is { x: number; y: number; index: number; time: number } => p !== null);
  }, [telemetry, stageEvents]);

  // Rocket position & heading
  const rocketPos = trajectoryPts.length > 0 ? trajectoryPts[trajectoryPts.length - 1] : null;
  const rocketAngle = useMemo(() => {
    if (trajectoryPts.length < 2) return -Math.PI / 2;
    const curr = trajectoryPts[trajectoryPts.length - 1];
    const prev = trajectoryPts[Math.max(0, trajectoryPts.length - 4)];
    return Math.atan2(curr.y - prev.y, curr.x - prev.x);
  }, [trajectoryPts]);

  // Target orbit
  const targetOrbitR = targetAltitude ? EARTH_RADIUS_KM + targetAltitude / 1000 : null;

  // Polyline string
  const polylineStr = useMemo(() => {
    if (trajectoryPts.length < 2) return '';
    // Downsample if too many points
    const pts = trajectoryPts.length > 500
      ? trajectoryPts.filter((_, i) => i % Math.ceil(trajectoryPts.length / 500) === 0 || i === trajectoryPts.length - 1)
      : trajectoryPts;
    return pts.map(p => `${p.x},${p.y}`).join(' ');
  }, [trajectoryPts]);

  // Gradient ID for trajectory
  const trailGradientId = 'trail-gradient';

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
    const dy = ((e.clientY - dragStart.y) / rect.height) * (view.scale * aspectRatio);
    if (viewMode === 'auto') {
      setViewMode('manual');
      setManualView({ cx: autoView.cx - dx, cy: autoView.cy - dy, scale: autoView.scale });
    } else {
      setManualView(v => ({ ...v, cx: v.cx - dx, cy: v.cy - dy }));
    }
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [dragging, dragStart, view.scale, viewMode, autoView, aspectRatio]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  // Sizes relative to view
  const s = view.scale;
  const markerR = s * 0.006;
  const fontSize = s * 0.012;
  const rocketSize = s * 0.008;
  const strokeW = s * 0.002;

  // Altitude labels on the right side
  const altitudeMarks = useMemo(() => {
    const marks: { alt: number; label: string }[] = [];
    if (targetAltitude) {
      marks.push({ alt: targetAltitude / 1000, label: `${(targetAltitude / 1000).toFixed(0)} km` });
    }
    // Add 100km Karman line
    marks.push({ alt: 100, label: '100 km (Karman)' });
    return marks;
  }, [targetAltitude]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: '400px', position: 'relative', background: '#020208' }}
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
          {/* Trajectory gradient */}
          <linearGradient id={trailGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff6644" stopOpacity="0.2" />
            <stop offset="60%" stopColor="#ff6644" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#ffaa44" stopOpacity="1" />
          </linearGradient>
          {/* Earth gradient */}
          <radialGradient id="earth-grad" cx="40%" cy="35%">
            <stop offset="0%" stopColor="#2266aa" />
            <stop offset="70%" stopColor="#1a4488" />
            <stop offset="100%" stopColor="#0d2244" />
          </radialGradient>
          {/* Atmosphere glow */}
          <radialGradient id="atmo-grad" cx="50%" cy="50%">
            <stop offset="85%" stopColor="#4488cc" stopOpacity="0" />
            <stop offset="95%" stopColor="#4488cc" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#4488cc" stopOpacity="0" />
          </radialGradient>
          {/* Glow filter for rocket */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={s * 0.003} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Star field pattern */}
          <pattern id="stars" x="0" y="0" width={s * 0.1} height={s * 0.1} patternUnits="userSpaceOnUse">
            {Array.from({ length: 8 }, (_, i) => (
              <circle
                key={i}
                cx={((i * 37 + 13) % 100) / 100 * s * 0.1}
                cy={((i * 59 + 7) % 100) / 100 * s * 0.1}
                r={s * 0.0005 * (0.5 + (i % 3) * 0.3)}
                fill="#fff"
                opacity={0.15 + (i % 4) * 0.1}
              />
            ))}
          </pattern>
        </defs>

        {/* Star background */}
        <rect x={view.cx - s} y={view.cy - s} width={s * 2} height={s * 2} fill="url(#stars)" />

        {/* Atmosphere glow ring */}
        <circle cx={0} cy={0} r={EARTH_RADIUS_KM * 1.08} fill="url(#atmo-grad)" />

        {/* Thin atmosphere band */}
        <circle
          cx={0} cy={0}
          r={EARTH_RADIUS_KM + 100}
          fill="none"
          stroke="#4488cc"
          strokeWidth={s * 0.001}
          opacity={0.15}
          strokeDasharray={`${s * 0.005} ${s * 0.01}`}
        />

        {/* Earth */}
        <circle cx={0} cy={0} r={EARTH_RADIUS_KM} fill="url(#earth-grad)" />
        {/* Surface detail lines */}
        <circle cx={0} cy={0} r={EARTH_RADIUS_KM} fill="none" stroke="#2a5598" strokeWidth={s * 0.001} opacity={0.3} />

        {/* Altitude reference rings */}
        {altitudeMarks.map((mark, i) => {
          const r = EARTH_RADIUS_KM + mark.alt;
          return (
            <g key={i}>
              <circle
                cx={0} cy={0} r={r}
                fill="none"
                stroke="#334466"
                strokeWidth={s * 0.0008}
                strokeDasharray={`${s * 0.003} ${s * 0.006}`}
                opacity={0.4}
              />
              <text
                x={r * Math.cos(-Math.PI / 4) + fontSize * 0.5}
                y={-r * Math.sin(-Math.PI / 4) - fontSize * 0.3}
                fill="#445566"
                fontSize={fontSize * 0.7}
                fontFamily="monospace"
              >
                {mark.label}
              </text>
            </g>
          );
        })}

        {/* Target orbit */}
        {targetOrbitR && (
          <circle
            cx={0} cy={0} r={targetOrbitR}
            fill="none"
            stroke="#22aa44"
            strokeWidth={s * 0.0018}
            strokeDasharray={`${s * 0.008} ${s * 0.005}`}
            opacity={0.6}
          />
        )}

        {/* Launch site marker on Earth surface */}
        {telemetry.length > 0 && trajectoryPts.length > 0 && (
          <g>
            {/* Launch pad marker at first trajectory point */}
            <circle
              cx={trajectoryPts[0].x}
              cy={trajectoryPts[0].y}
              r={markerR * 0.8}
              fill="#44ff44"
              opacity={0.8}
            />
            <text
              x={trajectoryPts[0].x + markerR * 2}
              y={trajectoryPts[0].y + fontSize * 0.3}
              fill="#44ff44"
              fontSize={fontSize * 0.75}
              fontFamily="monospace"
              opacity={0.7}
            >
              LAUNCH
            </text>
          </g>
        )}

        {/* Trajectory trail - shadow/glow */}
        {polylineStr && (
          <polyline
            points={polylineStr}
            fill="none"
            stroke={isLive ? '#ff6644' : '#ff4444'}
            strokeWidth={strokeW * 3}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.15}
          />
        )}

        {/* Trajectory line */}
        {polylineStr && (
          <polyline
            points={polylineStr}
            fill="none"
            stroke={isLive ? 'url(#trail-gradient)' : '#ff4444'}
            strokeWidth={strokeW * 1.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Stage separation markers */}
        {stageMarkers.map((marker, i) => (
          <g key={i} filter="url(#glow)">
            <circle cx={marker.x} cy={marker.y} r={markerR * 1.5} fill="#ffaa00" opacity={0.15} />
            <circle cx={marker.x} cy={marker.y} r={markerR} fill="#ffaa00" />
            <line
              x1={marker.x}
              y1={marker.y}
              x2={marker.x + fontSize * 3}
              y2={marker.y - fontSize * 1.5}
              stroke="#ffaa00"
              strokeWidth={s * 0.0005}
              opacity={0.5}
            />
            <rect
              x={marker.x + fontSize * 3 - fontSize * 0.2}
              y={marker.y - fontSize * 2.2}
              width={fontSize * 5.5}
              height={fontSize * 1.4}
              rx={fontSize * 0.2}
              fill="rgba(0,0,0,0.7)"
              stroke="#ffaa00"
              strokeWidth={s * 0.0005}
              opacity={0.8}
            />
            <text
              x={marker.x + fontSize * 3}
              y={marker.y - fontSize * 1.2}
              fill="#ffaa00"
              fontSize={fontSize * 0.7}
              fontFamily="monospace"
              fontWeight="bold"
            >
              STAGE {marker.index + 1} SEP
            </text>
          </g>
        ))}

        {/* Rocket marker */}
        {rocketPos && (
          <g filter="url(#glow)">
            {/* Exhaust flame when live */}
            {isLive && (
              <polygon
                points={flameTriangle(rocketPos.x, rocketPos.y, rocketAngle + Math.PI, rocketSize * 2.5)}
                fill="#ff6600"
                opacity={0.5}
              />
            )}
            {/* Pulse ring */}
            {isLive && (
              <circle
                id="rocket-pulse"
                cx={rocketPos.x}
                cy={rocketPos.y}
                r={rocketSize * 2}
                fill="none"
                stroke="#ff6644"
                strokeWidth={s * 0.0015}
                opacity={0.5}
              />
            )}
            {/* Rocket body */}
            <polygon
              points={rocketTriangle(rocketPos.x, rocketPos.y, rocketAngle, rocketSize)}
              fill={isLive ? '#ffffff' : '#ccccdd'}
              stroke={isLive ? '#ff6644' : '#888'}
              strokeWidth={s * 0.001}
            />
          </g>
        )}

        {/* Current altitude line from Earth surface to rocket */}
        {rocketPos && telemetry.length > 0 && (
          <g>
            {(() => {
              const dist = Math.sqrt(rocketPos.x * rocketPos.x + rocketPos.y * rocketPos.y);
              if (dist < EARTH_RADIUS_KM * 1.001) return null;
              const nx = rocketPos.x / dist;
              const ny = rocketPos.y / dist;
              const surfX = nx * EARTH_RADIUS_KM;
              const surfY = ny * EARTH_RADIUS_KM;
              return (
                <>
                  <line
                    x1={surfX} y1={surfY}
                    x2={rocketPos.x} y2={rocketPos.y}
                    stroke="#4488ff"
                    strokeWidth={s * 0.0006}
                    strokeDasharray={`${s * 0.002} ${s * 0.003}`}
                    opacity={0.3}
                  />
                  <text
                    x={(surfX + rocketPos.x) / 2 + fontSize}
                    y={(surfY + rocketPos.y) / 2}
                    fill="#4488ff"
                    fontSize={fontSize * 0.65}
                    fontFamily="monospace"
                    opacity={0.5}
                  >
                    {(telemetry[telemetry.length - 1].altitude / 1000).toFixed(1)} km
                  </text>
                </>
              );
            })()}
          </g>
        )}
      </svg>

      {/* View controls overlay */}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        left: '12px',
        display: 'flex',
        gap: '6px',
        zIndex: 5,
      }}>
        {viewMode === 'manual' && (
          <button onClick={() => setViewMode('auto')} style={viewBtnStyle}>
            AUTO FIT
          </button>
        )}
        <button
          onClick={() => {
            if (viewMode === 'auto') {
              setManualView({ ...autoView, scale: autoView.scale * 0.7 });
              setViewMode('manual');
            } else {
              setManualView(v => ({ ...v, scale: v.scale * 0.7 }));
            }
          }}
          style={viewBtnStyle}
        >
          +
        </button>
        <button
          onClick={() => {
            if (viewMode === 'auto') {
              setManualView({ ...autoView, scale: autoView.scale * 1.4 });
              setViewMode('manual');
            } else {
              setManualView(v => ({ ...v, scale: v.scale * 1.4 }));
            }
          }}
          style={viewBtnStyle}
        >
          -
        </button>
      </div>
    </div>
  );
}

const viewBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  background: 'rgba(0,0,0,0.6)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '4px',
  color: '#aaa',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '1px',
  backdropFilter: 'blur(8px)',
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
