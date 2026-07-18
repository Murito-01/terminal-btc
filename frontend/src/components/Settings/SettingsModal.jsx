import { useState, useEffect } from 'react';
import api from '../../lib/api';
import './SettingsModal.css';

export default function SettingsModal({ onClose }) {
  const [settings, setSettings] = useState(null);
  const [chatId, setChatId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success'|'error', text }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/settings')
      .then(res => {
        const s = res.data.settings;
        setSettings(s);
        setEnabled(s?.telegram_enabled === 1);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { telegram_enabled: enabled };
      if (chatId.trim()) payload.telegram_chat_id = chatId.trim();

      await api.put('/settings', payload);
      showMessage('success', 'Pengaturan berhasil disimpan!');
      setChatId('');
    } catch (err) {
      showMessage('error', err.response?.data?.error || 'Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const payload = {};
      if (chatId.trim()) payload.chat_id = chatId.trim();
      await api.post('/settings/test-telegram', payload);
      showMessage('success', 'Test berhasil! Pesan dikirim ke Telegram kamu.');
    } catch (err) {
      showMessage('error', err.response?.data?.error || 'Gagal mengirim test');
    } finally {
      setTesting(false);
    }
  };

  const webhookUrl = `${window.location.origin}/api/webhook`;

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-modal" id="settings-modal">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">⚙ Pengaturan</h2>
            <p className="modal-subtitle">Konfigurasi notifikasi dan integrasi</p>
          </div>
          <button className="modal-close-btn" onClick={onClose} id="settings-close-btn">✕</button>
        </div>

        {loading ? (
          <div className="modal-loading">
            <span className="spinner" />
            <span>Memuat pengaturan...</span>
          </div>
        ) : (
          <div className="modal-body">
            {/* Message */}
            {message && (
              <div className={`modal-message modal-message--${message.type}`}>
                {message.type === 'success' ? '✓' : '⚠'} {message.text}
              </div>
            )}

            {/* Telegram Section */}
            <div className="settings-section">
              <div className="settings-section-header">
                <span className="settings-section-icon">📱</span>
                <div>
                  <h3 className="settings-section-title">Notifikasi Telegram</h3>
                  <p className="settings-section-desc">
                    Dapatkan notifikasi sinyal LONG/SHORT langsung di Telegram
                  </p>
                </div>
              </div>

              {/* Toggle */}
              <div className="settings-row">
                <label className="settings-row-label">Aktifkan Notifikasi</label>
                <button
                  className={`toggle-btn ${enabled ? 'toggle-btn--on' : 'toggle-btn--off'}`}
                  onClick={() => setEnabled(!enabled)}
                  id="telegram-toggle-btn"
                  role="switch"
                  aria-checked={enabled}
                >
                  <span className="toggle-thumb" />
                  <span className="toggle-text">{enabled ? 'ON' : 'OFF'}</span>
                </button>
              </div>

              {/* Status */}
              {settings?.has_telegram_chat_id && (
                <div className="settings-status">
                  <span className="status-dot status-dot--ok" />
                  <span className="status-text">
                    Chat ID sudah terkonfigurasi (***{settings?.telegram_chat_id?.slice(-4)})
                  </span>
                </div>
              )}

              {/* Chat ID input */}
              <div className="form-group">
                <label className="label" htmlFor="telegram-chat-id">
                  Telegram Chat ID
                  {settings?.has_telegram_chat_id && (
                    <span className="label-hint"> (kosongkan jika tidak ingin mengubah)</span>
                  )}
                </label>
                <input
                  id="telegram-chat-id"
                  type="text"
                  className="input"
                  placeholder="Contoh: 123456789"
                  value={chatId}
                  onChange={e => setChatId(e.target.value)}
                />
                <p className="input-hint">
                  Cara mendapatkan Chat ID: Buka Telegram → cari <strong>@userinfobot</strong> → Start → Copy ID kamu
                </p>
              </div>

              {/* Buttons */}
              <div className="settings-btn-row">
                <button
                  className="btn btn-success"
                  onClick={handleTest}
                  disabled={testing || (!chatId && !settings?.has_telegram_chat_id)}
                  id="test-telegram-btn"
                >
                  {testing ? <><span className="spinner" /> Mengirim...</> : '📤 Test Kirim'}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                  id="save-settings-btn"
                >
                  {saving ? <><span className="spinner" /> Menyimpan...</> : 'Simpan Pengaturan'}
                </button>
              </div>
            </div>

            <hr className="divider" />

            {/* Webhook Info */}
            <div className="settings-section">
              <div className="settings-section-header">
                <span className="settings-section-icon">🔗</span>
                <div>
                  <h3 className="settings-section-title">Webhook TradingView</h3>
                  <p className="settings-section-desc">
                    Endpoint untuk menerima alert dari Pine Script
                  </p>
                </div>
              </div>

              <div className="webhook-box">
                <div className="webhook-label">URL Webhook</div>
                <div className="webhook-url-row">
                  <code className="webhook-url mono">{webhookUrl}</code>
                  <button
                    className="btn btn-ghost webhook-copy-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl);
                      showMessage('success', 'URL disalin!');
                    }}
                    id="copy-webhook-btn"
                  >
                    📋
                  </button>
                </div>
              </div>

              <div className="webhook-payload-example">
                <div className="webhook-label">Contoh Payload Pine Script</div>
                <pre className="webhook-code mono">{`{
  "secret": "WEBHOOK_SECRET_KAMU",
  "timeframe": "{{interval}}",
  "position": "LONG",
  "ema9": {{plot("EMA 9")}},
  "ema13": {{plot("EMA 13")}},
  "stoch_k": {{plot("Stochastic %K")}},
  "stoch_d": {{plot("Stochastic %D")}},
  "order_block": "65000-65500"
}`}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
