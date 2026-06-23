import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Check, Trash2 } from 'lucide-react';
import { appointmentService } from '../../api/services/appointmentService';
import { getErrorMessage } from '../../utils/error';
import { StatusBanner } from '../StatusBanner';
import type { Appointment, RequestStatus } from '../../types';

interface Props {
  role: string;
}

export const AppointmentsTab: React.FC<Props> = ({ role }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  const fetchAppointments = async (pageNum = 0) => {
    setStatus('loading');
    setStatusMsg('Loading appointments list...');
    try {
      const { data } = await appointmentService.getAll(pageNum);
      setAppointments(data.content ?? []);
      setTotalPages(data.totalPages ?? 0);
      setStatus('idle');
      setStatusMsg('');
    } catch (err) {
      setStatus('error');
      setStatusMsg(getErrorMessage(err));
    }
  };

  useEffect(() => {
    fetchAppointments(page);
  }, [page]);

  const handleCancel = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    setStatus('loading');
    setStatusMsg('Cancelling appointment...');
    try {
      await appointmentService.cancel(id);
      setStatus('success');
      setStatusMsg('Appointment cancelled successfully.');
      fetchAppointments(page);
    } catch (err) {
      setStatus('error');
      setStatusMsg(getErrorMessage(err));
    }
  };

  const handleComplete = async (id: string) => {
    if (!window.confirm('Mark this appointment as completed?')) return;
    setStatus('loading');
    setStatusMsg('Marking appointment as completed...');
    try {
      await appointmentService.complete(id);
      setStatus('success');
      setStatusMsg('Appointment marked as completed.');
      fetchAppointments(page);
    } catch (err) {
      setStatus('error');
      setStatusMsg(getErrorMessage(err));
    }
  };

  const getStatusStyle = (apptStatus: string): React.CSSProperties => {
    const map: Record<string, { background: string; color: string }> = {
      CONFIRMED: { background: 'rgba(16,185,129,0.15)', color: '#34d399' },
      COMPLETED: { background: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
      CANCELLED: { background: 'rgba(239,68,68,0.15)', color: '#f87171' },
      RESERVED:  { background: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
    };
    return map[apptStatus] ?? map.RESERVED;
  };

  return (
    <div className="card">
      <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Calendar size={20} style={{ color: 'var(--primary)' }} /> Scheduled Appointments
      </h3>

      <StatusBanner status={status} message={statusMsg} />

      {appointments.length === 0 && status !== 'loading' ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
          No scheduled appointments found.
        </p>
      ) : (
        <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
          <table className="data-table" style={{ minWidth: '600px' }}>
            <thead>
              <tr>
                <th>Patient Name</th>
                <th>Date &amp; Time</th>
                {role === 'ADMIN' && <th>Doctor</th>}
                <th>Status</th>
                <th>Payment</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appt) => (
                <tr key={appt.id}>
                  <td>
                    <strong>{appt.patientName}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {appt.patientEmail} | {appt.patientPhone}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Clock size={14} style={{ color: 'var(--primary)' }} />
                      <span>
                        {new Date(appt.slotStartTime).toLocaleDateString([], { timeZone: 'UTC' })} at{' '}
                        {new Date(appt.slotStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                      </span>
                    </div>
                  </td>
                  {role === 'ADMIN' && <td>{appt.doctorName}</td>}
                  <td>
                    <span className="status-badge" style={getStatusStyle(appt.status)}>
                      {appt.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--accent)' }}>{appt.paymentMethod}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      {appt.status === 'CONFIRMED' && (
                        <button
                          onClick={() => handleComplete(appt.id)}
                          className="btn-icon"
                          style={{ color: 'var(--success)' }}
                          title="Mark as Completed"
                        >
                          <Check size={16} />
                        </button>
                      )}
                      {appt.status !== 'CANCELLED' && appt.status !== 'COMPLETED' && (
                        <button
                          onClick={() => handleCancel(appt.id)}
                          className="btn-icon"
                          style={{ color: 'var(--error)' }}
                          title="Cancel Appointment"
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

      {totalPages > 1 && (
        <div className="pagination">
          <button
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            className="btn btn-secondary btn-sm"
          >
            Previous
          </button>
          <span className="pagination-label">Page {page + 1} of {totalPages}</span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
            className="btn btn-secondary btn-sm"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
