import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle2, Copy, Check, Download, QrCode } from 'lucide-react';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import { formatDate } from '../utils/formatters';

export default function TransferSuccessCard({ result, onReset, onNavigateToDownload }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const qrCanvasRef = useRef(null);

  const transfer = result.transfer;
  const shareUrl = `${window.location.origin}/#download/${result.transferId}`;

  useEffect(() => {
    try {
      confetti({
        particleCount: 50,
        spread: 50,
        origin: { y: 0.6 }
      });
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (showQr && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, shareUrl, {
        width: 140,
        margin: 1
      }, (err) => {
        if (err) console.error('QR code error:', err);
      });
    }
  }, [showQr, shareUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="wetransfer-card" style={{ textAlign: 'center', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 52,
        height: 52,
        borderRadius: '50%',
        background: '#ecfdf5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#059669',
        margin: '6px auto 0'
      }}>
        <CheckCircle2 size={30} />
      </div>

      <div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Ready to send</h2>
        <p style={{ fontSize: '0.84rem', color: '#64748b', marginTop: 2 }}>
          {transfer.isPermanent
            ? 'Saved permanently in Client Vault'
            : `Available until ${formatDate(transfer.expiresAt)}`}
        </p>
      </div>

      {/* Share Link Input */}
      <div style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '6px 10px',
        gap: 6
      }}>
        <input
          type="text"
          readOnly
          value={shareUrl}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            fontSize: '0.85rem',
            color: '#0f172a',
            outline: 'none'
          }}
        />
        <button
          onClick={handleCopy}
          className="btn-sm"
          style={{ background: '#2563eb', color: '#ffffff', border: 'none' }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* QR Code */}
      <button
        onClick={() => setShowQr(!showQr)}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#2563eb',
          fontSize: '0.8rem',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4
        }}
      >
        <QrCode size={14} />
        <span>{showQr ? 'Hide QR' : 'Show QR Code'}</span>
      </button>

      {showQr && (
        <div style={{ background: '#ffffff', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <canvas ref={qrCanvasRef}></canvas>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 8 }}>
        <button
          onClick={() => onNavigateToDownload(result.transferId)}
          className="btn-transfer"
          style={{ flex: 1, fontSize: '0.9rem', padding: '11px 14px' }}
        >
          <Download size={15} />
          <span>Download Page</span>
        </button>
        <button
          onClick={onReset}
          className="btn-sm"
          style={{ padding: '11px 16px', borderRadius: 12 }}
        >
          Send Another
        </button>
      </div>
    </div>
  );
}
