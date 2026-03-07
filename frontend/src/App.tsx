import { useState, useEffect, useCallback, useRef } from 'react';
import TelemetryDashboard from './components/TelemetryDashboard';
import MissionControlDashboard from './components/MissionControlDashboard';
import HeroSection from './components/HeroSection';
import RocketBuilderModal from './components/RocketBuilder';
import SimulationHistory from './components/SimulationHistory';
import HowItWorks from './components/HowItWorks';
import { fetchRockets, fetchSimulations, fetchSimulationById } from './services/api';
import { runStreamingSimulation } from './services/signalr';
import type {
  RocketPreset,
  TelemetryPoint,
  SimulationRequest,
  SimulationState,
  StageEvent,
  StageRequest,
  SavedSimulation,
  AppPage,
} from './types';

export default function App() {
  const [rockets, setRockets] = useState<RocketPreset[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [simState, setSimState] = useState<SimulationState>('idle');
  const [events, setEvents] = useState<StageEvent[]>([]);
  const [rocketName, setRocketName] = useState('');
  const [orbitResult, setOrbitResult] = useState<{ achieved: boolean; time: number } | null>(null);
  const [showRocketBuilder, setShowRocketBuilder] = useState(false);
  const [page, setPage] = useState<AppPage>('launch');
  const [lastRequest, setLastRequest] = useState<SimulationRequest | null>(null);
  const telemetryRef = useRef<TelemetryPoint[]>([]);
  const eventsRef = useRef<StageEvent[]>([]);

  useEffect(() => {
    fetchRockets()
      .then(setRockets)
      .catch(() => {
        setRockets([
          { id: 'falcon9', name: 'Falcon 9', manufacturer: 'SpaceX', country: 'USA', height: 70, diameter: 3.7, launchMass: 549054, payloadToLEO: 22800, costPerLaunch: 67, stageCount: 2 },
          { id: 'saturnv', name: 'Saturn V', manufacturer: 'Boeing/NA/Douglas', country: 'USA', height: 110.6, diameter: 10.1, launchMass: 2970000, payloadToLEO: 140000, costPerLaunch: 1160, stageCount: 3 },
          { id: 'electron', name: 'Electron', manufacturer: 'Rocket Lab', country: 'NZ/USA', height: 18, diameter: 1.2, launchMass: 12550, payloadToLEO: 300, costPerLaunch: 7.5, stageCount: 2 },
          { id: 'ariane5', name: 'Ariane 5', manufacturer: 'Airbus/Safran', country: 'Europe', height: 53, diameter: 5.4, launchMass: 777000, payloadToLEO: 21000, costPerLaunch: 178, stageCount: 2 },
          { id: 'starship', name: 'Starship', manufacturer: 'SpaceX', country: 'USA', height: 121, diameter: 9, launchMass: 5000000, payloadToLEO: 150000, costPerLaunch: null, stageCount: 2 },
        ]);
      });
  }, []);

  const handleLaunch = useCallback(async (request: SimulationRequest) => {
    setSimState('connecting');
    setTelemetry([]);
    setEvents([]);
    setOrbitResult(null);
    setLastRequest(request);
    telemetryRef.current = [];
    eventsRef.current = [];
    setPage('simulation');

    await runStreamingSimulation(request, {
      onStart: (info) => {
        setRocketName(info.rocketName);
        setSimState('running');
      },
      onTelemetry: (point) => {
        telemetryRef.current = [...telemetryRef.current, point];
        setTelemetry([...telemetryRef.current]);
      },
      onStageEvent: (event) => {
        eventsRef.current = [...eventsRef.current, event];
        setEvents([...eventsRef.current]);
      },
      onComplete: (result) => {
        setOrbitResult({ achieved: result.orbitAchieved, time: result.finalTime });
        setSimState('complete');
      },
      onError: (error) => {
        console.error('Simulation error:', error);
        setSimState('failed');
      },
    });
  }, []);

  const handleReplay = useCallback((
    replayTelemetry: TelemetryPoint[],
    replayEvents: StageEvent[],
    name: string,
    orbitAchieved: boolean,
    finalTime: number
  ) => {
    setTelemetry(replayTelemetry);
    setEvents(replayEvents);
    setRocketName(name);
    setOrbitResult({ achieved: orbitAchieved, time: finalTime });
    setSimState('complete');
    setPage('simulation');
  }, []);

  const latest = telemetry[telemetry.length - 1];
  const isActive = simState === 'running' || simState === 'connecting';

  return (
    <div style={rootStyle}>
      {/* Navigation bar */}
      <nav style={navStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <h1
            style={{ margin: 0, fontSize: '18px', letterSpacing: '3px', fontWeight: 700, cursor: 'pointer' }}
            onClick={() => setPage('launch')}
          >
            TITAN
          </h1>
          <NavBtn active={page === 'launch'} onClick={() => setPage('launch')}>Launch</NavBtn>
          {simState !== 'idle' && (
            <NavBtn active={page === 'simulation'} onClick={() => setPage('simulation')}>
              Simulation {isActive && <span style={{ color: '#44ff44', marginLeft: '4px' }}>LIVE</span>}
            </NavBtn>
          )}
          <NavBtn active={page === 'history'} onClick={() => setPage('history')}>History</NavBtn>
          <NavBtn active={page === 'how-it-works'} onClick={() => setPage('how-it-works')}>How It Works</NavBtn>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {latest && page === 'simulation' && (
            <span style={{ fontFamily: 'monospace', fontSize: '14px', color: isActive ? '#44ff44' : '#888', letterSpacing: '2px' }}>
              T+{formatMissionTime(latest.time)}
            </span>
          )}
          {simState !== 'idle' && page === 'simulation' && (
            <StatusBadge state={simState} />
          )}
        </div>
      </nav>

      {/* Page content */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {page === 'launch' && (
          <HeroSection
            rockets={rockets}
            onLaunch={handleLaunch}
            onReplay={handleReplay}
            onBuildCustom={() => setShowRocketBuilder(true)}
          />
        )}

        {page === 'simulation' && (
          <SimulationPage
            telemetry={telemetry}
            events={events}
            rocketName={rocketName}
            orbitResult={orbitResult}
            simState={simState}
            isActive={isActive}
            lastRequest={lastRequest}
            onNewLaunch={() => { setSimState('idle'); setTelemetry([]); setEvents([]); setOrbitResult(null); setPage('launch'); }}
            onRelaunch={handleLaunch}
          />
        )}

        {page === 'history' && (
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 32px' }}>
            <SimulationHistory onReplay={handleReplay} />
          </div>
        )}

        {page === 'how-it-works' && <HowItWorks />}
      </div>

      {showRocketBuilder && (
        <RocketBuilderModal
          onClose={() => setShowRocketBuilder(false)}
          onLaunch={(request) => {
            setShowRocketBuilder(false);
            handleLaunch(request);
          }}
        />
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}

function NavBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: active ? '#fff' : '#667',
        fontSize: '12px',
        fontWeight: active ? 600 : 400,
        letterSpacing: '1px',
        cursor: 'pointer',
        padding: '4px 0',
        borderBottom: active ? '2px solid #4488ff' : '2px solid transparent',
      }}
    >
      {children}
    </button>
  );
}

function StatusBadge({ state }: { state: SimulationState }) {
  const { bg, dot, label } = statusInfo(state);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '4px 10px', borderRadius: '12px',
      background: bg, fontSize: '11px', fontWeight: 600,
    }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: dot,
        animation: (state === 'running' || state === 'connecting') ? 'pulse 1s infinite' : 'none',
      }} />
      {label}
    </div>
  );
}

