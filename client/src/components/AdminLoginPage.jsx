import React, { useState } from 'react';
import { Shield, Lock } from 'lucide-react';

export default function AdminLoginPage({ onLoginSuccess, onCancel }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pin.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() })
      });

      if (res.ok) {
        onLoginSuccess(pin.trim());
      } else {
        setError('Invalid master PIN. (Default demo PIN is "admin123")');
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: 440, margin: '40px auto' }}>
      <div className="wt-transfer-card" style={{ width: '100%', maxWidth: 440, margin: '0 auto', textAlign: 'center', padding: '32px 28px' }}>
        <div style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          background: '#eff6ff',
          color: '#2563eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px'
        }}>
          <Shield size={26} />
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
          Super Admin Portal
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 22 }}>
          Enter master PIN to manage storage vaults, client retention, and purges.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ textAlign: 'left' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
              Master PIN Key
            </label>
            <input
              type="password"
              placeholder="Enter PIN .."
              className="clean-input"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
              required
            />
          </div>

          {error && (
            <div style={{ color: '#e11d48', fontSize: '0.8rem', textAlign: 'left' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !pin.trim()}
            className="wt-btn-transfer"
            style={{ marginTop: 6 }}
          >
            <span>{loading ? 'Verifying...' : 'Unlock Admin Dashboard'}</span>
          </button>

          <button
            type="button"
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              fontSize: '0.82rem',
              cursor: 'pointer',
              marginTop: 6
            }}
          >
            ← Back to Transfer
          </button>
        </form>
      </div>
    </div>
  );
}
