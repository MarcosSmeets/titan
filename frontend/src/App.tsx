import { useState, useEffect, useCallback, useRef } from 'react';
import TrajectoryViewer from './components/TrajectoryViewer';
import TelemetryDashboard from './components/TelemetryDashboard';
import HeroSection from './components/HeroSection';
import RocketBuilderModal from './components/RocketBuilder';
import { fetchRockets } from './services/api';
import { runStreamingSimulation } from './services/signalr';
import type {
  RocketPreset,
  TelemetryPoint,
  SimulationRequest,
  SimulationState,
  StageEvent,
} from './types';

export default function App() {
  const [rockets, setRockets] = useState<RocketPreset[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [simState, setSimState] = useState<SimulationState>('idle');
  const [events, setEvents] = useState<StageEvent[]>([]);
  const [rocketName, setRocketName] = useState('');
  const [orbitResult, setOrbitResult] = useState<{ achieved: boolean; time: number } | null>(null);
  const [showTelemetry, setShowTelemetry] = useState(true);
  const [showRocketBuilder, setShowRocketBuilder] = useState(false);
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
  }, []);

  const latest = telemetry[telemetry.length - 1];
  const isActive = simState === 'running' || simState === 'connecting';

  if (simState === 'idle') {
    return (
      <div style={rootStyle}>
        <HeroSection
          rockets={rockets}
          onLaunch={handleLaunch}
          onReplay={handleReplay}
          onBuildCustom={() => setShowRocketBuilder(true)}
        />
        {showRocketBuilder && (
          <RocketBuilderModal
            onClose={() => setShowRocketBuilder(false)}
            onLaunch={(request) => {
              setShowRocketBuilder(false);
              handleLaunch(request);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ ...rootStyle, height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* Full-bleed 3D viewer */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <TrajectoryViewer
          telemetry={telemetry}
          targetAltitude={200000}
          stageEvents={events.map(e => ({ time: e.time, index: e.newStage }))}
          isLive={isActive}
        />
      </div>

      {/* Top bar overlay */}
      <header style={headerOverlayStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ margin: 0, fontSize: '18px', letterSpacing: '3px', fontWeight: 700 }}>
            TITAN
          </h1>
          {rocketName && (
            <span style={{ color: '#4488ff', fontSize: '14px' }}>
              {rocketName}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {latest && (
            <div style={{
              fontFamily: 'monospace',
              fontSize: '18px',
              color: isActive ? '#44ff44' : '#888',
              letterSpacing: '2px',
            }}>
              T+{formatMissionTime(latest.time)}
            </div>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '12px',
            background: statusColor(simState).bg,
            fontSize: '12px',
            fontWeight: 600,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: statusColor(simState).dot,
              animation: isActive ? 'pulse 1s infinite' : 'none',
            }} />
            {statusLabel(simState)}
          </div>

          {simState === 'complete' && (
            <button
              onClick={() => { setSimState('idle'); setTelemetry([]); setEvents([]); setOrbitResult(null); }}
              style={{
                padding: '6px 16px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '12px',
                backdropFilter: 'blur(8px)',
              }}
            >
              New Launch
            </button>
          )}
        </div>
      </header>

      {/* Orbit result banner */}
      {orbitResult && (
        <div style={{
          position: 'absolute',
          top: '56px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 24px',
          background: orbitResult.achieved
            ? 'rgba(34,170,68,0.2)'
            : 'rgba(255,68,68,0.2)',
          backdropFilter: 'blur(12px)',
          borderRadius: '8px',
          border: orbitResult.achieved
            ? '1px solid rgba(34,170,68,0.3)'
            : '1px solid rgba(255,68,68,0.3)',
          textAlign: 'center',
          fontSize: '14px',
          fontWeight: 700,
          letterSpacing: '2px',
          zIndex: 10,
        }}>
          {orbitResult.achieved
            ? `ORBIT ACHIEVED at T+${formatMissionTime(orbitResult.time)}`
            : 'ORBIT NOT ACHIEVED'}
        </div>
      )}

      {/* Telemetry overlay panel — top right */}
      {showTelemetry && latest && (
        <div style={telemetryPanelStyle}>
          <TelemetryDashboard
            telemetry={telemetry}
            events={events}
            isLive={isActive}
            compact
          />
        </div>
      )}

      {/* Toggle telemetry button */}
      <button
        onClick={() => setShowTelemetry(v => !v)}
        style={{
          position: 'absolute',
          top: '60px',
          right: '16px',
          padding: '4px 10px',
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '4px',
          color: '#888',
          cursor: 'pointer',
          fontSize: '10px',
          letterSpacing: '1px',
          zIndex: 20,
          backdropFilter: 'blur(8px)',
        }}
      >
        {showTelemetry ? 'HIDE' : 'SHOW'} TELEMETRY
      </button>

      {/* Live data badges — bottom left */}
      {latest && (
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          display: 'flex',
          gap: '8px',
          zIndex: 10,
          pointerEvents: 'none',
        }}>
          <OverlayBadge label="ALT" value={`${(latest.altitude / 1000).toFixed(1)} km`} />
          <OverlayBadge label="VEL" value={`${latest.velocity.toFixed(0)} m/s`} />
          <OverlayBadge label="APO" value={`${(latest.apoapsis / 1000).toFixed(1)} km`} />
          <OverlayBadge label="PERI" value={`${(latest.periapsis / 1000).toFixed(1)} km`} />
          <OverlayBadge label="ECC" value={latest.eccentricity.toFixed(4)} />
        </div>
      )}

      {/* Events log — bottom right */}
      {events.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px',
          padding: '8px 12px',
          zIndex: 10,
          maxWidth: '240px',
        }}>
          <div style={{ fontSize: '9px', color: '#556', letterSpacing: '1.5px', marginBottom: '6px', fontWeight: 600 }}>
            EVENTS
          </div>
          {events.slice(-5).map((e, i) => (
            <div key={i} style={{
              display: 'flex',
              gap: '8px',
              fontSize: '11px',
              padding: '2px 0',
            }}>
              <span style={{ color: '#ffaa00', fontFamily: 'monospace', fontSize: '10px' }}>
                T+{formatMissionTime(e.time)}
              </span>
              <span style={{ color: '#ccc' }}>{e.description}</span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

function OverlayBadge({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(8px)',
      padding: '6px 10px',
      borderRadius: '6px',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ fontSize: '9px', color: '#888', letterSpacing: '1px' }}>{label}</div>
      <div style={{ fontSize: '14px', fontFamily: 'monospace', color: '#fff' }}>{value}</div>
    </div>
  );
}

function formatMissionTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function statusColor(state: SimulationState) {
  switch (state) {
    case 'connecting': return { bg: 'rgba(255,170,0,0.15)', dot: '#ffaa00' };
    case 'running': return { bg: 'rgba(68,255,68,0.1)', dot: '#44ff44' };
    case 'complete': return { bg: 'rgba(68,136,255,0.1)', dot: '#4488ff' };
    case 'failed': return { bg: 'rgba(255,68,68,0.1)', dot: '#ff4444' };
    default: return { bg: 'rgba(136,136,136,0.1)', dot: '#888' };
  }
}

function statusLabel(state: SimulationState): string {
  switch (state) {
    case 'connecting': return 'CONNECTING';
    case 'running': return 'LIVE';
    case 'complete': return 'COMPLETE';
    case 'failed': return 'FAILED';
    default: return 'IDLE';
  }
}

const rootStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0a0a14',
  color: '#fff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif',
};

const headerOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  padding: '10px 20px',
  background: 'rgba(10,10,20,0.7)',
  backdropFilter: 'blur(12px)',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: '52px',
  zIndex: 20,
};

const telemetryPanelStyle: React.CSSProperties = {
  position: 'absolute',
  top: '80px',
  right: '16px',
  width: '320px',
  maxHeight: 'calc(100vh - 160px)',
  overflowY: 'auto',
  background: 'rgba(10,10,20,0.65)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  padding: '12px',
  zIndex: 15,
};
