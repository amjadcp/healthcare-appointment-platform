import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LogOut, Copy, ExternalLink, AlertTriangle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { dlqService } from '../api/services/dlqService';
import { ROUTES, USER_ROLES } from '../constants';
import { AppointmentsTab } from './admin/AppointmentsTab';
import { DoctorsTab } from './admin/DoctorsTab';
import { EventsTab } from './admin/EventsTab';
import { DlqTab } from './admin/DlqTab';
import { BusinessAuditTab } from './admin/BusinessAuditTab';

type TabKey = 'appointments' | 'doctors' | 'audit' | 'events' | 'dlq';

export const AdminPortal: React.FC = () => {
  const navigate = useNavigate();
  const { token, role, orgName, orgSlug, logout, isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dlqCount, setDlqCount] = useState(0);

  const activeTab = (searchParams.get('tab') as TabKey) || 'appointments';
  const setActiveTab = (tab: TabKey) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  };

  // Enforce auth + role restrictions
  useEffect(() => {
    if (!isAuthenticated) {
      navigate(ROUTES.LOGIN, { replace: true });
      return;
    }
    const path = window.location.pathname;
    if (path.startsWith('/admin') && role !== USER_ROLES.ADMIN) navigate(ROUTES.DOCTORS, { replace: true });
    else if (path.startsWith('/doctors') && role !== USER_ROLES.DOCTOR) navigate(ROUTES.ADMIN, { replace: true });
  }, [isAuthenticated, role, navigate]);

  // Set default tab for admins
  useEffect(() => {
    if (token && role === USER_ROLES.ADMIN && !searchParams.get('tab')) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', 'appointments');
      setSearchParams(next, { replace: true });
    }
  }, [token, role, searchParams, setSearchParams]);

  // Poll DLQ count badge
  useEffect(() => {
    if (role !== USER_ROLES.ADMIN) return;
    dlqService.getCount().then(({ data }) => setDlqCount(data.count ?? 0)).catch(() => {});
  }, [role]);

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/o/${orgSlug}`);
  };

  if (!isAuthenticated) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><div className="spinner" /></div>;
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem', padding: '1.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)' }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            {orgName} — {role} Portal
          </span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.2rem' }}>Dashboard Control</h2>
          {role === USER_ROLES.ADMIN && orgSlug && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', maxWidth: 'fit-content' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Patient Booking Link: <strong style={{ color: 'var(--primary)' }}>/o/{orgSlug}</strong>
              </span>
              <button onClick={copyShareLink} className="btn-icon" title="Copy Link"><Copy size={14} /></button>
              <a href={`/o/${orgSlug}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', color: 'var(--accent)' }} title="Open Link">
                <ExternalLink size={14} />
              </a>
            </div>
          )}
        </div>
        <button onClick={handleLogout} className="btn btn-danger" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}>
          <LogOut size={16} /> Logout
        </button>
      </div>

      {/* Tab Bar (ADMIN only) */}
      {role === USER_ROLES.ADMIN && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {(['appointments', 'doctors', 'audit', 'events'] as TabKey[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`tab-btn ${activeTab === tab ? 'tab-btn-active' : ''}`}
            >
              {tab === 'appointments' ? 'Appointments' : 
               tab === 'doctors' ? 'Manage Doctors' : 
               tab === 'audit' ? 'Business Audit Trail' : 
               'Debug Event Log'}
            </button>
          ))}
          <button
            onClick={() => setActiveTab('dlq')}
            className={`tab-btn ${activeTab === 'dlq' ? 'tab-btn-danger-active' : ''}`}
          >
            <AlertTriangle size={15} /> Dead Letter Queue
            {dlqCount > 0 && (
              <span style={{ background: 'var(--error)', color: 'white', borderRadius: '50px', fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.45rem', minWidth: '18px', textAlign: 'center' }}>
                {dlqCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'dlq' && role === USER_ROLES.ADMIN && <DlqTab />}
      {activeTab === 'events' && role === USER_ROLES.ADMIN && <EventsTab orgName={orgName} />}
      {activeTab === 'audit' && role === USER_ROLES.ADMIN && <BusinessAuditTab />}
      {activeTab === 'doctors' && role === USER_ROLES.ADMIN && <DoctorsTab />}
      {(activeTab === 'appointments' || role === USER_ROLES.DOCTOR) && <AppointmentsTab role={role ?? ''} />}
    </div>
  );
};
