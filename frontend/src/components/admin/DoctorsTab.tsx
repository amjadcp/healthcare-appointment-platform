import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { doctorService } from '../../api/services/doctorService';
import { getErrorMessage } from '../../utils/error';
import { StatusBanner } from '../StatusBanner';
import { AvailabilityEditor } from './AvailabilityEditor';
import type { Doctor, RequestStatus } from '../../types';

export const DoctorsTab: React.FC = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  // Doctor provision form fields
  const [docEmail, setDocEmail] = useState('');
  const [docPassword, setDocPassword] = useState('');
  const [docFirstName, setDocFirstName] = useState('');
  const [docLastName, setDocLastName] = useState('');
  const [docDept, setDocDept] = useState('');
  const [docDegrees, setDocDegrees] = useState('');

  // Availability editor state
  const [editingDoctor, setEditingDoctor] = useState<{ id: string; name: string } | null>(null);

  const fetchDoctors = async () => {
    try {
      const { data } = await doctorService.getAll();
      setDoctors(data);
    } catch (err) {
      console.error('Failed to load doctors', getErrorMessage(err));
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setStatusMsg('Provisioning doctor profile...');
    try {
      await doctorService.provision({
        email: docEmail,
        password: docPassword,
        firstName: docFirstName,
        lastName: docLastName,
        department: docDept,
        degrees: docDegrees,
      });
      setStatus('success');
      setStatusMsg('Doctor provisioned successfully!');
      setDocEmail(''); setDocPassword(''); setDocFirstName('');
      setDocLastName(''); setDocDept(''); setDocDegrees('');
      fetchDoctors();
    } catch (err) {
      setStatus('error');
      setStatusMsg(getErrorMessage(err));
    }
  };

  if (editingDoctor) {
    return (
      <AvailabilityEditor
        doctorId={editingDoctor.id}
        doctorName={editingDoctor.name}
        onClose={() => setEditingDoctor(null)}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: '2rem' }}>
      <div className="card">
        <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={20} style={{ color: 'var(--primary)' }} /> Provision New Doctor Profile
        </h3>

        <StatusBanner status={status} message={statusMsg} />

        <form onSubmit={handleProvision}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'First Name', value: docFirstName, setter: setDocFirstName, type: 'text' },
              { label: 'Last Name', value: docLastName, setter: setDocLastName, type: 'text' },
              { label: 'Email Address', value: docEmail, setter: setDocEmail, type: 'email' },
              { label: 'Temporary Password', value: docPassword, setter: setDocPassword, type: 'password', min: 6 },
              { label: 'Specialty Department', value: docDept, setter: setDocDept, type: 'text', placeholder: 'e.g. Cardiology' },
              { label: 'Degrees / Credentials', value: docDegrees, setter: setDocDegrees, type: 'text', placeholder: 'e.g. MD, PhD' },
            ].map(({ label, value, setter, type, placeholder, min }) => (
              <div key={label}>
                <label className="form-label">{label}</label>
                <input
                  type={type}
                  required
                  placeholder={placeholder}
                  value={value}
                  onChange={e => setter(e.target.value)}
                  minLength={min}
                  className="form-input"
                />
              </div>
            ))}
          </div>
          <button type="submit" className="btn btn-primary">
            Provision Doctor Account
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>Active Medical Staff</h3>
        {doctors.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No doctors have been provisioned yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {doctors.map((doc) => (
              <div
                key={doc.id}
                className="card-base"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}
              >
                <div>
                  <strong style={{ fontSize: '1.05rem', display: 'block' }}>{doc.firstName} {doc.lastName}</strong>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>{doc.department} | {doc.degrees}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>{doc.email}</span>
                </div>
                <button
                  onClick={() => setEditingDoctor({ id: doc.id, name: `${doc.firstName} ${doc.lastName}` })}
                  className="btn btn-secondary btn-sm"
                >
                  Edit Availability
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
