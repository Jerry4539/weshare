import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import TransferView from './components/TransferView';
import DownloadView from './components/DownloadView';
import AdminDashboard from './components/AdminDashboard';
import ClientLoginPage from './components/ClientLoginPage';
import AdminLoginPage from './components/AdminLoginPage';

export default function App() {
  const [activeTab, setActiveTab] = useState('transfer'); // 'transfer', 'download', 'client-login', 'admin'
  const [selectedTransferId, setSelectedTransferId] = useState('');

  // Client Session & Target
  const [loggedInClient, setLoggedInClient] = useState(() => {
    try {
      const saved = localStorage.getItem('weshare_client');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [activeTargetClient, setActiveTargetClient] = useState(null);

  // Admin Session
  const [adminPin, setAdminPin] = useState(localStorage.getItem('weshare_admin_pin') || '');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  // Hash Navigation support (e.g. /#download/tr_123 or /#admin)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#download/')) {
        const id = hash.replace('#download/', '');
        setSelectedTransferId(id);
        setActiveTab('download');
      } else if (hash === '#admin') {
        setActiveTab('admin');
      } else if (hash === '#client-login') {
        setActiveTab('client-login');
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Check saved admin pin at startup
  useEffect(() => {
    if (adminPin) {
      verifyAdminPin(adminPin);
    }
  }, []);

  const verifyAdminPin = async (pin) => {
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      if (res.ok) {
        setIsAdminLoggedIn(true);
        localStorage.setItem('weshare_admin_pin', pin);
        return true;
      } else {
        setIsAdminLoggedIn(false);
        localStorage.removeItem('weshare_admin_pin');
        return false;
      }
    } catch (e) {
      setIsAdminLoggedIn(false);
      return false;
    }
  };

  const handleAdminLoginSuccess = (pin) => {
    setAdminPin(pin);
    setIsAdminLoggedIn(true);
    localStorage.setItem('weshare_admin_pin', pin);
  };

  const handleAdminLogout = () => {
    setAdminPin('');
    setIsAdminLoggedIn(false);
    localStorage.removeItem('weshare_admin_pin');
    setActiveTab('transfer');
    window.location.hash = '';
  };

  const handleClientLoginSuccess = (client) => {
    setLoggedInClient(client);
    localStorage.setItem('weshare_client', JSON.stringify(client));
    setActiveTargetClient(client);
    setActiveTab('transfer');
    window.location.hash = '';
  };

  const handleClientLogout = () => {
    setLoggedInClient(null);
    setActiveTargetClient(null);
    localStorage.removeItem('weshare_client');
  };

  const handleShareToClient = (client) => {
    setActiveTargetClient(client);
    setActiveTab('transfer');
    window.location.hash = '';
  };

  const handleNavigateToDownload = (id) => {
    setSelectedTransferId(id);
    setActiveTab('download');
    window.location.hash = `#download/${id}`;
  };

  return (
    <div className="wetransfer-hero-canvas">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'transfer') window.location.hash = '';
          if (tab === 'download' && selectedTransferId) window.location.hash = `#download/${selectedTransferId}`;
          if (tab === 'client-login') window.location.hash = '#client-login';
          if (tab === 'admin') window.location.hash = '#admin';
        }}
        isAdminLoggedIn={isAdminLoggedIn}
        loggedInClient={loggedInClient}
        onClientLogout={handleClientLogout}
        onShareToClient={handleShareToClient}
      />

      {/* Main In-Page View (Zero Popups) */}
      {activeTab === 'transfer' && (
        <TransferView
          loggedInClient={loggedInClient}
          activeTargetClient={activeTargetClient}
          onNavigateToDownload={handleNavigateToDownload}
        />
      )}

      {activeTab === 'download' && (
        <div style={{ padding: '20px', zIndex: 20 }}>
          <DownloadView transferId={selectedTransferId} />
        </div>
      )}

      {activeTab === 'client-login' && (
        <div style={{ padding: '20px', zIndex: 20 }}>
          <ClientLoginPage
            onLoginSuccess={handleClientLoginSuccess}
            onCancel={() => {
              setActiveTab('transfer');
              window.location.hash = '';
            }}
          />
        </div>
      )}

      {activeTab === 'admin' && (
        <div style={{ padding: '20px', zIndex: 20, width: '100%' }}>
          {isAdminLoggedIn ? (
            <div style={{ maxWidth: 1200, margin: '0 auto', background: '#ffffff', borderRadius: 24, padding: 32, boxShadow: '0 25px 60px rgba(0,0,0,0.4)', color: '#0f172a' }}>
              <AdminDashboard
                adminPin={adminPin}
                onLogout={handleAdminLogout}
              />
            </div>
          ) : (
            <AdminLoginPage
              onLoginSuccess={handleAdminLoginSuccess}
              onCancel={() => {
                setActiveTab('transfer');
                window.location.hash = '';
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
