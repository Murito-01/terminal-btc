import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Header.css';

export default function Header({ connected, onSettingsClick }) {
  const { user, logout } = useAuth();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <header className="header" id="main-header">
      <div className="header-left">
        {/* Logo */}
        <div className="header-logo">
          <div className="header-logo-icon">₿</div>
          <div className="header-logo-text">
            <span className="header-logo-title">Terminal BTC</span>
            <span className="header-logo-sub">Personal Trading Dashboard</span>
          </div>
        </div>

        {/* Live indicator */}
        <div className="header-live-badge">
          <span className={`live-dot ${connected ? 'live-dot--active' : 'live-dot--inactive'}`} />
          <span className="live-label">{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </div>

      <div className="header-center">
        {/* Clock */}
        <div className="header-clock">
          <div className="header-clock-time mono">{formatTime(time)}</div>
          <div className="header-clock-date">{formatDate(time)} WIB</div>
        </div>
      </div>

      <div className="header-right">
        {/* Connection status */}
        <div className={`header-ws-status ${connected ? 'ws-connected' : 'ws-disconnected'}`}>
          <span className="ws-icon">{connected ? '⚡' : '⚠'}</span>
          <span className="ws-text">{connected ? 'WebSocket OK' : 'Reconnecting...'}</span>
        </div>

        {/* Settings button */}
        <button
          className="header-btn"
          onClick={onSettingsClick}
          id="settings-btn"
          title="Pengaturan"
        >
          ⚙
        </button>

        {/* User menu */}
        <div className="header-user" id="user-menu">
          <div className="header-user-avatar">
            {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="header-user-info">
            <span className="header-user-name">{user?.name || 'User'}</span>
          </div>
          <button className="header-logout-btn" onClick={logout} title="Logout" id="logout-btn">
            ⏻
          </button>
        </div>
      </div>
    </header>
  );
}
