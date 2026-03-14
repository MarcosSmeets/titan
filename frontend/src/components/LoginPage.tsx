import { useState } from 'react';
import { login, setToken } from '../services/auth';
import { useAuth } from '../context/AuthContext';
import type { User } from '../types';

interface Props {
  onLogin: (user: User) => void;
  onNavigateRegister: () => void;
}

export default function LoginPage({ onLogin, onNavigateRegister }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const auth = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password);
      setToken(res.token);
      const user = { username: res.username, email: res.email, role: res.role as 'admin' | 'user' };
      auth.login(user);
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 48px)', padding: '24px' }}>
      <form onSubmit={handleSubmit} style={formStyle}>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px', letterSpacing: '2px', color: '#fff' }}>SIGN IN</h2>
        <p style={{ margin: '0 0 24px', fontSize: '12px', color: '#667' }}>Access your Titan account</p>

        {error && <div style={errorStyle}>{error}</div>}

        <label style={labelStyle}>Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={inputStyle}
          placeholder="you@example.com"
        />

        <label style={labelStyle}>Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={inputStyle}
          placeholder="••••••••"
        />

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <p style={{ margin: '16px 0 0', fontSize: '12px', color: '#667', textAlign: 'center' }}>
          Don't have an account?{' '}
          <span onClick={onNavigateRegister} style={linkStyle}>Create one</span>
        </p>
      </form>
    </div>
  );
}

const formStyle: React.CSSProperties = {
  background: '#0d0d1a',
  border: '1px solid #1a1a2e',
  borderRadius: '8px',
  padding: '32px',
  width: '100%',
  maxWidth: '380px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#889',
  letterSpacing: '1px',
  fontWeight: 600,
  marginBottom: '4px',
  display: 'block',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  marginBottom: '16px',
  background: '#08080f',
  border: '1px solid #1a1a2e',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  background: '#4488ff',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  letterSpacing: '1px',
};

const errorStyle: React.CSSProperties = {
  background: '#2a0a0a',
  border: '1px solid #ff4444',
  borderRadius: '4px',
  padding: '8px 12px',
  marginBottom: '16px',
  color: '#ff6666',
  fontSize: '12px',
};

const linkStyle: React.CSSProperties = {
  color: '#4488ff',
  cursor: 'pointer',
  textDecoration: 'underline',
};
