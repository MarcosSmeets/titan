import { useState } from 'react';

export default function HowItWorks() {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px' }}>
      <h2 style={{ fontSize: '28px', fontWeight: 300, marginBottom: '8px' }}>
        How Titan Works
      </h2>
      <p style={{ color: '#778', fontSize: '14px', lineHeight: 1.6, marginBottom: '32px' }}>
        Titan is a high-fidelity aerospace physics engine that simulates rocket launches from liftoff to orbit insertion.
        The simulation core is written in C++ with a .NET API layer and React frontend for real-time telemetry.
      </p>

      <Section title="System Architecture" defaultOpen>
        <p>
          The system is composed of three layers:
        </p>
        <ul>
          <li><strong>C++ Physics Engine</strong> — Numerical core with RK4/RK45 integration, gravity, atmosphere, drag, and orbital mechanics</li>
          <li><strong>.NET API</strong> — REST + SignalR WebSocket bridge that calls the C++ engine via native interop and streams telemetry in real time</li>
          <li><strong>React Frontend</strong> — Real-time telemetry dashboard with charts, mission history, and rocket configuration</li>
        </ul>
        <p>
          During a simulation, the API creates a native simulation instance, steps it forward in time, and pushes telemetry
          points to the browser via SignalR at the configured time warp rate. All orbital elements are computed at each step.
        </p>
      </Section>

      <Section title="Gravity Model" icon="G">
        <p>
          We use <strong>Newton's Law of Universal Gravitation</strong> to compute gravitational acceleration as a function of altitude:
        </p>
        <Formula>{'g(h) = G * M / (R + h)²'}</Formula>
        <ParamTable params={[
          ['G', '6.67430 × 10⁻¹¹ m³/kg/s²', 'Gravitational constant'],
          ['M', '5.972 × 10²⁴ kg', 'Earth mass'],
          ['R', '6,371,000 m', 'Earth radius'],
          ['h', 'variable', 'Altitude above surface (m)'],
        ]} />
        <p>
          In 3D, gravity is applied as a radial acceleration toward Earth's center:
        </p>
        <Formula>{'a_gravity = -μ/r³ × r'}</Formula>
        <p>
          Where μ = GM = 3.986 × 10¹⁴ m³/s² is the standard gravitational parameter and <strong>r</strong> is the position vector.
        </p>
      </Section>

      <Section title="Atmosphere Model" icon="ATM">
        <p>
          The atmosphere uses an <strong>exponential density decay</strong> model:
        </p>
        <Formula>{'ρ(h) = ρ₀ × exp(-h / H)'}</Formula>
        <ParamTable params={[
          ['ρ₀', '1.225 kg/m³', 'Sea level air density'],
          ['H', '8,500 m', 'Scale height'],
          ['h', 'variable', 'Altitude (m)'],
        ]} />
        <p>
          This is a simplified single-layer model. Real atmospheres have multiple scale heights at different altitudes,
          but the exponential model captures the dominant behavior for launch trajectory simulation.
        </p>
      </Section>

      <Section title="Aerodynamic Drag" icon="D">
        <p>
          Drag force opposes the velocity vector using the standard <strong>quadratic drag equation</strong>:
        </p>
        <Formula>{'F_drag = ½ × ρ × v² × Cd × A'}</Formula>
        <ParamTable params={[
          ['ρ', 'from atmosphere model', 'Air density (kg/m³)'],
          ['v', 'vehicle speed', 'Velocity magnitude (m/s)'],
          ['Cd', '0.3 – 0.5', 'Drag coefficient'],
          ['A', 'per stage', 'Reference cross-section area (m²)'],
        ]} />
        <p>
          Drag acceleration is applied opposite to the velocity direction:
        </p>
        <Formula>{'a_drag = -(F_drag / m) × v̂'}</Formula>
        <p>
          Drag is dominant during the first ~80 seconds of flight through the dense lower atmosphere.
          Above ~80 km, atmospheric density is negligible and drag effectively drops to zero.
        </p>
      </Section>

      <Section title="Thrust & Rocket Equation" icon="T">
        <p>
          Each stage produces thrust based on the <strong>Tsiolkovsky rocket equation</strong> relationship:
        </p>
        <Formula>{'F_thrust = ṁ × v_e'}</Formula>
        <ParamTable params={[
          ['ṁ', 'per stage', 'Mass flow rate / burn rate (kg/s)'],
          ['v_e', 'per stage', 'Exhaust velocity (m/s) = Isp × g₀'],
          ['Isp', 'per stage', 'Specific impulse (seconds)'],
          ['g₀', '9.80665 m/s²', 'Standard gravity'],
        ]} />
        <p>
          Total vehicle mass decreases as fuel burns:
        </p>
        <Formula>{'m(t) = m_dry + m_fuel(t)'}</Formula>
        <p>
          A <strong>throttle limiter</strong> enforces maximum G-loading (default 4g) by reducing the burn rate
          when the acceleration would exceed the limit. Stages separate automatically when fuel is exhausted.
        </p>
      </Section>

      <Section title="Numerical Integration" icon="RK">
        <p>
          Titan supports three integration methods of increasing fidelity:
        </p>

        <h4 style={{ color: '#aab', marginTop: '16px' }}>Euler (1st order)</h4>
        <Formula>{'y(t+dt) = y(t) + f(t, y) × dt'}</Formula>
        <p>Simple but accumulates error quickly. Only used for quick estimates.</p>

        <h4 style={{ color: '#aab', marginTop: '16px' }}>RK4 (4th order Runge-Kutta)</h4>
        <Formula>{`k₁ = f(t, y)
k₂ = f(t + dt/2, y + dt×k₁/2)
k₃ = f(t + dt/2, y + dt×k₂/2)
k₄ = f(t + dt, y + dt×k₃)

y(t+dt) = y(t) + (dt/6)(k₁ + 2k₂ + 2k₃ + k₄)`}</Formula>
        <p>Fourth-order accurate with O(dt⁵) local truncation error. Fixed timestep.</p>

        <h4 style={{ color: '#aab', marginTop: '16px' }}>RK45 Dormand-Prince (Adaptive)</h4>
        <p>
          The default and most accurate method. Uses 6 stages with Dormand-Prince coefficients to compute
          both a 4th-order and 5th-order solution estimate. The difference is used for <strong>adaptive step size control</strong>:
        </p>
        <Formula>{`err = max_i( |y5[i] - y4[i]| / (atol + rtol × |y5[i]|) )

if err ≤ 1: accept step, h_new = 0.84 × (1/err)^0.25 × h
if err > 1: reject step, shrink h and retry`}</Formula>
        <ParamTable params={[
          ['atol', '1 × 10⁻⁸', 'Absolute tolerance'],
          ['rtol', '1 × 10⁻⁶', 'Relative tolerance'],
          ['h_min', '1 × 10⁻⁶ s', 'Minimum step size'],
          ['h_max', '10 s', 'Maximum step size'],
        ]} />
      </Section>

      <Section title="Orbital Mechanics" icon="ORB">
        <p>
          At each simulation step, classical orbital elements are computed from the Cartesian state vector (position + velocity):
        </p>

        <h4 style={{ color: '#aab', marginTop: '16px' }}>Specific Orbital Energy</h4>
        <Formula>{'ε = v²/2 - μ/r'}</Formula>
        <p>Negative = bound orbit, zero = parabolic escape, positive = hyperbolic.</p>

        <h4 style={{ color: '#aab', marginTop: '16px' }}>Semi-Major Axis</h4>
        <Formula>{'a = -μ / (2ε)'}</Formula>

        <h4 style={{ color: '#aab', marginTop: '16px' }}>Eccentricity</h4>
        <Formula>{'e = |v × h/μ - r/r|'}</Formula>
        <p>Where <strong>h</strong> = r × v is the angular momentum vector. e = 0 is circular, 0 &lt; e &lt; 1 is elliptical.</p>

        <h4 style={{ color: '#aab', marginTop: '16px' }}>Apoapsis & Periapsis</h4>
        <Formula>{`r_apo = a × (1 + e)
r_peri = a × (1 - e)`}</Formula>

        <h4 style={{ color: '#aab', marginTop: '16px' }}>Inclination</h4>
        <Formula>{'i = arccos(h_z / |h|)'}</Formula>

        <h4 style={{ color: '#aab', marginTop: '16px' }}>RAAN (Right Ascension of Ascending Node)</h4>
        <Formula>{'Ω = arccos(n_x / |n|), where n = K × h'}</Formula>

        <h4 style={{ color: '#aab', marginTop: '16px' }}>Orbit Achievement Criteria</h4>
        <p>
          An orbit is considered achieved when the periapsis altitude exceeds 180 km and eccentricity drops below 0.02,
          indicating a nearly circular orbit above the atmosphere.
        </p>
      </Section>

      <Section title="Guidance Algorithms" icon="NAV">
        <h4 style={{ color: '#aab' }}>Orbital Circularization (Two-Phase)</h4>
        <p>The default guidance algorithm operates in two phases:</p>
        <p><strong>Phase 1 — Gravity Turn:</strong> The rocket starts vertical and gradually pitches over
          as altitude increases. The pitch angle linearly interpolates from 90° (vertical) to 0° (horizontal):</p>
        <Formula>{'pitch = (1 - altitude/target_altitude) × π/2'}</Formula>

        <p><strong>Phase 2 — Circularization:</strong> Once the apoapsis reaches the target altitude,
          the vehicle burns prograde (horizontal) to raise the periapsis and circularize the orbit.</p>

        <h4 style={{ color: '#aab', marginTop: '16px' }}>Thrust Direction</h4>
        <p>
          Thrust is resolved in the Local Vertical/Local Horizontal (LVLH) frame:
        </p>
        <Formula>{`up = r / |r|  (radial outward)
east = (h × r) / |h × r|  (prograde)

thrust = sin(pitch) × up + cos(pitch) × east`}</Formula>
      </Section>

      <Section title="Key Constants" icon="C">
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Parameter</th>
                <th style={thStyle}>Value</th>
                <th style={thStyle}>Unit</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Earth radius', '6,371,000', 'm'],
                ['Earth mass', '5.972 × 10²⁴', 'kg'],
                ['Gravitational parameter (μ)', '3.986 × 10¹⁴', 'm³/s²'],
                ['Gravitational constant (G)', '6.674 × 10⁻¹¹', 'm³/kg/s²'],
                ['Sea level density (ρ₀)', '1.225', 'kg/m³'],
                ['Scale height (H)', '8,500', 'm'],
                ['Standard gravity (g₀)', '9.80665', 'm/s²'],
                ['Earth rotation rate', '7.292 × 10⁻⁵', 'rad/s'],
                ['Default max G-loading', '4.0', 'g'],
                ['Default target orbit', '200', 'km'],
              ].map(([param, value, unit], i) => (
                <tr key={i}>
                  <td style={tdStyle}>{param}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#4488ff' }}>{value}</td>
                  <td style={{ ...tdStyle, color: '#667' }}>{unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, icon, defaultOpen = false, children }: {
  title: string;
  icon?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      marginBottom: '12px',
      background: '#0a0a16',
      border: '1px solid #151520',
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          width: '100%', padding: '14px 18px',
          background: 'none', border: 'none',
          cursor: 'pointer', color: '#fff', textAlign: 'left',
        }}
      >
        {icon && (
          <span style={{
            width: '28px', height: '28px', borderRadius: '6px',
            background: 'rgba(68,136,255,0.08)', border: '1px solid #1a2a4e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '9px', fontWeight: 700, color: '#4488ff', letterSpacing: '0.5px',
            flexShrink: 0,
          }}>
            {icon}
          </span>
        )}
        <span style={{ flex: 1, fontSize: '14px', fontWeight: 600 }}>{title}</span>
        <span style={{ color: '#445', fontSize: '12px', transform: open ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>
          ▼
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 18px 16px', fontSize: '13px', color: '#aab', lineHeight: 1.7 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Formula({ children }: { children: string }) {
  return (
    <pre style={{
      background: '#080812',
      border: '1px solid #151520',
      borderRadius: '6px',
      padding: '10px 14px',
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#88ccff',
      overflowX: 'auto',
      margin: '8px 0',
      whiteSpace: 'pre-wrap',
    }}>
      {children}
    </pre>
  );
}

function ParamTable({ params }: { params: string[][] }) {
  return (
    <div style={{ overflowX: 'auto', margin: '8px 0' }}>
      <table style={{ ...tableStyle, width: '100%' }}>
        <thead>
          <tr>
            <th style={thStyle}>Symbol</th>
            <th style={thStyle}>Value</th>
            <th style={thStyle}>Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map(([sym, val, desc], i) => (
            <tr key={i}>
              <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#88ccff' }}>{sym}</td>
              <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#aab' }}>{val}</td>
              <td style={{ ...tdStyle, color: '#778' }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const tableStyle: React.CSSProperties = {
  borderCollapse: 'collapse',
  width: '100%',
  fontSize: '12px',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 10px',
  borderBottom: '1px solid #1a1a2e',
  color: '#556',
  fontSize: '10px',
  letterSpacing: '1px',
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid #0d0d1a',
};
