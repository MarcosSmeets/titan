import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { TelemetryPoint } from '../types';

interface TelemetryDashboardProps {
  telemetry: TelemetryPoint[];
  events?: { time: number; type: string; description: string }[];
}

function formatAltitude(value: number) {
  return `${(value / 1000).toFixed(1)} km`;
}

function formatVelocity(value: number) {
  return `${value.toFixed(0)} m/s`;
}

export default function TelemetryDashboard({ telemetry, events }: TelemetryDashboardProps) {
  const chartData = telemetry.map(t => ({
    time: t.time,
    altitude: t.altitude / 1000,    // km
    velocity: t.velocity,            // m/s
    apoapsis: t.apoapsis / 1000,     // km
    periapsis: t.periapsis / 1000,   // km
    eccentricity: t.eccentricity,
    inclination: t.inclination * (180 / Math.PI),
  }));

  const latest = telemetry[telemetry.length - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Orbital Elements Panel */}
      {latest && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          padding: '12px',
          background: '#1a1a2e',
          borderRadius: '8px',
        }}>
          <DataCard label="Altitude" value={formatAltitude(latest.altitude)} />
          <DataCard label="Velocity" value={formatVelocity(latest.velocity)} />
          <DataCard label="Apoapsis" value={formatAltitude(latest.apoapsis)} />
          <DataCard label="Periapsis" value={formatAltitude(latest.periapsis)} />
          <DataCard label="Eccentricity" value={latest.eccentricity.toFixed(4)} />
          <DataCard label="Inclination" value={`${(latest.inclination * 180 / Math.PI).toFixed(2)}°`} />
          <DataCard label="Semi-Major Axis" value={formatAltitude(latest.semiMajorAxis)} />
          <DataCard label="RAAN" value={`${(latest.raan * 180 / Math.PI).toFixed(2)}°`} />
          <DataCard label="Time" value={`${latest.time.toFixed(1)} s`} />
        </div>
      )}

      {/* Altitude & Orbit Chart */}
      <div style={{ background: '#1a1a2e', borderRadius: '8px', padding: '12px' }}>
        <h3 style={{ margin: '0 0 8px', color: '#ccc', fontSize: '14px' }}>
          Altitude & Orbit
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="time" stroke="#888" fontSize={11} />
            <YAxis stroke="#888" fontSize={11} />
            <Tooltip
              contentStyle={{ background: '#222', border: '1px solid #444' }}
            />
            <Legend />
            <Line type="monotone" dataKey="altitude" stroke="#4488ff" dot={false} name="Altitude (km)" />
            <Line type="monotone" dataKey="apoapsis" stroke="#44ff44" dot={false} name="Apoapsis (km)" />
            <Line type="monotone" dataKey="periapsis" stroke="#ff8844" dot={false} name="Periapsis (km)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Velocity Chart */}
      <div style={{ background: '#1a1a2e', borderRadius: '8px', padding: '12px' }}>
        <h3 style={{ margin: '0 0 8px', color: '#ccc', fontSize: '14px' }}>
          Velocity
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="time" stroke="#888" fontSize={11} />
            <YAxis stroke="#888" fontSize={11} />
            <Tooltip
              contentStyle={{ background: '#222', border: '1px solid #444' }}
            />
            <Line type="monotone" dataKey="velocity" stroke="#ff4488" dot={false} name="Velocity (m/s)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Eccentricity Chart */}
      <div style={{ background: '#1a1a2e', borderRadius: '8px', padding: '12px' }}>
        <h3 style={{ margin: '0 0 8px', color: '#ccc', fontSize: '14px' }}>
          Eccentricity
        </h3>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="time" stroke="#888" fontSize={11} />
            <YAxis stroke="#888" fontSize={11} domain={[0, 'auto']} />
            <Tooltip
              contentStyle={{ background: '#222', border: '1px solid #444' }}
            />
            <Line type="monotone" dataKey="eccentricity" stroke="#aa44ff" dot={false} name="Eccentricity" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Events Timeline */}
      {events && events.length > 0 && (
        <div style={{ background: '#1a1a2e', borderRadius: '8px', padding: '12px' }}>
          <h3 style={{ margin: '0 0 8px', color: '#ccc', fontSize: '14px' }}>
            Mission Events
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {events.map((event, i) => (
              <div key={i} style={{
                display: 'flex',
                gap: '12px',
                padding: '4px 8px',
                background: '#222',
                borderRadius: '4px',
                fontSize: '12px',
              }}>
                <span style={{ color: '#888', minWidth: '60px' }}>
                  T+{event.time.toFixed(1)}s
                </span>
                <span style={{ color: '#ffaa00' }}>{event.type}</span>
                <span style={{ color: '#ccc' }}>{event.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DataCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: '8px',
      background: '#16213e',
      borderRadius: '6px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>
        {label}
      </div>
      <div style={{ fontSize: '14px', color: '#fff', fontFamily: 'monospace' }}>
        {value}
      </div>
    </div>
  );
}
