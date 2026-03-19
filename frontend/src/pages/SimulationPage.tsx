import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import TrajectoryViewer from '../components/TrajectoryViewer';
import NavBall from '../components/NavBall';

const Viewer3D = lazy(() => import('../components/Viewer3D'));
import MissionEventTimeline from '../components/MissionEventTimeline';
import { useSimulationContext } from '../context/SimulationContext';
import { useNavigate } from 'react-router-dom';
import { fetchSimulations, fetchSimulationById } from '../services/api';
import { exportCSV, exportJSON } from '../utils/export';
import type {
  TelemetryPoint,
  SimulationRequest,
  SimulationState,
  StageEvent,
  StageRequest,
  SavedSimulation,
} from '../types';

const G0 = 9.80665;
const COMP_COLORS = ['#ff6600', '#00cc88', '#cc44ff', '#ffcc00', '#44ccff'];

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function quatToEuler(w: number, x: number, y: number, z: number) {
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

function statusInfo(state: SimulationState) {
  switch (state) {
    case 'connecting': return { bg: 'var(--amber-dim)', dot: 'var(--amber)', label: 'CONNECTING' };
    case 'running': return { bg: 'var(--green-dim)', dot: 'var(--green)', label: 'LIVE' };
    case 'complete': return { bg: 'var(--glow-accent)', dot: 'var(--accent)', label: 'COMPLETE' };
    case 'failed': return { bg: 'var(--red-dim)', dot: 'var(--red)', label: 'FAILED' };
    default: return { bg: 'rgba(136,136,136,0.1)', dot: 'var(--text-2)', label: 'IDLE' };
  }
}

function Panel({ title, accent, children, noPad }: {
  title: string; accent: string; children: React.ReactNode; noPad?: boolean;
}) {
  return (
    <div style={mccPanelStyle}>
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
      <span style={{ fontSize: '8px', color: 'var(--text-3)', letterSpacing: '1px', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
      <span style={{
        fontSize: large ? '14px' : '12px',
        color,
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {value}
      </span>
    </div>
  );
}

const mccChartTabColors: Record<string, string> = {
  altitude: '#4488ff', velocity: '#ff4488', orbit: '#44cc66', attitude: '#ff88aa', aero: '#ffaa44',
};

function renderMccChart(type: string, data: any[], stageTimes: number[], compData?: { name: string; data: any[]; color: string }[]) {
  const stageLines = stageTimes.map((t, i) => (
    <ReferenceLine key={`s${i}`} x={t} stroke="#ffaa0040" strokeDasharray="2 3" strokeWidth={0.5} />
  ));

  // Merge comparison data into the main data array by time
  let mergedData = data;
  const compLines: React.ReactNode[] = [];
  if (compData && compData.length > 0) {
    const timeMap = new Map<number, any>();
    data.forEach(d => timeMap.set(d.time, { ...d }));
    compData.forEach((comp, ci) => {
      comp.data.forEach(d => {
        const existing = timeMap.get(d.time) || { time: d.time };
        existing[`altitude_c${ci}`] = d.altitude;
        existing[`velocity_c${ci}`] = d.velocity;
        existing[`apoapsis_c${ci}`] = d.apoapsis;
        existing[`periapsis_c${ci}`] = d.periapsis;
        existing[`eccentricity_c${ci}`] = d.eccentricity;
        existing[`inclination_c${ci}`] = d.inclination;
        existing[`dynamicPressure_c${ci}`] = d.dynamicPressure;
        existing[`machNumber_c${ci}`] = d.machNumber;
        existing[`roll_c${ci}`] = d.roll;
        existing[`pitch_c${ci}`] = d.pitch;
        existing[`yaw_c${ci}`] = d.yaw;
        timeMap.set(d.time, existing);
      });
      const keyMap: Record<string, string[]> = {
        altitude: [`altitude_c${ci}`, `apoapsis_c${ci}`, `periapsis_c${ci}`],
        velocity: [`velocity_c${ci}`],
        orbit: [`eccentricity_c${ci}`, `inclination_c${ci}`],
        attitude: [`roll_c${ci}`, `pitch_c${ci}`, `yaw_c${ci}`],
        aero: [`dynamicPressure_c${ci}`, `machNumber_c${ci}`],
      };
      (keyMap[type] || []).forEach(key => {
        const yAxisId = (type === 'aero' && key.includes('machNumber')) ? 'right' : (type === 'aero' ? 'left' : undefined);
        compLines.push(
          <Line key={key} type="monotone" dataKey={key} stroke={comp.color} dot={false} strokeWidth={1} strokeDasharray="4 3"
            name={`${comp.name}`} {...(yAxisId ? { yAxisId } : {})} />
        );
      });
    });
    mergedData = Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
  }

  const commonProps = { data: mergedData, margin: { top: 8, right: 12, bottom: 0, left: 0 } };
  const ttStyle: React.CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', fontSize: '10px', borderRadius: '3px' };

  switch (type) {
    case 'altitude':
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#0d0d1a" />
          <XAxis dataKey="time" stroke="#222" fontSize={9} tickFormatter={t => `${t}s`} />
          <YAxis stroke="#222" fontSize={9} />
          {stageLines}
          <Tooltip contentStyle={ttStyle} labelFormatter={v => `T+${v}s`} />
          <Line type="monotone" dataKey="altitude" stroke="#4488ff" dot={false} strokeWidth={1.5} name="Alt (km)" />
          <Line type="monotone" dataKey="apoapsis" stroke="#44cc66" dot={false} strokeWidth={1} name="Apo (km)" />
          <Line type="monotone" dataKey="periapsis" stroke="#ff8844" dot={false} strokeWidth={1} name="Peri (km)" />
          {compLines}
        </LineChart>
      );
    case 'velocity':
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#0d0d1a" />
          <XAxis dataKey="time" stroke="#222" fontSize={9} tickFormatter={t => `${t}s`} />
          <YAxis stroke="#222" fontSize={9} />
          {stageLines}
          <Tooltip contentStyle={ttStyle} labelFormatter={v => `T+${v}s`} />
          <Line type="monotone" dataKey="velocity" stroke="#ff4488" dot={false} strokeWidth={1.5} name="Vel (m/s)" />
          {compLines}
        </LineChart>
      );
    case 'orbit':
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#0d0d1a" />
          <XAxis dataKey="time" stroke="#222" fontSize={9} tickFormatter={t => `${t}s`} />
          <YAxis stroke="#222" fontSize={9} />
          {stageLines}
          <Tooltip contentStyle={ttStyle} labelFormatter={v => `T+${v}s`} />
          <Line type="monotone" dataKey="eccentricity" stroke="#aa44ff" dot={false} strokeWidth={1.5} name="Ecc" />
          <Line type="monotone" dataKey="inclination" stroke="#ff88aa" dot={false} strokeWidth={1} name="Inc (deg)" />
          {compLines}
        </LineChart>
      );
    case 'attitude':
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#0d0d1a" />
          <XAxis dataKey="time" stroke="#222" fontSize={9} tickFormatter={t => `${t}s`} />
          <YAxis stroke="#222" fontSize={9} unit={'\u00B0'} />
          {stageLines}
          <Tooltip contentStyle={ttStyle} labelFormatter={v => `T+${v}s`} />
          <Line type="monotone" dataKey="roll" stroke="#ff8888" dot={false} strokeWidth={1} name="Roll" />
          <Line type="monotone" dataKey="pitch" stroke="#88ff88" dot={false} strokeWidth={1} name="Pitch" />
          <Line type="monotone" dataKey="yaw" stroke="#8888ff" dot={false} strokeWidth={1} name="Yaw" />
          {compLines}
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
          <Tooltip contentStyle={ttStyle} labelFormatter={v => `T+${v}s`} />
          <Line type="monotone" dataKey="dynamicPressure" stroke="#ffaa44" dot={false} strokeWidth={1.5} name="Q (kPa)" yAxisId="left" />
          <Line type="monotone" dataKey="machNumber" stroke="#cc88ff" dot={false} strokeWidth={1} name="Mach" yAxisId="right" />
          {compLines}
        </LineChart>
      );
    default:
      return <LineChart {...commonProps}><CartesianGrid /></LineChart>;
  }
}

function EditorField({ label, value, onChange, step }: {
  label: string; value: number; onChange: (v: number) => void; step?: number;
}) {
  return (
    <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
      <label style={{ fontSize: '9px', color: 'var(--text-3)', letterSpacing: '0.5px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{label}</label>
      <input
        type="number"
        value={typeof value === 'number' ? (Number.isInteger(value) ? value : parseFloat(value.toFixed(2))) : value}
        step={step}
        onChange={e => onChange(Number(e.target.value))}
        style={editorInputStyle}
      />
    </div>
  );
}

// --- Orbit Advisor (inline) ---
interface Tip { type: 'ok' | 'warn' | 'bad'; text: string; }
interface StageIssue { stage: number; param: string; value: string; issue: string; type: 'warn' | 'bad'; }

function analyzeOrbit(
  telemetry: TelemetryPoint[], stages: StageRequest[], targetAltKm: number, orbitAchieved: boolean,
): { tips: Tip[]; stageIssues: StageIssue[] } {
  const tips: Tip[] = [];
  const stageIssues: StageIssue[] = [];
  const last = telemetry[telemetry.length - 1];
  if (!last) return { tips, stageIssues };

  const targetAltM = targetAltKm * 1000;
  const EARTH_R = 6_371_000;
  const MU = 3.986e14;
  const orbitalV = Math.sqrt(MU / (EARTH_R + targetAltM));
  const maxVel = Math.max(...telemetry.map(t => t.velocity));
  const maxAlt = Math.max(...telemetry.map(t => t.altitude));
  const finalApoKm = last.apoapsis / 1000;
  const finalPeriKm = last.periapsis / 1000;
  const finalEcc = last.eccentricity;

  if (orbitAchieved) {
    tips.push({ type: 'ok', text: `Circular orbit achieved at ~${targetAltKm} km.` });
    if (finalEcc < 0.005) tips.push({ type: 'ok', text: `Very low eccentricity (${finalEcc.toFixed(4)}).` });
  } else {
    tips.push({ type: 'bad', text: 'Orbit not achieved.' });
  }

  if (finalApoKm < targetAltKm * 0.9)
    tips.push({ type: 'bad', text: `Apoapsis (${finalApoKm.toFixed(0)} km) far below target (${targetAltKm} km).` });
  else if (finalApoKm < targetAltKm)
    tips.push({ type: 'warn', text: `Apoapsis (${finalApoKm.toFixed(0)} km) almost at target.` });

  if (finalPeriKm < 0) tips.push({ type: 'bad', text: `Negative periapsis (${finalPeriKm.toFixed(0)} km).` });
  else if (finalPeriKm < 120) tips.push({ type: 'bad', text: `Periapsis (${finalPeriKm.toFixed(0)} km) inside atmosphere.` });

  if (finalEcc > 0.5) tips.push({ type: 'bad', text: `Very high eccentricity (${finalEcc.toFixed(3)}).` });
  else if (finalEcc > 0.1) tips.push({ type: 'warn', text: `Eccentricity (${finalEcc.toFixed(3)}) > 0.1.` });

  if (maxVel < orbitalV * 0.7) tips.push({ type: 'bad', text: `Max velocity (${maxVel.toFixed(0)} m/s) far below orbital (${orbitalV.toFixed(0)} m/s).` });
  if (maxAlt / 1000 < targetAltKm * 0.5) tips.push({ type: 'bad', text: `Max altitude (${(maxAlt / 1000).toFixed(0)} km) very low.` });
  if (!orbitAchieved && stages.length === 0) tips.push({ type: 'warn', text: `LEO at ${targetAltKm} km requires ~9,400 m/s total delta-V.` });

  if (stages.length > 0) {
    let massAbove = 0;
    const reversed = [...stages].reverse();
    const tempStats: { twr: number; deltaV: number; burnTime: number; isp: number }[] = [];
    for (const s of reversed) {
      const wetMass = s.dryMass + s.fuelMass + massAbove;
      const dryMass = s.dryMass + massAbove;
      const ve = s.exhaustVelocity;
      const isp = ve / G0;
      const deltaV = ve * Math.log(wetMass / dryMass);
      const thrust = s.burnRate * ve;
      const twr = thrust / (wetMass * G0);
      const burnTime = s.fuelMass / s.burnRate;
      tempStats.push({ twr, deltaV, burnTime, isp });
      massAbove += s.dryMass + s.fuelMass;
    }
    const stats = tempStats.reverse();
    const totalDV = stats.reduce((sum, s) => sum + s.deltaV, 0);

    if (totalDV < 7800) tips.push({ type: 'bad', text: `Total delta-V: ${totalDV.toFixed(0)} m/s. Need ~9,400 m/s.` });
    else if (totalDV < 9400) tips.push({ type: 'warn', text: `Total delta-V: ${totalDV.toFixed(0)} m/s. Low margin.` });
    else tips.push({ type: 'ok', text: `Total delta-V: ${totalDV.toFixed(0)} m/s. Sufficient.` });

    stats.forEach((st, i) => {
      const s = stages[i];
      if (i === 0 && st.twr < 1.0) stageIssues.push({ stage: i + 1, param: 'TWR', value: st.twr.toFixed(2), issue: 'TWR < 1.0', type: 'bad' });
      else if (i === 0 && st.twr < 1.3) stageIssues.push({ stage: i + 1, param: 'TWR', value: st.twr.toFixed(2), issue: 'Low TWR', type: 'warn' });
      if (i === stages.length - 1 && st.deltaV < 3000 && !orbitAchieved) stageIssues.push({ stage: i + 1, param: 'Delta-V', value: `${st.deltaV.toFixed(0)} m/s`, issue: 'Insufficient for circularization', type: 'bad' });
      if (st.isp < 250) stageIssues.push({ stage: i + 1, param: 'Isp', value: `${st.isp.toFixed(0)} s`, issue: 'Very low Isp', type: 'warn' });
      const massRatio = s.fuelMass / (s.dryMass + s.fuelMass);
      if (massRatio < 0.6) stageIssues.push({ stage: i + 1, param: 'Mass fraction', value: `${(massRatio * 100).toFixed(0)}%`, issue: 'Low fuel fraction', type: 'warn' });
    });
  }

  return { tips, stageIssues };
}

function OrbitAdvisor({ telemetry, stages, targetAltKm, orbitAchieved }: {
  telemetry: TelemetryPoint[]; stages: StageRequest[]; targetAltKm: number; orbitAchieved: boolean;
}) {
  const { tips, stageIssues } = analyzeOrbit(telemetry, stages, targetAltKm, orbitAchieved);
  const tipIcon = (type: Tip['type']) => {
    switch (type) {
      case 'ok': return { symbol: '\u2713', color: '#22aa44', bg: 'rgba(34,170,68,0.1)' };
      case 'warn': return { symbol: '!', color: '#ffaa00', bg: 'rgba(255,170,0,0.1)' };
      case 'bad': return { symbol: '\u2717', color: '#ff4444', bg: 'rgba(255,68,68,0.1)' };
    }
  };
  const stageGroups = new Map<number, StageIssue[]>();
  stageIssues.forEach(issue => {
    const list = stageGroups.get(issue.stage) || [];
    list.push(issue);
    stageGroups.set(issue.stage, list);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={advisorBoxStyle}>
        <div style={{ fontSize: '10px', color: '#4488ff', letterSpacing: '2px', fontWeight: 700, marginBottom: '10px' }}>ORBIT TIPS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {tips.map((tip, i) => {
            const icon = tipIcon(tip.type);
            return (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '6px 8px', borderRadius: '6px', background: icon.bg }}>
                <span style={{ width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: icon.color, flexShrink: 0, border: `1px solid ${icon.color}40` }}>{icon.symbol}</span>
                <span style={{ fontSize: '11px', color: '#bbc', lineHeight: 1.4 }}>{tip.text}</span>
              </div>
            );
          })}
        </div>
      </div>
      {stageIssues.length > 0 && (
        <div style={advisorBoxStyle}>
          <div style={{ fontSize: '10px', color: '#ff8844', letterSpacing: '2px', fontWeight: 700, marginBottom: '10px' }}>STAGE ISSUES</div>
          {[...stageGroups.entries()].map(([stageNum, issues]) => (
            <div key={stageNum} style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', color: '#4488ff', fontWeight: 600, letterSpacing: '1px', marginBottom: '4px' }}>STAGE {stageNum}</div>
              {issues.map((issue, j) => (
                <div key={j} style={{ fontSize: '10px', color: issue.type === 'bad' ? '#ff4444' : '#ffaa00', marginBottom: '2px' }}>
                  {issue.param}: {issue.value} — {issue.issue}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SimulationPageComponent() {
  const {
    telemetry, events, rocketName, orbitResult, simState, isActive, lastRequest,
    handleLaunch, reset,
  } = useSimulationContext();
  const navigate = useNavigate();

  const latest = telemetry[telemetry.length - 1];
  const [showEditor, setShowEditor] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showAdvisor, setShowAdvisor] = useState(false);
  const [editStages, setEditStages] = useState<StageRequest[]>([]);
  const [editTargetAlt, setEditTargetAlt] = useState(200);
  const [savedSims, setSavedSims] = useState<SavedSimulation[]>([]);
  const [comparisons, setComparisons] = useState<{ id: string; name: string; telemetry: TelemetryPoint[]; color: string }[]>([]);
  const [loadingComp, setLoadingComp] = useState<string | null>(null);
  const [selectedChart, setSelectedChart] = useState<'altitude' | 'velocity' | 'orbit' | 'attitude' | 'aero'>('altitude');
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');

  useEffect(() => {
    if (lastRequest) {
      setEditTargetAlt(lastRequest.targetAltitude / 1000);
      if (lastRequest.customStages && lastRequest.customStages.length > 0) {
        setEditStages(lastRequest.customStages.map(s => ({ ...s })));
      } else {
        setEditStages([]);
      }
    }
  }, [lastRequest]);

  useEffect(() => {
    if (showCompare) {
      fetchSimulations().then(setSavedSims).catch(() => {});
    }
  }, [showCompare]);

  const updateStage = (idx: number, field: keyof StageRequest, value: number) => {
    setEditStages(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleRelaunch = () => {
    if (!lastRequest) return;
    const req: SimulationRequest = { ...lastRequest, targetAltitude: editTargetAlt * 1000 };
    if (editStages.length > 0) { req.customStages = editStages; req.rocketId = undefined; }
    handleLaunch(req);
  };

  const toggleComparison = async (sim: SavedSimulation) => {
    const existing = comparisons.find(c => c.id === sim.id);
    if (existing) { setComparisons(prev => prev.filter(c => c.id !== sim.id)); return; }
    if (comparisons.length >= 5) return;
    setLoadingComp(sim.id);
    try {
      const detail = await fetchSimulationById(sim.id);
      const color = COMP_COLORS[comparisons.length % COMP_COLORS.length];
      setComparisons(prev => [...prev, { id: sim.id, name: sim.rocketName, telemetry: detail.telemetry, color }]);
    } catch { /* ignore */ }
    setLoadingComp(null);
  };

  const onNewLaunch = () => {
    reset();
    navigate('/launch');
  };

  const hasCustomStages = editStages.length > 0;

  const stageMarkers = useMemo(() =>
    events.filter(e => e.description?.toLowerCase().includes('separation') || e.newStage !== e.previousStage)
      .map(e => ({ time: e.time, index: e.newStage })),
    [events]
  );

  const euler = latest ? quatToEuler(
    latest.attitudeW ?? 1, latest.attitudeX ?? 0, latest.attitudeY ?? 0, latest.attitudeZ ?? 0
  ) : { roll: 0, pitch: 0, yaw: 0 };

  const orbitClassification = useMemo(() => {
    if (!latest) return 'prelaunch' as const;
    const periKm = latest.periapsis / 1000;
    const ecc = latest.eccentricity;
    if (periKm < 100 || ecc > 1) return 'suborbital' as const;
    if (ecc < 0.02) return 'circular' as const;
    return 'elliptical' as const;
  }, [latest]);

  const maxQ = useMemo(() => Math.max(...telemetry.map(t => t.dynamicPressure ?? 0), 0), [telemetry]);
  const maxG = useMemo(() => {
    if (telemetry.length <= 1) return 0;
    return Math.max(...telemetry.slice(1).map((t, i) => {
      const dt = t.time - telemetry[i].time;
      if (dt <= 0) return 0;
      const dv = Math.sqrt(
        Math.pow((t.vx ?? 0) - (telemetry[i].vx ?? 0), 2) +
        Math.pow((t.vy ?? 0) - (telemetry[i].vy ?? 0), 2) +
        Math.pow((t.vz ?? 0) - (telemetry[i].vz ?? 0), 2)
      );
      return dv / dt / 9.80665;
    }));
  }, [telemetry]);

  const stageTimes = useMemo(() => events.map(e => Math.round(e.time)), [events]);

  const compChartData = useMemo(() => comparisons.map(c => ({
    name: c.name,
    color: c.color,
    data: c.telemetry.map(t => {
      const e = quatToEuler(t.attitudeW ?? 1, t.attitudeX ?? 0, t.attitudeY ?? 0, t.attitudeZ ?? 0);
      return {
        time: Math.round(t.time),
        altitude: t.altitude / 1000,
        velocity: t.velocity,
        apoapsis: t.apoapsis / 1000,
        periapsis: Math.max(t.periapsis / 1000, -500),
        eccentricity: t.eccentricity,
        inclination: t.inclination * 180 / Math.PI,
        roll: e.roll, pitch: e.pitch, yaw: e.yaw,
        dynamicPressure: (t.dynamicPressure ?? 0) / 1000,
        machNumber: t.machNumber ?? 0,
      };
    }),
  })), [comparisons]);

  const chartData = useMemo(() => telemetry.map(t => {
    const e = quatToEuler(t.attitudeW ?? 1, t.attitudeX ?? 0, t.attitudeY ?? 0, t.attitudeZ ?? 0);
    return {
      time: Math.round(t.time),
      altitude: t.altitude / 1000,
      velocity: t.velocity,
      apoapsis: t.apoapsis / 1000,
      periapsis: Math.max(t.periapsis / 1000, -500),
      eccentricity: t.eccentricity,
      inclination: t.inclination * 180 / Math.PI,
      semiMajorAxis: t.semiMajorAxis / 1000,
      roll: e.roll, pitch: e.pitch, yaw: e.yaw,
      dynamicPressure: (t.dynamicPressure ?? 0) / 1000,
      machNumber: t.machNumber ?? 0,
    };
  }), [telemetry]);

  const stInfo = statusInfo(simState);

  const handleExportCSV = useCallback(() => {
    exportCSV({ rocketName, telemetry });
  }, [rocketName, telemetry]);

  const handleExportJSON = useCallback(() => {
    exportJSON({ rocketName, telemetry, events });
  }, [rocketName, telemetry, events]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-0)' }}>

      {/* HEADER BAR */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 12px', background: 'var(--bg-1)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '10px', letterSpacing: '3px', color: 'var(--text-3)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>TITAN MCC</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-0)' }}>{rocketName || 'Simulation'}</span>
          {orbitResult && (
            <span style={{
              padding: '2px 8px', borderRadius: '3px', fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
              color: orbitResult.achieved ? '#22aa44' : '#ff4444',
              background: orbitResult.achieved ? 'rgba(34,170,68,0.12)' : 'rgba(255,68,68,0.12)',
              border: `1px solid ${orbitResult.achieved ? 'rgba(34,170,68,0.3)' : 'rgba(255,68,68,0.3)'}`,
            }}>
              {orbitResult.achieved ? 'ORBIT ACHIEVED' : 'NO ORBIT'}
            </span>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '2px 8px', borderRadius: '3px', fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
            color: stInfo.dot, background: stInfo.bg, border: `1px solid ${stInfo.dot}30`,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: stInfo.dot, animation: isActive ? 'pulse 1s infinite' : 'none' }} />
            {stInfo.label}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {latest && (
            <>
              <DataField label="MET" value={`T+${fmtTime(latest.time)}`} color={isActive ? '#00ff88' : '#aab'} mono large />
              <DataField label="STAGE" value={`${(latest.stageIndex ?? 0) + 1}`} color="#ffaa00" mono />
            </>
          )}
          <div style={{ display: 'flex', gap: '4px', marginLeft: '8px', marginRight: '8px' }}>
            {(['2d', '3d'] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} style={{
                ...mccHeaderBtnStyle,
                color: viewMode === mode ? '#ffaa00' : '#4488ff',
                borderColor: viewMode === mode ? '#ffaa0040' : '#4488ff30',
                background: viewMode === mode ? 'rgba(255,170,0,0.08)' : 'transparent',
              }}>
                {mode.toUpperCase()}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {simState === 'complete' && (
              <>
                <button onClick={handleExportCSV} style={{ ...mccHeaderBtnStyle, color: '#44cc88', borderColor: '#44cc8840' }}>CSV</button>
                <button onClick={handleExportJSON} style={{ ...mccHeaderBtnStyle, color: '#44cc88', borderColor: '#44cc8840' }}>JSON</button>
                <button onClick={() => { setShowEditor(e => !e); setShowCompare(false); setShowAdvisor(false); }}
                  style={{ ...mccHeaderBtnStyle, color: showEditor ? '#ffaa00' : '#4488ff', borderColor: showEditor ? '#ffaa0040' : '#4488ff30' }}>EDIT</button>
                <button onClick={() => { setShowCompare(c => !c); setShowEditor(false); setShowAdvisor(false); }}
                  style={{ ...mccHeaderBtnStyle, color: showCompare ? '#aa44ff' : '#4488ff', borderColor: showCompare ? '#aa44ff40' : '#4488ff30' }}>CMP</button>
                <button onClick={() => { setShowAdvisor(a => !a); setShowEditor(false); setShowCompare(false); }}
                  style={{ ...mccHeaderBtnStyle, color: showAdvisor ? '#44cc66' : '#4488ff', borderColor: showAdvisor ? '#44cc6640' : '#4488ff30' }}>ADV</button>
                <button onClick={onNewLaunch} style={mccHeaderBtnStyle}>NEW</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* MAIN AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div style={{ flex: '0 0 75%', minHeight: 0, position: 'relative' }}>
            {viewMode === '2d' ? (
              <TrajectoryViewer
                telemetry={telemetry}
                targetAltitude={lastRequest?.targetAltitude}
                stageEvents={stageMarkers}
                isLive={isActive}
                orbitClassification={orbitClassification}
              />
            ) : (
              <Suspense fallback={
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#556', fontSize: '12px', letterSpacing: '2px' }}>
                  LOADING 3D VIEWER...
                </div>
              }>
                <Viewer3D
                  telemetry={telemetry}
                  targetAltitude={lastRequest?.targetAltitude ?? 200000}
                  isLive={isActive}
                />
              </Suspense>
            )}
          </div>
          <div style={{ flex: '0 0 25%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: '1px solid var(--border-subtle)' }}>
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
              {latest ? (
                <>
                  <Panel title="FLT TELEMETRY" accent="#4488ff">
                    <div style={mccDataGridStyle}>
                      <DataField label="ALT" value={`${(latest.altitude / 1000).toFixed(2)} km`} color="#4488ff" mono />
                      <DataField label="VEL" value={`${latest.velocity.toFixed(1)} m/s`} color="#ff4488" mono />
                      <DataField label="V/V" value={`${((latest.vy ?? 0) > 0 ? '+' : '')}${((latest.vy ?? 0) / 1000).toFixed(2)} km/s`} color="#88aaff" mono />
                      <DataField label="V/H" value={`${((latest.vx ?? 0) / 1000).toFixed(2)} km/s`} color="#88ccff" mono />
                      <DataField label="MACH" value={`${(latest.machNumber ?? 0).toFixed(2)}`} color="#cc88ff" mono />
                      <DataField label="Q" value={`${((latest.dynamicPressure ?? 0) / 1000).toFixed(2)} kPa`} color="#ff8844" mono />
                      <DataField label="G-LOAD" value={`${maxG.toFixed(1)} g`} color="#ff6644" mono />
                      <DataField label="MAX-Q" value={`${(maxQ / 1000).toFixed(1)} kPa`} color="#ffaa44" mono />
                    </div>
                  </Panel>
                  <Panel title="ORB PARAMS" accent="#44cc66">
                    <div style={mccDataGridStyle}>
                      <DataField label="APO" value={`${(latest.apoapsis / 1000).toFixed(2)} km`} color="#44cc66" mono />
                      <DataField label="PERI" value={`${(latest.periapsis / 1000).toFixed(2)} km`} color="#ff8844" mono />
                      <DataField label="ECC" value={latest.eccentricity.toFixed(6)} color="#aa44ff" mono />
                      <DataField label="INC" value={`${(latest.inclination * 180 / Math.PI).toFixed(3)}\u00B0`} color="#ff88aa" mono />
                      <DataField label="SMA" value={`${(latest.semiMajorAxis / 1000).toFixed(2)} km`} color="#44aaff" mono />
                      <DataField label="RAAN" value={`${(latest.raan * 180 / Math.PI).toFixed(3)}\u00B0`} color="#88ccff" mono />
                      <DataField label="ARG-P" value={`${((latest.argumentOfPeriapsis ?? 0) * 180 / Math.PI).toFixed(2)}\u00B0`} color="#aabb88" mono />
                      <DataField label="TA" value={`${((latest.trueAnomaly ?? 0) * 180 / Math.PI).toFixed(2)}\u00B0`} color="#bbaa88" mono />
                    </div>
                  </Panel>
                  <Panel title="NAVBALL" accent="#88aaff">
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                      <NavBall roll={euler.roll} pitch={euler.pitch} yaw={euler.yaw} size={280}
                        vx={latest.vx} vy={latest.vy} vz={latest.vz ?? 0}
                        px={latest.x} py={latest.y} pz={latest.z ?? 0} />
                    </div>
                  </Panel>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#334' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', letterSpacing: '3px', color: '#556', marginBottom: '8px' }}>AWAITING TELEMETRY</div>
                    <div style={{ fontSize: '11px', color: '#334' }}>Data will appear when simulation starts</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM STRIP */}
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-1)', display: 'flex' }}>
          <div style={{ flex: '0 0 35%', borderRight: '1px solid var(--border-subtle)', padding: '4px 8px', maxHeight: '210px', overflowY: 'auto' }}>
            <div style={{ fontSize: '9px', letterSpacing: '1.5px', fontWeight: 700, color: '#ffaa00', marginBottom: '4px' }}>MISSION EVENTS</div>
            {latest ? (
              <MissionEventTimeline events={events} currentTime={latest.time} isLive={isActive} />
            ) : (
              <div style={{ fontSize: '10px', color: '#334', letterSpacing: '1px' }}>NO EVENTS</div>
            )}
          </div>
          <div style={{ flex: '0 0 65%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '0' }}>
              {(['altitude', 'velocity', 'orbit', 'attitude', 'aero'] as const).map(tab => (
                <button key={tab} onClick={() => setSelectedChart(tab)}
                  style={{
                    flex: 1, padding: '5px 4px', border: 'none', cursor: 'pointer',
                    fontSize: '9px', letterSpacing: '1.5px', fontWeight: 700,
                    background: selectedChart === tab ? 'var(--bg-2)' : 'var(--bg-0)',
                    color: selectedChart === tab ? mccChartTabColors[tab] : '#334',
                    borderBottom: selectedChart === tab ? `2px solid ${mccChartTabColors[tab]}` : '2px solid transparent',
                  }}>
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ height: '180px', padding: '0' }}>
              {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {renderMccChart(selectedChart, chartData, stageTimes, compChartData)}
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#334', fontSize: '11px' }}>
                  Chart data will appear here
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL OVERLAYS */}
      {showEditor && lastRequest && (
        <div style={modalOverlayStyle} onClick={() => setShowEditor(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: '#ffaa00', letterSpacing: '2px', fontWeight: 700 }}>ROCKET PARAMETERS</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '9px', color: '#556', letterSpacing: '1px' }}>TARGET ORBIT </span>
                  <input type="number" value={editTargetAlt} onChange={e => setEditTargetAlt(Number(e.target.value))}
                    style={{ ...editorInputStyle, width: '60px' }} />
                  <span style={{ fontSize: '10px', color: '#445', marginLeft: '2px' }}>km</span>
                </div>
                <button onClick={handleRelaunch} style={relaunchBtnStyle}>RE-LAUNCH</button>
                <button onClick={() => setShowEditor(false)} style={{ ...mccHeaderBtnStyle, color: '#888' }}>CLOSE</button>
              </div>
            </div>
            {hasCustomStages ? (
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
                {editStages.map((stage, i) => (
                  <div key={i} style={{ flex: '1 0 180px', padding: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--accent)', letterSpacing: '1.5px', fontWeight: 600, marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>STAGE {i + 1}</div>
                    <EditorField label="Dry Mass (kg)" value={stage.dryMass} onChange={v => updateStage(i, 'dryMass', v)} />
                    <EditorField label="Fuel Mass (kg)" value={stage.fuelMass} onChange={v => updateStage(i, 'fuelMass', v)} />
                    <EditorField label="Burn Rate (kg/s)" value={stage.burnRate} onChange={v => updateStage(i, 'burnRate', v)} />
                    <EditorField label="Exhaust Vel (m/s)" value={stage.exhaustVelocity} onChange={v => updateStage(i, 'exhaustVelocity', v)} />
                    <EditorField label="Isp (s)" value={Math.round(stage.exhaustVelocity / G0)} onChange={v => updateStage(i, 'exhaustVelocity', v * G0)} />
                    <EditorField label="Ref Area (m2)" value={stage.referenceArea} onChange={v => updateStage(i, 'referenceArea', v)} />
                    <EditorField label="Cd" value={stage.dragCoefficient} onChange={v => updateStage(i, 'dragCoefficient', v)} step={0.05} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text-2)', padding: '8px 0' }}>
                This is a preset rocket. To edit parameters, first launch a custom rocket from the Rocket Builder, then modify it here.
                <br /><span style={{ fontSize: '11px', color: 'var(--text-3)' }}>You can still change the target orbit and re-launch with different altitude.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {showCompare && (
        <div style={modalOverlayStyle} onClick={() => setShowCompare(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', color: '#aa44ff', letterSpacing: '2px', fontWeight: 700 }}>COMPARE WITH PAST SIMULATIONS</div>
              <button onClick={() => setShowCompare(false)} style={{ ...mccHeaderBtnStyle, color: '#888' }}>CLOSE</button>
            </div>
            {comparisons.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                {comparisons.map(c => (
                  <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, background: `${c.color}15`, color: c.color, border: `1px solid ${c.color}40` }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color }} />{c.name}
                    <button onClick={() => setComparisons(prev => prev.filter(x => x.id !== c.id))} style={{ background: 'none', border: 'none', color: c.color, cursor: 'pointer', padding: '0 2px', fontSize: '10px' }}>x</button>
                  </span>
                ))}
              </div>
            )}
            {savedSims.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>No saved simulations found.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                {savedSims.map(sim => {
                  const isSelected = comparisons.some(c => c.id === sim.id);
                  const isLoading = loadingComp === sim.id;
                  return (
                    <button key={sim.id} onClick={() => toggleComparison(sim)}
                      disabled={isLoading || (!isSelected && comparisons.length >= 5)}
                      style={{
                        padding: '8px 10px', background: isSelected ? 'rgba(170,68,255,0.08)' : 'rgba(255,255,255,0.02)',
                        border: isSelected ? '1px solid rgba(170,68,255,0.4)' : '1px solid var(--border-subtle)',
                        borderRadius: '6px', cursor: isLoading ? 'wait' : 'pointer', textAlign: 'left', color: '#fff',
                        opacity: (!isSelected && comparisons.length >= 5) ? 0.4 : 1,
                      }}>
                      <div style={{ fontSize: '12px', fontWeight: 600 }}>{sim.rocketName}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-2)', marginTop: '2px' }}>
                        {sim.orbitAchieved ? 'Orbit' : 'No orbit'} &middot; Alt {(sim.maxAltitude / 1000).toFixed(0)} km
                      </div>
                      {isLoading && <div style={{ fontSize: '9px', color: '#aa44ff', marginTop: '2px' }}>Loading...</div>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showAdvisor && latest && simState === 'complete' && (
        <div style={modalOverlayStyle} onClick={() => setShowAdvisor(false)}>
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: '380px',
            background: 'var(--bg-1)', borderLeft: '1px solid var(--border)',
            overflowY: 'auto', padding: '16px', zIndex: 1001,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '11px', color: '#44cc66', letterSpacing: '2px', fontWeight: 700 }}>ORBIT ADVISOR</span>
              <button onClick={() => setShowAdvisor(false)} style={{ ...mccHeaderBtnStyle, color: '#888' }}>CLOSE</button>
            </div>
            <OrbitAdvisor
              telemetry={telemetry}
              stages={lastRequest?.customStages || editStages}
              targetAltKm={editTargetAlt}
              orbitAchieved={orbitResult?.achieved || false}
            />
          </div>
        </div>
      )}


    </div>
  );
}

// --- Styles ---
const editorInputStyle: React.CSSProperties = { width: '70px', padding: '4px 8px', background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: '5px', color: 'var(--text-0)', fontSize: '11px', fontFamily: 'var(--font-mono)', textAlign: 'right' };
const relaunchBtnStyle: React.CSSProperties = { padding: '8px 20px', background: 'linear-gradient(135deg, #ff3333, #cc2200)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', letterSpacing: '2px', boxShadow: '0 2px 10px rgba(255,50,50,0.3)' };
const advisorBoxStyle: React.CSSProperties = { background: 'var(--bg-1)', borderRadius: '8px', padding: '12px 14px', border: '1px solid var(--border-subtle)' };
const mccPanelStyle: React.CSSProperties = { background: 'var(--bg-1)', borderBottom: '1px solid var(--border-subtle)' };
const mccDataGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))', gap: '8px 14px' };
const mccHeaderBtnStyle: React.CSSProperties = { padding: '5px 12px', background: 'transparent', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '5px', color: 'var(--accent)', cursor: 'pointer', fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.5px', transition: 'all 0.15s' };
const modalOverlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modalContentStyle: React.CSSProperties = { background: 'var(--bg-2)', borderRadius: '12px', border: '1px solid var(--border)', padding: '24px', maxWidth: '900px', width: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' };
