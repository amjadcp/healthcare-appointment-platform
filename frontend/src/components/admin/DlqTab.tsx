import React, { useState, useEffect } from 'react';
import { AlertTriangle, Copy } from 'lucide-react';
import { dlqService } from '../../api/services/dlqService';
import { getErrorMessage } from '../../utils/error';
import { StatusBanner } from '../StatusBanner';
import type { DlqMessage, RequestStatus } from '../../types';

export const DlqTab: React.FC = () => {
  const [messages, setMessages] = useState<DlqMessage[]>([]);
  const [expandedDlq, setExpandedDlq] = useState<Record<number, boolean>>({});
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  const fetchMessages = async () => {
    setStatus('loading');
    setStatusMsg('Fetching Dead Letter Queue messages...');
    try {
      const { data } = await dlqService.getMessages();
      setMessages(data);
      setStatus('idle');
      setStatusMsg('');
    } catch (err) {
      setStatus('error');
      setStatusMsg(getErrorMessage(err));
    }
  };

  useEffect(() => { fetchMessages(); }, []);

  const handleReprocess = async (eventId?: string) => {
    const isAll = !eventId;
    if (!window.confirm(isAll ? 'Reprocess ALL messages?' : `Reprocess message ${eventId}?`)) return;
    setStatus('loading');
    setStatusMsg(isAll ? 'Reprocessing all...' : `Reprocessing ${eventId}...`);
    try {
      await dlqService.reprocess(eventId);
      setStatus('success');
      setStatusMsg(isAll ? 'All messages sent for reprocessing!' : 'Message sent for reprocessing.');
      fetchMessages();
    } catch (err) {
      setStatus('error');
      setStatusMsg(getErrorMessage(err));
    }
  };

  const handleDismiss = async (eventId?: string) => {
    const isAll = !eventId;
    if (!window.confirm(isAll ? 'WARNING: Permanently delete ALL messages?' : `Delete message ${eventId}?`)) return;
    setStatus('loading');
    setStatusMsg(isAll ? 'Dismissing all...' : `Dismissing ${eventId}...`);
    try {
      await dlqService.dismiss(eventId);
      setStatus('success');
      setStatusMsg(isAll ? 'All messages dismissed.' : 'Message dismissed.');
      fetchMessages();
    } catch (err) {
      setStatus('error');
      setStatusMsg(getErrorMessage(err));
    }
  };

  const toggleExpanded = (idx: number) =>
    setExpandedDlq((prev) => ({ ...prev, [idx]: !prev[idx] }));

  return (
    <div style={{ background: 'var(--bg-surface)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(239,68,68,0.4)', boxShadow: '0 0 0 1px rgba(239,68,68,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <AlertTriangle size={20} style={{ color: 'var(--error)' }} /> Dead Letter Queue
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={fetchMessages} className="btn btn-secondary btn-sm">↻ Refresh</button>
          {messages.length > 0 && (
            <>
              <button onClick={() => handleReprocess()} className="btn btn-warning btn-sm">🔁 Reprocess All</button>
              <button onClick={() => handleDismiss()} className="btn btn-danger btn-sm">❌ Dismiss All</button>
            </>
          )}
        </div>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Messages that failed processing after retries are routed here via RabbitMQ's native dead-lettering.
        These messages are peeked (<strong>not consumed</strong>) — they remain in the queue.
      </p>

      <StatusBanner status={status} message={statusMsg} />

      {messages.length === 0 && status !== 'loading' ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
          <AlertTriangle size={36} style={{ marginBottom: '1rem', opacity: 0.4 }} />
          <p>No messages in the Dead Letter Queue. 🎉</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {messages.map((msg, idx) => {
            const deaths = msg.deaths ?? [];
            const firstDeath = deaths[0];
            const payload = msg.payload ?? {};
            const originalEvent = (payload.originalEvent as Record<string, unknown>) ?? payload;
            const errorInfo = payload.error as { reason?: string; message?: string } | null;
            const eventType = (originalEvent?.eventType as string) || (originalEvent?.event_type as string) || msg.routingKey || 'UNKNOWN';
            const reason = firstDeath?.reason || errorInfo?.reason || 'rejected';
            const eId = (originalEvent?.eventId as string) || (originalEvent?.event_id as string);
            const isExpanded = !!expandedDlq[idx];

            return (
              <div key={idx} style={{ background: 'var(--bg-base)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--error)', background: 'rgba(239,68,68,0.1)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                        FAILED
                      </span>
                      <strong style={{ fontSize: '0.95rem' }}>{eventType}</strong>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                      <span>📮 Queue: <code>{firstDeath?.queue || msg.exchange || '—'}</code></span>
                      <span>💀 Reason: <code style={{ color: '#fbbf24' }}>{reason}</code></span>
                      {firstDeath?.count && <span>🔁 Deaths: <strong>{firstDeath.count}</strong></span>}
                      {firstDeath?.firstDeathAt && <span>🕒 First failed: {String(firstDeath.firstDeathAt)}</span>}
                    </div>
                    {errorInfo?.message && (
                      <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#f87171', fontFamily: 'monospace' }}>⚠ {errorInfo.message}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {eventType !== 'UNKNOWN' && eId && (
                      <button onClick={() => handleReprocess(eId)} className="btn btn-warning btn-sm">🔁 Reprocess</button>
                    )}
                    {eId && (
                      <button onClick={() => handleDismiss(eId)} className="btn btn-danger btn-sm">❌ Dismiss</button>
                    )}
                    <button onClick={() => toggleExpanded(idx)} className="btn btn-secondary btn-sm">
                      {isExpanded ? 'Hide' : 'Show'} Raw Payload
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: '1px solid rgba(239,68,68,0.2)', padding: '1.25rem', background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Full Message Payload</span>
                      <button
                        className="btn-icon"
                        onClick={() => navigator.clipboard.writeText(JSON.stringify(msg.payload, null, 2))}
                        style={{ fontSize: '0.8rem' }}
                      >
                        <Copy size={12} /> Copy JSON
                      </button>
                    </div>
                    <pre style={{ margin: 0, fontSize: '0.82rem', color: '#f87171', fontFamily: 'Consolas, Monaco, monospace', lineHeight: '1.4', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(msg.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
