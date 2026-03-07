interface NavBallProps {
  roll: number;
  pitch: number;
  yaw: number;
  size?: number;
}

export default function NavBall({ roll, pitch, yaw, size = 180 }: NavBallProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;

  const pitchOffset = Math.max(-r, Math.min(r, (pitch / 90) * r));

  // Normalize yaw to 0-360
  const yawNorm = ((yaw % 360) + 360) % 360;

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
