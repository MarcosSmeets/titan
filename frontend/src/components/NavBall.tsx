interface NavBallProps {
  roll: number;
  pitch: number;
  yaw: number;
  size?: number;
  // Velocity and position for computing orbital markers
  vx?: number; vy?: number; vz?: number;
  px?: number; py?: number; pz?: number;
}

interface OrbitalMarker {
  label: string;
  symbol: 'prograde' | 'retrograde' | 'normal' | 'antiNormal' | 'radialIn' | 'radialOut';
  color: string;
  direction: [number, number, number];
}

function normalize(x: number, y: number, z: number): [number, number, number] {
  const mag = Math.sqrt(x * x + y * y + z * z);
  if (mag < 1e-12) return [0, 0, 0];
  return [x / mag, y / mag, z / mag];
}

function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

// Rotate vector by inverse of quaternion (q*, i.e. inertial -> body frame)
function rotateByQuatInverse(
  qw: number, qx: number, qy: number, qz: number,
  vx: number, vy: number, vz: number,
): [number, number, number] {
  // Conjugate quaternion for inverse rotation
  const cw = qw, cx = -qx, cy = -qy, cz = -qz;
  // q* v q — quaternion sandwich product
  // First: t = q* × v (as pure quaternion)
  const tw = -cx * vx - cy * vy - cz * vz;
  const tx = cw * vx + cy * vz - cz * vy;
  const ty = cw * vy + cz * vx - cx * vz;
  const tz = cw * vz + cx * vy - cy * vx;
  // Then: result = t × q (original quaternion, not conjugate)
  return [
    tw * (-qx) + tx * qw + ty * (-qz) - tz * (-qy),
    tw * (-qy) + ty * qw + tz * (-qx) - tx * (-qz),
    tw * (-qz) + tz * qw + tx * (-qy) - ty * (-qx),
  ];
}

function computeOrbitalMarkers(
  pvx: number, pvy: number, pvz: number,
  ppx: number, ppy: number, ppz: number,
): OrbitalMarker[] {
  const velMag = Math.sqrt(pvx * pvx + pvy * pvy + pvz * pvz);
  const posMag = Math.sqrt(ppx * ppx + ppy * ppy + ppz * ppz);
  if (velMag < 1e-6 || posMag < 1e-6) return [];

  const prograde = normalize(pvx, pvy, pvz);
  const retrograde: [number, number, number] = [-prograde[0], -prograde[1], -prograde[2]];
  const radialIn = normalize(-ppx, -ppy, -ppz);
  const radialOut: [number, number, number] = [-radialIn[0], -radialIn[1], -radialIn[2]];
  const pos: [number, number, number] = [ppx, ppy, ppz];
  const vel: [number, number, number] = [pvx, pvy, pvz];
  const normal = normalize(...cross(pos, vel));
  const antiNormal: [number, number, number] = [-normal[0], -normal[1], -normal[2]];

  return [
    { label: 'PRO', symbol: 'prograde', color: '#44ff44', direction: prograde },
    { label: 'RET', symbol: 'retrograde', color: '#44ff44', direction: retrograde },
    { label: 'NML', symbol: 'normal', color: '#cc44ff', direction: normal },
    { label: 'ANM', symbol: 'antiNormal', color: '#cc44ff', direction: antiNormal },
    { label: 'RAD+', symbol: 'radialOut', color: '#44ccff', direction: radialOut },
    { label: 'RAD-', symbol: 'radialIn', color: '#44ccff', direction: radialIn },
  ];
}

