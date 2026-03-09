import { useState, useMemo } from 'react';
import { saveCustomRocket } from '../services/api';
import type { SimulationRequest, StageRequest } from '../types';

const G0 = 9.80665;

interface StageConfig {
  dryMass: number;
  fuelMass: number;
  thrustKN: number;
  isp: number;
  burnRate: number;
  cd: number;
  refArea: number;
}

const defaultStage: StageConfig = {
  dryMass: 5000,
  fuelMass: 20000,
  thrustKN: 500,
  isp: 300,
  burnRate: 170,
  cd: 0.3,
  refArea: 10,
};

interface RocketBuilderProps {
  onClose: () => void;
  onLaunch: (request: SimulationRequest) => void;
}

export default function RocketBuilderModal({ onClose, onLaunch }: RocketBuilderProps) {
  const [name, setName] = useState('Custom Rocket');
  const [stageCount, setStageCount] = useState(2);
  const [stages, setStages] = useState<StageConfig[]>([
    { ...defaultStage },
    { dryMass: 2000, fuelMass: 8000, thrustKN: 100, isp: 350, burnRate: 30, cd: 0.2, refArea: 8 },
    { dryMass: 1000, fuelMass: 3000, thrustKN: 50, isp: 380, burnRate: 15, cd: 0.15, refArea: 5 },
  ]);
  const [targetAlt, setTargetAlt] = useState(200);

  const activeStages = stages.slice(0, stageCount);

  const updateStage = (idx: number, field: keyof StageConfig, value: number) => {
    const newStages = [...stages];
    newStages[idx] = { ...newStages[idx], [field]: value };
    setStages(newStages);
  };

  const stats = useMemo(() => {
    const result: { twr: number; deltaV: number }[] = [];
    let totalMassAbove = 0;

    // Calculate from top stage down, then reverse
    const reversedStages = [...activeStages].reverse();
    const tempResults: { twr: number; deltaV: number }[] = [];

    for (const s of reversedStages) {
      const wetMass = s.dryMass + s.fuelMass + totalMassAbove;
      const dryMass = s.dryMass + totalMassAbove;
      const exhaustVelocity = s.isp * G0;
      const deltaV = exhaustVelocity * Math.log(wetMass / dryMass);
      const twr = (s.thrustKN * 1000) / (wetMass * G0);
      tempResults.push({ twr, deltaV });
      totalMassAbove += s.dryMass + s.fuelMass;
    }

    return tempResults.reverse();
  }, [activeStages]);

  const totalDeltaV = stats.reduce((sum, s) => sum + s.deltaV, 0);

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCustomRocket(name, activeStages.map((s, i) => ({
        stageIndex: i,
        dryMass: s.dryMass,
        fuelMass: s.fuelMass,
        burnRate: s.burnRate,
        exhaustVelocity: s.isp * G0,
        isp: s.isp,
        referenceArea: s.refArea,
        dragCoefficient: s.cd,
      })));
      alert('Rocket saved!');
    } catch {
      alert('Failed to save rocket');
    } finally {
      setSaving(false);
    }
  };

  const handleLaunch = () => {
    const customStages: StageRequest[] = activeStages.map(s => ({
      dryMass: s.dryMass,
      fuelMass: s.fuelMass,
      burnRate: s.burnRate,
      exhaustVelocity: s.isp * G0,
      referenceArea: s.refArea,
      dragCoefficient: s.cd,
    }));

    // Also save to database
    saveCustomRocket(name, activeStages.map((s, i) => ({
      stageIndex: i,
      dryMass: s.dryMass,
      fuelMass: s.fuelMass,
      burnRate: s.burnRate,
      exhaustVelocity: s.isp * G0,
      isp: s.isp,
      referenceArea: s.refArea,
      dragCoefficient: s.cd,
    }))).catch(() => {});

    onLaunch({
      targetAltitude: targetAlt * 1000,
      maxG: 4.0,
      dt: 0.05,
      duration: 900,
      integratorType: 2,
      guidanceType: 0,
      timeWarp: 50,
      customStages,
    });
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', letterSpacing: '2px', fontWeight: 700 }}>
            ROCKET BUILDER
          </h2>
          <button onClick={onClose} style={closeBtnStyle}>X</button>
        </div>

        {/* Rocket name */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Rocket Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>

        {/* Stage count */}
        <div style={{ marginBottom: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div>
            <label style={labelStyle}>Stages</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => setStageCount(n)}
                  style={{
                    padding: '6px 14px',
                    background: stageCount === n ? 'rgba(68,136,255,0.15)' : 'rgba(255,255,255,0.03)',
                    border: stageCount === n ? '1px solid #4488ff' : '1px solid #1a1a2e',
                    borderRadius: '4px',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Target Orbit</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="number"
                value={targetAlt}
                onChange={e => setTargetAlt(Number(e.target.value))}
                style={{ ...inputStyle, width: '80px' }}
              />
              <span style={{ color: '#556', fontSize: '12px' }}>km</span>
            </div>
          </div>
        </div>

        {/* Stage configs */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          {activeStages.map((stage, i) => (
            <div key={i} style={stageCardStyle}>
              <div style={{ fontSize: '11px', color: '#4488ff', letterSpacing: '1.5px', fontWeight: 600, marginBottom: '8px' }}>
                STAGE {i + 1}
              </div>
              <StageField label="Dry Mass (kg)" value={stage.dryMass} onChange={v => updateStage(i, 'dryMass', v)} />
              <StageField label="Fuel Mass (kg)" value={stage.fuelMass} onChange={v => updateStage(i, 'fuelMass', v)} />
              <StageField label="Thrust (kN)" value={stage.thrustKN} onChange={v => updateStage(i, 'thrustKN', v)} />
              <StageField label="Isp (s)" value={stage.isp} onChange={v => updateStage(i, 'isp', v)} />
              <StageField label="Burn Rate (kg/s)" value={stage.burnRate} onChange={v => updateStage(i, 'burnRate', v)} />
              <StageField label="Cd" value={stage.cd} onChange={v => updateStage(i, 'cd', v)} step={0.05} />
              <StageField label="Ref Area (m2)" value={stage.refArea} onChange={v => updateStage(i, 'refArea', v)} />

              {/* Stats */}
              {stats[i] && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #1a1a2e' }}>
                  <div style={{ fontSize: '10px', color: '#556' }}>
                    TWR: <span style={{ color: stats[i].twr >= 1 ? '#22aa44' : '#ff4444', fontWeight: 600 }}>
                      {stats[i].twr.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#556' }}>
                    Delta-V: <span style={{ color: '#aab', fontWeight: 600 }}>
                      {stats[i].deltaV.toFixed(0)} m/s
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Total stats */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '8px',
          border: '1px solid #1a1a2e',
          marginBottom: '16px',
        }}>
          <div>
            <span style={{ fontSize: '11px', color: '#556', letterSpacing: '1px' }}>TOTAL DELTA-V: </span>
            <span style={{
              fontSize: '18px',
              fontFamily: 'monospace',
              fontWeight: 700,
              color: totalDeltaV >= 9400 ? '#22aa44' : totalDeltaV >= 7800 ? '#ffaa00' : '#ff4444',
            }}>
              {totalDeltaV.toFixed(0)} m/s
            </span>
            <span style={{ fontSize: '10px', color: '#445', marginLeft: '8px' }}>
              (LEO ~9,400 m/s)
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1,
              padding: '14px',
              background: 'rgba(68,136,255,0.1)',
              color: '#4488ff',
              border: '1px solid rgba(68,136,255,0.3)',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              letterSpacing: '2px',
            }}
          >
            {saving ? 'SAVING...' : 'SAVE ROCKET'}
          </button>
          <button
            onClick={handleLaunch}
            style={{
              flex: 2,
              padding: '14px',
              background: 'linear-gradient(135deg, #ff3333, #cc2200)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '16px',
              cursor: 'pointer',
              letterSpacing: '3px',
              boxShadow: '0 4px 20px rgba(255,50,50,0.3)',
            }}
          >
            LAUNCH
          </button>
        </div>
      </div>
    </div>
  );
}

function StageField({ label, value, onChange, step }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div style={{ marginBottom: '6px' }}>
      <label style={{ fontSize: '9px', color: '#445', letterSpacing: '0.5px' }}>{label}</label>
      <input
        type="number"
        value={value}
        step={step}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          padding: '4px 6px',
          background: '#0c0c18',
          border: '1px solid #151520',
          borderRadius: '4px',
          color: '#ccc',
          fontSize: '12px',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  backdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
};

const modalStyle: React.CSSProperties = {
  background: '#0f0f1a',
  border: '1px solid #1a1a2e',
  borderRadius: '16px',
  padding: '24px',
  maxWidth: '720px',
  width: '90vw',
  maxHeight: '90vh',
  overflowY: 'auto',
  color: '#fff',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #333',
  borderRadius: '4px',
  color: '#666',
  cursor: 'pointer',
  padding: '4px 10px',
  fontSize: '12px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  color: '#556',
  letterSpacing: '1px',
  marginBottom: '4px',
};

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  background: '#0c0c18',
  border: '1px solid #1a1a2e',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '14px',
  boxSizing: 'border-box',
};

const stageCardStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px',
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid #1a1a2e',
  borderRadius: '8px',
};
