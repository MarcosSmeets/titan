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
        <div style={{ width: '100%', height: '2px', background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', marginBottom: '24px', borderRadius: '1px' }} />
        <h2 style={{ margin: '0 0 8px', fontSize: '20px', letterSpacing: '2px', color: 'var(--text-0)', fontFamily: 'var(--font-mono)' }}>CREATE ACCOUNT</h2>
        <p style={{ margin: '0 0 24px', fontSize: '12px', color: 'var(--text-2)' }}>Join the Titan mission control</p>

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

        <p style={{ margin: '16px 0 0', fontSize: '12px', color: 'var(--text-2)', textAlign: 'center' }}>
          Already have an account?{' '}
          <span onClick={onNavigateLogin} style={linkStyle}>Sign in</span>
        </p>
      </form>
    </div>
  );
}

const formStyle: React.CSSProperties = {
  background: 'var(--bg-2)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '32px',
  width: '100%',
  maxWidth: '380px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-1)',
  letterSpacing: '1px',
  fontWeight: 600,
  marginBottom: '4px',
  display: 'block',
  fontFamily: 'var(--font-mono)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  marginBottom: '16px',
  background: 'var(--bg-0)',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  color: 'var(--text-0)',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  letterSpacing: '1px',
  fontFamily: 'var(--font-mono)',
};

const errorStyle: React.CSSProperties = {
  background: 'var(--red-dim)',
  border: '1px solid var(--red)',
  borderRadius: '4px',
  padding: '8px 12px',
  marginBottom: '16px',
  color: '#ff6666',
  fontSize: '12px',
};

const linkStyle: React.CSSProperties = {
  color: 'var(--accent)',
  cursor: 'pointer',
  textDecoration: 'underline',
};
