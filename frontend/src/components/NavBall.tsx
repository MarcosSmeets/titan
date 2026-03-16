import { useMemo } from 'react';

interface NavBallProps {
  roll: number;
  pitch: number;
  yaw: number;
  size?: number;
  vx?: number; vy?: number; vz?: number;
  px?: number; py?: number; pz?: number;
}

function normalize(x: number, y: number, z: number): [number, number, number] {
  const m = Math.sqrt(x*x + y*y + z*z);
  if (m < 1e-12) return [0, 0, 0];
  return [x/m, y/m, z/m];
}

function cross(a: [number,number,number], b: [number,number,number]): [number,number,number] {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}

function rotateByQuatInverse(
  qw: number, qx: number, qy: number, qz: number,
  vx: number, vy: number, vz: number,
): [number, number, number] {
  const cw = qw, cx = -qx, cy = -qy, cz = -qz;
  const tw = -cx*vx - cy*vy - cz*vz;
  const tx = cw*vx + cy*vz - cz*vy;
  const ty = cw*vy + cz*vx - cx*vz;
  const tz = cw*vz + cx*vy - cy*vx;
  return [
    tw*(-qx) + tx*qw + ty*(-qz) - tz*(-qy),
    tw*(-qy) + ty*qw + tz*(-qx) - tx*(-qz),
    tw*(-qz) + tz*qw + tx*(-qy) - ty*(-qx),
  ];
}

interface OrbitalMarker {
  label: string;
  symbol: string;
  color: string;
  direction: [number, number, number];
}

function computeMarkers(vx: number, vy: number, vz: number, px: number, py: number, pz: number): OrbitalMarker[] {
  const vm = Math.sqrt(vx*vx+vy*vy+vz*vz);
  const pm = Math.sqrt(px*px+py*py+pz*pz);
  if (vm < 1e-6 || pm < 1e-6) return [];
  const pro = normalize(vx, vy, vz);
  const ret: [number,number,number] = [-pro[0], -pro[1], -pro[2]];
  const radIn = normalize(-px, -py, -pz);
  const radOut: [number,number,number] = [-radIn[0], -radIn[1], -radIn[2]];
  const nml = normalize(...cross([px,py,pz], [vx,vy,vz]));
  const anml: [number,number,number] = [-nml[0], -nml[1], -nml[2]];
  return [
    { label: 'PRO', symbol: 'prograde', color: '#22c55e', direction: pro },
    { label: 'RET', symbol: 'retrograde', color: '#22c55e', direction: ret },
    { label: 'NML', symbol: 'normal', color: '#a855f7', direction: nml },
    { label: 'ANM', symbol: 'antiNormal', color: '#a855f7', direction: anml },
    { label: 'R+', symbol: 'radialOut', color: '#06b6d4', direction: radOut },
    { label: 'R-', symbol: 'radialIn', color: '#06b6d4', direction: radIn },
  ];
}

