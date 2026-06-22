import React from 'react';
import { Routes, Route, Link, useSearchParams } from 'react-router-dom';

function App() {
  const [searchParams] = useSearchParams();
  const currentView = searchParams.get('view') || 'booking';

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏥 MedBook</h1>
        <p style={{ color: 'var(--text-muted)' }}>Premium Healthcare Appointment Platform</p>
      </header>
      
      <main style={{ background: 'var(--bg-surface)', padding: '2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <h2>Welcome to MedBook</h2>
        <p style={{ margin: '1rem 0', color: 'var(--text-muted)' }}>
          Active View: <strong>{currentView}</strong>
        </p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link to="?view=booking" style={{ background: 'var(--primary)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', color: 'white' }}>Booking</Link>
          <Link to="?view=admin" style={{ background: 'var(--bg-surface-elevated)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', color: 'white', border: '1px solid var(--border)' }}>Admin Portal</Link>
        </div>
      </main>
    </div>
  );
}

export default App;
