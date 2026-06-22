import React from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { BookingView } from './components/BookingView';
import { AdminPortal } from './components/AdminPortal';

function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Routes>
        {/* Patient Booking View for a specific organization */}
        <Route path="/o/:orgSlug" element={<BookingView />} />

        {/* Admin/Doctor Portal */}
        <Route path="/admin" element={<AdminPortal />} />

        {/* Default route: Landing page for MedBook SaaS */}
        <Route
          path="/"
          element={
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '3rem 2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🏥</div>
              <h1 style={{ fontSize: '2.75rem', fontWeight: 800, marginBottom: '1rem', letterSpacing: '-0.025em' }}>
                MedBook SaaS
              </h1>
              <p style={{ color: 'var(--text-muted)', maxWidth: '550px', marginBottom: '2rem', fontSize: '1.1rem', lineHeight: '1.6' }}>
                The premium multi-tenant healthcare appointment booking platform. Register your medical organisation or sign in to manage doctors and schedules.
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <Link
                  to="/admin"
                  style={{
                    background: 'var(--primary)',
                    color: 'white',
                    padding: '0.85rem 2rem',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 600,
                    fontSize: '1rem',
                    boxShadow: 'var(--shadow-md)',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  Manage Your Clinic (Admin / Doctor)
                </Link>
              </div>

              <footer style={{ marginTop: '5rem', color: 'var(--text-muted)', fontSize: '0.8rem', opacity: 0.8 }}>
                &copy; 2026 MedBook Healthcare Inc. Secured multi-tenant SaaS architecture.
              </footer>
            </div>
          }
        />

        {/* Catch-all redirects back to root */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
