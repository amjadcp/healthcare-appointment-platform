import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { StatusBanner } from './StatusBanner';
import { useAuth } from '../hooks/useAuth';
import { useRedirectIfAuthenticated } from '../hooks/useRedirectIfAuthenticated';
import { authService } from '../api/services/authService';
import { getErrorMessage } from '../utils/error';
import { ROUTES, USER_ROLES } from '../constants';
import type { RequestStatus } from '../types';

export const LoginView: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  useRedirectIfAuthenticated();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setStatusMsg('Authenticating credentials...');
    try {
      const { data } = await authService.login({ email, password });
      login(data);
      setStatus('success');
      setStatusMsg('Successfully authenticated!');
      navigate(data.role === USER_ROLES.ADMIN ? ROUTES.ADMIN : ROUTES.DOCTORS, { replace: true });
    } catch (err) {
      setStatus('error');
      setStatusMsg(getErrorMessage(err));
    }
  };

  return (
    <div style={{ maxWidth: '450px', margin: '6rem auto 0 auto', padding: '0 1rem', animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <span style={{ fontSize: '3rem' }}>🏥</span>
        <h2 style={{ fontSize: '1.75rem', marginTop: '0.5rem', fontWeight: 800 }}>
          MedBook Portal Sign In
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Enter email and password to access your dashboard
        </p>
      </div>

      <StatusBanner status={status} message={statusMsg} />

      <div className="card">
        <form onSubmit={handleLogin}>
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            <div>
              <label className="form-label">Email Address</label>
              <input
                type="email"
                required
                placeholder="name@organisation.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="form-input"
              />
            </div>
            <button
              type="submit"
              disabled={status === 'loading'}
              className="btn btn-primary"
              style={{ marginTop: '0.5rem' }}
            >
              <LogIn size={18} /> Sign In
            </button>
          </div>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
          <Link to={ROUTES.REGISTER} style={{ color: 'var(--text-muted)', textDecoration: 'underline', fontSize: '0.9rem' }}>
            Need to register a new Admin account?
          </Link>
        </div>
      </div>
    </div>
  );
};
