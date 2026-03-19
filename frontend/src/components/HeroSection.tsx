import { useState, useEffect } from 'react';
import { fetchCustomRockets, deleteCustomRocket } from '../services/api';
import type { RocketPreset, SimulationRequest, TelemetryPoint, StageEvent, CustomRocket } from '../types';

interface HeroSectionProps {
  rockets: RocketPreset[];
  onLaunch: (request: SimulationRequest) => void;
  onReplay: (telemetry: TelemetryPoint[], events: StageEvent[], rocketName: string, orbitAchieved: boolean, finalTime: number) => void;
  onBuildCustom?: () => void;
}

export default function HeroSection({ rockets, onLaunch, onReplay, onBuildCustom }: HeroSectionProps) {
  const [selectedRocket, setSelectedRocket] = useState<string>('');
  const [targetAlt, setTargetAlt] = useState(200);
  const [customRockets, setCustomRockets] = useState<CustomRocket[]>([]);
  const [selectedCustom, setSelectedCustom] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pointingMode, setPointingMode] = useState(2); // nadir default

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
        rocketName: custom.name,
        targetAltitude: targetAlt * 1000,
        maxG: 4.0,
        dt: 0.05,
        duration: 900,
        integratorType: 2,
        guidanceType: 0,
        timeWarp: 50,
        pointingMode,
        enable6DOF: true,
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
      duration: Math.max(900, Math.min(7200, targetAlt * 3)),
      integratorType: 2,
      guidanceType: 0,
      timeWarp: 50,
      pointingMode,
      enable6DOF: true,
    });
  };

  const selected = rockets.find(r => r.id === selectedRocket);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'radial-gradient(ellipse at 50% 120%, #0a1628 0%, var(--bg-1) 60%)',
    }}>
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
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>in real time</span>
          </h2>
          <p style={{
            fontSize: '16px',
            color: 'var(--text-2)',
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
            color: 'var(--text-2)',
            letterSpacing: '2px',
            marginBottom: '12px',
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
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
                    ? '1px solid var(--accent)'
                    : '1px solid var(--border)',
                  borderRadius: '8px',
                  background: selectedRocket === rocket.id
                    ? 'var(--glow-accent)'
                    : 'rgba(255,255,255,0.02)',
                  color: 'var(--text-0)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  {rocket.name}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-2)' }}>
                  {rocket.manufacturer}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
                  {(rocket.payloadToLEO / 1000).toFixed(1)}t to LEO
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Launch controls */}
        {(selectedRocket || selectedCustom) && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              padding: '20px 32px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '12px',
              border: '1px solid var(--border)',
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
                  <span style={{ color: 'var(--text-2)', fontSize: '13px' }}>km</span>
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

              <button
                onClick={() => setShowAdvanced(a => !a)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: showAdvanced ? 'var(--amber)' : 'var(--text-2)',
                  cursor: 'pointer',
                  fontSize: '10px',
                  letterSpacing: '1.5px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {showAdvanced ? 'HIDE ADVANCED' : 'ADVANCED'}
              </button>
            </div>

            {showAdvanced && (
              <div style={{
                width: '100%',
                maxWidth: '800px',
                padding: '16px 24px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                display: 'flex',
                gap: '24px',
                alignItems: 'center',
              }}>
                <div>
                  <label style={labelStyle}>Pointing Mode</label>
                  <select
                    value={pointingMode}
                    onChange={e => setPointingMode(Number(e.target.value))}
                    style={{
                      ...inputStyle,
                      width: '160px',
                      appearance: 'auto' as const,
                    }}
                  >
                    <option value={2}>Nadir (Earth-facing)</option>
                    <option value={1}>Inertial Hold</option>
                    <option value={3}>Sun Pointing</option>
                    <option value={0}>None (free drift)</option>
                  </select>
                </div>
              </div>
            )}
          </>
        )}

        {/* Selected rocket details */}
        {selected && (
          <div style={{
            display: 'flex',
            gap: '32px',
            fontSize: '12px',
            color: 'var(--text-2)',
          }}>
            <Stat label="Height" value={`${selected.height} m`} />
            <Stat label="Launch Mass" value={`${(selected.launchMass / 1000).toFixed(0)} t`} />
            <Stat label="Stages" value={`${selected.stageCount}`} />
            {selected.costPerLaunch && (
              <Stat label="Cost/Launch" value={`$${selected.costPerLaunch}M`} />
            )}
          </div>
        )}

        {/* Build custom rocket button — only shown for admin users */}
        {onBuildCustom && (
          <button
            onClick={onBuildCustom}
            style={{
              padding: '10px 24px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-2)',
              cursor: 'pointer',
              fontSize: '12px',
              letterSpacing: '1.5px',
              fontFamily: 'var(--font-mono)',
              transition: 'all 0.15s',
            }}
          >
            BUILD CUSTOM ROCKET
          </button>
        )}

        {/* Saved custom rockets */}
        {customRockets.length > 0 && (
          <div style={{ width: '100%', maxWidth: '800px', marginTop: '8px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-2)', letterSpacing: '2px', marginBottom: '12px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              YOUR CUSTOM ROCKETS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
              {customRockets.map(cr => (
                <div
                  key={cr.id}
                  onClick={() => { setSelectedCustom(cr.id); setSelectedRocket(''); }}
                  style={{
                    padding: '12px 10px',
                    border: selectedCustom === cr.id ? '1px solid var(--amber)' : '1px solid var(--border)',
                    borderRadius: '8px',
                    background: selectedCustom === cr.id ? 'var(--amber-dim)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    position: 'relative',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{cr.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-2)' }}>{cr.stageCount} stage{cr.stageCount !== 1 ? 's' : ''}</div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteCustom(cr.id); }}
                    style={{
                      position: 'absolute', top: '4px', right: '4px',
                      background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '10px',
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
        borderTop: '1px solid var(--border-subtle)',
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
      <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px', fontFamily: 'var(--font-mono)' }}>{label}</div>
      <div style={{ color: 'var(--text-1)', fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{value}</div>
    </div>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-2)' }}>
      <div style={{
        width: '28px', height: '28px',
        borderRadius: '6px',
        background: 'var(--glow-accent)',
        border: '1px solid rgba(59,130,246,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '9px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.5px',
        fontFamily: 'var(--font-mono)',
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
  color: 'var(--text-2)',
  letterSpacing: '1px',
  marginBottom: '6px',
  fontFamily: 'var(--font-mono)',
};

const inputStyle: React.CSSProperties = {
  width: '80px',
  padding: '10px 12px',
  background: 'var(--bg-0)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  color: 'var(--text-0)',
  fontSize: '14px',
  fontFamily: 'var(--font-mono)',
};
