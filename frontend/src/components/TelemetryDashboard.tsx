import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import type { TelemetryPoint, StageEvent } from '../types';

interface TelemetryDashboardProps {
  telemetry: TelemetryPoint[];
  events?: StageEvent[];
  isLive?: boolean;
  compact?: boolean;
  comparisons?: { name: string; telemetry: TelemetryPoint[]; color: string }[];
}

const CHART_HELP: Record<string, string> = {
  'ALTITUDE & ORBIT (km)':
    'Altitude is the rocket\'s height above Earth\'s surface. Apoapsis is the highest point of the orbit, periapsis the lowest. For a stable orbit, both must be above ~120 km (the atmosphere). A circular orbit has apoapsis ≈ periapsis.',
  'VELOCITY (m/s)':
    'Speed of the rocket relative to Earth\'s center. To reach Low Earth Orbit (LEO) at ~200 km, the rocket needs ~7,800 m/s of orbital velocity. Velocity increases during engine burns and decreases due to gravity and atmospheric drag.',
  'ECCENTRICITY':
    'Measures how circular the orbit is. 0 = perfect circle, values between 0 and 1 = ellipse, 1 = parabolic escape. A good LEO insertion targets eccentricity < 0.02. The simulation declares orbit achieved when e < 0.02 and periapsis > 180 km.',
  'INCLINATION (deg)':
    'The tilt of the orbit relative to the equator. 0° = equatorial orbit, 90° = polar orbit. The inclination is determined by the launch direction. Titan\'s default launch is nearly polar (90°).',
  'SEMI-MAJOR AXIS (km)':
    'Half the longest diameter of the orbital ellipse. For a circular orbit at 200 km altitude, the semi-major axis is Earth\'s radius (6,371 km) + 200 km = 6,571 km. Negative values mean the rocket is on a suborbital trajectory.',
  'DOWNRANGE DISTANCE (km)':
    'The horizontal distance from the launch site. As the rocket pitches over during the gravity turn, it covers increasing horizontal distance. This is the X-coordinate in the simulation frame.',
};

function HelpTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', marginLeft: '6px' }}>
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(s => !s)}
        style={{
          width: '16px', height: '16px', borderRadius: '50%',
          background: 'rgba(68,136,255,0.12)', border: '1px solid rgba(68,136,255,0.3)',
          color: '#4488ff', fontSize: '10px', fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, lineHeight: 1,
        }}
      >
        ?
      </button>
      {show && (
        <div style={{
          position: 'absolute', top: '22px', left: '-8px', zIndex: 100,
          width: '280px', padding: '10px 12px',
          background: '#12122a', border: '1px solid #2a2a4e',
          borderRadius: '8px', fontSize: '11px', color: '#aab',
          lineHeight: 1.5, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {text}
        </div>
      )}
    </span>
  );
}

function CollapsibleChart({ title, defaultOpen = true, accent, helpKey, children }: {
  title: string;
  defaultOpen?: boolean;
  accent?: string;
  helpKey?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const helpText = helpKey ? CHART_HELP[helpKey] : undefined;
  return (
    <div style={chartBoxStyle}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', flex: 1,
            background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: accent || '#667',
          }}
        >
          <span style={{ fontSize: '10px', letterSpacing: '1.5px', fontWeight: 700 }}>{title}</span>
        </button>
        {helpText && <HelpTooltip text={helpText} />}
        <button
          onClick={() => setOpen(o => !o)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#445', fontSize: '10px', marginLeft: '8px', padding: 0 }}
        >
          {open ? '▼' : '▶'}
        </button>
      </div>
      {open && <div style={{ marginTop: '10px' }}>{children}</div>}
    </div>
  );
}

