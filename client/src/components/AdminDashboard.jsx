import React, { useState, useEffect } from 'react';
import {
  Shield,
  HardDrive,
  Users,
  Clock,
  Trash2,
  Plus,
  RefreshCw,
  Search,
  CheckCircle,
  FolderArchive,
  Lock,
  Building2
} from 'lucide-react';
import { formatBytes, formatDate, getDaysRemaining } from '../utils/formatters';

export default function AdminDashboard({ adminPin, onLogout }) {
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [activeTab, setActiveTab] = useState('transfers'); // 'transfers' or 'clients'
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Client Modal State
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientForm, setClientForm] = useState({
    name: '',
    email: '',
    slug: '',
    retentionPolicy: 'limited',
    retentionDays: 14,
    maxUploadSizeGB: 10,
    notes: ''
  });

  // Purge State
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState(null);

  const authHeaders = {
    'Content-Type': 'application/json',
    'x-admin-pin': adminPin
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, clientsRes, transfersRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: authHeaders }),
        fetch('/api/admin/clients', { headers: authHeaders }),
        fetch('/api/admin/transfers', { headers: authHeaders })
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (clientsRes.ok) setClients(await clientsRes.json());
      if (transfersRes.ok) setTransfers(await transfersRes.json());
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [adminPin]);

  // Client actions
  const handleSaveClient = async (e) => {
    e.preventDefault();
    try {
      const url = editingClient
        ? `/api/admin/clients/${editingClient.id}`
        : '/api/admin/clients';
      const method = editingClient ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(clientForm)
      });

      if (res.ok) {
        setShowClientModal(false);
        setEditingClient(null);
        setClientForm({
          name: '',
          email: '',
          slug: '',
          retentionPolicy: 'limited',
          retentionDays: 14,
          maxUploadSizeGB: 10,
          notes: ''
        });
        loadData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save client');
      }
    } catch (err) {
      alert('Error saving client');
    }
  };

  const handleToggleClientRetention = async (client) => {
    const newPolicy = client.retentionPolicy === 'permanent' ? 'limited' : 'permanent';
    const confirmMsg = newPolicy === 'permanent'
      ? `Set ${client.name}'s vault to PERMANENT? Files will never expire automatically.`
      : `Set ${client.name}'s vault to AUTO-EXPIRE after ${client.retentionDays || 14} days?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await fetch(`/api/admin/clients/${client.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          retentionPolicy: newPolicy,
          retentionDays: newPolicy === 'permanent' ? null : (client.retentionDays || 14),
          applyToExistingTransfers: true
        })
      });
      loadData();
    } catch (err) {
      alert('Failed to update client retention policy');
    }
  };

  const handleDeleteClient = async (id, name) => {
    if (!window.confirm(`Delete client "${name}"?`)) return;
    try {
      await fetch(`/api/admin/clients/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      loadData();
    } catch (err) {
      alert('Failed to delete client');
    }
  };

  // Transfer actions
  const handleToggleTransferPermanent = async (transfer) => {
    const willBePermanent = !transfer.isPermanent;
    try {
      await fetch(`/api/admin/transfers/${transfer.id}/retention`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          isPermanent: willBePermanent,
          additionalDays: willBePermanent ? null : 7
        })
      });
      loadData();
    } catch (err) {
      alert('Failed to update transfer retention');
    }
  };

  const handleDeleteTransfer = async (id, title) => {
    if (!window.confirm(`Permanently delete transfer "${title}" and free its disk storage?`)) return;
    try {
      await fetch(`/api/admin/transfers/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      loadData();
    } catch (err) {
      alert('Failed to delete transfer');
    }
  };

  const handleRunPurgeNow = async () => {
    setPurging(true);
    setPurgeResult(null);
    try {
      const res = await fetch('/api/admin/purge-now', {
        method: 'POST',
        headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        setPurgeResult(data);
        loadData();
      }
    } catch (err) {
      alert('Failed to trigger purge');
    } finally {
      setPurging(false);
    }
  };

  // Filter transfers
  const filteredTransfers = transfers.filter(t => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.senderEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.clientName && t.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'permanent') return t.isPermanent;
    if (statusFilter === 'expiring') return !t.isPermanent && t.status === 'ready';
    if (statusFilter === 'expired') return t.status === 'expired';

    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Header */}
      <div className="admin-header-row">
        <div className="admin-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Shield size={22} />
            </div>
            <h1 className="admin-title">Super Admin Portal</h1>
          </div>
          <p className="admin-sub">
            Master control over client storage vaults, retention policies, and file auto-purges.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={handleRunPurgeNow}
            disabled={purging}
            className="btn-sm"
            style={{
              padding: '9px 16px',
              background: '#eff6ff',
              borderColor: '#bfdbfe',
              color: '#1d4ed8'
            }}
          >
            <RefreshCw size={14} className={purging ? 'spin' : ''} />
            <span>{purging ? 'Purging...' : 'Run Auto-Purge Now'}</span>
          </button>

          <button
            onClick={onLogout}
            className="btn-sm"
            style={{ padding: '9px 16px' }}
          >
            <Lock size={14} />
            <span>Lock Portal</span>
          </button>
        </div>
      </div>

      {/* Purge Notification */}
      {purgeResult && (
        <div style={{
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          borderRadius: 12,
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#059669',
          fontSize: '0.88rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={18} />
            <span>
              Auto-Purge Scan Finished: <strong>{purgeResult.purgedCount}</strong> expired transfers cleaned up from server disk.
            </span>
          </div>
          <button
            onClick={() => setPurgeResult(null)}
            style={{ background: 'transparent', border: 'none', color: '#059669', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 4 Stats Cards */}
      {stats && (
        <div className="stats-grid-4">
          <div className="stat-card">
            <div className="stat-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <HardDrive size={22} />
            </div>
            <div className="stat-text">
              <span className="stat-value">{formatBytes(stats.totalSizeBytes)}</span>
              <span className="stat-label">Total Storage Used</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap" style={{ background: '#ecfdf5', color: '#059669', borderColor: '#a7f3d0' }}>
              <Shield size={22} />
            </div>
            <div className="stat-text">
              <span className="stat-value">{stats.permanentTransfers}</span>
              <span className="stat-label">Permanent Vaults</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap" style={{ background: '#fffbeb', color: '#d97706', borderColor: '#fde68a' }}>
              <Clock size={22} />
            </div>
            <div className="stat-text">
              <span className="stat-value">{stats.activeTransfers}</span>
              <span className="stat-label">Expiring Transfers</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap" style={{ background: '#f5f3ff', color: '#7c3aed', borderColor: '#ddd6fe' }}>
              <Users size={22} />
            </div>
            <div className="stat-text">
              <span className="stat-value">{stats.clientCount}</span>
              <span className="stat-label">Managed Clients</span>
            </div>
          </div>
        </div>
      )}

      {/* Sub Tabs: Transfers vs Clients */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
        <button
          onClick={() => setActiveTab('transfers')}
          className="btn-sm"
          style={{
            padding: '8px 18px',
            fontSize: '0.88rem',
            background: activeTab === 'transfers' ? '#eff6ff' : '#ffffff',
            borderColor: activeTab === 'transfers' ? '#2563eb' : '#e2e8f0',
            color: activeTab === 'transfers' ? '#1d4ed8' : '#64748b',
            fontWeight: activeTab === 'transfers' ? 700 : 600
          }}
        >
          <span>All Transfers ({transfers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('clients')}
          className="btn-sm"
          style={{
            padding: '8px 18px',
            fontSize: '0.88rem',
            background: activeTab === 'clients' ? '#eff6ff' : '#ffffff',
            borderColor: activeTab === 'clients' ? '#2563eb' : '#e2e8f0',
            color: activeTab === 'clients' ? '#1d4ed8' : '#64748b',
            fontWeight: activeTab === 'clients' ? 700 : 600
          }}
        >
          <span>Client Retention Rules ({clients.length})</span>
        </button>
      </div>

      {/* TAB 1: ALL TRANSFERS */}
      {activeTab === 'transfers' && (
        <div>
          {/* Toolbar */}
          <div className="admin-toolbar">
            <div className="admin-search-wrap">
              <Search size={16} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search by title, sender, client..."
                className="admin-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              {['all', 'permanent', 'expiring', 'expired'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className="btn-sm"
                  style={{
                    textTransform: 'capitalize',
                    background: statusFilter === filter ? '#eff6ff' : '#ffffff',
                    borderColor: statusFilter === filter ? '#2563eb' : '#e2e8f0',
                    color: statusFilter === filter ? '#1d4ed8' : '#64748b'
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transfer Title</th>
                  <th>Sender / Client</th>
                  <th>Size & Items</th>
                  <th>Retention Status</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      No transfers found. Files uploaded on the transfer page will appear here.
                    </td>
                  </tr>
                ) : (
                  filteredTransfers.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>{t.title}</span>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                            {t.id}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: '#334155', fontWeight: 600 }}>{t.senderEmail}</span>
                          {t.clientName ? (
                            <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 700 }}>
                              Client: {t.clientName}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Guest Transfer</span>
                          )}
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="file-size-badge">{formatBytes(t.totalSize)}</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            ({t.fileCount || t.files?.length || 0} items)
                          </span>
                        </div>
                      </td>

                      <td>
                        {t.status === 'expired' ? (
                          <span className="retention-pill" style={{ background: '#fef2f2', color: '#e11d48', borderColor: '#fecaca' }}>
                            Purged (Expired)
                          </span>
                        ) : t.isPermanent ? (
                          <span className="retention-pill permanent">
                            ✨ Permanent (Saved)
                          </span>
                        ) : (
                          <span className="retention-pill limited">
                            ⏳ {getDaysRemaining(t.expiresAt)}
                          </span>
                        )}
                      </td>

                      <td>
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          {formatDate(t.createdAt)}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            className="btn-action-icon"
                            onClick={() => handleToggleTransferPermanent(t)}
                            title={t.isPermanent ? 'Set to Auto-Expire' : 'Keep Permanently'}
                            style={{
                              color: t.isPermanent ? '#d97706' : '#059669',
                              borderColor: t.isPermanent ? '#fde68a' : '#a7f3d0'
                            }}
                          >
                            <Shield size={12} />
                            <span>{t.isPermanent ? 'Set Expiry' : 'Keep Forever'}</span>
                          </button>

                          {t.status !== 'expired' && (
                            <a
                              href={`/api/transfers/${t.id}/download-zip`}
                              className="btn-action-icon"
                              title="Download ZIP"
                              style={{ color: '#2563eb', borderColor: '#bfdbfe' }}
                            >
                              <FolderArchive size={13} />
                            </a>
                          )}

                          <button
                            className="btn-action-icon danger"
                            onClick={() => handleDeleteTransfer(t.id, t.title)}
                            title="Delete files"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CLIENT RETENTION RULES */}
      {activeTab === 'clients' && (
        <div>
          <div className="admin-toolbar">
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>Client Retention Policies</h3>
              <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Control which clients get permanent storage vs auto-delete duration.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingClient(null);
                setClientForm({
                  name: '',
                  email: '',
                  slug: '',
                  retentionPolicy: 'limited',
                  retentionDays: 14,
                  maxUploadSizeGB: 10,
                  notes: ''
                });
                setShowClientModal(true);
              }}
              className="btn-sm"
              style={{ padding: '9px 16px', background: '#2563eb', color: '#ffffff', borderColor: '#2563eb' }}
            >
              <Plus size={15} />
              <span>Create Client</span>
            </button>
          </div>

          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client Organization</th>
                  <th>Code / Slug</th>
                  <th>Retention Policy</th>
                  <th>Limit</th>
                  <th>Storage Usage</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{client.name}</span>
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{client.email}</span>
                      </div>
                    </td>

                    <td>
                      <span style={{
                        background: '#eff6ff',
                        color: '#2563eb',
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontFamily: 'monospace',
                        fontSize: '0.8rem'
                      }}>
                        {client.slug}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {client.retentionPolicy === 'permanent' ? (
                          <span className="retention-pill permanent">
                            ✨ Permanent (Saved Forever)
                          </span>
                        ) : (
                          <span className="retention-pill limited">
                            ⏳ Auto-deletes in {client.retentionDays || 14} days
                          </span>
                        )}

                        <button
                          className="btn-action-icon"
                          onClick={() => handleToggleClientRetention(client)}
                          style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                        >
                          Switch
                        </button>
                      </div>
                    </td>

                    <td>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>
                        {client.maxUploadSizeGB || 10} GB
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, color: '#2563eb' }}>
                          {formatBytes(client.totalBytesUsed || 0)}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {client.transfersCount || 0} transfers
                        </span>
                      </div>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className="btn-action-icon"
                          onClick={() => {
                            setEditingClient(client);
                            setClientForm({
                              name: client.name,
                              email: client.email,
                              slug: client.slug,
                              retentionPolicy: client.retentionPolicy,
                              retentionDays: client.retentionDays || 14,
                              maxUploadSizeGB: client.maxUploadSizeGB || 10,
                              notes: client.notes || ''
                            });
                            setShowClientModal(true);
                          }}
                        >
                          Edit
                        </button>

                        <button
                          className="btn-action-icon danger"
                          onClick={() => handleDeleteClient(client.id, client.name)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT CLIENT MODAL / DRAWER */}
      {showClientModal && (
        <div className="modal-overlay" onClick={() => setShowClientModal(false)}>
          <div className="modal-card" style={{ maxWidth: 460, borderRadius: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                {editingClient ? 'Edit Client' : 'Create Client'}
              </h2>
              <button
                className="btn-sm"
                onClick={() => setShowClientModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveClient} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Client / Organization Name
                </label>
                <input
                  type="text"
                  className="clean-input"
                  placeholder="e.g. Acme Agency"
                  value={clientForm.name}
                  onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Contact Email
                </label>
                <input
                  type="email"
                  className="clean-input"
                  placeholder="client@acme.com"
                  value={clientForm.email}
                  onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Client Code / Slug
                </label>
                <input
                  type="text"
                  className="clean-input"
                  placeholder="e.g. acme"
                  value={clientForm.slug}
                  onChange={(e) => setClientForm({ ...clientForm, slug: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Data Retention Policy
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div
                    onClick={() => setClientForm({ ...clientForm, retentionPolicy: 'permanent' })}
                    style={{
                      border: `1.5px solid ${clientForm.retentionPolicy === 'permanent' ? '#059669' : '#e2e8f0'}`,
                      background: clientForm.retentionPolicy === 'permanent' ? '#ecfdf5' : '#ffffff',
                      borderRadius: 10,
                      padding: '10px',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontWeight: 700, color: clientForm.retentionPolicy === 'permanent' ? '#059669' : '#0f172a', fontSize: '0.85rem' }}>
                      Permanent
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Never auto-deleted</div>
                  </div>

                  <div
                    onClick={() => setClientForm({ ...clientForm, retentionPolicy: 'limited' })}
                    style={{
                      border: `1.5px solid ${clientForm.retentionPolicy === 'limited' ? '#2563eb' : '#e2e8f0'}`,
                      background: clientForm.retentionPolicy === 'limited' ? '#eff6ff' : '#ffffff',
                      borderRadius: 10,
                      padding: '10px',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontWeight: 700, color: clientForm.retentionPolicy === 'limited' ? '#2563eb' : '#0f172a', fontSize: '0.85rem' }}>
                      Auto-Expire
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>After set days</div>
                  </div>
                </div>
              </div>

              {clientForm.retentionPolicy === 'limited' && (
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                    Auto-Delete After (Days)
                  </label>
                  <select
                    className="clean-input"
                    value={clientForm.retentionDays}
                    onChange={(e) => setClientForm({ ...clientForm, retentionDays: Number(e.target.value) })}
                  >
                    <option value={3}>3 Days</option>
                    <option value={7}>7 Days (1 Week)</option>
                    <option value={14}>14 Days (2 Weeks)</option>
                    <option value={30}>30 Days (1 Month)</option>
                    <option value={90}>90 Days (Quarter)</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="submit"
                  className="wt-btn-transfer"
                  style={{ flex: 1, padding: '10px 16px' }}
                >
                  {editingClient ? 'Save Changes' : 'Create Client'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
                  className="btn-sm"
                  style={{ padding: '10px 16px' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
