import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { StatusBanner } from './StatusBanner';

export const RegisterView: React.FC = () => {
  const navigate = useNavigate();
  const [orgNameInput, setOrgNameInput] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    const token = localStorage.getItem('medbook_token');
    const role = localStorage.getItem('medbook_role');
    if (token) {
      if (role === 'ADMIN') {
        navigate('/admin', { replace: true });
      } else if (role === 'DOCTOR') {
        navigate('/doctors', { replace: true });
      }
    }
  }, [navigate]);

  const handleRegisterAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setStatusMsg('Creating administrator and organisation...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName, orgName: orgNameInput })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Admin registration failed');
      }
      
      const data = await res.json();
      
      // Store in localStorage
      localStorage.setItem('medbook_token', data.token);
      localStorage.setItem('medbook_role', data.role);
      localStorage.setItem('medbook_orgName', data.orgName || '');
      localStorage.setItem('medbook_orgSlug', data.orgSlug || '');

      setStatus('success');
      setStatusMsg('Organisation and admin account registered successfully!');
      
      // Redirect to Admin dashboard
      navigate('/admin', { replace: true });
    } catch (err: any) {
      setStatus('error');
      setStatusMsg(err.message || 'Registration failed');
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

      <div style={{ 
        background: 'var(--bg-surface)', 
        padding: '2rem', 
        borderRadius: 'var(--radius-lg)', 
        border: '1px solid var(--border)', 
        boxShadow: 'var(--shadow-lg)' 
      }}>
        <form onSubmit={handleRegisterAdmin}>
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Organisation Name</label>
              <input 
                type="text" 
                required 
                placeholder="e.g. Seattle Grace Hospital" 
                value={orgNameInput} 
                onChange={e => setOrgNameInput(e.target.value)} 
                style={{ 
                  width: '100%', 
                  padding: '0.85rem', 
                  background: 'var(--bg-base)', 
                  border: '1px solid var(--border)', 
                  borderRadius: 'var(--radius-md)', 
                  color: 'white', 
                  outline: 'none',
                  transition: 'border-color var(--transition-fast)'
                }} 
                onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>First Name</label>
                <input 
                  type="text" 
                  required 
                  value={firstName} 
                  onChange={e => setFirstName(e.target.value)} 
                  style={{ 
                    width: '100%', 
                    padding: '0.85rem', 
                    background: 'var(--bg-base)', 
                    border: '1px solid var(--border)', 
                    borderRadius: 'var(--radius-md)', 
                    color: 'white', 
                    outline: 'none',
                    transition: 'border-color var(--transition-fast)'
                  }} 
                  onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Last Name</label>
                <input 
                  type="text" 
                  required 
                  value={lastName} 
                  onChange={e => setLastName(e.target.value)} 
                  style={{ 
                    width: '100%', 
                    padding: '0.85rem', 
                    background: 'var(--bg-base)', 
                    border: '1px solid var(--border)', 
                    borderRadius: 'var(--radius-md)', 
                    color: 'white', 
                    outline: 'none',
                    transition: 'border-color var(--transition-fast)'
                  }} 
                  onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Email Address</label>
              <input 
                type="email" 
                required 
                placeholder="name@organisation.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                style={{ 
                  width: '100%', 
                  padding: '0.85rem', 
                  background: 'var(--bg-base)', 
                  border: '1px solid var(--border)', 
                  borderRadius: 'var(--radius-md)', 
                  color: 'white', 
                  outline: 'none',
                  transition: 'border-color var(--transition-fast)'
                }} 
                onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Password</label>
              <input 
                type="password" 
                required 
                minLength={6} 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                style={{ 
                  width: '100%', 
                  padding: '0.85rem', 
                  background: 'var(--bg-base)', 
                  border: '1px solid var(--border)', 
                  borderRadius: 'var(--radius-md)', 
                  color: 'white', 
                  outline: 'none',
                  transition: 'border-color var(--transition-fast)'
                }} 
                onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
            <button 
              type="submit" 
              disabled={status === 'loading'}
              style={{ 
                background: 'var(--primary)', 
                color: 'white', 
                border: 'none', 
                padding: '1rem', 
                borderRadius: 'var(--radius-md)', 
                fontWeight: 600, 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '0.5rem', 
                marginTop: '0.5rem',
                opacity: status === 'loading' ? 0.7 : 1,
                transition: 'background var(--transition-fast)'
              }}
            >
              <UserPlus size={18} /> Register Organisation
            </button>
          </div>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
          <Link
            to="/login"
            style={{ color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.9rem' }}
          >
            Already have an account? Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
