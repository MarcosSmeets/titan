import { useState, useEffect } from 'react';
import { fetchSimulations, fetchSimulationById, deleteSimulation } from '../services/api';
import type { SavedSimulation, TelemetryPoint, StageEvent } from '../types';

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

  const successCount = simulations.filter(s => s.orbitAchieved).length;
  const failCount = simulations.filter(s => !s.orbitAchieved).length;
  const successRate = simulations.length > 0 ? ((successCount / simulations.length) * 100).toFixed(1) : '0';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, letterSpacing: '1px' }}>
          Launch History
        </h2>
        <button onClick={load} style={refreshBtnStyle}>Refresh</button>
      </div>

      {/* Stats row */}
      {simulations.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px',
          marginBottom: '20px',
        }}>
          <StatCard label="TOTAL LAUNCHES" value={String(simulations.length)} color="#4488ff" />
          <StatCard label="ORBITS ACHIEVED" value={String(successCount)} color="#22aa44" />
          <StatCard label="FAILED" value={String(failCount)} color="#ff4444" />
          <StatCard label="SUCCESS RATE" value={`${successRate}%`} color={parseFloat(successRate) >= 50 ? '#22aa44' : '#ff8844'} />
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', color: '#445', fontSize: '12px', padding: '20px' }}>Loading...</div>
      )}

      {!loading && simulations.length === 0 && (
        <div style={{ textAlign: 'center', color: '#445', fontSize: '13px', padding: '40px' }}>
          No past launches yet. Run a simulation to see results here.
        </div>
      )}

      {/* Simulation list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {simulations.map(sim => (
          <div
            key={sim.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '8px 1fr auto',
              gap: '14px',
              alignItems: 'center',
              padding: '12px 16px',
              background: '#0a0a16',
              border: '1px solid #151520',
              borderRadius: '8px',
            }}
          >
            {/* Status dot */}
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: sim.orbitAchieved ? '#22aa44' : '#ff4444',
            }} />

            {/* Info */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>{sim.rocketName}</span>
                <span style={{
                  fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px',
                  color: sim.orbitAchieved ? '#22aa44' : '#ff4444',
                }}>
                  {sim.orbitAchieved ? 'ORBIT' : 'FAIL'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#667', flexWrap: 'wrap' }}>
                <span>Target: {(sim.targetAltitude / 1000).toFixed(0)} km</span>
                <span>Time: {fmtTime(sim.finalTime)}</span>
                <span>Max Alt: {(sim.maxAltitude / 1000).toFixed(1)} km</span>
                <span>Max Vel: {sim.maxVelocity.toFixed(0)} m/s</span>
                <span>Ecc: {sim.finalEccentricity.toFixed(4)}</span>
                <span>{new Date(sim.createdAt).toLocaleString()}</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleReplay(sim.id)}
                disabled={loadingId === sim.id}
                style={{
                  padding: '5px 14px',
                  background: 'rgba(68,136,255,0.1)',
                  border: '1px solid rgba(68,136,255,0.3)',
                  borderRadius: '4px',
                  color: '#4488ff',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                {loadingId === sim.id ? '...' : 'VIEW'}
              </button>
              <button
                onClick={() => handleDelete(sim.id)}
                style={{
                  padding: '5px 8px',
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

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '12px 14px',
      background: '#0a0a16',
      borderRadius: '8px',
      border: '1px solid #151520',
    }}>
      <div style={{ fontSize: '9px', color: '#556', letterSpacing: '1px', marginBottom: '4px', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '22px', fontFamily: 'monospace', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const refreshBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid #1a1a2e',
  borderRadius: '6px',
  color: '#667',
  cursor: 'pointer',
  fontSize: '11px',
};
