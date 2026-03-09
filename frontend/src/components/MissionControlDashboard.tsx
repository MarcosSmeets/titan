import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import TrajectoryViewer from './TrajectoryViewer';
import type { TelemetryPoint, StageEvent } from '../types';

interface MissionControlProps {
  telemetry: TelemetryPoint[];
  events: StageEvent[];
  rocketName: string;
  isLive: boolean;
  simState: string;
  targetAltitude?: number;
}

// --- Utility functions ---

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function fmtNum(n: number, decimals = 1): string {
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  return n.toFixed(decimals);
}

function quatToEuler(w: number, x: number, y: number, z: number): { roll: number; pitch: number; yaw: number } {
  const sinr = 2 * (w * x + y * z);
  const cosr = 1 - 2 * (x * x + y * y);
  const roll = Math.atan2(sinr, cosr);

  const sinp = 2 * (w * y - z * x);
  const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);

  const siny = 2 * (w * z + x * y);
  const cosy = 1 - 2 * (y * y + z * z);
  const yaw = Math.atan2(siny, cosy);

  return { roll: roll * 180 / Math.PI, pitch: pitch * 180 / Math.PI, yaw: yaw * 180 / Math.PI };
}

function statusLabel(status: number): { text: string; color: string } {
  switch (status) {
    case 0: return { text: 'NOMINAL', color: '#00ff88' };
    case 1: return { text: 'COMPLETE', color: '#4488ff' };
    case 2: return { text: 'IMPACT', color: '#ff4444' };
    case 3: return { text: 'ERROR', color: '#ff4444' };
    default: return { text: 'UNKNOWN', color: '#888' };
  }
}

// --- Main Component ---

