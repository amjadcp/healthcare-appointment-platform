import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import { Calendar, Clock, User, Mail, Phone, CreditCard, ChevronRight, Check, ArrowLeft } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { StatusBanner } from './StatusBanner';

interface Doctor {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  department: string;
  degrees: string;
}

export const BookingView: React.FC = () => {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  
  // Form fields
  const [patientName, setPatientName] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  
  // UI states
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookedAppointment, setBookedAppointment] = useState<any>(null);

  // URL state synchronization
  const selectedDoctorId = searchParams.get('doctor') || '';
  const selectedDate = searchParams.get('date') || '';

  // Get current date in local YYYY-MM-DD format as minimum selection
  const todayStr = new Date().toISOString().split('T')[0];

  const formatSlug = (slug: string | undefined) => {
    if (!slug) return '';
    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const orgNameReadable = formatSlug(orgSlug);

  // Fetch doctors for this specific organization on load/slug change
  useEffect(() => {
    if (!orgSlug) return;

    const fetchDoctors = async () => {
      setStatus('loading');
      setStatusMsg(`Connecting to ${orgNameReadable}...`);
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/doctors?orgSlug=${orgSlug}`);
        if (!res.ok) throw new Error('Failed to load doctors list for this clinic');
        const data = await res.json();
        setDoctors(data);
        setStatus('idle');
        setStatusMsg('');
      } catch (err: any) {
        setStatus('error');
        setStatusMsg(err.message || 'Error fetching doctors');
      }
    };
    
    fetchDoctors();
  }, [orgSlug]);

  // Fetch slots when doctor or date changes
  useEffect(() => {
    if (!selectedDoctorId || !selectedDate) {
      setAvailableSlots([]);
      return;
    }

    const fetchSlots = async () => {
      setStatus('loading');
      setStatusMsg('Fetching available slots...');
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/v1/slots/available?doctorId=${selectedDoctorId}&date=${selectedDate}`
        );
        if (!res.ok) throw new Error('Failed to retrieve available slots');
        const data = await res.json();
        setAvailableSlots(data);
        setStatus('idle');
        setStatusMsg('');
      } catch (err: any) {
        setStatus('error');
        setStatusMsg(err.message || 'Error retrieving slots');
      }
    };

    fetchSlots();
  }, [selectedDoctorId, selectedDate]);

  const handleDoctorChange = (id: string) => {
    setSelectedSlot(null);
    const newParams = new URLSearchParams(searchParams);
    if (id) {
      newParams.set('doctor', id);
    } else {
      newParams.delete('doctor');
    }
    setSearchParams(newParams);
  };

  const handleDateChange = (date: string) => {
    setSelectedSlot(null);
    const newParams = new URLSearchParams(searchParams);
    if (date) {
      newParams.set('date', date);
    } else {
      newParams.delete('date');
    }
    setSearchParams(newParams);
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !selectedDate || !selectedSlot) return;

    setStatus('loading');
    setStatusMsg('Booking appointment...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          patientName,
          patientEmail,
          patientPhone,
          doctorId: selectedDoctorId,
          slotStartTime: selectedSlot
        })
      });

      if (res.status === 409) {
        throw new Error('This slot is already booked. Please choose another slot.');
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to book appointment');
      }

      const appointment = await res.json();
      setBookedAppointment(appointment);
      setStatus('success');
      setStatusMsg('Appointment booked successfully!');
      
      // Clear form
      setPatientName('');
      setPatientEmail('');
      setPatientPhone('');
      setSelectedSlot(null);
    } catch (err: any) {
      setStatus('error');
      setStatusMsg(err.message || 'Booking failed');
    }
  };

  const handleCancelAppointment = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;

    setStatus('loading');
    setStatusMsg('Cancelling appointment...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/appointments/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Cancellation failed');
      
      setStatus('success');
      setStatusMsg('Appointment cancelled successfully.');
      setBookedAppointment(null);
      // Refresh slots
      if (selectedDoctorId && selectedDate) {
        const slotsRes = await fetch(
          `${API_BASE_URL}/api/v1/slots/available?doctorId=${selectedDoctorId}&date=${selectedDate}`
        );
        if (slotsRes.ok) {
          const slotsData = await slotsRes.json();
          setAvailableSlots(slotsData);
        }
      }
    } catch (err: any) {
      setStatus('error');
      setStatusMsg(err.message || 'Error cancelling appointment');
    }
  };

  const formatSlotTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const activeDoctor = doctors.find(d => d.id === selectedDoctorId);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem', animation: 'fadeIn 0.4s ease-out' }}>
      
      {/* Patient Specific Header */}
      <header style={{ marginBottom: '2rem', textAlign: 'center', position: 'relative' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.25rem' }}>
          🏥 {orgNameReadable}
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>Online Scheduling & Appointment Flow</p>
      </header>

      <StatusBanner status={status} message={statusMsg} />

      {bookedAppointment ? (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.05)',
            border: '1px solid var(--success)',
            padding: '2rem',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center',
            marginBottom: '2rem',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem auto'
            }}
          >
            <Check size={32} color="white" />
          </div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Appointment Confirmed!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            We've sent a confirmation email to <strong>{bookedAppointment.patientEmail}</strong>.
          </p>

          <div
            style={{
              background: 'var(--bg-base)',
              padding: '1.5rem',
              borderRadius: 'var(--radius-md)',
              textAlign: 'left',
              maxWidth: '500px',
              margin: '0 auto 2rem auto',
              border: '1px solid var(--border)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Patient Name:</span>
              <strong>{bookedAppointment.patientName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Doctor:</span>
              <strong>Dr. {bookedAppointment.doctorName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Time slot:</span>
              <strong>
                {new Date(bookedAppointment.slotStartTime).toLocaleDateString()} at{' '}
                {formatSlotTime(bookedAppointment.slotStartTime)}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Payment Method:</span>
              <strong style={{ color: 'var(--accent)' }}>{bookedAppointment.paymentMethod}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Status:</span>
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>{bookedAppointment.status}</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <button
              onClick={() => setBookedAppointment(null)}
              style={{
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'background var(--transition-fast)'
              }}
            >
              Book Another Appointment
            </button>
            <button
              onClick={() => handleCancelAppointment(bookedAppointment.id)}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--error)',
                border: '1px solid var(--error)',
                padding: '0.75rem 1.5rem',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'background var(--transition-fast)'
              }}
            >
              Cancel Appointment
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          {/* Step 1 & 2: Doctor and Date selection */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '2rem',
              boxShadow: 'var(--shadow-md)'
            }}
          >
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', width: '32px', height: '32px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem' }}>1</span>
              Select Doctor & Date
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr md:1fr', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
                  Consulting Doctor
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => handleDoctorChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.85rem 1rem',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-main)',
                      fontSize: '1rem',
                      appearance: 'none',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'border-color var(--transition-fast)'
                    }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--border-focus)')}
                    onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                  >
                    <option value="">-- Select a Doctor --</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        Dr. {d.firstName} {d.lastName} ({d.department})
                      </option>
                    ))}
                  </select>
                </div>
                {activeDoctor && (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Degrees: <em>{activeDoctor.degrees}</em>
                  </p>
                )}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
                  Appointment Date
                </label>
                <input
                  type="date"
                  min={todayStr}
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.85rem 1rem',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-main)',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'border-color var(--transition-fast)'
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--border-focus)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
            </div>
          </div>

          {/* Step 3: Slots grid */}
          {selectedDoctorId && selectedDate && (
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem',
                boxShadow: 'var(--shadow-md)',
                animation: 'fadeIn 0.3s ease-out'
              }}
            >
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', width: '32px', height: '32px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem' }}>2</span>
                Available Time Slots
              </h2>

              {availableSlots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                  No available appointment slots found for this date.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                    gap: '0.75rem'
                  }}
                >
                  {availableSlots.map((slot) => {
                    const isSelected = selectedSlot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        style={{
                          background: isSelected ? 'var(--primary)' : 'var(--bg-base)',
                          color: isSelected ? 'white' : 'var(--text-main)',
                          border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                          padding: '0.75rem 0.5rem',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          textAlign: 'center',
                          fontWeight: 500,
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        {formatSlotTime(slot)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Patient Form */}
          {selectedSlot && (
            <form
              onSubmit={handleBook}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem',
                boxShadow: 'var(--shadow-md)',
                animation: 'fadeIn 0.3s ease-out'
              }}
            >
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', width: '32px', height: '32px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem' }}>3</span>
                Patient Details
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="e.g. John Doe"
                    style={{
                      width: '100%',
                      padding: '0.85rem 1rem',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-main)',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr md:1fr', gap: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={patientEmail}
                      onChange={(e) => setPatientEmail(e.target.value)}
                      placeholder="e.g. john@example.com"
                      style={{
                        width: '100%',
                        padding: '0.85rem 1rem',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-main)',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={patientPhone}
                      onChange={(e) => setPatientPhone(e.target.value)}
                      placeholder="e.g. +1 555-0199"
                      style={{
                        width: '100%',
                        padding: '0.85rem 1rem',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-main)',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Payment Option
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                    {/* CASH Payment - Enabled */}
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1rem',
                        background: 'var(--bg-base)',
                        border: '2px solid var(--primary)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="radio"
                          name="payment"
                          value="CASH"
                          checked={paymentMethod === 'CASH'}
                          onChange={() => setPaymentMethod('CASH')}
                          style={{ accentColor: 'var(--primary)' }}
                        />
                        <span style={{ fontWeight: 600 }}>Cash</span>
                      </div>
                    </label>

                    {/* CREDIT CARD - Disabled */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1rem',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px dashed var(--border)',
                        borderRadius: 'var(--radius-md)',
                        opacity: 0.5,
                        cursor: 'not-allowed'
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, display: 'block', fontSize: '0.95rem' }}>Credit Card</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 500 }}>Coming soon</span>
                      </div>
                    </div>

                    {/* UPI - Disabled */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1rem',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px dashed var(--border)',
                        borderRadius: 'var(--radius-md)',
                        opacity: 0.5,
                        cursor: 'not-allowed'
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, display: 'block', fontSize: '0.95rem' }}>UPI / NetBanking</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 500 }}>Coming soon</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  background: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '1rem',
                  transition: 'background var(--transition-fast)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                Confirm Appointment Slot <ChevronRight size={18} />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
