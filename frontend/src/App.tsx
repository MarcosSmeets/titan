import { useState, useEffect, useCallback, useRef } from 'react';
import TelemetryDashboard from './components/TelemetryDashboard';
import HeroSection from './components/HeroSection';
import RocketBuilderModal from './components/RocketBuilder';
import SimulationHistory from './components/SimulationHistory';
import HowItWorks from './components/HowItWorks';
import { fetchRockets } from './services/api';
import { runStreamingSimulation } from './services/signalr';
import type {
  RocketPreset,
  TelemetryPoint,
  SimulationRequest,
  SimulationState,
  StageEvent,
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
            onNewLaunch={() => { setSimState('idle'); setTelemetry([]); setEvents([]); setOrbitResult(null); setPage('launch'); }}
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

// Simulation results page — full telemetry
function SimulationPage({
  telemetry, events, rocketName, orbitResult, simState, isActive, onNewLaunch,
}: {
  telemetry: TelemetryPoint[];
  events: StageEvent[];
  rocketName: string;
  orbitResult: { achieved: boolean; time: number } | null;
  simState: SimulationState;
  isActive: boolean;
  onNewLaunch: () => void;
}) {
  const latest = telemetry[telemetry.length - 1];

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
              Target: 200 km circular &middot; Mission time: {formatMissionTime(latest.time)}
            </div>
          )}
        </div>
        {simState === 'complete' && (
          <button onClick={onNewLaunch} style={actionBtnStyle}>New Launch</button>
        )}
      </div>

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

      {/* Full telemetry dashboard */}
      <TelemetryDashboard
        telemetry={telemetry}
        events={events}
        isLive={isActive}
      />
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
