import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/Header/Header';
import { useSocket } from '../../hooks/useSocket';
import api from '../../lib/api';
import './Performance.css';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ── Warna sel berdasarkan nilai P&L ── */
function getCellStyle(value) {
  if (value === null || value === undefined) return { bg: 'var(--cell-empty)', text: 'var(--text-muted)', opacity: 0.4 };

  if (value === 0) return { bg: 'var(--cell-zero)', text: 'var(--text-secondary)' };

  const abs = Math.abs(value);
  // Skala intensitas: 0–5% ringan, 5–15% sedang, 15%+ kuat
  const intensity = Math.min(abs / 20, 1); // max at 20%

  if (value > 0) {
    const lightness = Math.round(28 - intensity * 14); // 28% → 14%
    return { bg: `hsl(145, 60%, ${lightness}%)`, text: '#fff' };
  } else {
    const lightness = Math.round(28 - intensity * 14);
    return { bg: `hsl(354, 70%, ${lightness}%)`, text: '#fff' };
  }
}

function PnlCell({ value, isYear = false }) {
  const style = getCellStyle(value);

  if (value === null || value === undefined) {
    return (
      <td className={`perf-cell ${isYear ? 'perf-cell--year' : ''}`}
          style={{ background: style.bg, color: style.text, opacity: style.opacity || 1 }}>
        —
      </td>
    );
  }

  const formatted = value === 0 ? '0.00' : (value > 0 ? '+' : '') + value.toFixed(2);

  return (
    <td className={`perf-cell ${isYear ? 'perf-cell--year' : ''} ${value > 0 ? 'perf-cell--pos' : value < 0 ? 'perf-cell--neg' : 'perf-cell--zero'}`}
        style={{ background: style.bg, color: style.text }}>
      {formatted}
    </td>
  );
}

function ProbCell({ value }) {
  if (value === null || value === undefined) {
    return <td className="perf-cell perf-cell--prob" style={{ background: 'var(--cell-empty)', color: 'var(--text-muted)', opacity: 0.4 }}>—</td>;
  }
  const style = getCellStyle(value - 50); // 50% adalah netral
  return (
    <td className="perf-cell perf-cell--prob" style={{ background: style.bg, color: style.text }}>
      {value}%
    </td>
  );
}