export default function MissionControlDashboard({
  telemetry, events, rocketName, isLive, simState, targetAltitude,
}: MissionControlProps) {
  const [selectedChart, setSelectedChart] = useState<'altitude' | 'velocity' | 'orbit' | 'attitude' | 'aero'>('altitude');
  const latest = telemetry[telemetry.length - 1];

  const stageMarkers = useMemo(() =>
    events.filter(e => e.description?.toLowerCase().includes('separation') || e.newStage !== e.previousStage)
      .map(e => ({ time: e.time, index: e.newStage })),
    [events]
  );

  const stageTimes = useMemo(() => events.map(e => Math.round(e.time)), [events]);

  const chartData = useMemo(() => telemetry.map(t => {
    const euler = quatToEuler(
      t.attitudeW ?? 1, t.attitudeX ?? 0, t.attitudeY ?? 0, t.attitudeZ ?? 0
    );
    return {
      time: Math.round(t.time),
      altitude: t.altitude / 1000,
      velocity: t.velocity,
      apoapsis: t.apoapsis / 1000,
      periapsis: Math.max(t.periapsis / 1000, -500),
      eccentricity: t.eccentricity,
      inclination: t.inclination * 180 / Math.PI,
      semiMajorAxis: t.semiMajorAxis / 1000,
      downrange: t.x / 1000,
      roll: euler.roll,
      pitch: euler.pitch,
      yaw: euler.yaw,
      angVelX: (t.angularVelocityX ?? 0) * 180 / Math.PI,
      angVelY: (t.angularVelocityY ?? 0) * 180 / Math.PI,
      angVelZ: (t.angularVelocityZ ?? 0) * 180 / Math.PI,
      dynamicPressure: (t.dynamicPressure ?? 0) / 1000,
      machNumber: t.machNumber ?? 0,
    };
  }), [telemetry]);

  if (!latest) {
    return (
      <div style={rootStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#334' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '14px', letterSpacing: '3px', color: '#556', marginBottom: '8px' }}>AWAITING TELEMETRY</div>
            <div style={{ fontSize: '11px', color: '#334' }}>Simulation data will appear here when available</div>
          </div>
        </div>
      </div>
    );
  }

  const euler = quatToEuler(
    latest.attitudeW ?? 1, latest.attitudeX ?? 0, latest.attitudeY ?? 0, latest.attitudeZ ?? 0
  );
  const stInfo = statusLabel(latest.status ?? (simState === 'complete' ? 1 : 0));
  const maxQ = Math.max(...telemetry.map(t => t.dynamicPressure ?? 0));
  const maxG = telemetry.length > 1
    ? Math.max(...telemetry.slice(1).map((t, i) => {
        const dt = t.time - telemetry[i].time;
        if (dt <= 0) return 0;
        const dv = Math.sqrt(
          Math.pow((t.vx ?? 0) - (telemetry[i].vx ?? 0), 2) +
          Math.pow((t.vy ?? 0) - (telemetry[i].vy ?? 0), 2) +
          Math.pow((t.vz ?? 0) - (telemetry[i].vz ?? 0), 2)
        );
        return dv / dt / 9.80665;
      }))
    : 0;

  return (
    <div style={rootStyle}>
      {/* ===== TOP BAR: Mission header ===== */}
      <div style={headerBarStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '11px', letterSpacing: '3px', color: '#556', fontWeight: 700 }}>TITAN MCC</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#dde' }}>{rocketName}</span>
          <span style={{
            padding: '2px 8px', borderRadius: '3px', fontSize: '10px', fontWeight: 700,
            letterSpacing: '1px', color: stInfo.color,
            background: `${stInfo.color}15`, border: `1px solid ${stInfo.color}30`,
          }}>
            {stInfo.text}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <DataField label="MET" value={`T+${fmtTime(latest.time)}`} color={isLive ? '#00ff88' : '#aab'} mono large />
          <DataField label="STAGE" value={`${(latest.stageIndex ?? 0) + 1}`} color="#ffaa00" mono />
        </div>
      </div>

      {/* ===== MAIN GRID ===== */}
      <div style={gridStyle}>

        {/* --- LEFT COLUMN: Flight Telemetry + Orbital Params --- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>

          {/* Panel 1: FLIGHT TELEMETRY */}
          <Panel title="FLT TELEMETRY" accent="#4488ff">
            <div style={dataGridStyle}>
              <DataField label="ALT" value={`${(latest.altitude / 1000).toFixed(2)} km`} color="#4488ff" mono />
              <DataField label="VEL" value={`${latest.velocity.toFixed(1)} m/s`} color="#ff4488" mono />
              <DataField label="V/V" value={`${((latest.vy ?? 0) > 0 ? '+' : '')}${((latest.vy ?? 0) / 1000).toFixed(2)} km/s`} color="#88aaff" mono />
              <DataField label="V/H" value={`${((latest.vx ?? 0) / 1000).toFixed(2)} km/s`} color="#88ccff" mono />
              <DataField label="DRANGE" value={`${(latest.x / 1000).toFixed(1)} km`} color="#44cc88" mono />
              <DataField label="MAX-Q" value={`${(maxQ / 1000).toFixed(1)} kPa`} color="#ffaa44" mono />
              <DataField label="Q" value={`${((latest.dynamicPressure ?? 0) / 1000).toFixed(2)} kPa`} color="#ff8844" mono />
              <DataField label="MACH" value={`${(latest.machNumber ?? 0).toFixed(2)}`} color="#cc88ff" mono />
              <DataField label="G-LOAD" value={`${maxG.toFixed(1)} g`} color="#ff6644" mono />
            </div>
          </Panel>

          {/* Panel 2: ORBITAL PARAMETERS */}
          <Panel title="ORB PARAMS" accent="#44cc66">
            <div style={dataGridStyle}>
              <DataField label="APO" value={`${(latest.apoapsis / 1000).toFixed(2)} km`} color="#44cc66" mono />
              <DataField label="PERI" value={`${(latest.periapsis / 1000).toFixed(2)} km`} color="#ff8844" mono />
              <DataField label="ECC" value={latest.eccentricity.toFixed(6)} color="#aa44ff" mono />
              <DataField label="INC" value={`${(latest.inclination * 180 / Math.PI).toFixed(3)}${'\u00B0'}`} color="#ff88aa" mono />
              <DataField label="RAAN" value={`${(latest.raan * 180 / Math.PI).toFixed(3)}${'\u00B0'}`} color="#88ccff" mono />
              <DataField label="SMA" value={`${(latest.semiMajorAxis / 1000).toFixed(2)} km`} color="#44aaff" mono />
              <DataField label="ARG-P" value={`${((latest.argumentOfPeriapsis ?? 0) * 180 / Math.PI).toFixed(2)}${'\u00B0'}`} color="#aabb88" mono />
              <DataField label="TA" value={`${((latest.trueAnomaly ?? 0) * 180 / Math.PI).toFixed(2)}${'\u00B0'}`} color="#bbaa88" mono />
            </div>
          </Panel>

          {/* Panel 3: ATTITUDE & GNC */}
          <Panel title="ATT / GNC" accent="#ff88aa">
            <div style={dataGridStyle}>
              <DataField label="ROLL" value={`${euler.roll.toFixed(2)}${'\u00B0'}`} color="#ff8888" mono />
              <DataField label="PITCH" value={`${euler.pitch.toFixed(2)}${'\u00B0'}`} color="#88ff88" mono />
              <DataField label="YAW" value={`${euler.yaw.toFixed(2)}${'\u00B0'}`} color="#8888ff" mono />
              <DataField label="WX" value={`${((latest.angularVelocityX ?? 0) * 180 / Math.PI).toFixed(3)}${'\u00B0'}/s`} color="#ff8888" mono />
              <DataField label="WY" value={`${((latest.angularVelocityY ?? 0) * 180 / Math.PI).toFixed(3)}${'\u00B0'}/s`} color="#88ff88" mono />
              <DataField label="WZ" value={`${((latest.angularVelocityZ ?? 0) * 180 / Math.PI).toFixed(3)}${'\u00B0'}/s`} color="#8888ff" mono />
              <DataField label="Q-W" value={(latest.attitudeW ?? 1).toFixed(4)} color="#aab" mono />
              <DataField label="Q-VEC" value={`${(latest.attitudeX ?? 0).toFixed(3)}, ${(latest.attitudeY ?? 0).toFixed(3)}, ${(latest.attitudeZ ?? 0).toFixed(3)}`} color="#889" mono />
            </div>
          </Panel>

          {/* Panel 4: REACTION WHEELS */}
          <Panel title="RW STATUS" accent="#ffaa00">
            {(latest.wheelCount ?? 0) > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {Array.from({ length: latest.wheelCount }, (_, i) => {
                  const speed = latest.wheelSpeed?.[i] ?? 0;
                  const momentum = latest.wheelMomentum?.[i] ?? 0;
                  const maxMom = 100;
                  const satPct = Math.min(Math.abs(momentum) / maxMom * 100, 100);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '9px', color: '#556', width: '32px', letterSpacing: '1px' }}>RW-{i + 1}</span>
                      <div style={{ flex: 1, height: '10px', background: '#0c0c18', borderRadius: '2px', overflow: 'hidden', border: '1px solid #1a1a2e' }}>
                        <div style={{
                          width: `${satPct}%`, height: '100%',
                          background: satPct > 80 ? '#ff4444' : satPct > 50 ? '#ffaa00' : '#00ff88',
                          transition: 'width 0.3s',
                        }} />
                      </div>
                      <span style={{ fontSize: '9px', color: '#aab', fontFamily: 'monospace', width: '60px', textAlign: 'right' }}>
                        {speed.toFixed(1)} r/s
                      </span>
                      <span style={{ fontSize: '9px', color: '#667', fontFamily: 'monospace', width: '55px', textAlign: 'right' }}>
                        {momentum.toFixed(2)} Nms
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: '10px', color: '#334', letterSpacing: '1px' }}>NO RW CONFIGURED</div>
            )}
          </Panel>
        </div>

        {/* --- CENTER COLUMN: Charts + Events --- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>

          {/* Chart selector tabs */}
          <div style={{ display: 'flex', gap: '0', background: '#060610' }}>
            {(['altitude', 'velocity', 'orbit', 'attitude', 'aero'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setSelectedChart(tab)}
                style={{
                  flex: 1, padding: '6px 4px', border: 'none', cursor: 'pointer',
                  fontSize: '9px', letterSpacing: '1.5px', fontWeight: 700,
                  background: selectedChart === tab ? '#0d0d1a' : '#060610',
                  color: selectedChart === tab ? chartTabColors[tab] : '#334',
                  borderBottom: selectedChart === tab ? `2px solid ${chartTabColors[tab]}` : '2px solid transparent',
                }}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Active chart */}
          <Panel title="" accent="transparent" noPad>
            <div style={{ height: '220px' }}>
              {chartData.length > 1 && (
                <ResponsiveContainer width="100%" height="100%">
                  {renderChart(selectedChart, chartData, stageTimes)}
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          {/* Panel 5: FLIGHT EVENTS TIMELINE */}
          <Panel title="EVENTS" accent="#ffaa00">
            <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
              {events.length === 0 ? (
                <div style={{ fontSize: '10px', color: '#334', letterSpacing: '1px' }}>NO EVENTS</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>MET</th>
                      <th style={thStyle}>EVENT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e, i) => (
                      <tr key={i}>
                        <td style={{ ...tdStyle, color: '#ffaa00', whiteSpace: 'nowrap', width: '70px' }}>
                          T+{fmtTime(e.time)}
                        </td>
                        <td style={{ ...tdStyle, color: '#bbc' }}>{e.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Panel>
        </div>

        {/* --- RIGHT COLUMN: Trajectory Viewer --- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <Panel title="TRAJECTORY" accent="#ff6644" noPad>
            <div style={{ height: '100%', minHeight: '420px' }}>
              <TrajectoryViewer
                telemetry={telemetry}
                targetAltitude={targetAltitude}
                stageEvents={stageMarkers}
                isLive={isLive}
              />
            </div>
          </Panel>

          {/* Attitude Indicator (simplified horizon) */}
          <Panel title="ATT INDICATOR" accent="#88aaff">
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
              <AttitudeIndicator roll={euler.roll} pitch={euler.pitch} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

// --- Chart rendering ---

const chartTabColors: Record<string, string> = {
  altitude: '#4488ff',
  velocity: '#ff4488',
  orbit: '#44cc66',
  attitude: '#ff88aa',
  aero: '#ffaa44',
};

function renderChart(type: string, data: any[], stageTimes: number[]) {
  const stageLines = stageTimes.map((t, i) => (
    <ReferenceLine key={`s${i}`} x={t} stroke="#ffaa0040" strokeDasharray="2 3" strokeWidth={0.5} />
  ));

  const commonProps = {
    data,
    margin: { top: 8, right: 12, bottom: 0, left: 0 },
  };

  switch (type) {
    case 'altitude':
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#0d0d1a" />
          <XAxis dataKey="time" stroke="#222" fontSize={9} tickFormatter={t => `${t}s`} />
          <YAxis stroke="#222" fontSize={9} />
          {stageLines}
          <Tooltip contentStyle={tooltipStyle} labelFormatter={v => `T+${v}s`} />
          <Line type="monotone" dataKey="altitude" stroke="#4488ff" dot={false} strokeWidth={1.5} name="Alt (km)" />
          <Line type="monotone" dataKey="apoapsis" stroke="#44cc66" dot={false} strokeWidth={1} name="Apo (km)" />
          <Line type="monotone" dataKey="periapsis" stroke="#ff8844" dot={false} strokeWidth={1} name="Peri (km)" />
        </LineChart>
      );
    case 'velocity':
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#0d0d1a" />
          <XAxis dataKey="time" stroke="#222" fontSize={9} tickFormatter={t => `${t}s`} />
          <YAxis stroke="#222" fontSize={9} />
          {stageLines}
          <Tooltip contentStyle={tooltipStyle} labelFormatter={v => `T+${v}s`} />
          <Line type="monotone" dataKey="velocity" stroke="#ff4488" dot={false} strokeWidth={1.5} name="Vel (m/s)" />
        </LineChart>
      );
    case 'orbit':
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#0d0d1a" />
          <XAxis dataKey="time" stroke="#222" fontSize={9} tickFormatter={t => `${t}s`} />
          <YAxis stroke="#222" fontSize={9} />
          {stageLines}
          <Tooltip contentStyle={tooltipStyle} labelFormatter={v => `T+${v}s`} />
          <Line type="monotone" dataKey="eccentricity" stroke="#aa44ff" dot={false} strokeWidth={1.5} name="Ecc" />
          <Line type="monotone" dataKey="inclination" stroke="#ff88aa" dot={false} strokeWidth={1} name="Inc (deg)" />
        </LineChart>
      );
    case 'attitude':
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#0d0d1a" />
          <XAxis dataKey="time" stroke="#222" fontSize={9} tickFormatter={t => `${t}s`} />
          <YAxis stroke="#222" fontSize={9} unit={'\u00B0'} />
          {stageLines}
          <Tooltip contentStyle={tooltipStyle} labelFormatter={v => `T+${v}s`} />
          <Line type="monotone" dataKey="roll" stroke="#ff8888" dot={false} strokeWidth={1} name="Roll" />
          <Line type="monotone" dataKey="pitch" stroke="#88ff88" dot={false} strokeWidth={1} name="Pitch" />
          <Line type="monotone" dataKey="yaw" stroke="#8888ff" dot={false} strokeWidth={1} name="Yaw" />
        </LineChart>
      );
    case 'aero':
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#0d0d1a" />
          <XAxis dataKey="time" stroke="#222" fontSize={9} tickFormatter={t => `${t}s`} />
          <YAxis stroke="#222" fontSize={9} yAxisId="left" />
          <YAxis stroke="#222" fontSize={9} yAxisId="right" orientation="right" />
          {stageLines}
          <Tooltip contentStyle={tooltipStyle} labelFormatter={v => `T+${v}s`} />
          <Line type="monotone" dataKey="dynamicPressure" stroke="#ffaa44" dot={false} strokeWidth={1.5} name="Q (kPa)" yAxisId="left" />
          <Line type="monotone" dataKey="machNumber" stroke="#cc88ff" dot={false} strokeWidth={1} name="Mach" yAxisId="right" />
        </LineChart>
      );
    default:
      return <LineChart {...commonProps}><CartesianGrid /></LineChart>;
  }
}

// --- Sub-components ---

function Panel({ title, accent, children, noPad }: {
  title: string; accent: string; children: React.ReactNode; noPad?: boolean;
}) {
  return (
    <div style={panelStyle}>
      {title && (
        <div style={{
          fontSize: '9px', letterSpacing: '2px', fontWeight: 700,
          color: accent, padding: '6px 10px 4px',
          borderBottom: '1px solid #0d0d1a',
        }}>
          {title}
        </div>
      )}
      <div style={{ padding: noPad ? '0' : '6px 10px 8px' }}>
        {children}
      </div>
    </div>
  );
}

function DataField({ label, value, color, mono, large }: {
  label: string; value: string; color: string; mono?: boolean; large?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
      <span style={{ fontSize: '8px', color: '#445', letterSpacing: '1px', fontWeight: 600 }}>{label}</span>
      <span style={{
        fontSize: large ? '14px' : '12px',
        color,
        fontFamily: mono ? '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace' : 'inherit',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {value}
      </span>
    </div>
  );
}

function AttitudeIndicator({ roll, pitch }: { roll: number; pitch: number }) {
  const size = 100;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  const pitchOffset = Math.max(-r, Math.min(r, (pitch / 90) * r));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#222" strokeWidth="2" />

      {/* Sky/ground split */}
      <defs>
        <clipPath id="att-clip">
          <circle cx={cx} cy={cy} r={r - 1} />
        </clipPath>
      </defs>
      <g clipPath="url(#att-clip)" transform={`rotate(${-roll}, ${cx}, ${cy})`}>
        {/* Sky */}
        <rect x={0} y={0} width={size} height={cy + pitchOffset} fill="#1a2a4a" />
        {/* Ground */}
        <rect x={0} y={cy + pitchOffset} width={size} height={size} fill="#2a1a0a" />
        {/* Horizon line */}
        <line x1={0} y1={cy + pitchOffset} x2={size} y2={cy + pitchOffset} stroke="#ffaa00" strokeWidth="1" />

        {/* Pitch lines */}
        {[-30, -20, -10, 10, 20, 30].map(deg => {
          const y = cy + pitchOffset - (deg / 90) * r;
          const w = Math.abs(deg) === 10 ? 12 : Math.abs(deg) === 20 ? 18 : 24;
          return (
            <g key={deg}>
              <line x1={cx - w} y1={y} x2={cx + w} y2={y} stroke="#556" strokeWidth="0.5" />
              <text x={cx + w + 2} y={y + 3} fill="#445" fontSize="6" fontFamily="monospace">{deg}</text>
            </g>
          );
        })}
      </g>

      {/* Fixed aircraft symbol */}
      <line x1={cx - 20} y1={cy} x2={cx - 8} y2={cy} stroke="#ffaa00" strokeWidth="2" />
      <line x1={cx + 8} y1={cy} x2={cx + 20} y2={cy} stroke="#ffaa00" strokeWidth="2" />
      <circle cx={cx} cy={cy} r="2" fill="#ffaa00" />

      {/* Roll indicator ticks around the top */}
      {[-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60].map(deg => {
        const a = (deg - 90) * Math.PI / 180;
        const x1 = cx + Math.cos(a) * (r - 2);
        const y1 = cy + Math.sin(a) * (r - 2);
        const x2 = cx + Math.cos(a) * (r + 1);
        const y2 = cy + Math.sin(a) * (r + 1);
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={deg === 0 ? '#ffaa00' : '#334'} strokeWidth={deg === 0 ? 2 : 1} />;
      })}

      {/* Roll pointer */}
      {(() => {
        const a = (-roll - 90) * Math.PI / 180;
        const x1 = cx + Math.cos(a) * (r - 6);
        const y1 = cy + Math.sin(a) * (r - 6);
        return <circle cx={x1} cy={y1} r="2" fill="#ffaa00" />;
      })()}
    </svg>
  );
}

// --- Styles ---

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: '#08080e',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  color: '#dde',
  overflow: 'hidden',
};

const headerBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 12px',
  background: '#0a0a14',
  borderBottom: '1px solid #151520',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '280px 1fr 340px',
  gap: '1px',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
  background: '#0d0d16',
};

const panelStyle: React.CSSProperties = {
  background: '#0a0a12',
  borderBottom: '1px solid #0d0d16',
};

const dataGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
  gap: '6px 12px',
};

const tooltipStyle: React.CSSProperties = {
  background: '#0a0a18',
  border: '1px solid #1a1a2a',
  fontSize: '10px',
  borderRadius: '3px',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '2px 6px',
  borderBottom: '1px solid #12121e',
  color: '#334',
  fontSize: '8px',
  letterSpacing: '1px',
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: '3px 6px',
  borderBottom: '1px solid #0a0a14',
  fontSize: '10px',
  fontFamily: 'monospace',
};
