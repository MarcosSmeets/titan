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
}

function CollapsibleChart({ title, defaultOpen = true, accent, children }: {
  title: string;
  defaultOpen?: boolean;
  accent?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={chartBoxStyle}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: accent || '#667',
        }}
      >
        <span style={{ fontSize: '10px', letterSpacing: '1.5px', fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: '10px', color: '#445', transition: 'transform 0.2s', transform: open ? 'rotate(0)' : 'rotate(-90deg)' }}>
          {open ? '▼' : '▶'}
        </span>
      </button>
      {open && <div style={{ marginTop: '10px' }}>{children}</div>}
    </div>
  );
}

export default function TelemetryDashboard({ telemetry, events, isLive, compact }: TelemetryDashboardProps) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Events timeline */}
      {events && events.length > 0 && (
        <CollapsibleChart title={`MISSION EVENTS (${events.length})`} accent="#ffaa00">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {events.map((e, i) => (
              <div key={i} style={{
                padding: '6px 12px',
                background: '#0c0c18',
                borderRadius: '6px',
                border: '1px solid #1a1a2e',
                display: 'flex', alignItems: 'center', gap: '8px',
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
      {chartData.length > 1 && (
        <CollapsibleChart title="ALTITUDE & ORBIT (km)" accent="#4488ff">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -5 }}>
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
            </LineChart>
          </ResponsiveContainer>
        </CollapsibleChart>
      )}

      {/* Velocity chart */}
      {chartData.length > 1 && (
        <CollapsibleChart title="VELOCITY (m/s)" accent="#ff4488">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#111118" />
              <XAxis dataKey="time" stroke="#333" fontSize={10} tickFormatter={t => `${t}s`} />
              <YAxis stroke="#333" fontSize={10} />
              {stageTimes.map((t, i) => (
                <ReferenceLine key={i} x={t} stroke="#ffaa00" strokeDasharray="2 3" strokeWidth={0.5} />
              ))}
              <Tooltip contentStyle={tooltipStyle} labelFormatter={v => `T+${v}s`} />
              <Line type="monotone" dataKey="velocity" stroke="#ff4488" dot={false} strokeWidth={2} name="Velocity" />
            </LineChart>
          </ResponsiveContainer>
        </CollapsibleChart>
      )}

      {/* Eccentricity chart */}
      {chartData.length > 1 && (
        <CollapsibleChart title="ECCENTRICITY" defaultOpen={!compact} accent="#aa44ff">
          <ResponsiveContainer width="100%" height={compact ? 120 : 160}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#111118" />
              <XAxis dataKey="time" stroke="#333" fontSize={10} tickFormatter={t => `${t}s`} />
              <YAxis stroke="#333" fontSize={10} domain={[0, 'auto']} />
              {stageTimes.map((t, i) => (
                <ReferenceLine key={i} x={t} stroke="#ffaa00" strokeDasharray="2 3" strokeWidth={0.5} />
              ))}
              <Tooltip contentStyle={tooltipStyle} labelFormatter={v => `T+${v}s`} />
              <Line type="monotone" dataKey="eccentricity" stroke="#aa44ff" dot={false} strokeWidth={2} name="Eccentricity" />
            </LineChart>
          </ResponsiveContainer>
        </CollapsibleChart>
      )}

      {/* Inclination chart */}
      {chartData.length > 1 && (
        <CollapsibleChart title="INCLINATION (deg)" defaultOpen={false} accent="#ff88aa">
          <ResponsiveContainer width="100%" height={compact ? 120 : 160}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#111118" />
              <XAxis dataKey="time" stroke="#333" fontSize={10} tickFormatter={t => `${t}s`} />
              <YAxis stroke="#333" fontSize={10} unit="°" />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={v => `T+${v}s`} formatter={(v: number) => [`${v.toFixed(2)}°`, 'Inclination']} />
              <Line type="monotone" dataKey="inclination" stroke="#ff88aa" dot={false} strokeWidth={2} name="Inclination" />
            </LineChart>
          </ResponsiveContainer>
        </CollapsibleChart>
      )}

      {/* Semi-major axis chart */}
      {chartData.length > 1 && (
        <CollapsibleChart title="SEMI-MAJOR AXIS (km)" defaultOpen={false} accent="#44aaff">
          <ResponsiveContainer width="100%" height={compact ? 120 : 160}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#111118" />
              <XAxis dataKey="time" stroke="#333" fontSize={10} tickFormatter={t => `${t}s`} />
              <YAxis stroke="#333" fontSize={10} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={v => `T+${v}s`} />
              <Line type="monotone" dataKey="semiMajorAxis" stroke="#44aaff" dot={false} strokeWidth={2} name="Semi-Major Axis" />
            </LineChart>
          </ResponsiveContainer>
        </CollapsibleChart>
      )}

      {/* Downrange distance chart */}
      {chartData.length > 1 && (
        <CollapsibleChart title="DOWNRANGE DISTANCE (km)" defaultOpen={false} accent="#44cc88">
          <ResponsiveContainer width="100%" height={compact ? 120 : 160}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#111118" />
              <XAxis dataKey="time" stroke="#333" fontSize={10} tickFormatter={t => `${t}s`} />
              <YAxis stroke="#333" fontSize={10} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={v => `T+${v}s`} />
              <Line type="monotone" dataKey="downrange" stroke="#44cc88" dot={false} strokeWidth={2} name="Downrange" />
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