export default function PerformancePage() {
  const { connected } = useSocket();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get('/performance/monthly');
      setData(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      setError('Gagal memuat data: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Refresh setiap 5 menit
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="perf-page">
      <Header connected={connected} onSettingsClick={() => {}} />

      <main className="perf-main">
        {/* Breadcrumb */}
        <div className="perf-breadcrumb">
          <Link to="/" className="perf-breadcrumb-link">← Dashboard</Link>
          <span className="perf-breadcrumb-sep">/</span>
          <span className="perf-breadcrumb-current">Monthly Performance</span>
        </div>

        {/* Page header */}
        <div className="perf-header">
          <div className="perf-header-left">
            <h1 className="perf-title">Monthly Performance</h1>
            <p className="perf-subtitle">
              Net P&amp;L % per bulan berdasarkan semua sinyal yang telah selesai (WIN/LOSS)
            </p>
          </div>
          <div className="perf-header-right">
            {data && (
              <div className="perf-meta">
                <span className="perf-meta-item">
                  <span className="perf-meta-label">Total Sinyal</span>
                  <span className="perf-meta-value">{data.total_signals}</span>
                </span>
                <span className="perf-meta-divider" />
                <span className="perf-meta-item">
                  <span className="perf-meta-label">Update Terakhir</span>
                  <span className="perf-meta-value mono">
                    {lastUpdated?.toLocaleTimeString('id-ID')}
                  </span>
                </span>
                <button className="perf-refresh-btn" onClick={fetchData} title="Refresh data">
                  ↻ Refresh
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="perf-legend">
          <div className="perf-legend-item">
            <span className="perf-legend-dot" style={{ background: 'hsl(145, 60%, 22%)' }} />
            <span>Profit (positif)</span>
          </div>
          <div className="perf-legend-item">
            <span className="perf-legend-dot" style={{ background: 'hsl(354, 70%, 22%)' }} />
            <span>Rugi (negatif)</span>
          </div>
          <div className="perf-legend-item">
            <span className="perf-legend-dot" style={{ background: 'var(--cell-zero)' }} />
            <span>Break-even (0%)</span>
          </div>
          <div className="perf-legend-item">
            <span className="perf-legend-dot perf-legend-dot--empty" />
            <span>Tidak ada data</span>
          </div>
          <span className="perf-legend-note">
            * Nilai = akumulasi P&amp;L % dari semua sinyal di bulan tersebut
          </span>
        </div>

        {/* Table */}
        <div className="perf-table-wrapper">
          {loading && (
            <div className="perf-loading">
              <div className="perf-loading-spinner" />
              <span>Memuat data performance...</span>
            </div>
          )}

          {error && (
            <div className="perf-error">
              <span>⚠️ {error}</span>
              <button onClick={fetchData} className="perf-error-retry">Coba Lagi</button>
            </div>
          )}

          {!loading && !error && data && (
            <table className="perf-table" id="performance-heatmap">
              <thead>
                <tr>
                  <th className="perf-th perf-th--label">Tahun</th>
                  {MONTHS.map(m => (
                    <th key={m} className="perf-th">{m}</th>
                  ))}
                  <th className="perf-th perf-th--year">Year</th>
                </tr>
              </thead>

              <tbody>
                {/* Baris Average */}
                <tr className="perf-row perf-row--avg">
                  <td className="perf-row-label perf-row-label--avg">Average</td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <PnlCell key={m} value={data.monthly_avg[m]} />
                  ))}
                  <PnlCell value={data.monthly_avg.year} isYear />
                </tr>

                {/* Baris per tahun */}
                {data.years.map(year => (
                  <tr key={year} className="perf-row">
                    <td className="perf-row-label">{year}</td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <PnlCell key={m} value={data.data[year]?.[m] ?? null} />
                    ))}
                    <PnlCell value={data.data[year]?.year ?? null} isYear />
                  </tr>
                ))}

                {/* Baris Probability */}
                <tr className="perf-row perf-row--prob">
                  <td className="perf-row-label perf-row-label--prob">Probability</td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <ProbCell key={m} value={data.monthly_probability[m]} />
                  ))}
                  <ProbCell value={data.monthly_probability.year} />
                </tr>
              </tbody>
            </table>
          )}

          {!loading && !error && data && data.total_signals === 0 && (
            <div className="perf-empty">
              <div className="perf-empty-icon">📊</div>
              <h3>Belum Ada Data</h3>
              <p>Data performance akan muncul setelah ada sinyal yang selesai (WIN/LOSS).</p>
            </div>
          )}
        </div>

        {/* Info kalkulasi */}
        <div className="perf-info-cards">
          <div className="perf-info-card">
            <div className="perf-info-icon">📈</div>
            <div className="perf-info-text">
              <strong>LONG WIN</strong>
              <span>(TP1 − Entry) / Entry × 100%</span>
            </div>
          </div>
          <div className="perf-info-card">
            <div className="perf-info-icon">📉</div>
            <div className="perf-info-text">
              <strong>LONG LOSS</strong>
              <span>(SL − Entry) / Entry × 100%</span>
            </div>
          </div>
          <div className="perf-info-card">
            <div className="perf-info-icon">📈</div>
            <div className="perf-info-text">
              <strong>SHORT WIN</strong>
              <span>(Entry − TP1) / Entry × 100%</span>
            </div>
          </div>
          <div className="perf-info-card">
            <div className="perf-info-icon">📉</div>
            <div className="perf-info-text">
              <strong>SHORT LOSS</strong>
              <span>(Entry − SL) / Entry × 100%</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
