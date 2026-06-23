import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Calendar, Clock, Plus, Trash2, CalendarRange, LogOut, Copy, ExternalLink, Check } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { StatusBanner } from './StatusBanner';

export const AdminPortal: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Doctor Provision Inputs
  const [docEmail, setDocEmail] = useState('');
  const [docPassword, setDocPassword] = useState('');
  const [docFirstName, setDocFirstName] = useState('');
  const [docLastName, setDocLastName] = useState('');
  const [docDept, setDocDept] = useState('');
  const [docDegrees, setDocDegrees] = useState('');

  // Availability Editing States
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingDocName, setEditingDocName] = useState('');
  const [availabilities, setAvailabilities] = useState<any[]>([]);

  // UI Status
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  // Sync token, role, and org info from localStorage
  const token = localStorage.getItem('medbook_token') || '';
  const role = localStorage.getItem('medbook_role') || '';
  const orgName = localStorage.getItem('medbook_orgName') || '';
  const orgSlug = localStorage.getItem('medbook_orgSlug') || '';

  // Tab state synced with URL parameters (for admins)
  const activeTab = (searchParams.get('tab') as 'appointments' | 'doctors') || 'appointments';
  const setActiveTab = (tab: 'appointments' | 'doctors') => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    setSearchParams(newParams);
  };

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  // Enforce authentication & role restrictions on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('medbook_token');
    const storedRole = localStorage.getItem('medbook_role');
    if (!storedToken) {
      navigate('/login', { replace: true });
      return;
    }

    const path = window.location.pathname;
    if (path.startsWith('/admin') && storedRole !== 'ADMIN') {
      navigate('/doctors', { replace: true });
    } else if (path.startsWith('/doctors') && storedRole !== 'DOCTOR') {
      navigate('/admin', { replace: true });
    }
  }, [navigate]);

  // Sync tab search parameter for ADMIN dashboard
  useEffect(() => {
    if (token && role === 'ADMIN' && !searchParams.get('tab')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('tab', 'appointments');
      setSearchParams(newParams, { replace: true });
    }
  }, [token, role, searchParams, setSearchParams]);

  // Run initial fetches if logged in
  useEffect(() => {
    if (token) {
      fetchAppointments(page);
      if (role === 'ADMIN') {
        fetchDoctors();
      }
    }
  }, [token, role, page]);

  const fetchAppointments = async (pageNum = 0) => {
    setStatus('loading');
    setStatusMsg('Loading appointments list...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/appointments?page=${pageNum}&size=10`, { headers });
      if (!res.ok) throw new Error('Could not retrieve appointments');
      const data = await res.json();
      setAppointments(data.content || []);
      setTotalPages(data.totalPages || 0);
      setStatus('idle');
      setStatusMsg('');
    } catch (err: any) {
      setStatus('error');
      setStatusMsg(err.message || 'Error fetching appointments');
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/doctors`, { headers });
      if (res.ok) {
        const data = await res.json();
        setDoctors(data);
      }
    } catch (err) {
      console.error('Failed to load doctors list', err);
    }
  };

  const handleProvisionDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setStatusMsg('Provisioning doctor profile...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/doctors`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: docEmail,
          password: docPassword,
          firstName: docFirstName,
          lastName: docLastName,
          department: docDept,
          degrees: docDegrees
        })
      });
      if (!res.ok) throw new Error('Failed to provision doctor profile');
      
      setStatus('success');
      setStatusMsg('Doctor provisioned successfully! Default availability has been set.');
      
      // Clear inputs
      setDocEmail('');
      setDocPassword('');
      setDocFirstName('');
      setDocLastName('');
      setDocDept('');
      setDocDegrees('');
      
      fetchDoctors();
    } catch (err: any) {
      setStatus('error');
      setStatusMsg(err.message || 'Provisioning failed');
    }
  };

  const handleCancelAppointment = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    setStatus('loading');
    setStatusMsg('Cancelling appointment...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/appointments/${id}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error('Appointment cancellation failed');
      setStatus('success');
      setStatusMsg('Appointment cancelled successfully.');
      fetchAppointments(page);
    } catch (err: any) {
      setStatus('error');
      setStatusMsg(err.message || 'Cancellation failed');
    }
  };

  const handleCompleteAppointment = async (id: string) => {
    if (!window.confirm('Are you sure you want to mark this appointment as completed?')) return;
    setStatus('loading');
    setStatusMsg('Marking appointment as completed...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/appointments/${id}/complete`, {
        method: 'POST',
        headers
      });
      if (!res.ok) throw new Error('Failed to mark appointment as completed');
      setStatus('success');
      setStatusMsg('Appointment marked as completed.');
      fetchAppointments(page);
    } catch (err: any) {
      setStatus('error');
      setStatusMsg(err.message || 'Action failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('medbook_token');
    localStorage.removeItem('medbook_role');
    localStorage.removeItem('medbook_orgName');
    localStorage.removeItem('medbook_orgSlug');
    setAppointments([]);
    setDoctors([]);
    navigate('/login', { replace: true });
  };

  // Availability Management
  const openAvailabilityEditor = async (docId: string, docName: string) => {
    setStatus('loading');
    setStatusMsg('Loading availability details...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/doctors/${docId}/availability`, { headers });
      if (!res.ok) throw new Error('Failed to retrieve availability');
      const data = await res.json();
      
      // Ensure all 7 days exist in local representation
      const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
      const mapped = days.map(day => {
        const existing = data.find((a: any) => a.dayOfWeek === day);
        return {
          dayOfWeek: day,
          enabled: !!existing,
          startTime: existing ? existing.startTime.substring(0, 5) : '09:00',
          endTime: existing ? existing.endTime.substring(0, 5) : '17:00'
        };
      });
      
      setAvailabilities(mapped);
      setEditingDocId(docId);
      setEditingDocName(docName);
      setStatus('idle');
      setStatusMsg('');
    } catch (err: any) {
      setStatus('error');
      setStatusMsg(err.message || 'Failed to load availability');
    }
  };

  const handleSaveAvailability = async () => {
    if (!editingDocId) return;
    setStatus('loading');
    setStatusMsg('Updating availability schedule...');

    // Only send the enabled days
    const payload = availabilities
      .filter(a => a.enabled)
      .map(a => ({
        dayOfWeek: a.dayOfWeek,
        startTime: `${a.startTime}:00`,
        endTime: `${a.endTime}:00`
      }));

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/doctors/${editingDocId}/availability`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to update availability schedule');
      
      setStatus('success');
      setStatusMsg('Availability schedule updated successfully!');
      setEditingDocId(null);
    } catch (err: any) {
      setStatus('error');
      setStatusMsg(err.message || 'Failed to save availability');
    }
  };

  const toggleDayEnabled = (index: number) => {
    const updated = [...availabilities];
    updated[index].enabled = !updated[index].enabled;
    setAvailabilities(updated);
  };

  const changeDayTime = (index: number, field: 'startTime' | 'endTime', val: string) => {
    const updated = [...availabilities];
    updated[index][field] = val;
    setAvailabilities(updated);
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}/o/${orgSlug}`;
    navigator.clipboard.writeText(link);
    alert('Share link copied to clipboard!');
  };

  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%' }}></div>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Logged in Header displaying Organization Name */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem', padding: '1.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)' }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            {orgName} — {role} Portal
          </span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.2rem' }}>Dashboard Control</h2>
          
          {role === 'ADMIN' && orgSlug && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', maxWidth: 'fit-content' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Patient Booking Link: <strong style={{ color: 'var(--primary)' }}>/o/{orgSlug}</strong>
              </span>
              <button
                onClick={copyShareLink}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Copy Link"
              >
                <Copy size={14} />
              </button>
              <a
                href={`/o/${orgSlug}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', color: 'var(--accent)' }}
                title="Open Link"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', border: '1px solid var(--error)', padding: '0.6rem 1.2rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}
        >
          <LogOut size={16} /> Logout
        </button>
      </div>

      <StatusBanner status={status} message={statusMsg} />

      {/* Main Tabs for Admin */}
      {role === 'ADMIN' && !editingDocId && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setActiveTab('appointments')}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: 'var(--radius-md)',
              background: activeTab === 'appointments' ? 'var(--primary)' : 'var(--bg-surface)',
              border: `1px solid ${activeTab === 'appointments' ? 'var(--primary)' : 'var(--border)'}`,
              color: 'white',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all var(--transition-fast)'
            }}
          >
            Appointments
          </button>
          <button
            onClick={() => setActiveTab('doctors')}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: 'var(--radius-md)',
              background: activeTab === 'doctors' ? 'var(--primary)' : 'var(--bg-surface)',
              border: `1px solid ${activeTab === 'doctors' ? 'var(--primary)' : 'var(--border)'}`,
              color: 'white',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all var(--transition-fast)'
            }}
          >
            Manage Doctors
          </button>
        </div>
      )}

      {/* Doctor Availability Editor Overlay */}
      {editingDocId ? (
        <div style={{ background: 'var(--bg-surface)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
          <h3 style={{ fontSize: '1.35rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CalendarRange style={{ color: 'var(--primary)' }} /> Edit Availability: Dr. {editingDocName}
          </h3>

          <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
            {availabilities.map((day, idx) => (
              <div
                key={day.dayOfWeek}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  padding: '1rem',
                  background: 'var(--bg-base)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)'
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '130px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={() => toggleDayEnabled(idx)}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{day.dayOfWeek}</span>
                </label>

                {day.enabled ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="time"
                      value={day.startTime}
                      onChange={(e) => changeDayTime(idx, 'startTime', e.target.value)}
                      style={{ padding: '0.4rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'white' }}
                    />
                    <span style={{ color: 'var(--text-muted)' }}>to</span>
                    <input
                      type="time"
                      value={day.endTime}
                      onChange={(e) => changeDayTime(idx, 'endTime', e.target.value)}
                      style={{ padding: '0.4rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'white' }}
                    />
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Unavailable / Off Day</span>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={handleSaveAvailability}
              style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}
            >
              Save Schedule
            </button>
            <button
              onClick={() => setEditingDocId(null)}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : activeTab === 'doctors' && role === 'ADMIN' ? (
        /* Manage Doctors Tab */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          {/* Provision Form */}
          <div style={{ background: 'var(--bg-surface)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={20} style={{ color: 'var(--primary)' }} /> Provision New Doctor Profile
            </h3>
            <form onSubmit={handleProvisionDoctor}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr md:1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>First Name</label>
                  <input type="text" required value={docFirstName} onChange={e => setDocFirstName(e.target.value)} style={{ width: '100%', padding: '0.8rem', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'white', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Last Name</label>
                  <input type="text" required value={docLastName} onChange={e => setDocLastName(e.target.value)} style={{ width: '100%', padding: '0.8rem', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'white', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Email Address</label>
                  <input type="email" required value={docEmail} onChange={e => setDocEmail(e.target.value)} style={{ width: '100%', padding: '0.8rem', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'white', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Temporary Password</label>
                  <input type="password" required minLength={6} value={docPassword} onChange={e => setDocPassword(e.target.value)} style={{ width: '100%', padding: '0.8rem', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'white', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Specialty Department</label>
                  <input type="text" required placeholder="e.g. Cardiology" value={docDept} onChange={e => setDocDept(e.target.value)} style={{ width: '100%', padding: '0.8rem', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'white', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Degrees / Credentials</label>
                  <input type="text" required placeholder="e.g. MD, PhD" value={docDegrees} onChange={e => setDocDegrees(e.target.value)} style={{ width: '100%', padding: '0.8rem', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'white', outline: 'none' }} />
                </div>
              </div>
              <button type="submit" style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.85rem 1.5rem', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}>
                Provision Doctor Account
              </button>
            </form>
          </div>

          {/* Doctor List */}
          <div style={{ background: 'var(--bg-surface)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>Active Medical Staff</h3>
            {doctors.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No doctors have been provisioned yet for this organisation.</p>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {doctors.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1rem',
                      background: 'var(--bg-base)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '1.05rem', display: 'block' }}>Dr. {doc.firstName} {doc.lastName}</strong>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>{doc.department} | {doc.degrees}</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>{doc.email}</span>
                    </div>
                    <button
                      onClick={() => openAvailabilityEditor(doc.id, `${doc.firstName} ${doc.lastName}`)}
                      style={{
                        background: 'var(--bg-surface-elevated)',
                        color: 'white',
                        border: '1px solid var(--border)',
                        padding: '0.6rem 1.2rem',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        transition: 'background var(--transition-fast)'
                      }}
                    >
                      Edit Availability
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Appointments Tab (or Doctor's only View) */
        <div style={{ background: 'var(--bg-surface)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={20} style={{ color: 'var(--primary)' }} /> Scheduled Appointments
          </h3>

          {appointments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No scheduled appointments found.</p>
          ) : (
            <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Patient Name</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Date & Time</th>
                    {role === 'ADMIN' && <th style={{ padding: '0.75rem 0.5rem' }}>Doctor</th>}
                    <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Payment</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((appt) => (
                    <tr key={appt.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.95rem' }}>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <div>
                          <strong>{appt.patientName}</strong>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {appt.patientEmail} | {appt.patientPhone}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Clock size={14} style={{ color: 'var(--primary)' }} />
                          <span>
                            {new Date(appt.slotStartTime).toLocaleDateString([], { timeZone: 'UTC' })} at{' '}
                            {new Date(appt.slotStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                          </span>
                        </div>
                      </td>
                      {role === 'ADMIN' && <td style={{ padding: '1rem 0.5rem' }}>Dr. {appt.doctorName}</td>}
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <span
                          style={{
                            padding: '0.25rem 0.6rem',
                            borderRadius: '50px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            background: 
                              appt.status === 'CONFIRMED' ? 'rgba(16, 185, 129, 0.15)' :
                              appt.status === 'COMPLETED' ? 'rgba(59, 130, 246, 0.15)' :
                              appt.status === 'CANCELLED' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: 
                              appt.status === 'CONFIRMED' ? '#34d399' :
                              appt.status === 'COMPLETED' ? '#60a5fa' :
                              appt.status === 'CANCELLED' ? '#f87171' : '#fbbf24'
                          }}
                        >
                          {appt.status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 0.5rem', color: 'var(--accent)' }}>{appt.paymentMethod}</td>
                      <td style={{ padding: '1rem 0.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          {appt.status === 'CONFIRMED' && (
                            <button
                              onClick={() => handleCompleteAppointment(appt.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--success)',
                                cursor: 'pointer',
                                padding: '0.5rem',
                                borderRadius: 'var(--radius-sm)',
                                transition: 'background var(--transition-fast)'
                              }}
                              title="Mark as Completed"
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            >
                              <Check size={16} />
                            </button>
                          )}
                          {appt.status !== 'CANCELLED' && appt.status !== 'COMPLETED' && (
                            <button
                              onClick={() => handleCancelAppointment(appt.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--error)',
                                cursor: 'pointer',
                                padding: '0.5rem',
                                borderRadius: 'var(--radius-sm)',
                                transition: 'background var(--transition-fast)'
                              }}
                              title="Cancel Appointment"
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  color: page === 0 ? 'var(--text-muted)' : 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  cursor: page === 0 ? 'default' : 'pointer'
                }}
              >
                Previous
              </button>
              <span style={{ alignSelf: 'center', color: 'var(--text-muted)' }}>Page {page + 1} of {totalPages}</span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  color: page >= totalPages - 1 ? 'var(--text-muted)' : 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  cursor: page >= totalPages - 1 ? 'default' : 'pointer'
                }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
