import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../../lib/api';
import './SignalHistory.css';

const POSITION_ICONS = { LONG: '▲', SHORT: '▼', WAIT: '⏸' };

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  // SQLite menyimpan CURRENT_TIMESTAMP tanpa suffix 'Z' (UTC), normalisasi dulu
  const normalized = dateStr.endsWith('Z') || dateStr.includes('+')
    ? dateStr
    : dateStr.replace(' ', 'T') + 'Z';
  return new Date(normalized).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SignalDetailModal({ signal, onClose }) {
  if (!signal) return null;

  const isWin = signal.outcome === 'WIN';
  const isLoss = signal.outcome === 'LOSS';
  const isRunning = !signal.outcome;

  const formatPrice = (val) =>
    val != null
      ? `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '—';

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content signal-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h3 className="modal-title">Detail Sinyal #{signal.id}</h3>
            <span className="modal-subtitle">{signal.timeframe} • {formatDateTime(signal.created_at)}</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Main Status & Position Row */}
          <div className="modal-status-card">
            <div className="modal-pos-group">
              <span className={`pos-badge pos-badge--${signal.position_type.toLowerCase()}`}>
                {POSITION_ICONS[signal.position_type]} {signal.position_type}
              </span>
              <span className="tf-tag mono">{signal.timeframe}</span>
            </div>

            <div className="modal-outcome-group">
              {isWin && <span className="status-badge status-badge--win">✅ WIN (TP Hit)</span>}
              {isLoss && <span className="status-badge status-badge--loss">❌ LOSS (SL Hit)</span>}
              {isRunning && <span className="status-badge status-badge--running">⚡ RUNNING</span>}
            </div>
          </div>

          {/* Trade Parameters Grid */}
          <div className="modal-section-title">📊 Parameter Harga</div>
          <div className="modal-grid grid-2">
            <div className="modal-info-item">
              <span className="info-label">Entry Price</span>
              <span className="info-value mono">{formatPrice(signal.entry_price)}</span>
            </div>
            <div className="modal-info-item">
              <span className="info-label">Stop Loss (SL)</span>
              <span className="info-value mono val-loss">{formatPrice(signal.sl)}</span>
            </div>
            <div className="modal-info-item">
              <span className="info-label">Take Profit 1 (TP1)</span>
              <span className="info-value mono val-win">{formatPrice(signal.tp1)}</span>
            </div>
            <div className="modal-info-item">
              <span className="info-label">Take Profit 2 (TP2)</span>
              <span className="info-value mono val-win">{formatPrice(signal.tp2)}</span>
            </div>
          </div>

          {/* Technical Indicators Grid */}
          <div className="modal-section-title">📈 Indikator Teknikal saat Sinyal Dipicu</div>
          <div className="modal-grid grid-3">
            <div className="modal-info-item">
              <span className="info-label">EMA 9</span>
              <span className="info-value mono">{signal.ema9 != null ? Number(signal.ema9).toFixed(2) : '—'}</span>
            </div>
            <div className="modal-info-item">
              <span className="info-label">EMA 13</span>
              <span className="info-value mono">{signal.ema13 != null ? Number(signal.ema13).toFixed(2) : '—'}</span>
            </div>
            <div className="modal-info-item">
              <span className="info-label">Stoch %K / %D</span>
              <span className="info-value mono">
                {signal.stoch_k != null ? Number(signal.stoch_k).toFixed(1) : '—'} / {signal.stoch_d != null ? Number(signal.stoch_d).toFixed(1) : '—'}
              </span>
            </div>
            <div className="modal-info-item">
              <span className="info-label">Order Block</span>
              <span className="info-value mono">{signal.order_block_zone || '—'}</span>
            </div>
            <div className="modal-info-item">
              <span className="info-label">Win Rate Historis</span>
              <span className="info-value mono val-win">{signal.success_rate != null ? `${signal.success_rate}%` : 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function SignalHistory({ newSignalTrigger }) {
  const [signals, setSignals] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState(null);

  const fetchSignals = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/signals?page=${pg}&limit=20`);
      setSignals(res.data.signals);
      setTotal(res.data.total);
      setPage(pg);
    } catch (err) {
      console.error('Failed to fetch signals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignals(1);
  }, [fetchSignals, newSignalTrigger]);

  const totalPages = Math.ceil(total / 20);

  const formatPriceCell = (val) =>
    val != null
      ? `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '—';

  return (
    <div className="history-panel" id="signal-history-panel">
      <div className="history-header">
        <div>
          <h3 className="history-title">Riwayat Sinyal</h3>
          <span className="history-total">{total} sinyal tersimpan</span>
        </div>
        <button
          className="btn btn-ghost history-refresh-btn"
          onClick={() => fetchSignals(page)}
          disabled={loading}
          id="refresh-history-btn"
        >
          <span className="history-refresh-icon">{loading ? <span className="spinner" /> : '↻'}</span>
          <span>Refresh</span>
        </button>
      </div>

      {signals.length === 0 && !loading ? (
        <div className="history-empty">
          <span className="history-empty-icon">📋</span>
          <p>Belum ada riwayat sinyal</p>
          <small>Sinyal akan muncul setelah webhook diterima dari TradingView</small>
        </div>
      ) : (
        <>
          <div className="history-table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Waktu</th>
                  <th>Timeframe</th>
                  <th>Posisi</th>
                  <th>Status</th>
                  <th>Entry Price</th>
                  <th>Take Profit</th>
                  <th>Stop Loss</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((sig, idx) => {
                  const isWin = sig.outcome === 'WIN';
                  const isLoss = sig.outcome === 'LOSS';
                  const isRunning = !sig.outcome;

                  return (
                    <tr key={sig.id} className="history-row">
                      <td className="td-id mono">{(page - 1) * 20 + idx + 1}</td>
                      <td className="td-time mono">{formatDateTime(sig.created_at)}</td>
                      <td className="td-tf">
                        <span className="tf-tag mono">{sig.timeframe}</span>
                      </td>
                      <td className="td-position">
                        <span className={`pos-badge pos-badge--${sig.position_type.toLowerCase()}`}>
                          {POSITION_ICONS[sig.position_type]} {sig.position_type}
                        </span>
                      </td>
                      <td className="td-status">
                        {isWin && <span className="status-badge status-badge--win">✅ WIN</span>}
                        {isLoss && <span className="status-badge status-badge--loss">❌ LOSS</span>}
                        {isRunning && <span className="status-badge status-badge--running">⚡ RUNNING</span>}
                      </td>
                      <td className="td-num mono font-bold">{formatPriceCell(sig.entry_price)}</td>
                      <td className="td-num mono val-win">{formatPriceCell(sig.tp1)}</td>
                      <td className="td-num mono val-loss">{formatPriceCell(sig.sl)}</td>
                      <td className="td-action">
                        <button
                          className="btn-detail"
                          onClick={() => setSelectedSignal(sig)}
                          title="Lihat Detail Sinyal"
                        >
                          👁 Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="history-pagination">
              <button
                className="btn btn-ghost page-btn"
                disabled={page <= 1}
                onClick={() => fetchSignals(page - 1)}
              >
                ← Prev
              </button>
              <span className="page-info">
                Halaman {page} dari {totalPages}
              </span>
              <button
                className="btn btn-ghost page-btn"
                disabled={page >= totalPages}
                onClick={() => fetchSignals(page + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal Detail Sinyal */}
      {selectedSignal && (
        <SignalDetailModal
          signal={selectedSignal}
          onClose={() => setSelectedSignal(null)}
        />
      )}
    </div>
  );
}
