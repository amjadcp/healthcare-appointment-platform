import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { StatusBanner } from './StatusBanner';

export const LoginView: React.FC = () => {
  const navigate = useNavigate();
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setStatusMsg('Authenticating credentials...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      if (!res.ok) throw new Error('Invalid email or password credentials');
      
      const data = await res.json();
      
      // Store in localStorage
      localStorage.setItem('medbook_token', data.token);
      localStorage.setItem('medbook_role', data.role);
      localStorage.setItem('medbook_orgName', data.orgName || '');
      localStorage.setItem('medbook_orgSlug', data.orgSlug || '');

      setStatus('success');
      setStatusMsg('Successfully authenticated!');
      
      // Redirect based on role
      if (data.role === 'ADMIN') {
        navigate('/admin', { replace: true });
      } else if (data.role === 'DOCTOR') {
        navigate('/doctors', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      setStatus('error');
      setStatusMsg(err.message || 'Login failed');
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

      <div style={{ 
        background: 'var(--bg-surface)', 
        padding: '2rem', 
        borderRadius: 'var(--radius-lg)', 
        border: '1px solid var(--border)', 
        boxShadow: 'var(--shadow-lg)' 
      }}>
        <form onSubmit={handleLogin}>
          <div style={{ display: 'grid', gap: '1.25rem' }}>
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
              <LogIn size={18} /> Sign In
            </button>
          </div>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
          <Link
            to="/register"
            style={{ color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.9rem' }}
          >
            Need to register a new Admin account?
          </Link>
        </div>
      </div>
    </div>
  );
};
