import React from 'react';
import { Loader2, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

interface StatusBannerProps {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({ status, message }) => {
  if (status === 'idle' || !message) return null;

  const bgColors = {
    loading: 'rgba(99, 102, 241, 0.15)',
    success: 'rgba(16, 185, 129, 0.15)',
    error: 'rgba(239, 68, 68, 0.15)',
    idle: 'transparent'
  };

  const borderColors = {
    loading: 'var(--primary)',
    success: 'var(--success)',
    error: 'var(--error)',
    idle: 'transparent'
  };

  const textColors = {
    loading: 'var(--text-main)',
    success: '#34d399',
    error: '#f87171',
    idle: 'var(--text-muted)'
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.85rem 1.25rem',
        borderRadius: 'var(--radius-md)',
        background: bgColors[status],
        border: `1px solid ${borderColors[status]}`,
        color: textColors[status],
        fontSize: '0.95rem',
        fontWeight: 500,
        marginBottom: '1.5rem',
        boxShadow: 'var(--shadow-sm)',
        animation: 'slideDown 0.3s ease-out',
        backdropFilter: 'blur(8px)',
        transition: 'all var(--transition-normal)'
      }}
    >
      {status === 'loading' && <Loader2 className="animate-spin" size={18} style={{ color: 'var(--primary)' }} />}
      {status === 'success' && <CheckCircle2 size={18} />}
      {status === 'error' && <AlertTriangle size={18} />}
      <span>{message}</span>
    </div>
  );
};
