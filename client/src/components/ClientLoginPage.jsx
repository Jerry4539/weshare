import React, { useState } from 'react';
import { UserCheck, ArrowRight, ShieldCheck } from 'lucide-react';

export default function ClientLoginPage({ onLoginSuccess, onCancel }) {
  const [inputVal, setInputVal] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/client-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inputVal.trim() })
      });

      if (res.ok) {
        const client = await res.json();
        onLoginSuccess(client);
      } else {
        const err = await res.json();
        setError(err.error || 'Login failed');
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
          <UserCheck size={26} />
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
          Client Sign In
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 22 }}>
          Sign in to access your storage vault and customized retention rules.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ textAlign: 'left' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
              Client Name or Code
            </label>
            <input
              type="text"
              placeholder="e.g. Acme Agency or your name"
              className="clean-input"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
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
            disabled={loading || !inputVal.trim()}
            className="wt-btn-transfer"
            style={{ marginTop: 6 }}
          >
            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
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
