import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { Clock, CreditCard, ChevronRight, Check } from 'lucide-react';
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

interface SlotResponse {
  slotStartTime: string;
  available: boolean;
  status: string;
}

export const BookingView: React.FC = () => {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [availableSlots, setAvailableSlots] = useState<SlotResponse[]>([]);
  
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
  
  // Reservation states
  const [reservedAppointment, setReservedAppointment] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');

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

  const refreshSlots = async () => {
    if (!selectedDoctorId || !selectedDate) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/slots/available?doctorId=${selectedDoctorId}&date=${selectedDate}`
      );
      if (res.ok) {
        const data = await res.json();
        setAvailableSlots(data);
      }
    } catch (err) {
      console.error('Error refreshing slots:', err);
    }
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !selectedDate || !selectedSlot) return;

    setStatus('loading');
    setStatusMsg('Reserving appointment slot...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/appointments/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          patientName,
          patientEmail: patientEmail.trim() || null,
          patientPhone,
          doctorId: selectedDoctorId,
          slotStartTime: selectedSlot
        })
      });

      if (res.status === 409) {
        throw new Error('This slot is already reserved or booked. Please choose another slot.');
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to reserve slot');
      }

      const appointment = await res.json();
      setReservedAppointment(appointment);
      setTimeLeft(30);
      setStatus('idle');
      setStatusMsg('');
    } catch (err: any) {
      setStatus('error');
      setStatusMsg(err.message || 'Reservation failed');
    }
  };

  const handleTimeout = async () => {
    if (!reservedAppointment) return;
    const appointmentId = reservedAppointment.id;
    setReservedAppointment(null);
    setSelectedSlot(null);
    setStatus('error');
    setStatusMsg('The 30-second payment window has expired. The slot has been released.');
    try {
      await fetch(`${API_BASE_URL}/api/v1/appointments/${appointmentId}/release`, {
        method: 'POST'
      });
    } catch (err) {
      console.error('Failed to release reservation:', err);
    }
    refreshSlots();
  };

  const handleCancelReservation = async () => {
    if (!reservedAppointment) return;
    const appointmentId = reservedAppointment.id;
    setStatus('loading');
    setStatusMsg('Releasing slot...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/appointments/${appointmentId}/release`, {
        method: 'POST'
      });
      if (res.ok) {
        setReservedAppointment(null);
        setSelectedSlot(null);
        setStatus('idle');
        setStatusMsg('Slot reservation released.');
        refreshSlots();
      } else {
        throw new Error('Failed to release reservation');
      }
    } catch (err: any) {
      setStatus('error');
      setStatusMsg(err.message || 'Error releasing slot');
    }
  };

  const handlePayment = async () => {
    if (!reservedAppointment) return;
    setStatus('loading');
    setStatusMsg('Processing payment...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/appointments/${reservedAppointment.id}/confirm-payment`, {
        method: 'POST'
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to confirm payment');
      }
      const confirmedAppointment = await res.json();
      setBookedAppointment(confirmedAppointment);
      setReservedAppointment(null);
      setStatus('success');
      setStatusMsg('Payment successful! Appointment confirmed.');
    } catch (err: any) {
      setStatus('error');
      setStatusMsg(err.message || 'Payment confirmation failed');
    }
  };

  // Card formatting helpers
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 16) value = value.slice(0, 16);
    const parts = value.match(/.{1,4}/g);
    setCardNumber(parts ? parts.join(' ') : value);
  };

  const handleCardExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length > 2) {
      setCardExpiry(`${value.slice(0, 2)}/${value.slice(2)}`);
    } else {
      setCardExpiry(value);
    }
  };

  const handleCardCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 3) value = value.slice(0, 3);
    setCardCvv(value);
  };

  useEffect(() => {
    if (!reservedAppointment) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [reservedAppointment]);

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
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
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
          {bookedAppointment.patientEmail && (
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              We've sent a confirmation email to <strong>{bookedAppointment.patientEmail}</strong>.
            </p>
          )}

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
                {new Date(bookedAppointment.slotStartTime).toLocaleDateString([], { timeZone: 'UTC' })} at{' '}
                {formatSlotTime(bookedAppointment.slotStartTime)}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Payment Method:</span>
              <strong style={{ color: 'var(--accent)' }}>{paymentMethod}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Status:</span>
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>{bookedAppointment.status}</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <button
              onClick={() => {
                setBookedAppointment(null);
                refreshSlots();
              }}
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
      ) : reservedAppointment ? (
        <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
          <style>{`
            @keyframes scan {
              0% { top: 1.5rem; }
              50% { top: calc(100% - 1.5rem); }
              100% { top: 1.5rem; }
            }
            @keyframes pulse-timer {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.05); opacity: 0.8; }
            }
          `}</style>

          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '2rem',
              boxShadow: 'var(--shadow-lg)',
              marginBottom: '2rem'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '1.5rem',
                marginBottom: '2rem',
                flexWrap: 'wrap',
                gap: '1rem'
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>💳 Secure Checkout</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Please complete payment to finalize your appointment reservation.
                </p>
              </div>
              
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  background: timeLeft <= 10 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                  border: `1px solid ${timeLeft <= 10 ? 'var(--error)' : 'var(--primary)'}`,
                  padding: '0.75rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  animation: timeLeft <= 10 ? 'pulse-timer 1s infinite' : 'none'
                }}
              >
                <Clock size={20} color={timeLeft <= 10 ? 'var(--error)' : 'var(--primary)'} />
                <span
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: timeLeft <= 10 ? 'var(--error)' : 'var(--text-main)',
                    fontFamily: 'monospace'
                  }}
                >
                  0:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr md:1.2fr',
                  gap: '2rem'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                    Payment Information
                  </h3>

                  {paymentMethod === 'CASH' && (
                    <div
                      style={{
                        background: 'rgba(20, 184, 166, 0.05)',
                        border: '1px solid var(--accent)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent)' }}>
                        <Check size={24} />
                        <strong style={{ fontSize: '1.1rem' }}>Pay at Clinic (Cash)</strong>
                      </div>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        Your booking will be confirmed immediately. You will pay the consultation fees in person when you check in at the clinic desk.
                      </p>
                      <div style={{ fontSize: '0.8rem', color: 'var(--warning)', fontWeight: 500 }}>
                        ⚠️ Please arrive 10-15 minutes prior to your slot time.
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'CARD' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div
                        style={{
                          background: 'linear-gradient(135deg, #6366f1, #14b8a6)',
                          borderRadius: '16px',
                          padding: '1.5rem',
                          color: 'white',
                          boxShadow: 'var(--shadow-lg)',
                          position: 'relative',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          height: '180px',
                          border: '1px solid rgba(255,255,255,0.2)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '1px' }}>PAYCARD</span>
                          <CreditCard size={28} />
                        </div>
                        <div style={{ fontSize: '1.4rem', letterSpacing: '3px', margin: '1.5rem 0 0.5rem 0', fontFamily: 'monospace' }}>
                          {cardNumber || '•••• •••• •••• ••••'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                          <div>
                            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Card Holder</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 600, letterSpacing: '1px' }}>{cardName.toUpperCase() || 'YOUR NAME'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Expires</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{cardExpiry || 'MM/YY'}</div>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            Cardholder Name
                          </label>
                          <input
                            type="text"
                            placeholder="John Doe"
                            value={cardName}
                            onChange={(e) => setCardName(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.75rem 1rem',
                              background: 'var(--bg-base)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-md)',
                              color: 'var(--text-main)',
                              outline: 'none'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            Card Number
                          </label>
                          <input
                            type="text"
                            placeholder="1234 5678 1234 5678"
                            value={cardNumber}
                            onChange={handleCardNumberChange}
                            style={{
                              width: '100%',
                              padding: '0.75rem 1rem',
                              background: 'var(--bg-base)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-md)',
                              color: 'var(--text-main)',
                              outline: 'none',
                              fontFamily: 'monospace'
                            }}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              Expiration Date
                            </label>
                            <input
                              type="text"
                              placeholder="MM/YY"
                              value={cardExpiry}
                              onChange={handleCardExpiryChange}
                              style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                background: 'var(--bg-base)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-main)',
                                outline: 'none',
                                fontFamily: 'monospace'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              CVV
                            </label>
                            <input
                              type="password"
                              placeholder="•••"
                              value={cardCvv}
                              onChange={handleCardCvvChange}
                              style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                background: 'var(--bg-base)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-main)',
                                outline: 'none',
                                fontFamily: 'monospace'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'UPI' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                        Scan this QR code using any UPI app (GPay, PhonePe, Paytm, BHIM) to pay.
                      </p>
                      
                      <div
                        style={{
                          background: 'white',
                          padding: '1.5rem',
                          borderRadius: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '200px',
                          height: '200px',
                          position: 'relative',
                          border: '1px solid var(--border)'
                        }}
                      >
                        <svg width="140" height="140" viewBox="0 0 100 100" style={{ fill: '#0f172a' }}>
                          <path d="M0 0h30v10H10v20H0V0zm70 0h30v30H90V10H70V0zM0 70h10v20h20v10H0V70zm90 0h10v30H70v-10h20V70z" />
                          <path d="M0 0h30v30H0V0zm5 5h20v20H5V5zm5 5h10v10H10V10zm60-10h30v30H70V0zm5 5h20v20H75V5zm5 5h10v10H80V10zM0 70h30v30H0V70zm5 5h20v20H5V75zm5 5h10v10H10V80z" />
                          <rect x="40" y="10" width="10" height="10" />
                          <rect x="50" y="20" width="10" height="10" />
                          <rect x="40" y="40" width="10" height="20" />
                          <rect x="50" y="50" width="20" height="10" />
                          <rect x="10" y="40" width="10" height="10" />
                          <rect x="20" y="50" width="10" height="10" />
                          <rect x="40" y="80" width="20" height="10" />
                          <rect x="80" y="40" width="10" height="10" />
                          <rect x="70" y="50" width="10" height="20" />
                          <rect x="80" y="80" width="10" height="10" />
                          <rect x="90" y="90" width="10" height="10" />
                        </svg>
                        
                        <div
                          style={{
                            position: 'absolute',
                            left: '1.5rem',
                            right: '1.5rem',
                            height: '3px',
                            background: 'var(--accent)',
                            boxShadow: '0 0 8px var(--accent)',
                            animation: 'scan 2s linear infinite',
                            borderRadius: '2px'
                          }}
                        />
                      </div>
                      
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>
                          Merchant: <strong>{orgNameReadable} Scheduling</strong>
                        </span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>
                          UPI ID: <strong>pay@{orgSlug}.medbook</strong>
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    background: 'var(--bg-base)',
                    padding: '1.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '1.5rem'
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', color: 'var(--primary)' }}>
                      Reservation Summary
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.95rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Clinic:</span>
                        <strong>{orgNameReadable}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Doctor:</span>
                        <strong>Dr. {reservedAppointment.doctorName}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Time Slot:</span>
                        <strong style={{ textAlign: 'right' }}>
                          {new Date(reservedAppointment.slotStartTime).toLocaleDateString([], { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })}
                          <br />
                          at {formatSlotTime(reservedAppointment.slotStartTime)}
                        </strong>
                      </div>
                      
                      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.5rem 0' }} />
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Patient Name:</span>
                        <strong>{reservedAppointment.patientName}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Phone:</span>
                        <strong>{reservedAppointment.patientPhone}</strong>
                      </div>
                      {reservedAppointment.patientEmail && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Email:</span>
                          <strong>{reservedAppointment.patientEmail}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: '1.5rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                        <span>Consultation Fee:</span>
                        <span>$100.00</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                        <span>GST / Service Fee (18%):</span>
                        <span>$18.00</span>
                      </div>
                      <hr style={{ border: 'none', borderTop: '1px dashed var(--border)', margin: '0.5rem 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>Total Payable:</span>
                        <strong style={{ fontSize: '1.3rem', color: 'var(--accent)' }}>$118.00</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={handlePayment}
                        style={{
                          width: '100%',
                          background: 'var(--primary)',
                          color: 'white',
                          border: 'none',
                          padding: '0.9rem',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '1rem',
                          transition: 'background var(--transition-fast)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        <Check size={18} /> Confirm & Pay Now
                      </button>
                      
                      <button
                        type="button"
                        onClick={handleCancelReservation}
                        style={{
                          width: '100%',
                          background: 'none',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border)',
                          padding: '0.75rem',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        Cancel & Release Slot
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </div>
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
                    const isSelected = selectedSlot === slot.slotStartTime;
                    const isAvailable = slot.available;
                    const isPendingPayment = slot.status === 'PENDING_PAYMENT';
                    
                    let btnStyle: React.CSSProperties = {
                      background: isSelected ? 'var(--primary)' : 'var(--bg-base)',
                      color: isSelected ? 'white' : 'var(--text-main)',
                      border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                      padding: '0.75rem 0.5rem',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      fontWeight: 500,
                      transition: 'all var(--transition-fast)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.2rem'
                    };
                    
                    if (!isAvailable && !isSelected) {
                      btnStyle.background = 'rgba(255, 255, 255, 0.02)';
                      btnStyle.color = 'var(--text-muted)';
                      btnStyle.borderColor = 'var(--border)';
                      btnStyle.opacity = 0.4;
                      btnStyle.cursor = 'not-allowed';
                    }

                    return (
                      <button
                        key={slot.slotStartTime}
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => setSelectedSlot(slot.slotStartTime)}
                        style={btnStyle}
                        title={!isAvailable ? (isPendingPayment ? 'Temporarily held for payment' : 'Already booked') : undefined}
                      >
                        <span>{formatSlotTime(slot.slotStartTime)}</span>
                        {!isAvailable && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: isPendingPayment ? 'var(--warning)' : 'var(--error)' }}>
                            {isPendingPayment ? 'Locked' : 'HELD/BOOKED'}
                          </span>
                        )}
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
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
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
                    {/* CASH Payment */}
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1rem',
                        background: 'var(--bg-base)',
                        border: paymentMethod === 'CASH' ? '2px solid var(--primary)' : '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)'
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

                    {/* CREDIT CARD */}
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1rem',
                        background: 'var(--bg-base)',
                        border: paymentMethod === 'CARD' ? '2px solid var(--primary)' : '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="radio"
                          name="payment"
                          value="CARD"
                          checked={paymentMethod === 'CARD'}
                          onChange={() => setPaymentMethod('CARD')}
                          style={{ accentColor: 'var(--primary)' }}
                        />
                        <span style={{ fontWeight: 600 }}>Credit Card</span>
                      </div>
                    </label>

                    {/* UPI */}
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1rem',
                        background: 'var(--bg-base)',
                        border: paymentMethod === 'UPI' ? '2px solid var(--primary)' : '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="radio"
                          name="payment"
                          value="UPI"
                          checked={paymentMethod === 'UPI'}
                          onChange={() => setPaymentMethod('UPI')}
                          style={{ accentColor: 'var(--primary)' }}
                        />
                        <span style={{ fontWeight: 600 }}>UPI</span>
                      </div>
                    </label>
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
                Reserve & Proceed to Payment <ChevronRight size={18} />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
