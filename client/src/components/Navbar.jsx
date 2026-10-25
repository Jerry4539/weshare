import React from 'react';
import { Send, Shield, Download, LogIn, LogOut } from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  isAdminLoggedIn,
  loggedInClient,
  onClientLogout
}) {
  return (
    <header className="wt-navbar">
      {/* Brand Logo - clicks go back to main transfer */}
      <div className="wt-brand" onClick={() => setActiveTab('transfer')}>
        <div className="wt-brand-icon">
          <Send size={18} />
        </div>
        <span className="wt-brand-title">WeShare</span>
      </div>

      {/* Right Navbar: Only Download, Admin, and Client Login State */}
      <div className="wt-nav-right">
        {/* Download */}
        <button
          className="wt-nav-pill-btn"
          onClick={() => setActiveTab('download')}
          style={{
            background: activeTab === 'download' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)'
          }}
        >
          <Download size={14} />
          <span>Download</span>
        </button>

        {/* Admin */}
        <button
          className="wt-nav-pill-btn"
          onClick={() => setActiveTab('admin')}
          style={{
            background: activeTab === 'admin' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)'
          }}
        >
          <Shield size={14} />
          <span>Admin</span>
          {isAdminLoggedIn && (
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#34d399'
            }} />
          )}
        </button>

        {/* Client Login State */}
        {loggedInClient ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              className="wt-profile-pill"
              onClick={() => setActiveTab('transfer')}
              title={`Logged in as ${loggedInClient.name}`}
              style={{ cursor: 'pointer' }}
            >
              <div className="wt-avatar-circle">
                {loggedInClient.name ? loggedInClient.name.charAt(0).toUpperCase() : 'C'}
              </div>
              <span className="wt-profile-name">{loggedInClient.name}</span>
            </div>

            <button
              onClick={onClientLogout}
              className="wt-nav-pill-btn"
              style={{ padding: '6px 10px' }}
              title="Log out"
            >
              <LogOut size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setActiveTab('client-login')}
            className={`wt-nav-pill-btn ${activeTab === 'client-login' ? 'active' : 'primary'}`}
          >
            <LogIn size={14} />
            <span>Login as Client</span>
          </button>
        )}
      </div>
    </header>
  );
}
