import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { StatusBanner } from './StatusBanner';
import { useAuth } from '../hooks/useAuth';
import { useRedirectIfAuthenticated } from '../hooks/useRedirectIfAuthenticated';
import { authService } from '../api/services/authService';
import { getErrorMessage } from '../utils/error';
import { ROUTES } from '../constants';
import type { RequestStatus } from '../types';

export const RegisterView: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  useRedirectIfAuthenticated();

  const [orgNameInput, setOrgNameInput] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  const handleRegisterAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setStatusMsg('Creating administrator and organisation...');
    try {
      const { data } = await authService.register({ email, password, firstName, lastName, orgName: orgNameInput });
      login(data);
      setStatus('success');
      setStatusMsg('Organisation and admin account registered successfully!');
      navigate(ROUTES.ADMIN, { replace: true });
    } catch (err) {
      setStatus('error');
      setStatusMsg(getErrorMessage(err));
    }
  };

  return (
    <div style={{ maxWidth: '450px', margin: '4rem auto 0 auto', padding: '0 1rem', animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <span style={{ fontSize: '3rem' }}>🏥</span>
        <h2 style={{ fontSize: '1.75rem', marginTop: '0.5rem', fontWeight: 800 }}>
          Register Organisation
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Create your SaaS clinic account and administrator profile
        </p>
      </div>

      <StatusBanner status={status} message={statusMsg} />

      <div className="card">
        <form onSubmit={handleRegisterAdmin}>
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            <div>
              <label className="form-label">Organisation Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Seattle Grace Hospital"
                value={orgNameInput}
                onChange={e => setOrgNameInput(e.target.value)}
                className="form-input"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="form-label">First Name</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Last Name</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>
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
                minLength={6}
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
              <UserPlus size={18} /> Register Organisation
            </button>
          </div>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
          <Link to={ROUTES.LOGIN} style={{ color: 'var(--text-muted)', textDecoration: 'underline', fontSize: '0.9rem' }}>
            Already have an account? Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
