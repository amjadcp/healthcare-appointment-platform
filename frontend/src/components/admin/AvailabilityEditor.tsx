import React, { useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { doctorService } from '../../api/services/doctorService';
import { getErrorMessage } from '../../utils/error';
import { StatusBanner } from '../StatusBanner';
import type { Availability, RequestStatus } from '../../types';

interface Props {
  doctorId: string;
  doctorName: string;
  onClose: () => void;
}

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export const AvailabilityEditor: React.FC<Props> = ({ doctorId, doctorName, onClose }) => {
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<RequestStatus>('loading');
  const [statusMsg, setStatusMsg] = useState('Loading availability...');

  // Load on mount
  React.useEffect(() => {
    doctorService
      .getAvailability(doctorId)
      .then(({ data }) => {
        const mapped = DAYS.map((day) => {
          const existing = data.find((a) => a.dayOfWeek === day);
          return {
            dayOfWeek: day,
            enabled: !!existing,
            startTime: existing ? existing.startTime.substring(0, 5) : '09:00',
            endTime: existing ? existing.endTime.substring(0, 5) : '17:00',
          };
        });
        setAvailabilities(mapped);
        setLoaded(true);
        setStatus('idle');
        setStatusMsg('');
      })
      .catch((err) => {
        setStatus('error');
        setStatusMsg(getErrorMessage(err));
      });
  }, [doctorId]);

  const toggleDay = (index: number) => {
    const updated = [...availabilities];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    setAvailabilities(updated);
  };

  const changeTime = (index: number, field: 'startTime' | 'endTime', val: string) => {
    const updated = [...availabilities];
    updated[index] = { ...updated[index], [field]: val };
    setAvailabilities(updated);
  };

  const handleSave = async () => {
    setStatus('loading');
    setStatusMsg('Saving availability schedule...');
    const payload = availabilities
      .filter((a) => a.enabled)
      .map(({ dayOfWeek, startTime, endTime }) => ({
        dayOfWeek,
        startTime: `${startTime}:00`,
        endTime: `${endTime}:00`,
      }));
    try {
      await doctorService.updateAvailability(doctorId, payload);
      setStatus('success');
      setStatusMsg('Availability updated!');
      onClose();
    } catch (err) {
      setStatus('error');
      setStatusMsg(getErrorMessage(err));
    }
  };

  if (!loaded && status === 'loading') {
    return (
      <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ fontSize: '1.35rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <CalendarRange style={{ color: 'var(--primary)' }} /> Edit Availability: {doctorName}
      </h3>

      <StatusBanner status={status} message={statusMsg} />

      <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
        {availabilities.map((day, idx) => (
          <div
            key={day.dayOfWeek}
            className="card-base"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '130px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={day.enabled}
                onChange={() => toggleDay(idx)}
                style={{ accentColor: 'var(--primary)' }}
              />
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{day.dayOfWeek}</span>
            </label>

            {day.enabled ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="time"
                  value={day.startTime}
                  onChange={(e) => changeTime(idx, 'startTime', e.target.value)}
                  className="form-input-sm"
                />
                <span style={{ color: 'var(--text-muted)' }}>to</span>
                <input
                  type="time"
                  value={day.endTime}
                  onChange={(e) => changeTime(idx, 'endTime', e.target.value)}
                  className="form-input-sm"
                />
              </div>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Unavailable / Off Day</span>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button onClick={handleSave} className="btn btn-primary">Save Schedule</button>
        <button onClick={onClose} className="btn btn-secondary">Cancel</button>
      </div>
    </div>
  );
};
