import SimulationHistory from '../components/SimulationHistory';
import { useSimulationContext } from '../context/SimulationContext';
import { useNavigate } from 'react-router-dom';
import type { TelemetryPoint, StageEvent } from '../types';

export default function HistoryPage() {
  const { handleReplay } = useSimulationContext();
  const navigate = useNavigate();

  const onReplay = (
    telemetry: TelemetryPoint[],
    events: StageEvent[],
    name: string,
    orbitAchieved: boolean,
    finalTime: number
  ) => {
    handleReplay(telemetry, events, name, orbitAchieved, finalTime);
    navigate('/simulation');
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 32px' }}>
      <SimulationHistory onReplay={onReplay} />
    </div>
  );
}
