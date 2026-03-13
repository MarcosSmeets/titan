import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { runStreamingSimulation } from '../services/signalr';
import type {
  TelemetryPoint,
  SimulationRequest,
  SimulationState,
  StageEvent,
} from '../types';

interface SimulationContextType {
  telemetry: TelemetryPoint[];
  simState: SimulationState;
  events: StageEvent[];
  rocketName: string;
  orbitResult: { achieved: boolean; time: number } | null;
  lastRequest: SimulationRequest | null;
  isActive: boolean;
  handleLaunch: (request: SimulationRequest) => Promise<void>;
  handleReplay: (
    replayTelemetry: TelemetryPoint[],
    replayEvents: StageEvent[],
    name: string,
    orbitAchieved: boolean,
    finalTime: number
  ) => void;
  reset: () => void;
}

const SimulationContext = createContext<SimulationContextType | null>(null);

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [simState, setSimState] = useState<SimulationState>('idle');
  const [events, setEvents] = useState<StageEvent[]>([]);
  const [rocketName, setRocketName] = useState('');
  const [orbitResult, setOrbitResult] = useState<{ achieved: boolean; time: number } | null>(null);
  const [lastRequest, setLastRequest] = useState<SimulationRequest | null>(null);
  const telemetryRef = useRef<TelemetryPoint[]>([]);
  const eventsRef = useRef<StageEvent[]>([]);

  const isActive = simState === 'running' || simState === 'connecting';

  const handleLaunch = useCallback(async (request: SimulationRequest) => {
    setSimState('connecting');
    setTelemetry([]);
    setEvents([]);
    setOrbitResult(null);
    setLastRequest(request);
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

  const reset = useCallback(() => {
    setSimState('idle');
    setTelemetry([]);
    setEvents([]);
    setOrbitResult(null);
  }, []);

  return (
    <SimulationContext.Provider value={{
      telemetry, simState, events, rocketName, orbitResult, lastRequest,
      isActive, handleLaunch, handleReplay, reset,
    }}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulationContext(): SimulationContextType {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useSimulationContext must be used within SimulationProvider');
  return ctx;
}
