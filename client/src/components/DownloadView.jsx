import React, { useState, useEffect } from 'react';
import {
  Download,
  FolderArchive,
  File,
  Folder,
  Eye,
  Lock,
  Clock,
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  Music,
  Video,
  Image as ImageIcon,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { formatBytes, formatDate, getDaysRemaining } from '../utils/formatters';

export default function DownloadView({ transferId: initialId }) {
  const [transferId, setTransferId] = useState(initialId || '');
  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [recentTransfers, setRecentTransfers] = useState([]);

  useEffect(() => {
    if (initialId) {
      setTransferId(initialId);
      loadTransfer(initialId);
    }
  }, [initialId]);

  // Load public info / recent demo transfers if not loaded
  useEffect(() => {
    if (!initialId && !transfer) {
      fetch('/api/info')
        .catch(() => {});
    }
  }, [initialId, transfer]);

  const loadTransfer = async (id, pwd = '') => {
    if (!id) return;
    setLoading(true);
    setError('');
    setPasswordError('');

    try {
      const headers = {};
      if (pwd) {
        headers['x-transfer-password'] = pwd;
      }

      const res = await fetch(`/api/transfers/${encodeURIComponent(id.trim())}`, { headers });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 410) {
          setError('This transfer has expired and its files have been purged in accordance with data retention rules.');
        } else {
          setError(data.error || 'Transfer not found. Check the ID and try again.');
        }
        setTransfer(null);
        return;
      }

      setTransfer(data);
    } catch (err) {
      setError('Failed to connect to transfer service');
      setTransfer(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!password) return;

    try {
      const res = await fetch(`/api/transfers/${transferId}/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (res.ok) {
        loadTransfer(transferId, password);
      } else {
        setPasswordError('Incorrect password. Please try again.');
      }
    } catch (err) {
      setPasswordError('Verification failed');
    }
  };

  const getFileIcon = (fileName, mimeType = '') => {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) || mimeType.startsWith('image/')) {
      return <ImageIcon size={18} color="#2563eb" />;
    }
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext) || mimeType.startsWith('video/')) {
      return <Video size={18} color="#3b82f6" />;
    }
    if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext) || mimeType.startsWith('audio/')) {
      return <Music size={18} color="#ec4899" />;
    }
    if (['pdf', 'doc', 'docx', 'txt', 'md', 'json', 'csv'].includes(ext)) {
      return <FileText size={18} color="#10b981" />;
    }
    return <File size={18} color="#64748b" />;
  };

  const filteredFiles = transfer?.files ? transfer.files.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.relativePath && f.relativePath.toLowerCase().includes(searchQuery.toLowerCase()))
  ) : [];

  return (
    <div style={{ width: '100%', maxWidth: 520, margin: '20px auto' }}>
      {/* 1. INITIAL SEARCH CARD (When no transfer is loaded) */}
      {!transfer && (
        <div className="wt-transfer-card" style={{ width: '100%', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          {/* Icon Badge */}
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px'
          }}>
            <Download size={26} />
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
            Find & Download Files
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 20 }}>
            Enter your WeShare transfer reference link or ID to inspect and download your files.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadTransfer(transferId);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: 12,
              padding: '4px 12px',
              gap: 8
            }}>
              <Search size={16} color="#94a3b8" />
              <input
                type="text"
                placeholder="Paste transfer link or ID (e.g. tr_172985...)"
                className="clean-input"
                style={{ border: 'none', background: 'transparent', padding: '10px 0', fontSize: '0.88rem' }}
                value={transferId}
                onChange={(e) => {
                  let val = e.target.value.trim();
                  if (val.includes('#download/')) {
                    val = val.split('#download/')[1];
                  }
                  setTransferId(val);
                }}
                required
              />
            </div>

            {error && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 10,
                padding: '10px 12px',
                fontSize: '0.82rem',
                color: '#e11d48',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                textAlign: 'left'
              }}>
                <AlertTriangle size={16} flexShrink={0} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !transferId.trim()}
              className="wt-btn-transfer"
            >
              <span>{loading ? 'Finding files...' : 'Find & Download'}</span>
            </button>
          </form>
        </div>
      )}

      {/* 2. PASSWORD GATE CARD */}
      {transfer && transfer.isPasswordProtected && !transfer.files && (
        <div className="wt-transfer-card" style={{ width: '100%', maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px'
          }}>
            <Lock size={26} />
          </div>

          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
            Password Protected
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.84rem', marginBottom: 18 }}>
            This transfer is encrypted by the sender. Enter the password to unlock and download files.
          </p>

          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              className="clean-input"
              placeholder="Enter transfer password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />

            {passwordError && (
              <div style={{ color: '#e11d48', fontSize: '0.8rem', textAlign: 'left' }}>
                {passwordError}
              </div>
            )}

            <button type="submit" className="wt-btn-transfer">
              <span>Unlock Files</span>
            </button>
          </form>
        </div>
      )}

      {/* 3. DOWNLOAD HUB (When transfer is unlocked & ready) */}
      {transfer && transfer.files && (
        <div className="wt-transfer-card" style={{ width: '100%', maxWidth: 520, margin: '0 auto', padding: '28px' }}>
          {/* Top Transfer Info */}
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                {transfer.title || 'Shared Files'}
              </h2>

              {transfer.isPermanent ? (
                <span style={{
                  background: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0',
                  padding: '3px 10px',
                  borderRadius: 9999,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <ShieldCheck size={13} />
                  Permanent Vault
                </span>
              ) : (
                <span style={{
                  background: '#eff6ff',
                  color: '#2563eb',
                  border: '1px solid #bfdbfe',
                  padding: '3px 10px',
                  borderRadius: 9999,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <Clock size={13} />
                  {getDaysRemaining(transfer.expiresAt)}
                </span>
              )}
            </div>

            {transfer.message && (
              <p style={{ color: '#475569', fontSize: '0.88rem', background: '#f8fafc', padding: '10px 12px', borderRadius: 10, margin: '8px 0', borderLeft: '3px solid #2563eb' }}>
                "{transfer.message}"
              </p>
            )}

            <div style={{ display: 'flex', gap: 14, fontSize: '0.8rem', color: '#64748b', marginTop: 8 }}>
              <span>From: <strong style={{ color: '#0f172a' }}>{transfer.senderEmail}</strong></span>
              <span>•</span>
              <span>Total: <strong style={{ color: '#2563eb' }}>{formatBytes(transfer.totalSize)}</strong> ({transfer.files.length} items)</span>
            </div>
          </div>

          {/* Primary Action: Download All as ZIP */}
          <a
            href={`/api/transfers/${transfer.id}/download-zip`}
            className="wt-btn-transfer"
            style={{ textDecoration: 'none', marginBottom: 16 }}
          >
            <FolderArchive size={18} />
            <span>Download all ({formatBytes(transfer.totalSize)})</span>
          </a>

          {/* Search within files */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '4px 10px',
            marginBottom: 12,
            gap: 6
          }}>
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search in files..."
              className="clean-input"
              style={{ border: 'none', background: 'transparent', padding: '6px 0', fontSize: '0.82rem' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Files List */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            maxHeight: 220,
            overflowY: 'auto',
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}>
            {filteredFiles.map((file) => (
              <div
                key={file.fileId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#ffffff',
                  border: '1px solid #f1f5f9',
                  borderRadius: 8,
                  padding: '8px 10px',
                  fontSize: '0.82rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                  {getFileIcon(file.name, file.mimeType)}
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </div>
                    {file.relativePath && file.relativePath !== file.name && (
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                        {file.relativePath}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                    {formatBytes(file.size)}
                  </span>

                  {/* Preview Button */}
                  <button
                    className="btn-sm"
                    onClick={() => setPreviewFile(file)}
                    style={{ padding: '4px 8px' }}
                    title="Preview"
                  >
                    <Eye size={12} />
                  </button>

                  {/* Individual Download */}
                  <a
                    href={`/api/transfers/${transfer.id}/files/${file.fileId}/download`}
                    className="btn-sm"
                    style={{ padding: '4px 8px', color: '#2563eb', borderColor: '#bfdbfe' }}
                    title="Download file"
                  >
                    <Download size={12} />
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Back button */}
          <div style={{ marginTop: 14, textAlign: 'center' }}>
            <button
              onClick={() => { setTransfer(null); setTransferId(''); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              ← Search another transfer
            </button>
          </div>
        </div>
      )}

      {/* Media Preview Lightbox Modal */}
      {previewFile && transfer && (
        <div className="modal-overlay" onClick={() => setPreviewFile(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: 760, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {getFileIcon(previewFile.name, previewFile.mimeType)}
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{previewFile.name}</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({formatBytes(previewFile.size)})</span>
              </div>
              <button onClick={() => setPreviewFile(null)} className="btn-sm">
                <X size={14} />
              </button>
            </div>

            <div style={{ background: '#02040a', borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: '60vh' }}>
              {previewFile.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(previewFile.name) ? (
                <img
                  src={`/api/transfers/${transfer.id}/files/${previewFile.fileId}/preview`}
                  alt={previewFile.name}
                  style={{ maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain' }}
                />
              ) : previewFile.mimeType?.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(previewFile.name) ? (
                <video controls autoPlay style={{ width: '100%', maxHeight: '55vh' }}>
                  <source src={`/api/transfers/${transfer.id}/files/${previewFile.fileId}/preview`} type={previewFile.mimeType} />
                </video>
              ) : previewFile.mimeType?.startsWith('audio/') || /\.(mp3|wav|ogg)$/i.test(previewFile.name) ? (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <Music size={40} color="#ec4899" style={{ margin: '0 auto 12px' }} />
                  <audio controls>
                    <source src={`/api/transfers/${transfer.id}/files/${previewFile.fileId}/preview`} type={previewFile.mimeType} />
                  </audio>
                </div>
              ) : (
                <iframe
                  src={`/api/transfers/${transfer.id}/files/${previewFile.fileId}/preview`}
                  title={previewFile.name}
                  style={{ width: '100%', height: '50vh', border: 'none' }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
