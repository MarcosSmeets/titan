import { useState, useEffect } from 'react';
import { fetchCustomRockets, deleteCustomRocket } from '../services/api';
import type { RocketPreset, SimulationRequest, TelemetryPoint, StageEvent, CustomRocket } from '../types';

interface HeroSectionProps {
  rockets: RocketPreset[];
  onLaunch: (request: SimulationRequest) => void;
  onReplay: (telemetry: TelemetryPoint[], events: StageEvent[], rocketName: string, orbitAchieved: boolean, finalTime: number) => void;
  onBuildCustom: () => void;
}

export default function HeroSection({ rockets, onLaunch, onReplay, onBuildCustom }: HeroSectionProps) {
  const [selectedRocket, setSelectedRocket] = useState<string>('');
  const [targetAlt, setTargetAlt] = useState(200);
  const [customRockets, setCustomRockets] = useState<CustomRocket[]>([]);
  const [selectedCustom, setSelectedCustom] = useState<string>('');

  useEffect(() => {
    fetchCustomRockets().then(setCustomRockets).catch(() => {});
  }, []);

  const handleDeleteCustom = async (id: string) => {
    await deleteCustomRocket(id);
    setCustomRockets(prev => prev.filter(r => r.id !== id));
    if (selectedCustom === id) setSelectedCustom('');
  };

  const G0 = 9.80665;

  const handleLaunch = () => {
    // Custom rocket launch
    if (selectedCustom) {
      const custom = customRockets.find(r => r.id === selectedCustom);
      if (!custom) return;
      onLaunch({
        targetAltitude: targetAlt * 1000,
        maxG: 4.0,
        dt: 0.05,
        duration: 900,
        integratorType: 2,
        guidanceType: 0,
        timeWarp: 50,
        customStages: custom.stages.map(s => ({
          dryMass: s.dryMass,
          fuelMass: s.fuelMass,
          burnRate: s.burnRate,
          exhaustVelocity: s.exhaustVelocity || s.isp * G0,
          referenceArea: s.referenceArea,
          dragCoefficient: s.dragCoefficient,
        })),
      });
      return;
    }
    if (!selectedRocket) return;
    onLaunch({
      rocketId: selectedRocket,
      targetAltitude: targetAlt * 1000,
      maxG: 4.0,
      dt: 0.05,
      duration: 900,
      integratorType: 2,
      guidanceType: 0,
      timeWarp: 50,
    });
  };

  const selected = rockets.find(r => r.id === selectedRocket);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'radial-gradient(ellipse at 50% 120%, #0a1628 0%, #0a0a14 60%)',
    }}>
      {/* Top bar */}
      <header style={{
        padding: '16px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h1 style={{ margin: 0, fontSize: '20px', letterSpacing: '4px', fontWeight: 700 }}>
          TITAN
        </h1>
        <span style={{ fontSize: '12px', color: '#555' }}>
          Aerospace Physics Engine v1.0
        </span>
      </header>

      {/* Hero content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 32px',
        gap: '40px',
      }}>
        {/* Title */}
        <div style={{ textAlign: 'center', maxWidth: '700px' }}>
          <h2 style={{
            fontSize: '48px',
            fontWeight: 300,
            margin: '0 0 16px',
            letterSpacing: '1px',
            lineHeight: 1.1,
          }}>
            Simulate orbital launches
            <br />
            <span style={{ color: '#4488ff', fontWeight: 600 }}>in real time</span>
          </h2>
          <p style={{
            fontSize: '16px',
            color: '#778',
            lineHeight: 1.6,
            margin: 0,
          }}>
            Titan is a high-fidelity aerospace physics engine that simulates rocket launches
            from liftoff to orbit insertion. Powered by a C++ numerical core with
            Runge-Kutta integration, full 3D orbital mechanics, and real atmospheric models.
          </p>
        </div>

        {/* Rocket selection */}
        <div style={{
          width: '100%',
          maxWidth: '800px',
        }}>
          <div style={{
            fontSize: '11px',
            color: '#556',
            letterSpacing: '2px',
            marginBottom: '12px',
            textAlign: 'center',
          }}>
            SELECT A ROCKET
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '8px',
          }}>
            {rockets.map(rocket => (
              <button
                key={rocket.id}
                onClick={() => { setSelectedRocket(rocket.id); setSelectedCustom(''); }}
                style={{
                  padding: '14px 10px',
                  border: selectedRocket === rocket.id
                    ? '1px solid #4488ff'
                    : '1px solid #1a1a2e',
                  borderRadius: '8px',
                  background: selectedRocket === rocket.id
                    ? 'rgba(68,136,255,0.08)'
                    : 'rgba(255,255,255,0.02)',
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  {rocket.name}
                </div>
                <div style={{ fontSize: '10px', color: '#667' }}>
                  {rocket.manufacturer}
                </div>
                <div style={{ fontSize: '11px', color: '#4488ff', marginTop: '6px' }}>
                  {(rocket.payloadToLEO / 1000).toFixed(1)}t to LEO
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Launch controls */}
        {(selectedRocket || selectedCustom) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            padding: '20px 32px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '12px',
            border: '1px solid #1a1a2e',
          }}>
            <div>
              <label style={labelStyle}>Target Orbit</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="number"
                  value={targetAlt}
                  onChange={e => setTargetAlt(Number(e.target.value))}
                  style={inputStyle}
                />
                <span style={{ color: '#667', fontSize: '13px' }}>km</span>
              </div>
            </div>

            <button
              onClick={handleLaunch}
              style={{
                padding: '14px 40px',
                background: 'linear-gradient(135deg, #ff3333, #cc2200)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '16px',
                cursor: 'pointer',
                letterSpacing: '3px',
                transition: 'transform 0.1s',
                boxShadow: '0 4px 20px rgba(255,50,50,0.3)',
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              LAUNCH
            </button>
          </div>
        )}

        {/* Selected rocket details */}
        {selected && (
          <div style={{
            display: 'flex',
            gap: '32px',
            fontSize: '12px',
            color: '#556',
          }}>
            <Stat label="Height" value={`${selected.height} m`} />
            <Stat label="Launch Mass" value={`${(selected.launchMass / 1000).toFixed(0)} t`} />
            <Stat label="Stages" value={`${selected.stageCount}`} />
            {selected.costPerLaunch && (
              <Stat label="Cost/Launch" value={`$${selected.costPerLaunch}M`} />
            )}
          </div>
        )}

        {/* Build custom rocket button */}
        <button
          onClick={onBuildCustom}
          style={{
            padding: '10px 24px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid #1a1a2e',
            borderRadius: '8px',
            color: '#667',
            cursor: 'pointer',
            fontSize: '12px',
            letterSpacing: '1.5px',
            transition: 'all 0.15s',
          }}
        >
          BUILD CUSTOM ROCKET
        </button>

        {/* Saved custom rockets */}
        {customRockets.length > 0 && (
          <div style={{ width: '100%', maxWidth: '800px', marginTop: '8px' }}>
            <div style={{ fontSize: '11px', color: '#556', letterSpacing: '2px', marginBottom: '12px', textAlign: 'center' }}>
              YOUR CUSTOM ROCKETS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
              {customRockets.map(cr => (
                <div
                  key={cr.id}
                  onClick={() => { setSelectedCustom(cr.id); setSelectedRocket(''); }}
                  style={{
                    padding: '12px 10px',
                    border: selectedCustom === cr.id ? '1px solid #ffaa00' : '1px solid #1a1a2e',
                    borderRadius: '8px',
                    background: selectedCustom === cr.id ? 'rgba(255,170,0,0.08)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    position: 'relative',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{cr.name}</div>
                  <div style={{ fontSize: '10px', color: '#667' }}>{cr.stageCount} stage{cr.stageCount !== 1 ? 's' : ''}</div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteCustom(cr.id); }}
                    style={{
                      position: 'absolute', top: '4px', right: '4px',
                      background: 'none', border: 'none', color: '#553', cursor: 'pointer', fontSize: '10px',
                    }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom features */}
      <div style={{
        padding: '24px 32px',
        display: 'flex',
        justifyContent: 'center',
        gap: '48px',
        borderTop: '1px solid #111',
      }}>
        <Feature icon="3D" text="Full 3D orbital mechanics with classical elements" />
        <Feature icon="RK" text="Adaptive Dormand-Prince RK45 integration" />
        <Feature icon="RT" text="Real-time telemetry streaming via WebSocket" />
        <Feature icon="ATM" text="Exponential atmosphere with drag modeling" />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: '#445', fontSize: '10px', letterSpacing: '1px' }}>{label}</div>
      <div style={{ color: '#aab', fontSize: '14px', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#556' }}>
      <div style={{
        width: '28px', height: '28px',
        borderRadius: '6px',
        background: 'rgba(68,136,255,0.08)',
        border: '1px solid #1a2a4e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '9px', fontWeight: 700, color: '#4488ff', letterSpacing: '0.5px',
      }}>
        {icon}
      </div>
      {text}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  color: '#556',
  letterSpacing: '1px',
  marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  width: '80px',
  padding: '10px 12px',
  background: '#0f0f1a',
  border: '1px solid #1a1a2e',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '14px',
};
