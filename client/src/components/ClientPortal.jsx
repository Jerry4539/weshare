import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  ShieldCheck,
  Clock,
  Send,
  Download,
  FolderArchive,
  ArrowRight,
  HardDrive,
  Sparkles
} from 'lucide-react';
import { formatBytes, formatDate, getDaysRemaining } from '../utils/formatters';

export default function ClientPortal({ onSelectClientForTransfer }) {
  const [clients, setClients] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState('studio-nova');
  const [clientData, setClientData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch available demo clients list
    fetch('/api/client-lookup/studio-nova')
      .then(res => res.json())
      .then(data => {
        setClientData(data);
      })
      .catch(() => {});
  }, []);

  const handleLookup = async (slug) => {
    if (!slug) return;
    setLoading(true);
    setSelectedSlug(slug);
    try {
      const res = await fetch(`/api/client-lookup/${encodeURIComponent(slug)}`);
      if (res.ok) {
        const data = await res.json();
        setClientData(data);
      } else {
        setClientData(null);
      }
    } catch (err) {
      setClientData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Banner */}
      <div className="bento-card highlight">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff'
          }}>
            <FolderGit2 size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Client Portals</h1>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>
              Dedicated client transfer environments with admin-enforced retention rules.
            </p>
          </div>
        </div>

        {/* Quick Client Switcher Pills */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          <button
            onClick={() => handleLookup('studio-nova')}
            className={`btn-action-icon ${selectedSlug === 'studio-nova' ? 'active' : ''}`}
            style={{
              padding: '8px 16px',
              borderRadius: 20,
              background: selectedSlug === 'studio-nova' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.05)',
              borderColor: selectedSlug === 'studio-nova' ? '#38bdf8' : 'rgba(255,255,255,0.1)',
              color: selectedSlug === 'studio-nova' ? '#ffffff' : '#94a3b8'
            }}
          >
            <span>Studio Nova (Permanent Vault)</span>
          </button>

          <button
            onClick={() => handleLookup('apex-media')}
            className={`btn-action-icon ${selectedSlug === 'apex-media' ? 'active' : ''}`}
            style={{
              padding: '8px 16px',
              borderRadius: 20,
              background: selectedSlug === 'apex-media' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.05)',
              borderColor: selectedSlug === 'apex-media' ? '#38bdf8' : 'rgba(255,255,255,0.1)',
              color: selectedSlug === 'apex-media' ? '#ffffff' : '#94a3b8'
            }}
          >
            <span>Apex Media (14-Day Auto-Purge)</span>
          </button>
        </div>
      </div>

      {/* Client Overview Card */}
      {clientData && (
        <div className="bento-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <h2 style={{ fontSize: '1.45rem', fontWeight: 800 }}>
                  {clientData.name}
                </h2>
                <span style={{
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  background: 'rgba(56, 189, 248, 0.1)',
                  color: '#38bdf8',
                  padding: '3px 8px',
                  borderRadius: 6
                }}>
                  slug: {clientData.slug}
                </span>
              </div>

              {/* Retention Explanation Box */}
              <div style={{
                background: clientData.retentionPolicy === 'permanent' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                border: `1px solid ${clientData.retentionPolicy === 'permanent' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
                borderRadius: 12,
                padding: '14px 18px',
                marginTop: 12,
                maxWidth: 600
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: clientData.retentionPolicy === 'permanent' ? '#34d399' : '#fbbf24', marginBottom: 4 }}>
                  {clientData.retentionPolicy === 'permanent' ? <ShieldCheck size={18} /> : <Clock size={18} />}
                  <span>
                    {clientData.retentionPolicy === 'permanent'
                      ? 'Indefinite Permanent Storage Vault'
                      : `Limited Retention: ${clientData.retentionDays} Days Auto-Purge`}
                  </span>
                </div>
                <p style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                  {clientData.retentionPolicy === 'permanent'
                    ? 'Super Admin has granted this client permanent storage rights. Any file uploaded via this client will be saved in the archive forever without automatic deletion.'
                    : `Files transferred through this portal will be securely hosted for ${clientData.retentionDays} days. Once this period concludes, our automated retention cron deletes the files to maintain compliance and storage hygiene.`}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 20, marginTop: 16, fontSize: '0.85rem', color: '#94a3b8' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <HardDrive size={15} color="#38bdf8" />
                  <span>Max Limit: <strong style={{ color: '#ffffff' }}>{clientData.maxUploadSizeGB || 10} GB</strong></span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={15} color="#38bdf8" />
                  <span>Chunk Streaming: <strong style={{ color: '#ffffff' }}>Active</strong></span>
                </span>
              </div>
            </div>

            {/* Launch Client Transfer Button */}
            <button
              onClick={() => onSelectClientForTransfer(clientData.slug)}
              className="btn-primary-action"
              style={{ width: 'auto', padding: '14px 28px', fontSize: '1rem' }}
            >
              <Send size={18} />
              <span>Share Files as {clientData.name}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
