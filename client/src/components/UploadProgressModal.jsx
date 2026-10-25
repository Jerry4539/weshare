import React from 'react';
import { Loader2, XCircle, Zap, Clock, HardDrive, FileText } from 'lucide-react';
import { formatBytes, formatSpeed, formatTimeRemaining } from '../utils/formatters';

export default function UploadProgressModal({ progress, onCancel }) {
  if (!progress) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content-box" style={{ maxWidth: 480 }}>
        {/* Progress Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8'
            }}>
              <Loader2 className="spin" size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Streaming Files...</h3>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Chunking & uploading up to 10GB with turbo speeds
              </p>
            </div>
          </div>
          <span className="progress-percentage">{progress.overallPercent}%</span>
        </div>

        {/* Progress Bar */}
        <div className="progress-bar-track">
          <div
            className="progress-bar-fill"
            style={{ width: `${progress.overallPercent}%` }}
          />
        </div>

        {/* Current Active File */}
        <div style={{
          background: 'rgba(15, 24, 52, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          margin: '16px 0 12px 0'
        }}>
          <FileText size={18} color="#38bdf8" />
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Current Item ({progress.currentFileIndex} of {progress.totalFiles})
            </div>
            <div style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#ffffff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {progress.currentFileName}
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="progress-metrics-row">
          <div className="metric-item">
            <span className="metric-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Zap size={11} color="#38bdf8" /> Speed
            </span>
            <span className="metric-value">{formatSpeed(progress.speedBytesPerSec)}</span>
          </div>

          <div className="metric-item">
            <span className="metric-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <HardDrive size={11} color="#38bdf8" /> Uploaded
            </span>
            <span className="metric-value">
              {formatBytes(progress.uploadedBytes)} / {formatBytes(progress.totalBytes)}
            </span>
          </div>

          <div className="metric-item">
            <span className="metric-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Clock size={11} color="#38bdf8" /> ETA
            </span>
            <span className="metric-value">{formatTimeRemaining(progress.etaSeconds)}</span>
          </div>
        </div>

        {/* Cancel Button */}
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6
            }}
            onMouseOver={(e) => e.currentTarget.style.color = '#f43f5e'}
            onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
          >
            <XCircle size={15} />
            <span>Cancel Transfer</span>
          </button>
        </div>
      </div>
    </div>
  );
}
