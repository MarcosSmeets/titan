import { useState, useEffect } from 'react';
import { fetchSimulations, fetchSimulationById, deleteSimulation } from '../services/api';
import type { SavedSimulation, SavedSimulationDetail, TelemetryPoint, StageEvent } from '../types';

interface SimulationHistoryProps {
  onReplay: (telemetry: TelemetryPoint[], events: StageEvent[], rocketName: string, orbitAchieved: boolean, finalTime: number) => void;
}

export default function SimulationHistory({ onReplay }: SimulationHistoryProps) {
  const [simulations, setSimulations] = useState<SavedSimulation[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchSimulations()
      .then(setSimulations)
      .catch(() => setSimulations([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleReplay = async (id: string) => {
    setLoadingId(id);
    try {
      const detail = await fetchSimulationById(id);
      const events: StageEvent[] = (detail.events || []).map((e: any) => ({
        time: e.time,
        previousStage: e.previousStage,
        newStage: e.newStage,
        description: e.description,
      }));
      onReplay(detail.telemetry, events, detail.rocketName, detail.orbitAchieved, detail.finalTime);
    } catch {
      // ignore
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteSimulation(id);
    load();
  };

  if (simulations.length === 0 && !loading) return null;

  return (
    <div style={{
      width: '100%',
      maxWidth: '800px',
      marginTop: '24px',
    }}>
      <div style={{
        fontSize: '11px',
        color: '#556',
        letterSpacing: '2px',
        marginBottom: '12px',
        textAlign: 'center',
      }}>
        PAST LAUNCHES
      </div>

      {loading && (
        <div style={{ textAlign: 'center', color: '#445', fontSize: '12px' }}>Loading...</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {simulations.map(sim => (
          <div
            key={sim.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid #1a1a2e',
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: sim.orbitAchieved ? '#22aa44' : '#ff4444',
              }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{sim.rocketName}</div>
                <div style={{ fontSize: '10px', color: '#556' }}>
                  {new Date(sim.createdAt).toLocaleString()} &middot; {(sim.targetAltitude / 1000).toFixed(0)} km target
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{
                fontSize: '11px',
                color: sim.orbitAchieved ? '#22aa44' : '#ff4444',
                fontWeight: 600,
              }}>
                {sim.orbitAchieved ? 'ORBIT' : 'FAIL'}
              </span>
              <span style={{ fontSize: '11px', color: '#667', fontFamily: 'monospace' }}>
                {Math.floor(sim.finalTime / 60)}:{String(Math.floor(sim.finalTime % 60)).padStart(2, '0')}
              </span>
              <button
                onClick={() => handleReplay(sim.id)}
                disabled={loadingId === sim.id}
                style={{
                  padding: '4px 12px',
                  background: 'rgba(68,136,255,0.1)',
                  border: '1px solid rgba(68,136,255,0.3)',
                  borderRadius: '4px',
                  color: '#4488ff',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                {loadingId === sim.id ? '...' : 'REPLAY'}
              </button>
              <button
                onClick={() => handleDelete(sim.id)}
                style={{
                  padding: '4px 8px',
                  background: 'none',
                  border: '1px solid rgba(255,68,68,0.2)',
                  borderRadius: '4px',
                  color: '#ff4444',
                  cursor: 'pointer',
                  fontSize: '10px',
                }}
              >
                DEL
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