export default function NavBall({ roll, pitch, yaw, size = 280, vx, vy, vz, px, py, pz }: NavBallProps) {
  const s = size / 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10 * s;

  // FIX: pitch offset — positive pitch = nose up = horizon moves DOWN
  // Previous code had inverted pitch direction
  const pitchOffset = Math.max(-r, Math.min(r, -(pitch / 90) * r));

  const yawNorm = ((yaw % 360) + 360) % 360;

  // Quaternion from Euler (ZYX)
  const rr = (roll * Math.PI) / 180;
  const pr = (pitch * Math.PI) / 180;
  const yr = (yaw * Math.PI) / 180;
  const cr = Math.cos(rr/2), sr = Math.sin(rr/2);
  const cp = Math.cos(pr/2), sp = Math.sin(pr/2);
  const cyq = Math.cos(yr/2), syq = Math.sin(yr/2);
  const qw = cr*cp*cyq + sr*sp*syq;
  const qx = sr*cp*cyq - cr*sp*syq;
  const qy = cr*sp*cyq + sr*cp*syq;
  const qz = cr*cp*syq - sr*sp*cyq;

  const hasOrb = vx !== undefined && vy !== undefined && vz !== undefined &&
    px !== undefined && py !== undefined && pz !== undefined;
  const markers = hasOrb ? computeMarkers(vx!, vy!, vz!, px!, py!, pz!) : [];

  const projected = markers.map(m => {
    const bd = rotateByQuatInverse(qw, qx, qy, qz, m.direction[0], m.direction[1], m.direction[2]);
    if (bd[0] <= 0) return null;
    const px2 = cx + (bd[1] / (bd[0] + 1)) * r * 0.85;
    const py2 = cy - (bd[2] / (bd[0] + 1)) * r * 0.85;
    const dx = px2 - cx, dy = py2 - cy;
    if (Math.sqrt(dx*dx + dy*dy) > r * 0.92) return null;
    return { ...m, x: px2, y: py2 };
  }).filter(Boolean) as (OrbitalMarker & { x: number; y: number })[];

  // FIX: Flight path angle display — compute from actual velocity if available
  const flightPathAngle = useMemo(() => {
    if (!hasOrb) return pitch;
    const pmag = Math.sqrt(px!*px! + py!*py! + pz!*pz!);
    const vmag = Math.sqrt(vx!*vx! + vy!*vy! + vz!*vz!);
    if (pmag < 1 || vmag < 1) return 0;
    const rhat = [px!/pmag, py!/pmag, pz!/pmag];
    const vrad = vx!*rhat[0] + vy!*rhat[1] + vz!*rhat[2];
    const vhor = Math.sqrt(Math.max(0, vmag*vmag - vrad*vrad));
    return Math.atan2(vrad, vhor) * 180 / Math.PI;
  }, [hasOrb, vx, vy, vz, px, py, pz, pitch]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: `${6*s}px` }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Outer bezel gradient */}
        <defs>
          <radialGradient id="bezel-grad">
            <stop offset="85%" stopColor="transparent" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.6)" />
          </radialGradient>
          <clipPath id="nb-clip">
            <circle cx={cx} cy={cy} r={r} />
          </clipPath>
        </defs>

        {/* Shadow ring */}
        <circle cx={cx} cy={cy} r={r + 6*s} fill="none" stroke="#0a0a14" strokeWidth={4*s} />
        <circle cx={cx} cy={cy} r={r + 3*s} fill="none" stroke="#14142240" strokeWidth={2*s} />

        {/* Ball interior */}
        <g clipPath="url(#nb-clip)" transform={`rotate(${-roll}, ${cx}, ${cy})`}>
          {/* Sky gradient */}
          <rect x={0} y={0} width={size} height={cy + pitchOffset} fill="#162a52" />
          <rect x={0} y={0} width={size} height={Math.max(0, cy + pitchOffset - r*0.6)} fill="#0e1e3e" />

          {/* Ground gradient */}
          <rect x={0} y={cy + pitchOffset} width={size} height={size} fill="#3a1a0a" />
          <rect x={0} y={cy + pitchOffset + r*0.4} width={size} height={size} fill="#2a1008" />

          {/* Horizon line */}
          <line x1={0} y1={cy + pitchOffset} x2={size} y2={cy + pitchOffset}
            stroke="#f59e0b" strokeWidth={2*s} />

          {/* Pitch ladder — every 10° */}
          {[-80,-70,-60,-50,-40,-30,-20,-10,10,20,30,40,50,60,70,80].map(deg => {
            const y = cy + pitchOffset - (deg / 90) * r;
            const w = Math.abs(deg) % 30 === 0 ? r*0.4 : Math.abs(deg) % 20 === 0 ? r*0.3 : r*0.18;
            return (
              <g key={deg}>
                <line x1={cx-w} y1={y} x2={cx+w} y2={y}
                  stroke={deg > 0 ? '#4488cc80' : '#cc664480'} strokeWidth={0.8*s}
                  strokeDasharray={deg < 0 ? `${3*s} ${2*s}` : 'none'} />
                {Math.abs(deg) % 20 === 0 && (
                  <text x={cx+w+4*s} y={y+3*s} fill="#8899aa" fontSize={7*s}
                    fontFamily="var(--font-mono)" fontWeight="500">{deg}°</text>
                )}
              </g>
            );
          })}

          {/* Heading ticks along horizon */}
          {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg => {
            const offset = ((deg - yawNorm + 180 + 360) % 360 - 180) / 180 * r * 1.5;
            const x = cx + offset;
            if (Math.abs(offset) > r * 0.92) return null;
            const label = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : null;
            return (
              <g key={deg}>
                <line x1={x} y1={cy+pitchOffset-7*s} x2={x} y2={cy+pitchOffset+7*s}
                  stroke={label ? '#dde' : '#44556680'} strokeWidth={(label ? 1.2 : 0.6)*s} />
                {label && (
                  <text x={x} y={cy+pitchOffset-12*s} fill="#eef0f6" fontSize={10*s}
                    fontFamily="var(--font-mono)" fontWeight="600" textAnchor="middle">{label}</text>
                )}
              </g>
            );
          })}
        </g>

        {/* Roll ticks */}
        {[-60,-45,-30,-20,-10,0,10,20,30,45,60].map(deg => {
          const a = (deg - 90) * Math.PI / 180;
          const r1 = r - 3*s, r2 = r + 4*s;
          return (
            <line key={deg}
              x1={cx+Math.cos(a)*r1} y1={cy+Math.sin(a)*r1}
              x2={cx+Math.cos(a)*r2} y2={cy+Math.sin(a)*r2}
              stroke={deg === 0 ? '#f59e0b' : '#3d4058'}
              strokeWidth={(deg === 0 ? 2.5 : deg % 30 === 0 ? 1.5 : 0.8)*s} />
          );
        })}

        {/* Roll pointer */}
        {(() => {
          const a = (-roll - 90) * Math.PI / 180;
          const tipR = r - 6*s, baseR = r + 2*s;
          return <polygon
            points={`${cx+Math.cos(a)*tipR},${cy+Math.sin(a)*tipR} ${cx+Math.cos(a-0.08)*baseR},${cy+Math.sin(a-0.08)*baseR} ${cx+Math.cos(a+0.08)*baseR},${cy+Math.sin(a+0.08)*baseR}`}
            fill="#f59e0b" />;
        })()}

        {/* Orbital markers */}
        {projected.map(m => (
          <g key={m.label}>
            <circle cx={m.x} cy={m.y} r={7*s} fill="none" stroke={m.color} strokeWidth={1.5*s} opacity={0.9} />
            {m.symbol === 'prograde' && <circle cx={m.x} cy={m.y} r={2*s} fill={m.color} />}
            {m.symbol === 'retrograde' && <>
              <line x1={m.x-3.5*s} y1={m.y-3.5*s} x2={m.x+3.5*s} y2={m.y+3.5*s} stroke={m.color} strokeWidth={1.5*s} />
              <line x1={m.x+3.5*s} y1={m.y-3.5*s} x2={m.x-3.5*s} y2={m.y+3.5*s} stroke={m.color} strokeWidth={1.5*s} />
            </>}
            {m.symbol === 'normal' && <polygon
              points={`${m.x},${m.y-4.5*s} ${m.x-4*s},${m.y+3*s} ${m.x+4*s},${m.y+3*s}`}
              fill="none" stroke={m.color} strokeWidth={1.3*s} />}
            {m.symbol === 'antiNormal' && <polygon
              points={`${m.x},${m.y+4.5*s} ${m.x-4*s},${m.y-3*s} ${m.x+4*s},${m.y-3*s}`}
              fill="none" stroke={m.color} strokeWidth={1.3*s} />}
            <text x={m.x} y={m.y+15*s} fill={m.color} fontSize={7*s}
              fontFamily="var(--font-mono)" fontWeight="600" textAnchor="middle" opacity={0.8}>{m.label}</text>
          </g>
        ))}

        {/* Fixed reticle */}
        <line x1={cx-24*s} y1={cy} x2={cx-9*s} y2={cy} stroke="#f59e0b" strokeWidth={2.2*s} />
        <line x1={cx+9*s} y1={cy} x2={cx+24*s} y2={cy} stroke="#f59e0b" strokeWidth={2.2*s} />
        <line x1={cx} y1={cy-9*s} x2={cx} y2={cy-3*s} stroke="#f59e0b" strokeWidth={1.5*s} />
        <circle cx={cx} cy={cy} r={3*s} fill="none" stroke="#f59e0b" strokeWidth={1.8*s} />

        {/* Vignette */}
        <circle cx={cx} cy={cy} r={r} fill="url(#bezel-grad)" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a1a2e" strokeWidth={2*s} />
      </svg>

      {/* Digital readouts */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: `${8*s}px`,
        fontFamily: 'var(--font-mono)', fontSize: `${9*s}px`, fontWeight: 500,
        background: 'rgba(10,10,20,0.6)', borderRadius: `${6*s}px`,
        padding: `${5*s}px ${10*s}px`,
        border: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: `${7*s}px`, color: '#6b7088', letterSpacing: '0.5px' }}>ROLL</div>
          <div style={{ color: '#ef4444' }}>{roll.toFixed(1)}°</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: `${7*s}px`, color: '#6b7088', letterSpacing: '0.5px' }}>PITCH</div>
          <div style={{ color: '#22c55e' }}>{pitch.toFixed(1)}°</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: `${7*s}px`, color: '#6b7088', letterSpacing: '0.5px' }}>YAW</div>
          <div style={{ color: '#3b82f6' }}>{yaw.toFixed(1)}°</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: `${7*s}px`, color: '#6b7088', letterSpacing: '0.5px' }}>FPA</div>
          <div style={{ color: '#f59e0b' }}>{flightPathAngle.toFixed(1)}°</div>
        </div>
      </div>
    </div>
  );
}
