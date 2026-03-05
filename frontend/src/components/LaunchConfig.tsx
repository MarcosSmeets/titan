import { useState } from 'react';
import type { RocketPreset, SimulationRequest } from '../types';

interface LaunchConfigProps {
  rockets: RocketPreset[];
  onLaunch: (request: SimulationRequest) => void;
  isRunning: boolean;
}

export default function LaunchConfig({ rockets, onLaunch, isRunning }: LaunchConfigProps) {
  const [rocketId, setRocketId] = useState<string>(rockets[0]?.id || '');
  const [targetAltitude, setTargetAltitude] = useState(200);  // km
  const [maxG, setMaxG] = useState(4.0);
  const [integratorType, setIntegratorType] = useState(2); // RK45
  const [isCustom, setIsCustom] = useState(false);

  // Custom stage params
  const [customDryMass, setCustomDryMass] = useState(10000);
  const [customFuelMass, setCustomFuelMass] = useState(150000);
  const [customBurnRate, setCustomBurnRate] = useState(2500);
  const [customExhaustVel, setCustomExhaustVel] = useState(3000);

  const handleLaunch = () => {
    const request: SimulationRequest = {
      targetAltitude: targetAltitude * 1000, // km to m
      maxG,
      dt: 0.05,
      duration: 900,
      integratorType,
      guidanceType: 0,
    };

    if (isCustom) {
      request.customStages = [{
        dryMass: customDryMass,
        fuelMass: customFuelMass,
        burnRate: customBurnRate,
        exhaustVelocity: customExhaustVel,
        referenceArea: 10,
        dragCoefficient: 0.5,
      }];
    } else {
      request.rocketId = rocketId;
    }

    onLaunch(request);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '16px',
      background: '#1a1a2e',
      borderRadius: '8px',
    }}>
      <h2 style={{ margin: 0, color: '#fff', fontSize: '16px' }}>
        Launch Configuration
      </h2>

      {/* Rocket/Custom toggle */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setIsCustom(false)}
          style={tabStyle(!isCustom)}
        >
          Preset Rocket
        </button>
        <button
          onClick={() => setIsCustom(true)}
          style={tabStyle(isCustom)}
        >
          Custom
        </button>
      </div>

      {!isCustom ? (
        <select
          value={rocketId}
          onChange={e => setRocketId(e.target.value)}
          style={inputStyle}
        >
          {rockets.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <InputField label="Dry Mass (kg)" value={customDryMass} onChange={setCustomDryMass} />
          <InputField label="Fuel Mass (kg)" value={customFuelMass} onChange={setCustomFuelMass} />
          <InputField label="Burn Rate (kg/s)" value={customBurnRate} onChange={setCustomBurnRate} />
          <InputField label="Exhaust Vel (m/s)" value={customExhaustVel} onChange={setCustomExhaustVel} />
        </div>
      )}

      {/* Target Orbit */}
      <InputField label="Target Altitude (km)" value={targetAltitude} onChange={setTargetAltitude} />

      {/* Max G */}
      <InputField label="Max G-Load" value={maxG} onChange={setMaxG} />

      {/* Integrator */}
      <div>
        <label style={labelStyle}>Integrator</label>
        <select
          value={integratorType}
          onChange={e => setIntegratorType(Number(e.target.value))}
          style={inputStyle}
        >
          <option value={0}>RK4 (Fixed Step)</option>
          <option value={1}>Euler (Fixed Step)</option>
          <option value={2}>RK45 Dormand-Prince (Adaptive)</option>
        </select>
      </div>

      {/* Launch Button */}
      <button
        onClick={handleLaunch}
        disabled={isRunning}
        style={{
          padding: '12px',
          background: isRunning ? '#555' : '#ff4444',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 'bold',
          fontSize: '16px',
          cursor: isRunning ? 'not-allowed' : 'pointer',
          letterSpacing: '2px',
        }}
      >
        {isRunning ? 'SIMULATING...' : 'LAUNCH'}
      </button>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={inputStyle}
      />
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  color: '#888',
  marginBottom: '4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px',
  background: '#16213e',
  border: '1px solid #333',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '13px',
  boxSizing: 'border-box',
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '8px',
    background: active ? '#4488ff' : '#16213e',
    border: 'none',
    borderRadius: '4px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
  };
}
