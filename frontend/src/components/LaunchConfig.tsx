import { useState } from 'react';
import type { RocketPreset, SimulationRequest } from '../types';

interface LaunchConfigProps {
  rockets: RocketPreset[];
  onLaunch: (request: SimulationRequest) => void;
  isRunning: boolean;
}

export default function LaunchConfig({ rockets, onLaunch, isRunning }: LaunchConfigProps) {
  const [rocketId, setRocketId] = useState<string>(rockets[0]?.id || '');
  const [targetAltitude, setTargetAltitude] = useState(200);
  const [maxG, setMaxG] = useState(4.0);
  const [integratorType, setIntegratorType] = useState(2);

  const handleLaunch = () => {
    onLaunch({
      rocketId,
      targetAltitude: targetAltitude * 1000,
      maxG,
      dt: 0.05,
      duration: 900,
      integratorType,
      guidanceType: 0,
      timeWarp: 50,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={sectionLabel}>MISSION CONFIG</div>

      {/* Rocket select */}
      <div>
        <label style={labelStyle}>Rocket</label>
        <select
          value={rocketId}
          onChange={e => setRocketId(e.target.value)}
          style={inputStyle}
          disabled={isRunning}
        >
          {rockets.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {/* Target orbit */}
      <div>
        <label style={labelStyle}>Target Orbit (km)</label>
        <input
          type="number"
          value={targetAltitude}
          onChange={e => setTargetAltitude(Number(e.target.value))}
          style={inputStyle}
          disabled={isRunning}
        />
      </div>

      {/* Max G */}
      <div>
        <label style={labelStyle}>Max G-Load</label>
        <input
          type="number"
          value={maxG}
          onChange={e => setMaxG(Number(e.target.value))}
          step="0.5"
          style={inputStyle}
          disabled={isRunning}
        />
      </div>

      {/* Integrator */}
      <div>
        <label style={labelStyle}>Integrator</label>
        <select
          value={integratorType}
          onChange={e => setIntegratorType(Number(e.target.value))}
          style={inputStyle}
          disabled={isRunning}
        >
          <option value={0}>RK4 (Fixed Step)</option>
          <option value={1}>Euler (Fixed Step)</option>
          <option value={2}>RK45 (Adaptive)</option>
        </select>
      </div>

      {/* Launch */}
      <button
        onClick={handleLaunch}
        disabled={isRunning}
        style={{
          marginTop: '8px',
          padding: '14px',
          background: isRunning
            ? 'linear-gradient(135deg, #333, #222)'
            : 'linear-gradient(135deg, #ff3333, #cc2200)',
          color: isRunning ? '#666' : '#fff',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 700,
          fontSize: '14px',
          cursor: isRunning ? 'not-allowed' : 'pointer',
          letterSpacing: '3px',
          boxShadow: isRunning ? 'none' : '0 4px 16px rgba(255,50,50,0.25)',
        }}
      >
        {isRunning ? 'SIMULATING...' : 'LAUNCH'}
      </button>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: '10px',
  color: '#445',
  letterSpacing: '2px',
  fontWeight: 600,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  color: '#556',
  letterSpacing: '0.5px',
  marginBottom: '4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: '#0c0c18',
  border: '1px solid #1a1a2e',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '13px',
  boxSizing: 'border-box',
};