export default function NavBall({ roll, pitch, yaw, size = 180, vx, vy, vz, px, py, pz }: NavBallProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;

  const pitchOffset = Math.max(-r, Math.min(r, (pitch / 90) * r));

  // Normalize yaw to 0-360
  const yawNorm = ((yaw % 360) + 360) % 360;

  // Compute attitude quaternion from Euler angles (ZYX convention)
  const rollRad = (roll * Math.PI) / 180;
  const pitchRad = (pitch * Math.PI) / 180;
  const yawRad = (yaw * Math.PI) / 180;
  const cr = Math.cos(rollRad / 2), sr = Math.sin(rollRad / 2);
  const cp = Math.cos(pitchRad / 2), sp = Math.sin(pitchRad / 2);
  const cyq = Math.cos(yawRad / 2), sy = Math.sin(yawRad / 2);
  const qw = cr * cp * cyq + sr * sp * sy;
  const qx = sr * cp * cyq - cr * sp * sy;
  const qy = cr * sp * cyq + sr * cp * sy;
  const qz = cr * cp * sy - sr * sp * cyq;

  // Compute orbital markers if velocity/position are provided
  const hasOrbitalData = vx !== undefined && vy !== undefined && vz !== undefined &&
    px !== undefined && py !== undefined && pz !== undefined;

  const markers = hasOrbitalData
    ? computeOrbitalMarkers(vx!, vy!, vz!, px!, py!, pz!)
    : [];

  // Project markers onto navball
  const projectedMarkers = markers.map(marker => {
    // Transform direction from inertial to body frame
    const bodyDir = rotateByQuatInverse(qw, qx, qy, qz, marker.direction[0], marker.direction[1], marker.direction[2]);

    // bodyDir[0] = forward (into screen), bodyDir[1] = right, bodyDir[2] = up
    // Visible if forward component > 0 (facing us)
    const forward = bodyDir[0];
    if (forward <= 0) return null;

    // Project onto 2D: right -> x, up -> y (inverted for SVG)
    const projX = cx + (bodyDir[1] / (forward + 1)) * r * 0.9;
    const projY = cy - (bodyDir[2] / (forward + 1)) * r * 0.9;

    // Check if within ball bounds
    const dx = projX - cx;
    const dy = projY - cy;
    if (Math.sqrt(dx * dx + dy * dy) > r * 0.95) return null;

    return { ...marker, x: projX, y: projY };
  }).filter(Boolean) as (OrbitalMarker & { x: number; y: number })[];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Outer ring */}
        <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="#1a1a2e" strokeWidth="2" />
        <circle cx={cx} cy={cy} r={r + 2} fill="none" stroke="#0d0d1a" strokeWidth="1" />

        <defs>
          <clipPath id="navball-clip">
            <circle cx={cx} cy={cy} r={r} />
          </clipPath>
        </defs>

        {/* Ball interior - clipped */}
        <g clipPath="url(#navball-clip)" transform={`rotate(${-roll}, ${cx}, ${cy})`}>
          {/* Sky */}
          <rect x={0} y={0} width={size} height={cy + pitchOffset} fill="#1a2a4a" />
          {/* Ground */}
          <rect x={0} y={cy + pitchOffset} width={size} height={size} fill="#3a1a0a" />
          {/* Horizon line */}
          <line x1={0} y1={cy + pitchOffset} x2={size} y2={cy + pitchOffset} stroke="#ffaa00" strokeWidth="1.5" />

          {/* Pitch ladder lines every 10 degrees */}
          {[-80, -70, -60, -50, -40, -30, -20, -10, 10, 20, 30, 40, 50, 60, 70, 80].map(deg => {
            const y = cy + pitchOffset - (deg / 90) * r;
            const w = Math.abs(deg) % 30 === 0 ? r * 0.35 : Math.abs(deg) % 20 === 0 ? r * 0.25 : r * 0.15;
            return (
              <g key={deg}>
                <line x1={cx - w} y1={y} x2={cx + w} y2={y} stroke="#556" strokeWidth="0.7" />
                {Math.abs(deg) % 20 === 0 && (
                  <text x={cx + w + 3} y={y + 3} fill="#556" fontSize="7" fontFamily="monospace">{deg}</text>
                )}
              </g>
            );
          })}

          {/* Heading/yaw lines every 30 degrees along the horizon */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => {
            const offset = ((deg - yawNorm + 180 + 360) % 360 - 180) / 180 * r * 1.5;
            const x = cx + offset;
            if (Math.abs(offset) > r * 0.95) return null;
            const label = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : null;
            return (
              <g key={deg}>
                <line
                  x1={x} y1={cy + pitchOffset - 6}
                  x2={x} y2={cy + pitchOffset + 6}
                  stroke={label ? '#aab' : '#445'} strokeWidth={label ? 1 : 0.5}
                />
                {label && (
                  <text
                    x={x} y={cy + pitchOffset - 10}
                    fill="#dde" fontSize="9" fontFamily="monospace" fontWeight="bold"
                    textAnchor="middle"
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Roll indicator ticks around outer ring */}
        {[-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60].map(deg => {
          const a = (deg - 90) * Math.PI / 180;
          const r1 = r - 2;
          const r2 = r + 3;
          const x1 = cx + Math.cos(a) * r1;
          const y1 = cy + Math.sin(a) * r1;
          const x2 = cx + Math.cos(a) * r2;
          const y2 = cy + Math.sin(a) * r2;
          return (
            <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={deg === 0 ? '#ffaa00' : '#334'}
              strokeWidth={deg === 0 ? 2 : deg % 30 === 0 ? 1.5 : 1}
            />
          );
        })}

        {/* Roll pointer triangle */}
        {(() => {
          const a = (-roll - 90) * Math.PI / 180;
          const tipR = r - 5;
          const baseR = r + 1;
          const tipX = cx + Math.cos(a) * tipR;
          const tipY = cy + Math.sin(a) * tipR;
          const bx1 = cx + Math.cos(a - 0.08) * baseR;
          const by1 = cy + Math.sin(a - 0.08) * baseR;
          const bx2 = cx + Math.cos(a + 0.08) * baseR;
          const by2 = cy + Math.sin(a + 0.08) * baseR;
          return <polygon points={`${tipX},${tipY} ${bx1},${by1} ${bx2},${by2}`} fill="#ffaa00" />;
        })()}

        {/* Orbital navigation markers */}
        {projectedMarkers.map(m => (
          <g key={m.label}>
            <circle cx={m.x} cy={m.y} r={6} fill="none" stroke={m.color} strokeWidth="1.5" opacity={0.9} />
            {m.symbol === 'prograde' && (
              <circle cx={m.x} cy={m.y} r={1.5} fill={m.color} opacity={0.9} />
            )}
            {m.symbol === 'retrograde' && (
              <>
                <line x1={m.x - 3} y1={m.y - 3} x2={m.x + 3} y2={m.y + 3} stroke={m.color} strokeWidth="1.5" opacity={0.9} />
                <line x1={m.x + 3} y1={m.y - 3} x2={m.x - 3} y2={m.y + 3} stroke={m.color} strokeWidth="1.5" opacity={0.9} />
              </>
            )}
            {m.symbol === 'normal' && (
              <polygon points={`${m.x},${m.y - 4} ${m.x - 3.5},${m.y + 2.5} ${m.x + 3.5},${m.y + 2.5}`} fill="none" stroke={m.color} strokeWidth="1.3" opacity={0.9} />
            )}
            {m.symbol === 'antiNormal' && (
              <polygon points={`${m.x},${m.y + 4} ${m.x - 3.5},${m.y - 2.5} ${m.x + 3.5},${m.y - 2.5}`} fill="none" stroke={m.color} strokeWidth="1.3" opacity={0.9} />
            )}
            {m.symbol === 'radialOut' && (
              <>
                <circle cx={m.x} cy={m.y} r={1.5} fill={m.color} opacity={0.9} />
                <line x1={m.x} y1={m.y - 6} x2={m.x} y2={m.y - 3} stroke={m.color} strokeWidth="1.3" opacity={0.9} />
              </>
            )}
            {m.symbol === 'radialIn' && (
              <>
                <circle cx={m.x} cy={m.y} r={1.5} fill={m.color} opacity={0.9} />
                <line x1={m.x} y1={m.y + 3} x2={m.x} y2={m.y + 6} stroke={m.color} strokeWidth="1.3" opacity={0.9} />
              </>
            )}
            <text
              x={m.x} y={m.y + 14}
              fill={m.color} fontSize="7" fontFamily="monospace" fontWeight="bold"
              textAnchor="middle" opacity={0.8}
            >
              {m.label}
            </text>
          </g>
        ))}

        {/* Fixed crosshair reticle */}
        <line x1={cx - 22} y1={cy} x2={cx - 8} y2={cy} stroke="#ffaa00" strokeWidth="2" />
        <line x1={cx + 8} y1={cy} x2={cx + 22} y2={cy} stroke="#ffaa00" strokeWidth="2" />
        <line x1={cx} y1={cy - 8} x2={cx} y2={cy - 2} stroke="#ffaa00" strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r="2.5" fill="none" stroke="#ffaa00" strokeWidth="1.5" />

        {/* Outer bezel */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#222" strokeWidth="1.5" />
      </svg>

      {/* Digital readouts */}
      <div style={{
        display: 'flex', gap: '12px', justifyContent: 'center',
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: '10px',
      }}>
        <span style={{ color: '#ff8888' }}>R {roll.toFixed(1)}{'\u00B0'}</span>
        <span style={{ color: '#88ff88' }}>P {pitch.toFixed(1)}{'\u00B0'}</span>
        <span style={{ color: '#8888ff' }}>Y {yaw.toFixed(1)}{'\u00B0'}</span>
      </div>
    </div>
  );
}
