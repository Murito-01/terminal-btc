import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import './SignalHistory.css';

const POSITION_ICONS = { LONG: '▲', SHORT: '▼', WAIT: '⏸' };

function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SignalHistory({ newSignalTrigger }) {
  const [signals, setSignals] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

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
                  <th>Win Rate</th>
                  <th>EMA 9</th>
                  <th>EMA 13</th>
                  <th>Stoch K</th>
                  <th>Stoch D</th>
                  <th>Order Block</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((sig, idx) => (
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
                    <td className="td-rate">
                      {sig.success_rate !== null ? (
                        <span className={`rate-val ${
                          sig.success_rate >= 70 ? 'rate--good' :
                          sig.success_rate >= 50 ? 'rate--ok' : 'rate--bad'
                        }`}>
                          {sig.success_rate}%
                        </span>
                      ) : (
                        <span className="rate-na">—</span>
                      )}
                    </td>
                    <td className="td-num mono">
                      {sig.ema9 != null ? Number(sig.ema9).toFixed(2) : '—'}
                    </td>
                    <td className="td-num mono">
                      {sig.ema13 != null ? Number(sig.ema13).toFixed(2) : '—'}
                    </td>
                    <td className="td-num mono">
                      {sig.stoch_k != null ? Number(sig.stoch_k).toFixed(2) : '—'}
                    </td>
                    <td className="td-num mono">
                      {sig.stoch_d != null ? Number(sig.stoch_d).toFixed(2) : '—'}
                    </td>
                    <td className="td-ob mono">{sig.order_block_zone || '—'}</td>
                  </tr>
                ))}
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
    </div>
  );
}
