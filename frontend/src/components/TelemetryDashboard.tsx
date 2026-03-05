import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import type { TelemetryPoint, StageEvent } from '../types';

interface TelemetryDashboardProps {
  telemetry: TelemetryPoint[];
  events?: StageEvent[];
  isLive?: boolean;
  compact?: boolean;
}

export default function TelemetryDashboard({ telemetry, events, isLive, compact }: TelemetryDashboardProps) {
  const chartData = telemetry.map(t => ({
    time: Math.round(t.time),
    altitude: t.altitude / 1000,
    velocity: t.velocity,
    apoapsis: t.apoapsis / 1000,
    periapsis: Math.max(t.periapsis / 1000, -500),
    eccentricity: t.eccentricity,
  }));

  const latest = telemetry[telemetry.length - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Section title */}
      <div style={{
        fontSize: '11px',
        color: '#556',
        letterSpacing: '2px',
        fontWeight: 600,
      }}>
        TELEMETRY {isLive && <span style={{ color: '#44ff44' }}>LIVE</span>}
      </div>

      {/* Orbital elements grid */}
      {latest ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '6px',
        }}>
          <DataCard label="Altitude" value={fmtKm(latest.altitude)} highlight />
          <DataCard label="Velocity" value={`${latest.velocity.toFixed(0)} m/s`} highlight />
          <DataCard label="Apoapsis" value={fmtKm(latest.apoapsis)} />
          <DataCard label="Periapsis" value={fmtKm(latest.periapsis)} />
          <DataCard label="Eccentricity" value={latest.eccentricity.toFixed(4)} />
          <DataCard label="Inclination" value={`${(latest.inclination * 180 / Math.PI).toFixed(1)}°`} />
          <DataCard label="Semi-Major" value={fmtKm(latest.semiMajorAxis)} />
          <DataCard label="RAAN" value={`${(latest.raan * 180 / Math.PI).toFixed(1)}°`} />
          <DataCard label="Mission Time" value={fmtTime(latest.time)} accent />
        </div>
      ) : (
        <div style={{
          padding: '24px',
          textAlign: 'center',
          color: '#334',
          fontSize: '13px',
        }}>
          Waiting for telemetry...
        </div>
      )}

      {/* Events log — hidden in compact mode (shown as separate overlay) */}
      {!compact && events && events.length > 0 && (
        <div style={{ ...sectionStyle }}>
          <div style={sectionTitle}>EVENTS</div>
          {events.map((e, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 0',
              fontSize: '11px',
              borderBottom: '1px solid #111',
            }}>
              <span style={{
                color: '#ffaa00',
                fontFamily: 'monospace',
                fontSize: '10px',
                minWidth: '50px',
              }}>
                T+{fmtTime(e.time)}
              </span>
              <span style={{ color: '#ccc' }}>{e.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Altitude chart */}
      {chartData.length > 1 && (
        <div style={sectionStyle}>
          <div style={sectionTitle}>ALTITUDE & ORBIT (km)</div>
          <ResponsiveContainer width="100%" height={compact ? 120 : 150}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#151520" />
              <XAxis dataKey="time" stroke="#334" fontSize={9} tickFormatter={t => `${t}s`} />
              <YAxis stroke="#334" fontSize={9} />
              <Tooltip
                contentStyle={{ background: '#0f0f1a', border: '1px solid #222', fontSize: '11px' }}
                labelFormatter={v => `T+${v}s`}
              />
              <Line type="monotone" dataKey="altitude" stroke="#4488ff" dot={false} strokeWidth={2} name="Alt" />
              <Line type="monotone" dataKey="apoapsis" stroke="#44cc66" dot={false} strokeWidth={1} name="Apo" />
              <Line type="monotone" dataKey="periapsis" stroke="#ff8844" dot={false} strokeWidth={1} name="Peri" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Velocity chart */}
      {chartData.length > 1 && (
        <div style={sectionStyle}>
          <div style={sectionTitle}>VELOCITY (m/s)</div>
          <ResponsiveContainer width="100%" height={compact ? 100 : 120}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#151520" />
              <XAxis dataKey="time" stroke="#334" fontSize={9} tickFormatter={t => `${t}s`} />
              <YAxis stroke="#334" fontSize={9} />
              <Tooltip
                contentStyle={{ background: '#0f0f1a', border: '1px solid #222', fontSize: '11px' }}
                labelFormatter={v => `T+${v}s`}
              />
              <Line type="monotone" dataKey="velocity" stroke="#ff4488" dot={false} strokeWidth={2} name="Vel" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Eccentricity chart — hidden in compact mode */}
      {!compact && chartData.length > 1 && (
        <div style={sectionStyle}>
          <div style={sectionTitle}>ECCENTRICITY</div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#151520" />
              <XAxis dataKey="time" stroke="#334" fontSize={9} tickFormatter={t => `${t}s`} />
              <YAxis stroke="#334" fontSize={9} domain={[0, 'auto']} />
              <Tooltip
                contentStyle={{ background: '#0f0f1a', border: '1px solid #222', fontSize: '11px' }}
                labelFormatter={v => `T+${v}s`}
              />
              <Line type="monotone" dataKey="eccentricity" stroke="#aa44ff" dot={false} strokeWidth={2} name="e" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function DataCard({
  label,
  value,
  highlight,
  accent,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  accent?: boolean;
}) {
  return (
    <div style={{
      padding: '8px 6px',
      background: '#0c0c18',
      borderRadius: '6px',
      textAlign: 'center',
      border: '1px solid #151520',
    }}>
      <div style={{
        fontSize: '9px',
        color: '#445',
        letterSpacing: '0.5px',
        marginBottom: '3px',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: highlight ? '15px' : '13px',
        color: accent ? '#4488ff' : highlight ? '#fff' : '#aab',
        fontFamily: 'monospace',
        fontWeight: highlight ? 600 : 400,
      }}>
        {value}
      </div>
    </div>
  );
}

function fmtKm(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const sectionStyle: React.CSSProperties = {
  background: '#0c0c18',
  borderRadius: '6px',
  padding: '10px',
  border: '1px solid #151520',
};

const sectionTitle: React.CSSProperties = {
  fontSize: '9px',
  color: '#445',
  letterSpacing: '1.5px',
  marginBottom: '8px',
  fontWeight: 600,
};
