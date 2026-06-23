import React, { useState, useEffect } from 'react';
import { Activity, Copy, ExternalLink } from 'lucide-react';
import { eventService } from '../../api/services/eventService';
import { getErrorMessage } from '../../utils/error';
import { StatusBanner } from '../StatusBanner';
import type { AppointmentEvent, RequestStatus } from '../../types';

interface Props {
  orgName: string;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  CONFIRMED: '#34d399',
  CANCELLED: '#f87171',
  COMPLETED: '#60a5fa',
  RELEASED:  '#fbbf24',
};

const getEventColor = (eventType: string): string => {
  const key = Object.keys(EVENT_TYPE_COLORS).find((k) => eventType.includes(k));
  return key ? EVENT_TYPE_COLORS[key] : '#c084fc';
};

export const EventsTab: React.FC<Props> = ({ orgName }) => {
  const [events, setEvents] = useState<AppointmentEvent[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  const fetchEvents = async (pageNum = 0) => {
    setStatus('loading');
    setStatusMsg('Loading event logs...');
    try {
      const { data } = await eventService.getAll(pageNum);
      setEvents(data.content ?? []);
      setTotalPages(data.totalPages ?? 0);
      setStatus('idle');
      setStatusMsg('');
    } catch (err) {
      setStatus('error');
      setStatusMsg(getErrorMessage(err));
    }
  };

  useEffect(() => {
    fetchEvents(page);
  }, [page]);

  const toggleRow = (id: string) =>
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="card">
      <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Activity size={20} style={{ color: 'var(--primary)' }} /> Worker Event Logs
      </h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Real-time audit of asynchronous RabbitMQ message events processed by the worker service.
      </p>

      <StatusBanner status={status} message={statusMsg} />

      {events.length === 0 && status !== 'loading' ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No events recorded yet.</p>
      ) : (
        <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
          <table className="data-table" style={{ minWidth: '800px' }}>
            <thead>
              <tr>
                <th>Event ID / Type</th>
                <th>Source / Time</th>
                <th>Organisation Context</th>
                <th style={{ textAlign: 'right' }}>Payload Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt) => {
                let parsed: Record<string, unknown> = {};
                try { parsed = JSON.parse(evt.payload || '{}'); } catch { /* skip */ }

                const innerPayload = (parsed.payload as Record<string, unknown>) || {};
                const oSlug = (innerPayload.orgSlug as string) || evt.orgSlug;
                const oName = (innerPayload.orgName as string) || orgName;
                const isExpanded = !!expandedRows[evt.id];

                return (
                  <React.Fragment key={evt.id}>
                    <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border)' }}>
                      <td>
                        <strong style={{ color: getEventColor(evt.eventType) }}>{evt.eventType}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '0.1rem' }}>
                          {evt.id}
                        </div>
                      </td>
                      <td>
                        <span>{(parsed.source as string) || 'backend'}</span>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                          {new Date(evt.processedAt).toLocaleString()}
                        </div>
                      </td>
                      <td>
                        <span>{oName}</span>
                        {oSlug && (
                          <div style={{ marginTop: '0.2rem' }}>
                            <a
                              href={`/o/${oSlug}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600 }}
                            >
                              Public Booking Link <ExternalLink size={12} />
                            </a>
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button onClick={() => toggleRow(evt.id)} className="btn btn-secondary btn-sm">
                          {isExpanded ? 'Hide Payload' : 'Show Payload'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td colSpan={4} style={{ padding: '0 0.5rem 1rem' }}>
                          <div className="card-base" style={{ overflowX: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                                Pretty JSON Envelope
                              </span>
                              <button
                                className="btn-icon"
                                onClick={() => { navigator.clipboard.writeText(JSON.stringify(parsed, null, 2)); }}
                                style={{ fontSize: '0.8rem', gap: '0.25rem' }}
                              >
                                <Copy size={12} /> Copy JSON
                              </button>
                            </div>
                            <pre style={{ margin: 0, fontSize: '0.85rem', color: 'var(--primary)', fontFamily: 'Consolas, Monaco, monospace', lineHeight: '1.4', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                              {JSON.stringify(parsed, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
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
