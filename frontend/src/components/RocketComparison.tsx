import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { RocketPreset, SimulationResult } from '../types';
import { compareRockets } from '../services/api';

interface RocketComparisonProps {
  rockets: RocketPreset[];
  onOverlayChange?: (overlays: { name: string; data: any[]; color: string }[]) => void;
}

const COLORS = ['#ff4444', '#44aaff', '#44ff44', '#ffaa44', '#aa44ff'];

export default function RocketComparison({
  rockets,
  onOverlayChange,
}: RocketComparisonProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleRocket = (id: string) => {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(r => r !== id)
        : [...prev, id]
    );
  };

  const runComparison = async () => {
    if (selected.length < 2) return;
    setLoading(true);
    try {
      const result = await compareRockets(selected);
      setResults(result.simulations);

      if (onOverlayChange) {
        onOverlayChange(result.simulations.map((sim, i) => ({
          name: sim.rocketName,
          data: sim.telemetry,
          color: COLORS[i % COLORS.length],
        })));
      }
    } catch (e) {
      console.error('Comparison failed:', e);
    } finally {
      setLoading(false);
    }
  };

  // Merge telemetry for charts
  const mergedAltitude = mergeByTime(results, 'altitude', 1000);
  const mergedVelocity = mergeByTime(results, 'velocity', 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Rocket Selection */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '8px',
      }}>
        {rockets.map(rocket => (
          <button
            key={rocket.id}
            onClick={() => toggleRocket(rocket.id)}
            style={{
              padding: '10px',
              border: selected.includes(rocket.id)
                ? '2px solid #4488ff'
                : '2px solid #333',
              borderRadius: '8px',
              background: selected.includes(rocket.id) ? '#1a2a4e' : '#1a1a2e',
              color: '#fff',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{rocket.name}</div>
            <div style={{ fontSize: '11px', color: '#888' }}>{rocket.manufacturer}</div>
            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>
              LEO: {(rocket.payloadToLEO / 1000).toFixed(1)}t
              {rocket.costPerLaunch && ` | $${rocket.costPerLaunch}M`}
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={runComparison}
        disabled={selected.length < 2 || loading}
        style={{
          padding: '10px 20px',
          background: selected.length >= 2 ? '#4488ff' : '#333',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: selected.length >= 2 ? 'pointer' : 'not-allowed',
          fontWeight: 'bold',
        }}
      >
        {loading ? 'Running...' : `Compare ${selected.length} Rockets`}
      </button>

      {/* Comparison Table */}
      {results.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '12px',
            color: '#ccc',
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #444' }}>
                <th style={thStyle}>Rocket</th>
                <th style={thStyle}>Orbit?</th>
                <th style={thStyle}>Time (s)</th>
                <th style={thStyle}>Max Alt (km)</th>
                <th style={thStyle}>Max Vel (m/s)</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const maxAlt = Math.max(...r.telemetry.map(t => t.altitude));
                const maxVel = Math.max(...r.telemetry.map(t => t.velocity));
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #333' }}>
                    <td style={{ ...tdStyle, color: COLORS[i % COLORS.length] }}>
                      {r.rocketName}
                    </td>
                    <td style={tdStyle}>
                      {r.orbitAchieved ? 'Yes' : 'No'}
                    </td>
                    <td style={tdStyle}>{r.finalTime.toFixed(1)}</td>
                    <td style={tdStyle}>{(maxAlt / 1000).toFixed(1)}</td>
                    <td style={tdStyle}>{maxVel.toFixed(0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Comparative Charts */}
      {results.length > 0 && (
        <>
          <div style={{ background: '#1a1a2e', borderRadius: '8px', padding: '12px' }}>
            <h3 style={{ margin: '0 0 8px', color: '#ccc', fontSize: '14px' }}>
              Altitude vs Time
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={mergedAltitude}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="time" stroke="#888" fontSize={11} />
                <YAxis stroke="#888" fontSize={11} />
                <Tooltip contentStyle={{ background: '#222', border: '1px solid #444' }} />
                <Legend />
                {results.map((r, i) => (
                  <Line
                    key={r.id}
                    type="monotone"
                    dataKey={r.rocketName}
                    stroke={COLORS[i % COLORS.length]}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: '#1a1a2e', borderRadius: '8px', padding: '12px' }}>
            <h3 style={{ margin: '0 0 8px', color: '#ccc', fontSize: '14px' }}>
              Velocity vs Time
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={mergedVelocity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="time" stroke="#888" fontSize={11} />
                <YAxis stroke="#888" fontSize={11} />
                <Tooltip contentStyle={{ background: '#222', border: '1px solid #444' }} />
                <Legend />
                {results.map((r, i) => (
                  <Line
                    key={r.id}
                    type="monotone"
                    dataKey={r.rocketName}
                    stroke={COLORS[i % COLORS.length]}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px',
  textAlign: 'left',
  color: '#888',
};

const tdStyle: React.CSSProperties = {
  padding: '8px',
};

function mergeByTime(
  results: SimulationResult[],
  field: keyof Pick<any, 'altitude' | 'velocity'>,
  divisor: number
): Record<string, number>[] {
  const timeMap = new Map<number, Record<string, number>>();

  for (const result of results) {
    for (const point of result.telemetry) {
      const t = Math.round(point.time);
      if (!timeMap.has(t)) {
        timeMap.set(t, { time: t });
      }
      const entry = timeMap.get(t)!;
      entry[result.rocketName] = (point as any)[field] / divisor;
    }
  }

  return Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
}
