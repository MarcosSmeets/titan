import { useState, useEffect, useCallback } from 'react';
import TrajectoryViewer from './components/TrajectoryViewer';
import TelemetryDashboard from './components/TelemetryDashboard';
import RocketComparison from './components/RocketComparison';
import LaunchConfig from './components/LaunchConfig';
import { fetchRockets, runSimulation } from './services/api';
import type {
  RocketPreset,
  TelemetryPoint,
  SimulationRequest,
  SimulationState,
} from './types';

type Tab = 'launch' | 'compare';

export default function App() {
  const [rockets, setRockets] = useState<RocketPreset[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [simState, setSimState] = useState<SimulationState>('idle');
  const [activeTab, setActiveTab] = useState<Tab>('launch');
  const [events, setEvents] = useState<{ time: number; type: string; description: string }[]>([]);
  const [overlays, setOverlays] = useState<{ name: string; data: TelemetryPoint[]; color: string }[]>([]);
  const [orbitAchieved, setOrbitAchieved] = useState<boolean | null>(null);

  useEffect(() => {
    fetchRockets()
      .then(setRockets)
      .catch(() => {
        // Fallback: use static presets if API isn't running
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
    setSimState('running');
    setTelemetry([]);
    setEvents([]);
    setOrbitAchieved(null);

    try {
      const result = await runSimulation(request);
      setTelemetry(result.telemetry);
      setOrbitAchieved(result.orbitAchieved);

      // Extract stage events
      const stageEvents: typeof events = [];
      let lastStage = 0;
      for (const point of result.telemetry) {
        if (point.stageIndex !== lastStage) {
          stageEvents.push({
            time: point.time,
            type: 'Stage Separation',
            description: `Stage ${lastStage + 1} separated`,
          });
          lastStage = point.stageIndex;
        }
      }
      if (result.orbitAchieved) {
        stageEvents.push({
          time: result.finalTime,
          type: 'Orbit Achieved',
          description: 'Stable orbit reached',
        });
      }
      setEvents(stageEvents);
      setSimState('complete');
    } catch (e) {
      console.error('Simulation failed:', e);
      setSimState('error');
    }
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0f23',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Header */}
      <header style={{
        padding: '12px 24px',
        background: '#16213e',
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h1 style={{ margin: 0, fontSize: '20px', letterSpacing: '4px' }}>
          TITAN
          <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>
            Aerospace Simulation Engine
          </span>
        </h1>
        <div style={{ display: 'flex', gap: '4px' }}>
          <TabButton
            active={activeTab === 'launch'}
            onClick={() => setActiveTab('launch')}
          >
            Launch
          </TabButton>
          <TabButton
            active={activeTab === 'compare'}
            onClick={() => setActiveTab('compare')}
          >
            Compare
          </TabButton>
        </div>
      </header>

      {/* Status Banner */}
      {orbitAchieved !== null && (
        <div style={{
          padding: '8px 24px',
          background: orbitAchieved ? '#1a4a2e' : '#4a1a1a',
          textAlign: 'center',
          fontSize: '14px',
          fontWeight: 'bold',
        }}>
          {orbitAchieved
            ? 'ORBIT ACHIEVED - Stable orbit established'
            : 'ORBIT NOT ACHIEVED - Simulation ended without stable orbit'}
        </div>
      )}

      {/* Main Content */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: activeTab === 'launch' ? '300px 1fr 400px' : '1fr',
        gap: '16px',
        padding: '16px',
        height: 'calc(100vh - 60px)',
        overflow: 'hidden',
      }}>
        {activeTab === 'launch' ? (
          <>
            {/* Left: Config */}
            <div style={{ overflow: 'auto' }}>
              <LaunchConfig
                rockets={rockets}
                onLaunch={handleLaunch}
                isRunning={simState === 'running'}
              />
            </div>

            {/* Center: 3D Viewer */}
            <div style={{
              background: '#111',
              borderRadius: '8px',
              overflow: 'hidden',
            }}>
              <TrajectoryViewer
                telemetry={telemetry}
                targetAltitude={200000}
              />
            </div>

            {/* Right: Telemetry */}
            <div style={{ overflow: 'auto' }}>
              <TelemetryDashboard
                telemetry={telemetry}
                events={events}
              />
            </div>
          </>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <RocketComparison
              rockets={rockets}
              onOverlayChange={setOverlays}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 16px',
        background: active ? '#4488ff' : 'transparent',
        color: active ? '#fff' : '#888',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: active ? 'bold' : 'normal',
      }}
    >
      {children}
    </button>
  );
}