export default function TelemetryDashboard({ telemetry, events, isLive, compact, comparisons }: TelemetryDashboardProps) {
  const chartData = telemetry.map(t => ({
    time: Math.round(t.time),
    altitude: t.altitude / 1000,
    velocity: t.velocity,
    apoapsis: t.apoapsis / 1000,
    periapsis: Math.max(t.periapsis / 1000, -500),
    eccentricity: t.eccentricity,
    inclination: t.inclination * 180 / Math.PI,
    semiMajorAxis: t.semiMajorAxis / 1000,
    downrange: t.x / 1000,
    stageIndex: t.stageIndex,
  }));

  // Merge comparison data into chart data by time
  const compDataSets = (comparisons || []).map(c => {
    const map = new Map<number, any>();
    c.telemetry.forEach(t => {
      map.set(Math.round(t.time), {
        altitude: t.altitude / 1000,
        velocity: t.velocity,
        apoapsis: t.apoapsis / 1000,
        periapsis: Math.max(t.periapsis / 1000, -500),
        eccentricity: t.eccentricity,
        inclination: t.inclination * 180 / Math.PI,
        semiMajorAxis: t.semiMajorAxis / 1000,
        downrange: t.x / 1000,
      });
    });
    return { name: c.name, color: c.color, map };
  });

  // Merge all time keys
  const mergedData = (() => {
    if (compDataSets.length === 0) return chartData;
    const allTimes = new Set<number>();
    chartData.forEach(d => allTimes.add(d.time));
    compDataSets.forEach(c => c.map.forEach((_, t) => allTimes.add(t)));
    const sorted = [...allTimes].sort((a, b) => a - b);
    return sorted.map(time => {
      const base = chartData.find(d => d.time === time) || {};
      const row: any = { time, ...base };
      compDataSets.forEach((c, i) => {
        const cd = c.map.get(time);
        if (cd) {
          row[`alt_c${i}`] = cd.altitude;
          row[`vel_c${i}`] = cd.velocity;
          row[`apo_c${i}`] = cd.apoapsis;
          row[`peri_c${i}`] = cd.periapsis;
          row[`ecc_c${i}`] = cd.eccentricity;
          row[`inc_c${i}`] = cd.inclination;
          row[`sma_c${i}`] = cd.semiMajorAxis;
          row[`dr_c${i}`] = cd.downrange;
        }
      });
      return row;
    });
  })();

  const latest = telemetry[telemetry.length - 1];
  const stageTimes = (events || []).map(e => Math.round(e.time));
  const chartHeight = compact ? 140 : 200;

  if (!latest) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#334', fontSize: '13px' }}>
        Awaiting telemetry data...
      </div>
    );
  }

  const maxAlt = Math.max(...telemetry.map(t => t.altitude)) / 1000;
  const maxVel = Math.max(...telemetry.map(t => t.velocity));

  // Helper to render comparison lines for a given dataKey prefix
  const compLines = (prefix: string) =>
    compDataSets.map((c, i) => (
      <Line key={`comp-${i}`} type="monotone" dataKey={`${prefix}_c${i}`} stroke={c.color} dot={false} strokeWidth={1.5} strokeDasharray="4 3" name={c.name} />
    ));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Events timeline */}
      {events && events.length > 0 && (
        <CollapsibleChart title={`MISSION EVENTS (${events.length})`} accent="#ffaa00">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {events.map((e, i) => (
              <div key={i} style={{
                padding: '6px 12px', background: '#0c0c18', borderRadius: '6px',
                border: '1px solid #1a1a2e', display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <span style={{ color: '#ffaa00', fontFamily: 'monospace', fontSize: '11px', fontWeight: 600 }}>
                  T+{fmtTime(e.time)}
                </span>
                <span style={{ color: '#bbc', fontSize: '11px' }}>{e.description}</span>
              </div>
            ))}
          </div>
        </CollapsibleChart>
      )}

      {/* Mission stats summary row */}
      <div style={chartBoxStyle}>
        <div style={{ fontSize: '10px', color: '#667', letterSpacing: '1.5px', fontWeight: 700, marginBottom: '10px' }}>
          MISSION SUMMARY
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
          <MiniStat label="Max Altitude" value={`${maxAlt.toFixed(1)} km`} color="#4488ff" />
          <MiniStat label="Max Velocity" value={`${maxVel.toFixed(0)} m/s`} color="#ff4488" />
          <MiniStat label="Final Apoapsis" value={`${(latest.apoapsis / 1000).toFixed(1)} km`} color="#44cc66" />
          <MiniStat label="Final Periapsis" value={`${(latest.periapsis / 1000).toFixed(1)} km`} color="#ff8844" />
          <MiniStat label="Eccentricity" value={latest.eccentricity.toFixed(5)} color="#aa44ff" />
          <MiniStat label="Semi-Major Axis" value={fmtKm(latest.semiMajorAxis)} color="#44aaff" />
          <MiniStat label="Inclination" value={`${(latest.inclination * 180 / Math.PI).toFixed(2)}°`} color="#ff88aa" />
          <MiniStat label="RAAN" value={`${(latest.raan * 180 / Math.PI).toFixed(2)}°`} color="#88ccff" />
          <MiniStat label="Downrange" value={`${(latest.x / 1000).toFixed(1)} km`} color="#44cc88" />
          <MiniStat label="Stage" value={`${latest.stageIndex + 1}`} color="#ffaa00" />
        </div>
      </div>

      {/* Altitude & Orbit chart */}
      {mergedData.length > 1 && (
        <CollapsibleChart title="ALTITUDE & ORBIT (km)" accent="#4488ff" helpKey="ALTITUDE & ORBIT (km)">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={mergedData} margin={{ top: 5, right: 10, bottom: 0, left: -5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#111118" />
              <XAxis dataKey="time" stroke="#333" fontSize={10} tickFormatter={t => `${t}s`} />
              <YAxis stroke="#333" fontSize={10} />
              {stageTimes.map((t, i) => (
                <ReferenceLine key={i} x={t} stroke="#ffaa00" strokeDasharray="2 3" strokeWidth={0.5} label={{ value: `S${i + 2}`, fill: '#ffaa00', fontSize: 9 }} />
              ))}
              <Tooltip contentStyle={tooltipStyle} labelFormatter={v => `T+${v}s`} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Line type="monotone" dataKey="altitude" stroke="#4488ff" dot={false} strokeWidth={2} name="Altitude" />
              <Line type="monotone" dataKey="apoapsis" stroke="#44cc66" dot={false} strokeWidth={1.5} name="Apoapsis" />
              <Line type="monotone" dataKey="periapsis" stroke="#ff8844" dot={false} strokeWidth={1.5} name="Periapsis" />
              {compLines('alt')}
            </LineChart>
          </ResponsiveContainer>
        </CollapsibleChart>
      )}

      {/* Velocity chart */}
      {mergedData.length > 1 && (
        <CollapsibleChart title="VELOCITY (m/s)" accent="#ff4488" helpKey="VELOCITY (m/s)">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={mergedData} margin={{ top: 5, right: 10, bottom: 0, left: -5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#111118" />
              <XAxis dataKey="time" stroke="#333" fontSize={10} tickFormatter={t => `${t}s`} />
              <YAxis stroke="#333" fontSize={10} />
              {stageTimes.map((t, i) => (
                <ReferenceLine key={i} x={t} stroke="#ffaa00" strokeDasharray="2 3" strokeWidth={0.5} />
              ))}
              <Tooltip contentStyle={tooltipStyle} labelFormatter={v => `T+${v}s`} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Line type="monotone" dataKey="velocity" stroke="#ff4488" dot={false} strokeWidth={2} name="Velocity" />
              {compLines('vel')}
            </LineChart>
          </ResponsiveContainer>
        </CollapsibleChart>
      )}

      {/* Eccentricity chart */}
      {mergedData.length > 1 && (
        <CollapsibleChart title="ECCENTRICITY" defaultOpen={!compact} accent="#aa44ff" helpKey="ECCENTRICITY">
          <ResponsiveContainer width="100%" height={compact ? 120 : 160}>
            <LineChart data={mergedData} margin={{ top: 5, right: 10, bottom: 0, left: -5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#111118" />
              <XAxis dataKey="time" stroke="#333" fontSize={10} tickFormatter={t => `${t}s`} />
              <YAxis stroke="#333" fontSize={10} domain={[0, 'auto']} />
              {stageTimes.map((t, i) => (
                <ReferenceLine key={i} x={t} stroke="#ffaa00" strokeDasharray="2 3" strokeWidth={0.5} />
              ))}
              <Tooltip contentStyle={tooltipStyle} labelFormatter={v => `T+${v}s`} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Line type="monotone" dataKey="eccentricity" stroke="#aa44ff" dot={false} strokeWidth={2} name="Eccentricity" />
              {compLines('ecc')}
            </LineChart>
          </ResponsiveContainer>
        </CollapsibleChart>
      )}

      {/* Inclination chart */}
      {mergedData.length > 1 && (
        <CollapsibleChart title="INCLINATION (deg)" defaultOpen={false} accent="#ff88aa" helpKey="INCLINATION (deg)">
          <ResponsiveContainer width="100%" height={compact ? 120 : 160}>
            <LineChart data={mergedData} margin={{ top: 5, right: 10, bottom: 0, left: -5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#111118" />
              <XAxis dataKey="time" stroke="#333" fontSize={10} tickFormatter={t => `${t}s`} />
              <YAxis stroke="#333" fontSize={10} unit="°" />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={v => `T+${v}s`} formatter={(v: number) => [`${v.toFixed(2)}°`, 'Inclination']} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Line type="monotone" dataKey="inclination" stroke="#ff88aa" dot={false} strokeWidth={2} name="Inclination" />
              {compLines('inc')}
            </LineChart>
          </ResponsiveContainer>
        </CollapsibleChart>
      )}

      {/* Semi-major axis chart */}
      {mergedData.length > 1 && (
        <CollapsibleChart title="SEMI-MAJOR AXIS (km)" defaultOpen={false} accent="#44aaff" helpKey="SEMI-MAJOR AXIS (km)">
          <ResponsiveContainer width="100%" height={compact ? 120 : 160}>
            <LineChart data={mergedData} margin={{ top: 5, right: 10, bottom: 0, left: -5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#111118" />
              <XAxis dataKey="time" stroke="#333" fontSize={10} tickFormatter={t => `${t}s`} />
              <YAxis stroke="#333" fontSize={10} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={v => `T+${v}s`} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Line type="monotone" dataKey="semiMajorAxis" stroke="#44aaff" dot={false} strokeWidth={2} name="Semi-Major Axis" />
              {compLines('sma')}
            </LineChart>
          </ResponsiveContainer>
        </CollapsibleChart>
      )}

      {/* Downrange distance chart */}
      {mergedData.length > 1 && (
        <CollapsibleChart title="DOWNRANGE DISTANCE (km)" defaultOpen={false} accent="#44cc88" helpKey="DOWNRANGE DISTANCE (km)">
          <ResponsiveContainer width="100%" height={compact ? 120 : 160}>
            <LineChart data={mergedData} margin={{ top: 5, right: 10, bottom: 0, left: -5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#111118" />
              <XAxis dataKey="time" stroke="#333" fontSize={10} tickFormatter={t => `${t}s`} />
              <YAxis stroke="#333" fontSize={10} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={v => `T+${v}s`} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Line type="monotone" dataKey="downrange" stroke="#44cc88" dot={false} strokeWidth={2} name="Downrange" />
              {compLines('dr')}
            </LineChart>
          </ResponsiveContainer>
        </CollapsibleChart>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: '6px 8px', background: '#080812', borderRadius: '5px', border: '1px solid #12121e' }}>
      <div style={{ fontSize: '8px', color: '#556', letterSpacing: '0.8px', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '13px', color, fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  );
}

function fmtKm(meters: number): string {
  const km = meters / 1000;
  if (Math.abs(km) >= 10000) return `${(km / 1000).toFixed(1)}k km`;
  return `${km.toFixed(1)} km`;
}

function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const chartBoxStyle: React.CSSProperties = {
  background: '#0a0a16',
  borderRadius: '8px',
  padding: '12px 16px',
  border: '1px solid #151520',
};

const tooltipStyle: React.CSSProperties = {
  background: '#0a0a18',
  border: '1px solid #1a1a2a',
  fontSize: '11px',
  borderRadius: '4px',
};
