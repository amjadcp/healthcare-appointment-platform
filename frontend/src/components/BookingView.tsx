import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { Clock, CreditCard, ChevronRight, Check } from 'lucide-react';
import { StatusBanner } from './StatusBanner';
import { appointmentService } from '../api/services/appointmentService';
import { doctorService } from '../api/services/doctorService';
import { getErrorMessage } from '../utils/error';
import type { Doctor, Appointment, SlotResponse, RequestStatus } from '../types';

export const BookingView: React.FC = () => {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [availableSlots, setAvailableSlots] = useState<SlotResponse[]>([]);
  const [bookedAppointment, setBookedAppointment] = useState<Appointment | null>(null);
  const [reservedAppointment, setReservedAppointment] = useState<Appointment | null>(null);

  // Form fields
  const [patientName, setPatientName] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  // Payment card fields
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');

  // UI state
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(30);

  // URL state
  const selectedDoctorId = searchParams.get('doctor') || '';
  const selectedDate = searchParams.get('date') || '';
  const todayStr = new Date().toISOString().split('T')[0];

  const formatSlug = (slug: string | undefined) =>
    slug?.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') ?? '';

  const orgNameReadable = formatSlug(orgSlug);

  const formatSlotTime = (isoString: string) =>
    new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

  const activeDoctor = doctors.find(d => d.id === selectedDoctorId);

  // Fetch doctors on component mount if org slug is present
  useEffect(() => {
    if (!orgSlug) return;
    setStatus('loading');
    setStatusMsg(`Connecting to ${orgNameReadable}...`);
    doctorService.getAll(orgSlug)
      .then(({ data }) => { setDoctors(data); setStatus('idle'); setStatusMsg(''); })
      .catch(err => { setStatus('error'); setStatusMsg(getErrorMessage(err)); });
  }, [orgSlug]);

  // Fetch available slots when a doctor and date are selected
  useEffect(() => {
    if (!selectedDoctorId || !selectedDate) { setAvailableSlots([]); return; }
    setStatus('loading');
    setStatusMsg('Fetching available slots...');
    doctorService.getSlots(selectedDoctorId, selectedDate)
      .then(({ data }) => { setAvailableSlots(data); setStatus('idle'); setStatusMsg(''); })
      .catch(err => { setStatus('error'); setStatusMsg(getErrorMessage(err)); });
  }, [selectedDoctorId, selectedDate]);

  // Handle the 30-second payment countdown timer
  useEffect(() => {
    if (!reservedAppointment) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timer); handleTimeout(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [reservedAppointment]);

  // Update URL search parameters to reflect selected state
  const handleDoctorChange = (id: string) => {
    setSelectedSlot(null);
    const next = new URLSearchParams(searchParams);
    id ? next.set('doctor', id) : next.delete('doctor');
    setSearchParams(next);
  };

  const handleDateChange = (date: string) => {
    setSelectedSlot(null);
    const next = new URLSearchParams(searchParams);
    date ? next.set('date', date) : next.delete('date');
    setSearchParams(next);
  };

  const refreshSlots = () => {
    if (!selectedDoctorId || !selectedDate) return;
    doctorService.getSlots(selectedDoctorId, selectedDate)
      .then(({ data }) => setAvailableSlots(data))
      .catch(console.error);
  };

  // Handle booking and payment actions
  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !selectedDate || !selectedSlot) return;
    setStatus('loading');
    setStatusMsg('Reserving appointment slot...');
    try {
      const { data } = await appointmentService.reserve({
        patientName,
        patientEmail: patientEmail.trim() || null,
        patientPhone,
        doctorId: selectedDoctorId,
        slotStartTime: selectedSlot,
      });
      setReservedAppointment(data);
      setTimeLeft(30);
      setStatus('idle');
      setStatusMsg('');
    } catch (err) {
      setStatus('error');
      setStatusMsg(getErrorMessage(err));
    }
  };

  const handleTimeout = async () => {
    if (!reservedAppointment) return;
    const id = reservedAppointment.id;
    setReservedAppointment(null);
    setSelectedSlot(null);
    setStatus('error');
    setStatusMsg('The 30-second payment window has expired. The slot has been released.');
    await appointmentService.release(id).catch(console.error);
    refreshSlots();
  };

  const handleCancelReservation = async () => {
    if (!reservedAppointment) return;
    setStatus('loading');
    setStatusMsg('Releasing slot...');
    try {
      await appointmentService.release(reservedAppointment.id);
      setReservedAppointment(null);
      setSelectedSlot(null);
      setStatus('idle');
      setStatusMsg('Slot reservation released.');
      refreshSlots();
    } catch (err) {
      setStatus('error');
      setStatusMsg(getErrorMessage(err));
    }
  };

  const handlePayment = async () => {
    if (!reservedAppointment) return;
    setStatus('loading');
    setStatusMsg('Processing payment...');
    try {
      const { data } = await appointmentService.confirmPayment(reservedAppointment.id);
      setBookedAppointment(data);
      setReservedAppointment(null);
      setStatus('success');
      setStatusMsg('Payment successful! Appointment confirmed.');
    } catch (err) {
      setStatus('error');
      setStatusMsg(getErrorMessage(err));
    }
  };

  const handleCancelAppointment = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    setStatus('loading');
    setStatusMsg('Cancelling appointment...');
    try {
      await appointmentService.cancel(id);
      setStatus('success');
      setStatusMsg('Appointment cancelled successfully.');
      setBookedAppointment(null);
      refreshSlots();
    } catch (err) {
      setStatus('error');
      setStatusMsg(getErrorMessage(err));
    }
  };

  // Formatting helpers for credit card inputs
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 16);
    setCardNumber(v.match(/.{1,4}/g)?.join(' ') ?? v);
  };

  const handleCardExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCardExpiry(v.length > 2 ? `${v.slice(0, 2)}/${v.slice(2)}` : v);
  };

  const handleCardCvvChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 3));


  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem', animation: 'fadeIn 0.4s ease-out' }}>
      <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.25rem' }}>
          🏥 {orgNameReadable}
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>Online Scheduling &amp; Appointment Flow</p>
      </header>

      <StatusBanner status={status} message={statusMsg} />

      {/* Confirmed Appointment State */}
      {bookedAppointment ? (
        <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid var(--success)', padding: '2rem', borderRadius: 'var(--radius-lg)', textAlign: 'center', marginBottom: '2rem', boxShadow: 'var(--shadow-lg)' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
            <Check size={32} color="white" />
          </div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Appointment Confirmed!</h2>
          {bookedAppointment.patientEmail && (
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              We've sent a confirmation email to <strong>{bookedAppointment.patientEmail}</strong>.
            </p>
          )}
          <div style={{ background: 'var(--bg-base)', padding: '1.5rem', borderRadius: 'var(--radius-md)', textAlign: 'left', maxWidth: '500px', margin: '0 auto 2rem auto', border: '1px solid var(--border)' }}>
            {[
              { label: 'Patient Name:', value: bookedAppointment.patientName },
              { label: 'Doctor:', value: bookedAppointment.doctorName },
              { label: 'Time slot:', value: `${new Date(bookedAppointment.slotStartTime).toLocaleDateString([], { timeZone: 'UTC' })} at ${formatSlotTime(bookedAppointment.slotStartTime)}` },
              { label: 'Payment Method:', value: paymentMethod },
              { label: 'Status:', value: bookedAppointment.status },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <strong style={label === 'Payment Method:' ? { color: 'var(--accent)' } : label === 'Status:' ? { color: 'var(--success)' } : undefined}>{value}</strong>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <button onClick={() => { setBookedAppointment(null); refreshSlots(); }} className="btn btn-primary">
              Book Another Appointment
            </button>
            <button onClick={() => handleCancelAppointment(bookedAppointment.id)} className="btn btn-danger">
              Cancel Appointment
            </button>
          </div>
        </div>

      /* Payment Checkout State */
      ) : reservedAppointment ? (
        <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
          <style>{`
            @keyframes scan { 0% { top:1.5rem; } 50% { top:calc(100% - 1.5rem); } 100% { top:1.5rem; } }
            @keyframes pulse-timer { 0%,100% { transform:scale(1); opacity:1; } 50% { transform:scale(1.05); opacity:0.8; } }
          `}</style>
          <div className="card" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>💳 Secure Checkout</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Please complete payment to finalize your appointment reservation.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: timeLeft <= 10 ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)', border: `1px solid ${timeLeft <= 10 ? 'var(--error)' : 'var(--primary)'}`, padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-md)', animation: timeLeft <= 10 ? 'pulse-timer 1s infinite' : 'none' }}>
                <Clock size={20} color={timeLeft <= 10 ? 'var(--error)' : 'var(--primary)'} />
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: timeLeft <= 10 ? 'var(--error)' : 'var(--text-main)', fontFamily: 'monospace' }}>
                  0:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              {/* Payment Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Payment Information</h3>

                {paymentMethod === 'CASH' && (
                  <div style={{ background: 'rgba(20,184,166,0.05)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-md)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent)' }}>
                      <Check size={24} /><strong style={{ fontSize: '1.1rem' }}>Pay at Clinic (Cash)</strong>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>Your booking will be confirmed immediately. Pay the consultation fees in person at the clinic desk.</p>
                    <div style={{ fontSize: '0.8rem', color: 'var(--warning)', fontWeight: 500 }}>⚠️ Please arrive 10-15 minutes prior to your slot time.</div>
                  </div>
                )}

                {paymentMethod === 'CARD' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Card preview */}
                    <div style={{ background: 'linear-gradient(135deg,#6366f1,#14b8a6)', borderRadius: '16px', padding: '1.5rem', color: 'white', boxShadow: 'var(--shadow-lg)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '180px', border: '1px solid rgba(255,255,255,0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '1px' }}>PAYCARD</span>
                        <CreditCard size={28} />
                      </div>
                      <div style={{ fontSize: '1.4rem', letterSpacing: '3px', margin: '1.5rem 0 0.5rem', fontFamily: 'monospace' }}>{cardNumber || '•••• •••• •••• ••••'}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div><div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Card Holder</div><div style={{ fontSize: '0.95rem', fontWeight: 600, letterSpacing: '1px' }}>{cardName.toUpperCase() || 'YOUR NAME'}</div></div>
                        <div><div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Expires</div><div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{cardExpiry || 'MM/YY'}</div></div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div><label className="form-label">Cardholder Name</label><input type="text" placeholder="John Doe" value={cardName} onChange={e => setCardName(e.target.value)} className="form-input" /></div>
                      <div><label className="form-label">Card Number</label><input type="text" placeholder="1234 5678 1234 5678" value={cardNumber} onChange={handleCardNumberChange} className="form-input" style={{ fontFamily: 'monospace' }} /></div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div><label className="form-label">Expiration Date</label><input type="text" placeholder="MM/YY" value={cardExpiry} onChange={handleCardExpiryChange} className="form-input" style={{ fontFamily: 'monospace' }} /></div>
                        <div><label className="form-label">CVV</label><input type="password" placeholder="•••" value={cardCvv} onChange={handleCardCvvChange} className="form-input" style={{ fontFamily: 'monospace' }} /></div>
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethod === 'UPI' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center' }}>Scan this QR code using any UPI app (GPay, PhonePe, Paytm, BHIM) to pay.</p>
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '200px', height: '200px', position: 'relative', border: '1px solid var(--border)' }}>
                      <svg width="140" height="140" viewBox="0 0 100 100" style={{ fill: '#0f172a' }}>
                        <path d="M0 0h30v10H10v20H0V0zm70 0h30v30H90V10H70V0zM0 70h10v20h20v10H0V70zm90 0h10v30H70v-10h20V70z" />
                        <rect x="40" y="10" width="10" height="10" /><rect x="50" y="20" width="10" height="10" />
                        <rect x="40" y="40" width="10" height="20" /><rect x="50" y="50" width="20" height="10" />
                        <rect x="10" y="40" width="10" height="10" /><rect x="20" y="50" width="10" height="10" />
                        <rect x="40" y="80" width="20" height="10" /><rect x="80" y="40" width="10" height="10" />
                        <rect x="70" y="50" width="10" height="20" /><rect x="80" y="80" width="10" height="10" /><rect x="90" y="90" width="10" height="10" />
                      </svg>
                      <div style={{ position: 'absolute', left: '1.5rem', right: '1.5rem', height: '3px', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)', animation: 'scan 2s linear infinite', borderRadius: '2px' }} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>Merchant: <strong>{orgNameReadable} Scheduling</strong></span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block' }}>UPI ID: <strong>pay@{orgSlug}.medbook</strong></span>
                    </div>
                  </div>
                )}
              </div>

              {/* Reservation Summary */}
              <div className="card-base" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', color: 'var(--primary)' }}>Reservation Summary</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.95rem' }}>
                    {[
                      { label: 'Clinic:', value: orgNameReadable },
                      { label: 'Doctor:', value: reservedAppointment.doctorName },
                      { label: 'Patient Name:', value: reservedAppointment.patientName },
                      { label: 'Phone:', value: reservedAppointment.patientPhone },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{label}</span><strong>{value}</strong>
                      </div>
                    ))}
                    {reservedAppointment.patientEmail && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Email:</span><strong>{reservedAppointment.patientEmail}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Time Slot:</span>
                      <strong style={{ textAlign: 'right' }}>
                        {new Date(reservedAppointment.slotStartTime).toLocaleDateString([], { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })}<br />
                        at {formatSlotTime(reservedAppointment.slotStartTime)}
                      </strong>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                    {[{ label: 'Consultation Fee:', val: '$100.00' }, { label: 'GST / Service Fee (18%):', val: '$18.00' }].map(({ label, val }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}><span>{label}</span><span>{val}</span></div>
                    ))}
                    <hr style={{ border: 'none', borderTop: '1px dashed var(--border)', margin: '0.5rem 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>Total Payable:</span>
                      <strong style={{ fontSize: '1.3rem', color: 'var(--accent)' }}>$118.00</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button type="button" onClick={handlePayment} className="btn btn-primary" style={{ width: '100%', padding: '0.9rem' }}>
                      <Check size={18} /> Confirm &amp; Pay Now
                    </button>
                    <button type="button" onClick={handleCancelReservation} className="btn btn-secondary" style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem' }}>
                      Cancel &amp; Release Slot
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      /* Initial Booking Form */
      ) : (
        <div style={{ display: 'grid', gap: '2rem' }}>
          {/* Step 1: Doctor + Date */}
          <div className="card">
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', width: '32px', height: '32px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem' }}>1</span>
              Select Doctor &amp; Date
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 500 }}>Consulting Doctor</label>
                <select value={selectedDoctorId} onChange={e => handleDoctorChange(e.target.value)} className="form-input">
                  <option value="">-- Select a Doctor --</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.firstName} {d.lastName} ({d.department})</option>
                  ))}
                </select>
                {activeDoctor && <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Degrees: <em>{activeDoctor.degrees}</em></p>}
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 500 }}>Appointment Date</label>
                <input type="date" min={todayStr} value={selectedDate} onChange={e => handleDateChange(e.target.value)} className="form-input" />
              </div>
            </div>
          </div>

          {/* Step 2: Slots */}
          {selectedDoctorId && selectedDate && (
            <div className="card" style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', width: '32px', height: '32px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem' }}>2</span>
                Available Time Slots
              </h2>
              {availableSlots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>No available slots for this date.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.75rem' }}>
                  {availableSlots.map(slot => {
                    const isSelected = selectedSlot === slot.slotStartTime;
                    const isPendingPayment = slot.status === 'PENDING_PAYMENT';
                    return (
                      <button
                        key={slot.slotStartTime}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => setSelectedSlot(slot.slotStartTime)}
                        title={!slot.available ? (isPendingPayment ? 'Temporarily held for payment' : 'Already booked') : undefined}
                        style={{
                          background: isSelected ? 'var(--primary)' : slot.available ? 'var(--bg-base)' : 'rgba(255,255,255,0.02)',
                          color: isSelected ? 'white' : slot.available ? 'var(--text-main)' : 'var(--text-muted)',
                          border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                          padding: '0.75rem 0.5rem', borderRadius: 'var(--radius-md)',
                          cursor: slot.available ? 'pointer' : 'not-allowed',
                          textAlign: 'center', fontWeight: 500,
                          opacity: !slot.available && !isSelected ? 0.4 : 1,
                          transition: 'all var(--transition-fast)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.2rem'
                        }}
                      >
                        <span>{formatSlotTime(slot.slotStartTime)}</span>
                        {!slot.available && (
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

          {/* Step 3: Patient Form */}
          {selectedSlot && (
            <form onSubmit={handleBook} className="card" style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', width: '32px', height: '32px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem' }}>3</span>
                Patient Details
              </h2>
              <div style={{ display: 'grid', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <label className="form-label">Full Name</label>
                  <input type="text" required value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="e.g. John Doe" className="form-input" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  <div>
                    <label className="form-label">Email Address (Optional)</label>
                    <input type="email" value={patientEmail} onChange={e => setPatientEmail(e.target.value)} placeholder="e.g. john@example.com" className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Phone Number</label>
                    <input type="tel" required value={patientPhone} onChange={e => setPatientPhone(e.target.value)} placeholder="e.g. +1 555-0199" className="form-input" />
                  </div>
                </div>
                <div>
                  <label className="form-label">Payment Option</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                    {['CASH', 'CARD', 'UPI'].map(method => (
                      <label key={method} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', background: 'var(--bg-base)', border: paymentMethod === method ? '2px solid var(--primary)' : '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all var(--transition-fast)' }}>
                        <input type="radio" name="payment" value={method} checked={paymentMethod === method} onChange={() => setPaymentMethod(method)} style={{ accentColor: 'var(--primary)' }} />
                        <span style={{ fontWeight: 600 }}>{method === 'CASH' ? 'Cash' : method === 'CARD' ? 'Credit Card' : 'UPI'}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}>
                Reserve &amp; Proceed to Payment <ChevronRight size={18} />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
