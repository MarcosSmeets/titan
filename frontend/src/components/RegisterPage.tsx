import { useState } from 'react';
import { register, setToken } from '../services/auth';
import { useAuth } from '../context/AuthContext';
import type { User } from '../types';

interface Props {
  onRegister: (user: User) => void;
  onNavigateLogin: () => void;
}

export default function RegisterPage({ onRegister, onNavigateLogin }: Props) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const auth = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must contain uppercase, lowercase, and a digit');
      return;
    }

    setLoading(true);
    try {
      const res = await register(email, username, password);
      setToken(res.token);
      const user = { username: res.username, email: res.email, role: res.role as 'admin' | 'user' };
      auth.login(user);
      onRegister(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 48px)', padding: '24px' }}>
      <form onSubmit={handleSubmit} style={formStyle}>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px', letterSpacing: '2px', color: '#fff' }}>CREATE ACCOUNT</h2>
        <p style={{ margin: '0 0 24px', fontSize: '12px', color: '#667' }}>Join the Titan mission control</p>

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

        <label style={labelStyle}>Username</label>
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
          style={inputStyle}
          placeholder="commander"
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

        <label style={labelStyle}>Confirm Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          required
          style={inputStyle}
          placeholder="••••••••"
        />

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? 'Creating account...' : 'Create Account'}
        </button>

        <p style={{ margin: '16px 0 0', fontSize: '12px', color: '#667', textAlign: 'center' }}>
          Already have an account?{' '}
          <span onClick={onNavigateLogin} style={linkStyle}>Sign in</span>
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
