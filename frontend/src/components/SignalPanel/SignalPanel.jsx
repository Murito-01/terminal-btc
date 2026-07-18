import './SignalPanel.css';

const POSITION_CONFIG = {
  LONG: {
    label: 'LONG',
    emoji: '▲',
    colorClass: 'signal--long',
    desc: 'Rekomendasi posisi BELI (Long)',
  },
  SHORT: {
    label: 'SHORT',
    emoji: '▼',
    colorClass: 'signal--short',
    desc: 'Rekomendasi posisi JUAL (Short)',
  },
  WAIT: {
    label: 'WAIT',
    emoji: '⏸',
    colorClass: 'signal--wait',
    desc: 'Wait and See — Belum ada sinyal kuat',
  },
};

function SuccessRateBar({ rate }) {
  if (rate === null || rate === undefined) {
    return (
      <div className="sr-container">
        <div className="sr-label-row">
          <span className="sr-label">Tingkat Keberhasilan</span>
          <span className="sr-value sr-value--na">N/A</span>
        </div>
        <div className="sr-bar-track">
          <div className="sr-bar-fill sr-bar-fill--empty" />
        </div>
        <p className="sr-note">Data histori masih terbatas</p>
      </div>
    );
  }

  const colorClass = rate >= 70 ? 'sr-bar--good' : rate >= 50 ? 'sr-bar--ok' : 'sr-bar--bad';

  return (
    <div className="sr-container">
      <div className="sr-label-row">
        <span className="sr-label">Tingkat Keberhasilan</span>
        <span className="sr-value">{rate}%</span>
      </div>
      <div className="sr-bar-track">
        <div
          className={`sr-bar-fill ${colorClass}`}
          style={{ width: `${rate}%` }}
        />
      </div>
      <p className="sr-note">
        {rate >= 70 ? '✓ Akurasi tinggi' : rate >= 50 ? '~ Akurasi sedang' : '✗ Akurasi rendah'}
      </p>
    </div>
  );
}

export default function SignalPanel({ signal, latestByTimeframe }) {
  if (!signal) {
    return (
      <div className="signal-panel signal-panel--empty" id="signal-panel">
        <div className="signal-empty">
          <div className="signal-empty-icon">📡</div>
          <h3 className="signal-empty-title">Menunggu Sinyal</h3>
          <p className="signal-empty-desc">
            Belum ada sinyal dari TradingView. Pastikan webhook sudah dikonfigurasi.
          </p>
        </div>
      </div>
    );
  }

  const config = POSITION_CONFIG[signal.position_type] || POSITION_CONFIG.WAIT;

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`signal-panel ${config.colorClass}`} id="signal-panel">
      {/* Main Signal Badge */}
      <div className="signal-badge-container">
        <div className="signal-badge-glow" />
        <div className="signal-icon-circle">
          <span className="signal-icon">{config.emoji}</span>
        </div>
        <div className="signal-main-badge">
          {config.label}
        </div>
        <p className="signal-desc">{config.desc}</p>
      </div>

      {/* Meta */}
      <div className="signal-meta">
        <div className="signal-meta-item">
          <span className="signal-meta-label">Timeframe</span>
          <span className="signal-meta-value mono">{signal.timeframe}</span>
        </div>
        <div className="signal-meta-item">
          <span className="signal-meta-label">Waktu Sinyal</span>
          <span className="signal-meta-value mono">{formatTime(signal.created_at)}</span>
        </div>
      </div>

      {/* Success Rate */}
      <SuccessRateBar rate={signal.success_rate} />

      {/* Timeframe summary pills */}
      {latestByTimeframe && (
        <div className="signal-tf-summary">
          <span className="signal-tf-label">Sinyal per Timeframe:</span>
          <div className="signal-tf-pills">
            {Object.entries(latestByTimeframe).map(([tf, sig]) => {
              if (!sig) return (
                <div key={tf} className="tf-pill tf-pill--empty">
                  <span className="tf-pill-tf">{tf}</span>
                  <span className="tf-pill-val">—</span>
                </div>
              );
              const tfConfig = POSITION_CONFIG[sig.position_type];
              return (
                <div key={tf} className={`tf-pill tf-pill--${sig.position_type.toLowerCase()}`}>
                  <span className="tf-pill-tf">{tf}</span>
                  <span className="tf-pill-val">{tfConfig?.emoji} {sig.position_type}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
