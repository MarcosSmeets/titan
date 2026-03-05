import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { TelemetryPoint, StageEvent } from '../types';

interface TelemetryDashboardProps {
  telemetry: TelemetryPoint[];
  events?: StageEvent[];
  isLive?: boolean;
  compact?: boolean;
}

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  accent?: string;
  children: React.ReactNode;
}

function CollapsibleSection({ title, defaultOpen = true, accent, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={sectionStyle}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: accent || '#556',
        }}
      >
        <span style={{
          fontSize: '9px',
          letterSpacing: '1.5px',
          fontWeight: 700,
          textTransform: 'uppercase',
        }}>
          {title}
        </span>
        <span style={{
          fontSize: '10px',
          color: '#445',
          transition: 'transform 0.2s',
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
        }}>
          ▼
        </span>
      </button>
      {open && <div style={{ marginTop: '8px' }}>{children}</div>}
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
    downrangeKm: t.x / 1000,
    altitudeKm: t.altitude / 1000,
  }));

  const latest = telemetry[telemetry.length - 1];

  // Compute derived values
  const maxAlt = telemetry.length > 0 ? Math.max(...telemetry.map(t => t.altitude)) / 1000 : 0;
  const maxVel = telemetry.length > 0 ? Math.max(...telemetry.map(t => t.velocity)) : 0;
  const maxQ = telemetry.length > 0 ? Math.max(...telemetry.map(t => t.velocity * (t.altitude < 80000 ? 1 : 0))) : 0;

  // Stage event times for reference lines
  const stageTimes = (events || []).map(e => e.time);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '4px',
        borderBottom: '1px solid #151520',
      }}>
        <div style={{
          fontSize: '11px',
          color: '#667',
          letterSpacing: '2px',
          fontWeight: 700,
        }}>
          TELEMETRY
        </div>
        {isLive && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '10px',
            color: '#44ff44',
            fontWeight: 600,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#44ff44',
              display: 'inline-block',
              animation: 'pulse-dot 1s infinite',
            }} />
            LIVE
          </div>
        )}
      </div>

      {/* Primary metrics - always visible */}
      {latest ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '5px',
        }}>
          <DataCard label="ALTITUDE" value={fmtKm(latest.altitude)} color="#4488ff" large />
          <DataCard label="VELOCITY" value={`${latest.velocity.toFixed(0)} m/s`} color="#ff4488" large />
          <DataCard label="APOAPSIS" value={fmtKm(latest.apoapsis)} color="#44cc66" />
          <DataCard label="PERIAPSIS" value={fmtKm(latest.periapsis)} color="#ff8844" />
        </div>
      ) : (
        <div style={{ padding: '20px', textAlign: 'center', color: '#334', fontSize: '12px' }}>
          Awaiting telemetry data...
        </div>
      )}

      {/* Orbital Parameters - collapsible */}
      {latest && (
        <CollapsibleSection title="Orbital Parameters" accent="#aa88ff">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '5px' }}>
            <DataCard label="ECCENTRICITY" value={latest.eccentricity.toFixed(5)} color="#aa44ff" />
            <DataCard label="INCLINATION" value={`${(latest.inclination * 180 / Math.PI).toFixed(2)}°`} color="#ff88aa" />
            <DataCard label="SEMI-MAJOR AXIS" value={fmtKm(latest.semiMajorAxis)} color="#44aaff" />
            <DataCard label="RAAN" value={`${(latest.raan * 180 / Math.PI).toFixed(2)}°`} color="#88ccff" />
          </div>
        </CollapsibleSection>
      )}

      {/* Mission Stats - collapsible */}
      {latest && (
        <CollapsibleSection title="Mission Stats" defaultOpen={!compact} accent="#ffaa44">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
            <DataCard label="T+" value={fmtTime(latest.time)} color="#4488ff" />
            <DataCard label="MAX ALT" value={`${maxAlt.toFixed(1)} km`} color="#4488ff" />
            <DataCard label="MAX VEL" value={`${maxVel.toFixed(0)} m/s`} color="#ff4488" />
            <DataCard label="STAGE" value={`${latest.stageIndex + 1}`} color="#ffaa00" />
            <DataCard label="DOWNRANGE" value={`${(latest.x / 1000).toFixed(1)} km`} color="#44cc88" />
            <DataCard label="MAX-Q VEL" value={`${maxQ.toFixed(0)} m/s`} color="#ff8844" />
          </div>
        </CollapsibleSection>
      )}

      {/* Events log - collapsible */}
      {events && events.length > 0 && (
        <CollapsibleSection title={`Events (${events.length})`} defaultOpen={!compact} accent="#ffaa00">
          <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
            {events.map((e, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '3px 0',
                fontSize: '10px',
                borderBottom: i < events.length - 1 ? '1px solid #0d0d1a' : 'none',
              }}>
                <span style={{
                  color: '#ffaa00',
                  fontFamily: 'monospace',
                  fontSize: '9px',
                  minWidth: '48px',
                  flexShrink: 0,
                }}>
                  T+{fmtTime(e.time)}
                </span>
                <span style={{ color: '#bbc' }}>{e.description}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Altitude & Orbit chart */}
      {chartData.length > 1 && (
        <CollapsibleSection title="Altitude & Orbit" accent="#4488ff">
          <ResponsiveContainer width="100%" height={compact ? 110 : 140}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#111118" />
              <XAxis dataKey="time" stroke="#333" fontSize={8} tickFormatter={t => `${t}s`} />
              <YAxis stroke="#333" fontSize={8} />
              {stageTimes.map((t, i) => (
                <ReferenceLine key={i} x={Math.round(t)} stroke="#ffaa00" strokeDasharray="2 3" strokeWidth={0.5} />
              ))}
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={v => `T+${v}s`}
              />
              <Line type="monotone" dataKey="altitude" stroke="#4488ff" dot={false} strokeWidth={1.5} name="Altitude" />
              <Line type="monotone" dataKey="apoapsis" stroke="#44cc66" dot={false} strokeWidth={1} name="Apoapsis" />
              <Line type="monotone" dataKey="periapsis" stroke="#ff8844" dot={false} strokeWidth={1} name="Periapsis" />
            </LineChart>
          </ResponsiveContainer>
        </CollapsibleSection>
      )}

      {/* Velocity chart */}
      {chartData.length > 1 && (
        <CollapsibleSection title="Velocity" accent="#ff4488">
          <ResponsiveContainer width="100%" height={compact ? 90 : 120}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#111118" />
              <XAxis dataKey="time" stroke="#333" fontSize={8} tickFormatter={t => `${t}s`} />
              <YAxis stroke="#333" fontSize={8} />
              {stageTimes.map((t, i) => (
                <ReferenceLine key={i} x={Math.round(t)} stroke="#ffaa00" strokeDasharray="2 3" strokeWidth={0.5} />
              ))}
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={v => `T+${v}s`}
              />
              <Line type="monotone" dataKey="velocity" stroke="#ff4488" dot={false} strokeWidth={1.5} name="Velocity (m/s)" />
            </LineChart>
          </ResponsiveContainer>
        </CollapsibleSection>
      )}

      {/* Eccentricity chart */}
      {chartData.length > 1 && (
        <CollapsibleSection title="Eccentricity" defaultOpen={!compact} accent="#aa44ff">
          <ResponsiveContainer width="100%" height={compact ? 80 : 100}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#111118" />
              <XAxis dataKey="time" stroke="#333" fontSize={8} tickFormatter={t => `${t}s`} />
              <YAxis stroke="#333" fontSize={8} domain={[0, 'auto']} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={v => `T+${v}s`}
              />
              <Line type="monotone" dataKey="eccentricity" stroke="#aa44ff" dot={false} strokeWidth={1.5} name="e" />
            </LineChart>
          </ResponsiveContainer>
        </CollapsibleSection>
      )}

      {/* Inclination chart */}
      {chartData.length > 1 && (
        <CollapsibleSection title="Inclination" defaultOpen={false} accent="#ff88aa">
          <ResponsiveContainer width="100%" height={compact ? 80 : 100}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#111118" />
              <XAxis dataKey="time" stroke="#333" fontSize={8} tickFormatter={t => `${t}s`} />
              <YAxis stroke="#333" fontSize={8} unit="°" />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={v => `T+${v}s`}
                formatter={(v: number) => [`${v.toFixed(2)}°`, 'Inclination']}
              />
              <Line type="monotone" dataKey="inclination" stroke="#ff88aa" dot={false} strokeWidth={1.5} name="Inc" />
            </LineChart>
          </ResponsiveContainer>
        </CollapsibleSection>
      )}

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

function DataCard({
  label,
  value,
  color,
  large,
}: {
  label: string;
  value: string;
  color?: string;
  large?: boolean;
}) {
  return (
    <div style={{
      padding: large ? '8px 6px' : '6px 5px',
      background: '#080812',
      borderRadius: '5px',
      border: '1px solid #12121e',
      overflow: 'hidden',
    }}>
      <div style={{
        fontSize: '8px',
        color: '#445',
        letterSpacing: '0.8px',
        marginBottom: '2px',
        fontWeight: 600,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: large ? '15px' : '12px',
        color: color || '#aab',
        fontFamily: 'monospace',
        fontWeight: large ? 700 : 500,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {value}
      </div>
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

const sectionStyle: React.CSSProperties = {
  background: '#0a0a16',
  borderRadius: '6px',
  padding: '8px 10px',
  border: '1px solid #12121e',
};

const tooltipStyle: React.CSSProperties = {
  background: '#0a0a18',
  border: '1px solid #1a1a2a',
  fontSize: '10px',
  borderRadius: '4px',
};