const G0 = 9.80665;
const COMP_COLORS = ['#ff6600', '#00cc88', '#cc44ff', '#ffcc00', '#44ccff'];

// Simulation results page — full telemetry + editor + comparisons
function SimulationPage({
  telemetry, events, rocketName, orbitResult, simState, isActive, lastRequest, onNewLaunch, onRelaunch,
}: {
  telemetry: TelemetryPoint[];
  events: StageEvent[];
  rocketName: string;
  orbitResult: { achieved: boolean; time: number } | null;
  simState: SimulationState;
  isActive: boolean;
  lastRequest: SimulationRequest | null;
  onNewLaunch: () => void;
  onRelaunch: (request: SimulationRequest) => void;
}) {
  const latest = telemetry[telemetry.length - 1];
  const [viewMode, setViewMode] = useState<'mcc' | 'classic'>('mcc');
  const [showEditor, setShowEditor] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [editStages, setEditStages] = useState<StageRequest[]>([]);
  const [editTargetAlt, setEditTargetAlt] = useState(200);
  const [savedSims, setSavedSims] = useState<SavedSimulation[]>([]);
  const [comparisons, setComparisons] = useState<{ id: string; name: string; telemetry: TelemetryPoint[]; color: string }[]>([]);
  const [loadingComp, setLoadingComp] = useState<string | null>(null);

  // Initialize editor from last request
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

  // Load saved simulations when compare panel opens
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
    const req: SimulationRequest = {
      ...lastRequest,
      targetAltitude: editTargetAlt * 1000,
    };
    if (editStages.length > 0) {
      req.customStages = editStages;
      req.rocketId = undefined;
    }
    onRelaunch(req);
  };

  const toggleComparison = async (sim: SavedSimulation) => {
    const existing = comparisons.find(c => c.id === sim.id);
    if (existing) {
      setComparisons(prev => prev.filter(c => c.id !== sim.id));
      return;
    }
    if (comparisons.length >= 5) return;
    setLoadingComp(sim.id);
    try {
      const detail = await fetchSimulationById(sim.id);
      const color = COMP_COLORS[comparisons.length % COMP_COLORS.length];
      setComparisons(prev => [...prev, { id: sim.id, name: sim.rocketName, telemetry: detail.telemetry, color }]);
    } catch { /* ignore */ }
    setLoadingComp(null);
  };

  const hasCustomStages = editStages.length > 0;

  // MCC full-screen mode
  if (viewMode === 'mcc') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px', background: '#0a0a14', borderBottom: '1px solid #151520' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {orbitResult && (
              <span style={{
                padding: '2px 8px', borderRadius: '3px', fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
                background: orbitResult.achieved ? 'rgba(34,170,68,0.12)' : 'rgba(255,68,68,0.12)',
                color: orbitResult.achieved ? '#22aa44' : '#ff4444',
                border: `1px solid ${orbitResult.achieved ? 'rgba(34,170,68,0.25)' : 'rgba(255,68,68,0.25)'}`,
              }}>
                {orbitResult.achieved ? 'ORBIT ACHIEVED' : 'ORBIT NOT ACHIEVED'}
              </span>
            )}
            <span style={{ fontSize: '10px', color: '#445' }}>Target: {editTargetAlt} km</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              onClick={() => setViewMode('classic')}
              style={{ ...mccToolBtnStyle, color: '#667' }}
            >
              CLASSIC VIEW
            </button>
            {simState === 'complete' && (
              <>
                <button onClick={() => { setViewMode('classic'); setShowEditor(true); setShowCompare(false); }} style={mccToolBtnStyle}>
                  EDIT
                </button>
                <button onClick={onNewLaunch} style={mccToolBtnStyle}>
                  NEW LAUNCH
                </button>
              </>
            )}
          </div>
        </div>
        {/* Dashboard */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <MissionControlDashboard
            telemetry={telemetry}
            events={events}
            rocketName={rocketName || 'Simulation'}
            isLive={isActive}
            simState={simState}
            targetAltitude={lastRequest?.targetAltitude}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 32px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>{rocketName || 'Simulation'}</h2>
            {orbitResult && (
              <span style={{
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '1px',
                background: orbitResult.achieved ? 'rgba(34,170,68,0.15)' : 'rgba(255,68,68,0.15)',
                color: orbitResult.achieved ? '#22aa44' : '#ff4444',
                border: `1px solid ${orbitResult.achieved ? 'rgba(34,170,68,0.3)' : 'rgba(255,68,68,0.3)'}`,
              }}>
                {orbitResult.achieved ? 'ORBIT ACHIEVED' : 'ORBIT NOT ACHIEVED'}
              </span>
            )}
          </div>
          {latest && (
            <div style={{ fontSize: '12px', color: '#556', marginTop: '4px' }}>
              Target: {editTargetAlt} km circular &middot; Mission time: {formatMissionTime(latest.time)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setViewMode('mcc')}
            style={{ ...actionBtnStyle, background: 'rgba(0,255,136,0.08)', color: '#00ff88', borderColor: 'rgba(0,255,136,0.25)' }}
          >
            MCC View
          </button>
          {simState === 'complete' && (
            <>
              <button
                onClick={() => { setShowEditor(e => !e); setShowCompare(false); }}
                style={{ ...actionBtnStyle, background: showEditor ? 'rgba(255,170,0,0.15)' : 'rgba(68,136,255,0.1)', color: showEditor ? '#ffaa00' : '#4488ff', borderColor: showEditor ? 'rgba(255,170,0,0.3)' : 'rgba(68,136,255,0.3)' }}
              >
                {showEditor ? 'Hide Editor' : 'Edit & Relaunch'}
              </button>
              <button
                onClick={() => { setShowCompare(c => !c); setShowEditor(false); }}
                style={{ ...actionBtnStyle, background: showCompare ? 'rgba(170,68,255,0.15)' : 'rgba(68,136,255,0.1)', color: showCompare ? '#aa44ff' : '#4488ff', borderColor: showCompare ? 'rgba(170,68,255,0.3)' : 'rgba(68,136,255,0.3)' }}
              >
                {showCompare ? 'Hide Compare' : `Compare${comparisons.length > 0 ? ` (${comparisons.length})` : ''}`}
              </button>
              <button onClick={onNewLaunch} style={actionBtnStyle}>New Launch</button>
            </>
          )}
        </div>
      </div>

      {/* Inline Rocket Editor */}
      {showEditor && lastRequest && (
        <div style={{
          marginBottom: '16px', padding: '16px',
          background: '#0a0a16', borderRadius: '10px', border: '1px solid #1a1a2e',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: '#ffaa00', letterSpacing: '2px', fontWeight: 700 }}>
              ROCKET PARAMETERS
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '9px', color: '#556', letterSpacing: '1px' }}>TARGET ORBIT </span>
                <input
                  type="number"
                  value={editTargetAlt}
                  onChange={e => setEditTargetAlt(Number(e.target.value))}
                  style={{ ...editorInputStyle, width: '60px' }}
                />
                <span style={{ fontSize: '10px', color: '#445', marginLeft: '2px' }}>km</span>
              </div>
              <button onClick={handleRelaunch} style={relaunchBtnStyle}>
                RE-LAUNCH
              </button>
            </div>
          </div>

          {hasCustomStages ? (
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
              {editStages.map((stage, i) => (
                <div key={i} style={{
                  flex: '1 0 180px', padding: '10px',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid #151520', borderRadius: '8px',
                }}>
                  <div style={{ fontSize: '10px', color: '#4488ff', letterSpacing: '1.5px', fontWeight: 600, marginBottom: '6px' }}>
                    STAGE {i + 1}
                  </div>
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
            <div style={{ fontSize: '12px', color: '#556', padding: '8px 0' }}>
              This is a preset rocket. To edit parameters, first launch a custom rocket from the Rocket Builder, then modify it here.
              <br />
              <span style={{ fontSize: '11px', color: '#445' }}>
                You can still change the target orbit and re-launch with different altitude.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Comparison Picker */}
      {showCompare && (
        <div style={{
          marginBottom: '16px', padding: '16px',
          background: '#0a0a16', borderRadius: '10px', border: '1px solid #1a1a2e',
        }}>
          <div style={{ fontSize: '11px', color: '#aa44ff', letterSpacing: '2px', fontWeight: 700, marginBottom: '10px' }}>
            COMPARE WITH PAST SIMULATIONS
          </div>
          {comparisons.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
              {comparisons.map(c => (
                <span key={c.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600,
                  background: `${c.color}15`, color: c.color, border: `1px solid ${c.color}40`,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color }} />
                  {c.name}
                  <button
                    onClick={() => setComparisons(prev => prev.filter(x => x.id !== c.id))}
                    style={{ background: 'none', border: 'none', color: c.color, cursor: 'pointer', padding: '0 2px', fontSize: '10px' }}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          )}
          {savedSims.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#445' }}>No saved simulations found.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
              {savedSims.map(sim => {
                const isSelected = comparisons.some(c => c.id === sim.id);
                const isLoading = loadingComp === sim.id;
                return (
                  <button
                    key={sim.id}
                    onClick={() => toggleComparison(sim)}
                    disabled={isLoading || (!isSelected && comparisons.length >= 5)}
                    style={{
                      padding: '8px 10px',
                      background: isSelected ? 'rgba(170,68,255,0.08)' : 'rgba(255,255,255,0.02)',
                      border: isSelected ? '1px solid rgba(170,68,255,0.4)' : '1px solid #151520',
                      borderRadius: '6px',
                      cursor: isLoading ? 'wait' : 'pointer',
                      textAlign: 'left',
                      color: '#fff',
                      opacity: (!isSelected && comparisons.length >= 5) ? 0.4 : 1,
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>{sim.rocketName}</div>
                    <div style={{ fontSize: '10px', color: '#556', marginTop: '2px' }}>
                      {sim.orbitAchieved ? 'Orbit' : 'No orbit'} &middot; Alt {(sim.maxAltitude / 1000).toFixed(0)} km &middot; {(sim.maxVelocity).toFixed(0)} m/s
                    </div>
                    {isLoading && <div style={{ fontSize: '9px', color: '#aa44ff', marginTop: '2px' }}>Loading...</div>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Summary cards */}
      {latest && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '10px',
          marginBottom: '20px',
        }}>
          <SummaryCard label="ALTITUDE" value={`${(latest.altitude / 1000).toFixed(1)} km`} color="#4488ff" />
          <SummaryCard label="VELOCITY" value={`${latest.velocity.toFixed(0)} m/s`} color="#ff4488" />
          <SummaryCard label="APOAPSIS" value={`${(latest.apoapsis / 1000).toFixed(1)} km`} color="#44cc66" />
          <SummaryCard label="PERIAPSIS" value={`${(latest.periapsis / 1000).toFixed(1)} km`} color="#ff8844" />
          <SummaryCard label="ECCENTRICITY" value={latest.eccentricity.toFixed(5)} color="#aa44ff" />
          <SummaryCard label="INCLINATION" value={`${(latest.inclination * 180 / Math.PI).toFixed(2)}°`} color="#ff88aa" />
        </div>
      )}

      {/* Two-column: Telemetry + Advisor */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TelemetryDashboard
            telemetry={telemetry}
            events={events}
            isLive={isActive}
            comparisons={comparisons.length > 0 ? comparisons : undefined}
          />
        </div>
        {latest && simState === 'complete' && (
          <div style={{ width: '320px', flexShrink: 0 }}>
            <OrbitAdvisor
              telemetry={telemetry}
              stages={lastRequest?.customStages || editStages}
              targetAltKm={editTargetAlt}
              orbitAchieved={orbitResult?.achieved || false}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function EditorField({ label, value, onChange, step }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
      <label style={{ fontSize: '9px', color: '#445', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{label}</label>
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

// --- Orbit Advisor ---
interface Tip {
  type: 'ok' | 'warn' | 'bad';
  text: string;
}

interface StageIssue {
  stage: number;
  param: string;
  value: string;
  issue: string;
  type: 'warn' | 'bad';
}

function analyzeOrbit(
  telemetry: TelemetryPoint[],
  stages: StageRequest[],
  targetAltKm: number,
  orbitAchieved: boolean,
): { tips: Tip[]; stageIssues: StageIssue[] } {
  const tips: Tip[] = [];
  const stageIssues: StageIssue[] = [];
  const last = telemetry[telemetry.length - 1];
  if (!last) return { tips, stageIssues };

  const targetAltM = targetAltKm * 1000;
  const EARTH_R = 6_371_000;
  const MU = 3.986e14;
  const orbitalV = Math.sqrt(MU / (EARTH_R + targetAltM));
  const maxAlt = Math.max(...telemetry.map(t => t.altitude));
  const maxVel = Math.max(...telemetry.map(t => t.velocity));
  const finalApoKm = last.apoapsis / 1000;
  const finalPeriKm = last.periapsis / 1000;
  const finalEcc = last.eccentricity;

  // --- Overall tips ---
  if (orbitAchieved) {
    tips.push({ type: 'ok', text: `Circular orbit achieved at ~${targetAltKm} km. Excellent!` });
    if (finalEcc < 0.005) {
      tips.push({ type: 'ok', text: `Very low eccentricity (${finalEcc.toFixed(4)}). Near-perfect circular orbit.` });
    }
  } else {
    tips.push({ type: 'bad', text: 'Orbit not achieved. See the issues below to adjust your rocket.' });
  }

  // Apoapsis check
  if (finalApoKm < targetAltKm * 0.9) {
    tips.push({ type: 'bad', text: `Apoapsis (${finalApoKm.toFixed(0)} km) far below target (${targetAltKm} km). Need more delta-V during ascent.` });
  } else if (finalApoKm < targetAltKm) {
    tips.push({ type: 'warn', text: `Apoapsis (${finalApoKm.toFixed(0)} km) almost at target. A small increase in fuel or Isp should fix it.` });
  } else if (finalApoKm > targetAltKm * 1.5) {
    tips.push({ type: 'warn', text: `Apoapsis (${finalApoKm.toFixed(0)} km) well above target. Consider reducing thrust or fuel in the upper stage.` });
  }

  // Periapsis check
  if (finalPeriKm < 0) {
    tips.push({ type: 'bad', text: `Negative periapsis (${finalPeriKm.toFixed(0)} km). The rocket would fall back to Earth. Need more horizontal velocity to circularize.` });
  } else if (finalPeriKm < 120) {
    tips.push({ type: 'bad', text: `Periapsis (${finalPeriKm.toFixed(0)} km) inside the atmosphere. Orbit would decay rapidly. Need more circularization burn.` });
  } else if (finalPeriKm < targetAltKm * 0.8 && !orbitAchieved) {
    tips.push({ type: 'warn', text: `Periapsis (${finalPeriKm.toFixed(0)} km) far from target. More horizontal thrust in the final stage would help.` });
  }

  // Eccentricity check
  if (finalEcc > 0.5) {
    tips.push({ type: 'bad', text: `Very high eccentricity (${finalEcc.toFixed(3)}). Extremely elliptical orbit. Need much more circularization burn.` });
  } else if (finalEcc > 0.1) {
    tips.push({ type: 'warn', text: `Eccentricity (${finalEcc.toFixed(3)}) > 0.1. Elliptical orbit. Increase Isp or fuel in the last stage for better circularization.` });
  } else if (finalEcc > 0.02 && !orbitAchieved) {
    tips.push({ type: 'warn', text: `Eccentricity (${finalEcc.toFixed(4)}) > 0.02. Nearly circular. A small adjustment in the final stage should fix it.` });
  }

  // Velocity check
  if (maxVel < orbitalV * 0.7) {
    tips.push({ type: 'bad', text: `Max velocity (${maxVel.toFixed(0)} m/s) far below orbital velocity (${orbitalV.toFixed(0)} m/s). Need significantly more total delta-V.` });
  } else if (maxVel < orbitalV * 0.95 && !orbitAchieved) {
    tips.push({ type: 'warn', text: `Velocity (${maxVel.toFixed(0)} m/s) close to orbital (${orbitalV.toFixed(0)} m/s). Increase Isp or fuel.` });
  }

  // Altitude check
  if (maxAlt / 1000 < targetAltKm * 0.5) {
    tips.push({ type: 'bad', text: `Max altitude (${(maxAlt / 1000).toFixed(0)} km) very low. Stage 1 TWR may be insufficient or not enough fuel.` });
  }

  // General LEO delta-V tip
  if (!orbitAchieved && stages.length === 0) {
    tips.push({ type: 'warn', text: `LEO at ${targetAltKm} km requires ~9,400 m/s of total delta-V (including gravity and drag losses).` });
  }

  // --- Per-stage analysis ---
  if (stages.length > 0) {
    let totalDV = 0;
    let massAbove = 0;

    // Compute from top stage down
    const stageStats: { twr: number; deltaV: number; burnTime: number; isp: number }[] = [];
    const reversed = [...stages].reverse();
    const tempStats: typeof stageStats = [];

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
    totalDV = stats.reduce((sum, s) => sum + s.deltaV, 0);

    // Total delta-V tip
    if (totalDV < 7800) {
      tips.push({ type: 'bad', text: `Total delta-V: ${totalDV.toFixed(0)} m/s. Need at least ~9,400 m/s for LEO. Missing ~${(9400 - totalDV).toFixed(0)} m/s.` });
    } else if (totalDV < 9400) {
      tips.push({ type: 'warn', text: `Total delta-V: ${totalDV.toFixed(0)} m/s. Low margin (target ~9,400 m/s with losses). Missing ~${(9400 - totalDV).toFixed(0)} m/s.` });
    } else {
      tips.push({ type: 'ok', text: `Total delta-V: ${totalDV.toFixed(0)} m/s. Sufficient for LEO (${(totalDV - 9400).toFixed(0)} m/s margin).` });
    }

    // Per-stage checks
    stats.forEach((st, i) => {
      const s = stages[i];
      const stageNum = i + 1;

      // TWR
      if (i === 0 && st.twr < 1.0) {
        stageIssues.push({ stage: stageNum, param: 'TWR', value: st.twr.toFixed(2), issue: 'TWR < 1.0 — rocket cannot lift off! Increase thrust or reduce mass.', type: 'bad' });
      } else if (i === 0 && st.twr < 1.3) {
        stageIssues.push({ stage: stageNum, param: 'TWR', value: st.twr.toFixed(2), issue: 'Low TWR. High gravity losses. Ideal > 1.3 for 1st stage.', type: 'warn' });
      } else if (i === 0 && st.twr > 4.0) {
        stageIssues.push({ stage: stageNum, param: 'TWR', value: st.twr.toFixed(2), issue: 'Very high TWR. Excessive drag losses. Consider reducing thrust.', type: 'warn' });
      }

      // Delta-V per stage
      if (i === 0 && st.deltaV < 2500) {
        stageIssues.push({ stage: stageNum, param: 'Delta-V', value: `${st.deltaV.toFixed(0)} m/s`, issue: 'Low delta-V for 1st stage. Ideal > 3,000 m/s. Increase fuel or Isp.', type: 'warn' });
      }
      if (i === stages.length - 1 && st.deltaV < 3000 && !orbitAchieved) {
        stageIssues.push({ stage: stageNum, param: 'Delta-V', value: `${st.deltaV.toFixed(0)} m/s`, issue: 'Insufficient delta-V in final stage to circularize. Increase fuel or Isp.', type: 'bad' });
      }

      // Isp
      if (st.isp < 250) {
        stageIssues.push({ stage: stageNum, param: 'Isp', value: `${st.isp.toFixed(0)} s`, issue: 'Very low Isp. Typical engines have Isp > 280s (sea level) or > 340s (vacuum).', type: 'warn' });
      }

      // Burn time
      if (st.burnTime < 10) {
        stageIssues.push({ stage: stageNum, param: 'Burn time', value: `${st.burnTime.toFixed(0)} s`, issue: 'Very short burn. May waste delta-V. Reduce burn rate or increase fuel.', type: 'warn' });
      }
      if (st.burnTime > 600 && i === 0) {
        stageIssues.push({ stage: stageNum, param: 'Burn time', value: `${st.burnTime.toFixed(0)} s`, issue: 'Very long 1st stage burn. High gravity losses. Increase burn rate.', type: 'warn' });
      }

      // Drag
      if (i === 0 && s.dragCoefficient > 0.5) {
        stageIssues.push({ stage: stageNum, param: 'Cd', value: s.dragCoefficient.toFixed(2), issue: 'High drag coefficient. Ideal < 0.4 to reduce aerodynamic losses.', type: 'warn' });
      }

      // Mass ratio
      const massRatio = s.fuelMass / (s.dryMass + s.fuelMass);
      if (massRatio < 0.6) {
        stageIssues.push({ stage: stageNum, param: 'Mass fraction', value: `${(massRatio * 100).toFixed(0)}%`, issue: `Low fuel fraction (${(massRatio * 100).toFixed(0)}%). Ideal > 80%. Reduce dry mass or increase fuel.`, type: 'warn' });
      }
    });
  }

  return { tips, stageIssues };
}

function OrbitAdvisor({ telemetry, stages, targetAltKm, orbitAchieved }: {
  telemetry: TelemetryPoint[];
  stages: StageRequest[];
  targetAltKm: number;
  orbitAchieved: boolean;
}) {
  const { tips, stageIssues } = analyzeOrbit(telemetry, stages, targetAltKm, orbitAchieved);

  const tipIcon = (type: Tip['type']) => {
    switch (type) {
      case 'ok': return { symbol: '\u2713', color: '#22aa44', bg: 'rgba(34,170,68,0.1)' };
      case 'warn': return { symbol: '!', color: '#ffaa00', bg: 'rgba(255,170,0,0.1)' };
      case 'bad': return { symbol: '\u2717', color: '#ff4444', bg: 'rgba(255,68,68,0.1)' };
    }
  };

  // Group stage issues by stage
  const stageGroups = new Map<number, StageIssue[]>();
  stageIssues.forEach(issue => {
    const list = stageGroups.get(issue.stage) || [];
    list.push(issue);
    stageGroups.set(issue.stage, list);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'sticky', top: '60px' }}>
      {/* Tips panel */}
      <div style={advisorBoxStyle}>
        <div style={{ fontSize: '10px', color: '#4488ff', letterSpacing: '2px', fontWeight: 700, marginBottom: '10px' }}>
          DICAS PARA ORBITA
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {tips.map((tip, i) => {
            const icon = tipIcon(tip.type);
            return (
              <div key={i} style={{
                display: 'flex', gap: '8px', alignItems: 'flex-start',
                padding: '6px 8px', borderRadius: '6px', background: icon.bg,
              }}>
                <span style={{
                  width: '16px', height: '16px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 700, color: icon.color, flexShrink: 0,
                  border: `1px solid ${icon.color}40`,
                }}>
                  {icon.symbol}
                </span>
                <span style={{ fontSize: '11px', color: '#bbc', lineHeight: 1.4 }}>{tip.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-stage issues */}
      {stageIssues.length > 0 && (
        <div style={advisorBoxStyle}>
          <div style={{ fontSize: '10px', color: '#ff8844', letterSpacing: '2px', fontWeight: 700, marginBottom: '10px' }}>
            PROBLEMAS POR ESTAGIO
          </div>
          {[...stageGroups.entries()].map(([stageNum, issues]) => (
            <div key={stageNum} style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', color: '#4488ff', fontWeight: 600, letterSpacing: '1px', marginBottom: '4px' }}>
                ESTAGIO {stageNum}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <thead>
                  <tr>
                    <th style={advisorThStyle}>Param</th>
                    <th style={advisorThStyle}>Valor</th>
                    <th style={advisorThStyle}>Problema</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue, j) => (
                    <tr key={j}>
                      <td style={{ ...advisorTdStyle, color: '#aab', fontWeight: 600, whiteSpace: 'nowrap' }}>{issue.param}</td>
                      <td style={{
                        ...advisorTdStyle,
                        fontFamily: 'monospace',
                        color: issue.type === 'bad' ? '#ff4444' : '#ffaa00',
                        whiteSpace: 'nowrap',
                      }}>
                        {issue.value}
                      </td>
                      <td style={{ ...advisorTdStyle, color: '#889', lineHeight: 1.3 }}>{issue.issue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Quick reference */}
      <div style={advisorBoxStyle}>
        <div style={{ fontSize: '10px', color: '#556', letterSpacing: '2px', fontWeight: 700, marginBottom: '8px' }}>
          REFERENCIA RAPIDA
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
          <tbody>
            {[
              ['Vel. orbital LEO', `~${Math.round(Math.sqrt(3.986e14 / (6.371e6 + targetAltKm * 1000)))} m/s`],
              ['Delta-V p/ LEO', '~9.400 m/s'],
              ['TWR ideal (1o est)', '1.3 — 2.0'],
              ['TWR ideal (vacuo)', '0.5 — 1.5'],
              ['Isp quimico tipico', '280 — 380 s'],
              ['Periapsis minimo', '> 120 km'],
              ['Excentricidade alvo', '< 0.02'],
              ['Fracao massa ideal', '> 80%'],
            ].map(([label, val], i) => (
              <tr key={i}>
                <td style={{ padding: '2px 4px', color: '#667', borderBottom: '1px solid #12121e' }}>{label}</td>
                <td style={{ padding: '2px 4px', color: '#aab', fontFamily: 'monospace', borderBottom: '1px solid #12121e', textAlign: 'right' }}>{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '12px 14px',
      background: '#0a0a16',
      borderRadius: '8px',
      border: '1px solid #151520',
    }}>
      <div style={{ fontSize: '9px', color: '#556', letterSpacing: '1px', marginBottom: '4px', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '18px', fontFamily: 'monospace', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function formatMissionTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function statusInfo(state: SimulationState) {
  switch (state) {
    case 'connecting': return { bg: 'rgba(255,170,0,0.15)', dot: '#ffaa00', label: 'CONNECTING' };
    case 'running': return { bg: 'rgba(68,255,68,0.1)', dot: '#44ff44', label: 'LIVE' };
    case 'complete': return { bg: 'rgba(68,136,255,0.1)', dot: '#4488ff', label: 'COMPLETE' };
    case 'failed': return { bg: 'rgba(255,68,68,0.1)', dot: '#ff4444', label: 'FAILED' };
    default: return { bg: 'rgba(136,136,136,0.1)', dot: '#888', label: 'IDLE' };
  }
}

const rootStyle: React.CSSProperties = {
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  background: '#0a0a14',
  color: '#fff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif',
  overflow: 'hidden',
};

const navStyle: React.CSSProperties = {
  padding: '10px 24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: '1px solid #151520',
  background: '#0a0a14',
  position: 'sticky',
  top: 0,
  zIndex: 50,
};

const actionBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: 'rgba(68,136,255,0.1)',
  border: '1px solid rgba(68,136,255,0.3)',
  borderRadius: '6px',
  color: '#4488ff',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '1px',
};

const editorInputStyle: React.CSSProperties = {
  width: '70px',
  padding: '3px 6px',
  background: '#0c0c18',
  border: '1px solid #151520',
  borderRadius: '4px',
  color: '#ccc',
  fontSize: '11px',
  textAlign: 'right',
};

const relaunchBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: 'linear-gradient(135deg, #ff3333, #cc2200)',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 700,
  fontSize: '12px',
  cursor: 'pointer',
  letterSpacing: '2px',
  boxShadow: '0 2px 10px rgba(255,50,50,0.3)',
};

const mccToolBtnStyle: React.CSSProperties = {
  padding: '4px 12px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid #1a1a2e',
  borderRadius: '3px',
  color: '#4488ff',
  cursor: 'pointer',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '1.5px',
};

const advisorBoxStyle: React.CSSProperties = {
  background: '#0a0a16',
  borderRadius: '8px',
  padding: '12px 14px',
  border: '1px solid #151520',
};

const advisorThStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '3px 4px',
  borderBottom: '1px solid #1a1a2e',
  color: '#445',
  fontSize: '9px',
  letterSpacing: '0.5px',
  fontWeight: 600,
};

const advisorTdStyle: React.CSSProperties = {
  padding: '4px',
  borderBottom: '1px solid #0d0d1a',
  verticalAlign: 'top',
};
