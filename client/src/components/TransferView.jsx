import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  FolderPlus,
  X,
  File,
  Folder,
  Lock,
  Calendar,
  MoreHorizontal,
  Send,
  Link2,
  Mail,
  Check,
  ShieldCheck,
  Zap,
  MessageCircle,
  Star,
  Clock
} from 'lucide-react';
import { formatBytes, formatSpeed, formatTimeRemaining } from '../utils/formatters';
import { ChunkUploader } from '../utils/chunkUploader';
import TransferSuccessCard from './TransferSuccessCard';

export default function TransferView({
  loggedInClient,
  activeTargetClient,
  onNavigateToDownload
}) {
  const [files, setFiles] = useState([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [transferType, setTransferType] = useState('email'); // 'email' or 'link'
  const [senderEmail, setSenderEmail] = useState('');
  const [recipientEmails, setRecipientEmails] = useState('');

  // Dropdown states
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showOptionsPopover, setShowOptionsPopover] = useState(false);
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [expiryDays, setExpiryDays] = useState(7);

  // Active client (e.g. Aakash or custom)
  const currentClient = activeTargetClient || loggedInClient;

  // Uploading states
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const uploaderRef = useRef(null);

  const MAX_LIMIT_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB

  // If client is targeted or logged in, set default email and permanent retention if applicable
  useEffect(() => {
    if (currentClient) {
      if (!recipientEmails && currentClient.email) {
        setRecipientEmails(currentClient.email);
      }
      if (currentClient.retentionPolicy === 'permanent') {
        setExpiryDays(null);
      }
    }
  }, [currentClient]);

  // Close popovers on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.wt-card-bottom-bar')) {
        setShowDateDropdown(false);
        setShowOptionsPopover(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleFilesSelect = (e) => {
    if (!e.target.files) return;
    addFiles(Array.from(e.target.files));
    e.target.value = null;
  };

  const handleFolderSelect = (e) => {
    if (!e.target.files) return;
    addFiles(Array.from(e.target.files));
    e.target.value = null;
  };

  const addFiles = (newFiles) => {
    setFiles((prev) => {
      const combined = [...prev, ...newFiles];
      const totalSize = combined.reduce((acc, f) => acc + f.size, 0);
      if (totalSize > MAX_LIMIT_BYTES) {
        alert('File size exceeds the 10GB limit!');
        return prev;
      }
      return combined;
    });
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const items = e.dataTransfer.items;
    if (items) {
      const droppedFiles = [];
      const traverse = async (item, path = '') => {
        return new Promise((resolve) => {
          if (item.isFile) {
            item.file((file) => {
              file.relativePath = path + file.name;
              droppedFiles.push(file);
              resolve();
            });
          } else if (item.isDirectory) {
            const reader = item.createReader();
            reader.readEntries(async (entries) => {
              for (const entry of entries) {
                await traverse(entry, path + item.name + '/');
              }
              resolve();
            });
          } else {
            resolve();
          }
        });
      };

      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
        if (entry) {
          await traverse(entry);
        } else if (items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (file) droppedFiles.push(file);
        }
      }

      if (droppedFiles.length > 0) addFiles(droppedFiles);
    } else if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const totalSizeBytes = files.reduce((acc, f) => acc + f.size, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) return;

    setErrorMessage('');
    setUploading(true);
    setUploadProgress({
      overallPercent: 0,
      uploadedBytes: 0,
      totalBytes: totalSizeBytes,
      currentFileIndex: 1,
      totalFiles: files.length,
      currentFileName: files[0].name,
      speedBytesPerSec: 0,
      etaSeconds: 0
    });

    const uploader = new ChunkUploader({
      concurrency: 3, // 3 parallel chunks for maximum speed
      onProgress: (p) => setUploadProgress(p),
      onError: (err) => {
        setUploading(false);
        setErrorMessage(err.message || 'Transfer failed');
      },
      onComplete: (res) => {
        setUploading(false);
        setUploadResult(res);
      }
    });

    uploaderRef.current = uploader;

    const recipientList = recipientEmails
      ? recipientEmails.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    await uploader.upload({
      title: title || (files.length === 1 ? files[0].name : `Transfer of ${files.length} items`),
      message,
      senderEmail: senderEmail || (loggedInClient ? loggedInClient.email : 'guest@weshare.io'),
      recipientEmails: recipientList,
      transferType,
      clientSlug: currentClient ? currentClient.slug : undefined,
      password: enablePassword && password ? password : null,
      customExpiryDays: currentClient?.retentionPolicy === 'permanent' ? null : expiryDays,
      files
    });
  };

  // Circular progress calculation
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = uploadProgress
    ? circumference - (uploadProgress.overallPercent / 100) * circumference
    : circumference;

  return (
    <div
      className="wt-canvas-main"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFilesSelect}
        multiple
        style={{ display: 'none' }}
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderSelect}
        webkitdirectory="true"
        directory="true"
        multiple
        style={{ display: 'none' }}
      />

      {/* LEFT: Authentic WeTransfer Card */}
      {uploadResult ? (
        <div style={{ zIndex: 40 }}>
          <TransferSuccessCard
            result={uploadResult}
            onReset={() => {
              setFiles([]);
              setTitle('');
              setMessage('');
              setUploadResult(null);
            }}
            onNavigateToDownload={onNavigateToDownload}
          />
        </div>
      ) : uploading ? (
        /* IN-CARD UPLOADING STATE (Circular animated WeTransfer style) */
        <div className="wt-transfer-card wt-uploading-card">
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
            Transferring...
          </h3>

          <div className="progress-circle-wrap">
            <svg className="progress-circle-svg" viewBox="0 0 120 120">
              <circle
                className="progress-circle-bg"
                cx="60"
                cy="60"
                r={radius}
              />
              <circle
                className="progress-circle-bar"
                cx="60"
                cy="60"
                r={radius}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>

            <div className="progress-circle-text">
              <span className="progress-pct-huge">
                {uploadProgress?.overallPercent || 0}%
              </span>
              <span className="progress-speed-badge">
                <Zap size={11} style={{ display: 'inline', verticalAlign: '-1px' }} />
                {formatSpeed(uploadProgress?.speedBytesPerSec)}
              </span>
            </div>
          </div>

          {/* Uploading File Details */}
          <div className="uploading-file-tag">
            <File size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6, color: '#2563eb' }} />
            <span>{uploadProgress?.currentFileName || 'Processing...'}</span>
          </div>

          <div className="uploading-stats-row">
            <span>
              {formatBytes(uploadProgress?.uploadedBytes || 0)} of {formatBytes(uploadProgress?.totalBytes || 0)}
            </span>
            <span>{formatTimeRemaining(uploadProgress?.etaSeconds)}</span>
          </div>

          <button
            type="button"
            className="btn-cancel-transfer"
            onClick={() => {
              uploaderRef.current?.cancel();
              setUploading(false);
            }}
          >
            Cancel transfer
          </button>
        </div>
      ) : (
        /* NORMAL TRANSFER FORM */
        <div className="wt-transfer-card">
          {/* Active Client Target Banner */}
          {loggedInClient && (
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 12,
              padding: '8px 12px',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.78rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#1d4ed8' }}>
                <ShieldCheck size={15} color="#2563eb" />
                <span>{loggedInClient.name}</span>
                <span style={{ color: '#64748b', fontWeight: 500 }}>→ Sharing to Akash</span>
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '2px 8px', borderRadius: 9999 }}>
                {loggedInClient.retentionPolicy === 'permanent' ? 'Permanent' : `${loggedInClient.retentionDays || 14}d`}
              </span>
            </div>
          )}

          {/* Top 2 Upload Buttons */}
          <div className="wt-card-triggers">
            <div
              className="wt-trigger-box"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="wt-trigger-icon-wrap">
                <Plus size={18} strokeWidth={2.8} />
              </div>
              <span className="wt-trigger-label">Add files</span>
            </div>

            <div
              className="wt-trigger-box"
              onClick={() => folderInputRef.current?.click()}
            >
              <div className="wt-trigger-icon-wrap">
                <FolderPlus size={16} strokeWidth={2.4} />
              </div>
              <span className="wt-trigger-label">Add folders</span>
            </div>
          </div>

          {/* Files queue */}
          {files.length > 0 && (
            <div className="wt-queue-box">
              {files.map((file, idx) => (
                <div key={idx} className="wt-queue-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {file.relativePath ? <Folder size={13} color="#2563eb" /> : <File size={13} color="#2563eb" />}
                    <span className="wt-queue-name">{file.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 700 }}>{formatBytes(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Segmented Share Mode Toggle */}
          <div className="wt-mode-segmented">
            <button
              type="button"
              className={`wt-mode-btn ${transferType === 'email' ? 'active' : ''}`}
              onClick={() => setTransferType('email')}
            >
              <Mail size={13} />
              <span>Send email</span>
            </button>
            <button
              type="button"
              className={`wt-mode-btn ${transferType === 'link' ? 'active' : ''}`}
              onClick={() => setTransferType('link')}
            >
              <Link2 size={13} />
              <span>Get link</span>
            </button>
          </div>

          {errorMessage && (
            <div style={{ color: '#e11d48', fontSize: '0.78rem', marginBottom: 10 }}>
              {errorMessage}
            </div>
          )}

          {/* Clean Borderless Form */}
          <form onSubmit={handleSubmit} className="wt-card-form">
            {transferType === 'email' && (
              <div className="wt-form-line">
                <input
                  type="text"
                  placeholder="Email to"
                  className="wt-input-clean"
                  value={recipientEmails}
                  onChange={(e) => setRecipientEmails(e.target.value)}
                  required={transferType === 'email'}
                />
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', position: 'absolute', right: 0 }}>
                  0 of 3
                </span>
              </div>
            )}

            <div className="wt-form-line">
              <input
                type="email"
                placeholder="Your email"
                className="wt-input-clean"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                required
              />
            </div>

            <div className="wt-form-line">
              <input
                type="text"
                placeholder="Title"
                className="wt-input-clean"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="wt-form-line" style={{ borderBottom: 'none' }}>
              <textarea
                placeholder="Message"
                className="wt-textarea-clean"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            {/* Password Indicator Badge if set */}
            {enablePassword && password && (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: '0.75rem',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 6
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Lock size={12} /> Password protected
                </span>
                <span
                  style={{ cursor: 'pointer', color: '#94a3b8' }}
                  onClick={() => { setEnablePassword(false); setPassword(''); }}
                >
                  Remove
                </span>
              </div>
            )}

            {/* Bottom Bar: Retention Dropdown & Three Dots Options */}
            <div className="wt-card-bottom-bar">
              {/* Date Limit Pill (Opens Dropdown) */}
              <div
                className={`wt-retention-pill ${currentClient?.retentionPolicy === 'permanent' || expiryDays === null ? 'permanent' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDateDropdown(!showDateDropdown);
                  setShowOptionsPopover(false);
                }}
              >
                <Calendar size={13} />
                <span>
                  {expiryDays === null
                    ? 'Permanent'
                    : `${expiryDays} days ▾`}
                </span>
              </div>

              {/* Date Limit Dropdown Menu */}
              {showDateDropdown && (
                <div className="wt-popover-menu" onClick={(e) => e.stopPropagation()}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', padding: '4px 10px', fontWeight: 700, textTransform: 'uppercase' }}>
                    Retention duration
                  </div>
                  {[3, 7, 14, 30].map((days) => (
                    <div
                      key={days}
                      className={`wt-popover-item ${expiryDays === days ? 'active' : ''}`}
                      onClick={() => {
                        setExpiryDays(days);
                        setShowDateDropdown(false);
                      }}
                    >
                      <span>{days} days</span>
                      {expiryDays === days && <Check size={13} />}
                    </div>
                  ))}
                  {(currentClient || loggedInClient) && (
                    <div
                      className={`wt-popover-item ${expiryDays === null ? 'active' : ''}`}
                      style={{ color: '#059669' }}
                      onClick={() => {
                        setExpiryDays(null);
                        setShowDateDropdown(false);
                      }}
                    >
                      <span>✨ Permanent Vault</span>
                      {expiryDays === null && <Check size={13} />}
                    </div>
                  )}
                </div>
              )}

              {/* Three Dots More Options Button */}
              <div
                className="wt-dots-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowOptionsPopover(!showOptionsPopover);
                  setShowDateDropdown(false);
                }}
                title="Options"
              >
                <MoreHorizontal size={16} />
              </div>

              {/* Options Popover (Password protect) */}
              {showOptionsPopover && (
                <div className="wt-options-popover" onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                      <Lock size={14} color="#2563eb" />
                      <span>Password protect</span>
                    </label>
                    <input
                      type="checkbox"
                      checked={enablePassword}
                      onChange={(e) => setEnablePassword(e.target.checked)}
                      style={{ cursor: 'pointer', accentColor: '#2563eb' }}
                    />
                  </div>

                  {enablePassword && (
                    <input
                      type="password"
                      placeholder="Enter secret password"
                      className="clean-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ padding: '8px 12px', fontSize: '0.84rem' }}
                      autoFocus
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => setShowOptionsPopover(false)}
                    className="btn-sm"
                    style={{ justifyContent: 'center', background: '#2563eb', color: '#ffffff', border: 'none', padding: '7px 10px' }}
                  >
                    Done
                  </button>
                </div>
              )}
            </div>

            {/* Royal Blue Transfer / Share to Akash Button */}
            <button
              type="submit"
              disabled={files.length === 0}
              className="wt-btn-transfer"
            >
              <span>
                {loggedInClient
                  ? (files.length === 0 ? 'Share to Akash' : `Share to Akash (${formatBytes(totalSizeBytes)})`)
                  : (files.length === 0 ? 'Transfer' : `Transfer (${formatBytes(totalSizeBytes)})`)}
              </span>
            </button>
          </form>
        </div>
      )}

      {/* CENTER: Editorial Serif Headline */}
      <div className="hero-editorial-center">
        <h1 className="hero-headline">
          Send files.<br />
          Move ideas.
        </h1>
      </div>

      {/* FLOATING ART ASSET 1: Ceramic Art Table (Top-Center) */}
      <div className="float-art-ceramic">
        <img src="/art/ceramic.jpg" alt="Editorial ceramic interior" />
        <div className="art-badge-jpg">.jpg</div>
        <div className="art-menu-dots">•••</div>
      </div>

      {/* FLOATING ART ASSET 2: Sunset Mountain (Bottom-Center) */}
      <div className="float-art-sunset">
        <img src="/art/sunset.jpg" alt="Vibrant sunset mountain" />
        <div className="art-badge-comment">
          <MessageCircle size={12} fill="#ffffff" />
          <span>4</span>
        </div>
      </div>

      {/* FLOATING ART ASSET 3: 3D Isometric Poster (Far-Right) */}
      <div className="float-art-3d">
        <img src="/art/abstract.jpg" alt="Creative design studio 3D abstract" />
        <div className="art-badge-star">
          <Star size={13} fill="#ffffff" />
        </div>
      </div>

      {/* FLOATING PASTEL FILE FORMAT BADGES */}
      <div className="badge-file-tif">.tif</div>
      <div className="badge-file-psd">.psd</div>
      <div className="badge-file-mov">.mov</div>

      {/* FLOATING ROYAL BLUE FOLDER WITH LABEL */}
      <div className="float-folder-wrap">
        <div className="folder-svg-icon" />
        <div className="folder-label-pill">WeTransfer_v01</div>
      </div>
    </div>
  );
}
