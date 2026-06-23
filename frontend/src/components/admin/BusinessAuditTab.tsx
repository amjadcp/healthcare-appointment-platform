import React, { useState, useEffect } from 'react';
import { History } from 'lucide-react';
import { logService } from '../../api/services/logService';
import { getErrorMessage } from '../../utils/error';
import { StatusBanner } from '../StatusBanner';
import type { AppointmentLog, RequestStatus } from '../../types';

export const BusinessAuditTab: React.FC = () => {
  const [logs, setLogs] = useState<AppointmentLog[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  const fetchLogs = async (pageNum = 0) => {
    setStatus('loading');
    setStatusMsg('Loading business audit trail...');
    try {
      const { data } = await logService.getAll(pageNum);
      setLogs(data.content ?? []);
      setTotalPages(data.totalPages ?? 0);
      setStatus('idle');
      setStatusMsg('');
    } catch (err) {
      setStatus('error');
      setStatusMsg(getErrorMessage(err));
    }
  };

  useEffect(() => {
    fetchLogs(page);
  }, [page]);

  return (
    <div className="card">
      <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <History size={20} style={{ color: 'var(--primary)' }} /> Business Audit Trail
      </h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Timeline of all appointment state changes, tracking what happened, when, and by whom.
      </p>

      <StatusBanner status={status} message={statusMsg} />

      {logs.length === 0 && status !== 'loading' ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No audit records yet.</p>
      ) : (
        <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
          <table className="data-table" style={{ minWidth: '800px' }}>
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Appointment ID</th>
                <th>Patient Name</th>
                <th>Status Transition</th>
                <th>Changed By</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <span>{new Date(log.changedAt).toLocaleString()}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {log.appointmentId}
                    </span>
                  </td>
                  <td>
                    <strong>{log.patientName}</strong>
                  </td>
                  <td>
                    {log.fromStatus ? (
                      <span>
                        <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{log.fromStatus}</span>
                        {' → '}
                        <strong style={{ color: 'var(--accent)' }}>{log.toStatus}</strong>
                      </span>
                    ) : (
                      <strong style={{ color: 'var(--primary)' }}>{log.toStatus} (CREATED)</strong>
                    )}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem' }}>{log.changedBy}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="btn btn-secondary btn-sm">Previous</button>
          <span className="pagination-label">Page {page + 1} of {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} className="btn btn-secondary btn-sm">Next</button>
        </div>
      )}
    </div>
  );
};
