import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SimulationProvider, useSimulationContext } from './context/SimulationContext';
import LaunchPage from './pages/LaunchPage';
import SimulationPage from './pages/SimulationPage';
import HistoryPage from './pages/HistoryPage';
import HowItWorks from './components/HowItWorks';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import type { SimulationState } from './types';

function AppLayout() {
  const { user, logout } = useAuth();
  const { simState, isActive, telemetry } = useSimulationContext();
  const navigate = useNavigate();
  const location = useLocation();
  const latest = telemetry[telemetry.length - 1];

  const isPage = (path: string) => location.pathname === path;

  return (
    <div style={rootStyle}>
      <nav style={navStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <h1
            style={{ margin: 0, fontSize: '16px', letterSpacing: '4px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-mono)', color: 'var(--text-0)' }}
            onClick={() => navigate('/launch')}
          >
            TITAN
          </h1>
          <NavBtn active={isPage('/launch')} onClick={() => navigate('/launch')}>Launch</NavBtn>
          {simState !== 'idle' && (
            <NavBtn active={isPage('/simulation')} onClick={() => navigate('/simulation')}>
              Simulation {isActive && <span style={{ color: '#44ff44', marginLeft: '4px' }}>LIVE</span>}
            </NavBtn>
          )}
          <NavBtn active={isPage('/history')} onClick={() => navigate('/history')}>History</NavBtn>
          <NavBtn active={isPage('/how-it-works')} onClick={() => navigate('/how-it-works')}>How It Works</NavBtn>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {latest && isPage('/simulation') && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: isActive ? 'var(--green)' : 'var(--text-2)', letterSpacing: '1.5px', fontWeight: 500 }}>
              T+{formatMissionTime(latest.time)}
            </span>
          )}
          {simState !== 'idle' && isPage('/simulation') && <StatusBadge state={simState} />}
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: '#aab', letterSpacing: '1px' }}>{user.username}</span>
              <span style={{
                fontSize: '9px', color: user.role === 'admin' ? '#ffaa44' : '#4488ff',
                background: user.role === 'admin' ? '#ffaa4420' : '#4488ff20',
                padding: '2px 6px', borderRadius: '8px', fontWeight: 700, letterSpacing: '1px',
              }}>
                {user.role.toUpperCase()}
              </span>
              <button onClick={() => { logout(); navigate('/launch'); }} style={{
                background: 'none', border: '1px solid #333', color: '#667',
                fontSize: '10px', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', letterSpacing: '1px',
              }}>
                Logout
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => navigate('/login')} style={{
                background: 'none', border: '1px solid #333', color: '#aab',
                fontSize: '10px', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', letterSpacing: '1px',
              }}>
                Sign In
              </button>
              <button onClick={() => navigate('/register')} style={{
                background: '#4488ff', border: 'none', color: '#fff',
                fontSize: '10px', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', letterSpacing: '1px',
              }}>
                Register
              </button>
            </div>
          )}
        </div>
      </nav>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <Routes>
          <Route path="/login" element={
            <LoginPage
              onLogin={(u) => { navigate('/launch'); }}
              onNavigateRegister={() => navigate('/register')}
            />
          } />
          <Route path="/register" element={
            <RegisterPage
              onRegister={(u) => { navigate('/launch'); }}
              onNavigateLogin={() => navigate('/login')}
            />
          } />
          <Route path="/launch" element={<LaunchPage />} />
          <Route path="/simulation" element={<SimulationPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="*" element={<Navigate to="/launch" replace />} />
        </Routes>
      </div>


    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SimulationProvider>
          <AppLayout />
        </SimulationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function NavBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none',
        color: active ? '#fff' : '#667',
        fontSize: '12px', fontWeight: active ? 600 : 400,
        letterSpacing: '1px', cursor: 'pointer',
        padding: '4px 0',
        borderBottom: active ? '2px solid #4488ff' : '2px solid transparent',
      }}
    >
      {children}
    </button>
  );
}

function StatusBadge({ state }: { state: SimulationState }) {
  const info = statusInfo(state);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '4px 10px', borderRadius: '12px',
      background: info.bg, fontSize: '11px', fontWeight: 600,
    }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: info.dot,
        animation: (state === 'running' || state === 'connecting') ? 'pulse 1s infinite' : 'none',
      }} />
      {info.label}
    </div>
  );
}

function formatMissionTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function statusInfo(state: SimulationState) {
  switch (state) {
    case 'connecting': return { bg: 'rgba(255,170,0,0.15)', dot: '#ffaa00', label: 'CONNECTING' };
    case 'running': return { bg: 'rgba(68,255,68,0.1)', dot: '#44ff44', label: 'LIVE' };
    case 'complete': return { bg: 'rgba(68,136,255,0.1)', dot: '#4488ff', label: 'COMPLETE' };
    case 'failed': return { bg: 'rgba(255,68,68,0.1)', dot: '#ff4444', label: 'FAILED' };
    default: return { bg: 'rgba(136,136,136,0.1)', dot: '#888', label: 'IDLE' };
  }
}

const rootStyle: React.CSSProperties = {
  height: '100vh', display: 'flex', flexDirection: 'column',
  background: 'var(--bg-0)', color: 'var(--text-0)',
  fontFamily: 'var(--font-sans)',
  overflow: 'hidden',
};

const navStyle: React.CSSProperties = {
  padding: '10px 24px', display: 'flex', alignItems: 'center',
  justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)',
  background: 'var(--bg-1)', position: 'sticky', top: 0, zIndex: 50,
};
