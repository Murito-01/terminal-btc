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
    label: 'WAIT & SEE',
    emoji: '⏸',
    colorClass: 'signal--wait',
    desc: 'Belum ada sinyal kuat — Tunggu konfirmasi',
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

/**
 * Komponen level TP/SL
 */
function TradeLevels({ signal, isWait = false }) {
  const { entry_price, tp1, tp2, sl, position_type } = signal;
  if (!tp1 || !sl) return null;

  const formatPrice = (p) =>
    p ? `$${Number(p).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

  const isLong = (position_type || signal.position) !== 'SHORT';

  return (
    <div className={`trade-levels ${isWait ? 'trade-levels--preview' : ''}`}>
      {isWait && (
        <div className="trade-levels-badge">📊 Level Referensi (jika sinyal muncul)</div>
      )}

      <div className="level-grid">
        <div className="level-item level-tp1">
          <span className="level-icon">🎯</span>
          <div className="level-body">
            <span className="level-label">Take Profit 1</span>
            <span className="level-value">{formatPrice(tp1)}</span>
            {entry_price && (
              <span className="level-rr">
                RR 1:1.3 · {isLong ? '+' : '-'}{Math.abs(((tp1 - entry_price) / entry_price) * 100).toFixed(2)}%
              </span>
            )}
          </div>
        </div>

        <div className="level-item level-tp2">
          <span className="level-icon">🎯</span>
          <div className="level-body">
            <span className="level-label">Take Profit 2</span>
            <span className="level-value">{formatPrice(tp2)}</span>
            {entry_price && (
              <span className="level-rr">
                RR 1:2 · {isLong ? '+' : '-'}{Math.abs(((tp2 - entry_price) / entry_price) * 100).toFixed(2)}%
              </span>
            )}
          </div>
        </div>

        <div className="level-item level-sl">
          <span className="level-icon">🛑</span>
          <div className="level-body">
            <span className="level-label">Stop Loss</span>
            <span className="level-value">{formatPrice(sl)}</span>
            {entry_price && (
              <span className="level-rr">
                {isLong ? '-' : '+'}{Math.abs(((sl - entry_price) / entry_price) * 100).toFixed(2)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {entry_price && (
        <div className="level-entry">
          <span className="level-entry-label">Entry Price</span>
          <span className="level-entry-value">{formatPrice(entry_price)}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Panel "Menunggu Analisa" — ditampilkan sebelum Signal Engine mengirim data pertama
 */
function EmptyState() {
  return (
    <div className="signal-panel signal-panel--empty" id="signal-panel">
      <div className="signal-empty">
        <div className="signal-empty-icon">📡</div>
        <h3 className="signal-empty-title">Menghubungkan ke Engine...</h3>
        <p className="signal-empty-desc">
          Signal Engine sedang mengambil data dari Binance. Harap tunggu sebentar.
        </p>
      </div>
    </div>
  );
}

/**
 * Panel utama sinyal
 * @param {object} signal - sinyal dari database (LONG/SHORT tersimpan) atau live state
 * @param {object} liveState - state terkini semua timeframe dari Socket.IO
 * @param {object} latestByTimeframe - sinyal terakhir per timeframe dari API
 */
export default function SignalPanel({ signal, liveState, latestByTimeframe }) {
  // Tentukan timeframe yang aktif (gunakan 1H sebagai default)
  const activeTimeframe = signal?.timeframe || '1H';

  // Gunakan live state dari Socket jika ada, atau fallback ke signal dari DB
  const liveData = liveState?.[activeTimeframe] || liveState?.['1H'];

  // Jika belum ada live state DAN tidak ada signal dari DB, tampilkan loading
  if (!liveData && !signal) {
    return <EmptyState />;
  }

  // Tentukan data yang akan ditampilkan
  // Prioritas: sinyal terbaru dari DB (LONG/SHORT) → live state dari engine
  const displayData = signal || liveData;
  const position    = displayData?.position_type || liveData?.position || 'WAIT';
  const config      = POSITION_CONFIG[position] || POSITION_CONFIG.WAIT;
  const isWait      = position === 'WAIT';

  // Siapkan data level TP/SL dari live state atau dari sinyal DB
  const levelData = {
    entry_price:   liveData?.entry_price   ?? signal?.entry_price,
    tp1:           liveData?.tp1           ?? signal?.tp1,
    tp2:           liveData?.tp2           ?? signal?.tp2,
    sl:            liveData?.sl            ?? signal?.sl,
    position_type: position,
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const signalTime = signal?.created_at || liveData?.updated_at;

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
          <span className="signal-meta-value mono">
            {liveData?.timeframe || signal?.timeframe || '—'}
          </span>
        </div>
        <div className="signal-meta-item">
          <span className="signal-meta-label">{isWait ? 'Update' : 'Waktu Sinyal'}</span>
          <span className="signal-meta-value mono">{formatTime(signalTime)}</span>
        </div>
        {liveData?.currentPrice && (
          <div className="signal-meta-item">
            <span className="signal-meta-label">Harga BTC</span>
            <span className="signal-meta-value mono signal-price">
              ${Number(liveData.currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>

      {/* TP/SL Levels */}
      <TradeLevels signal={levelData} isWait={isWait} />

      {/* Success Rate — hanya untuk sinyal LONG/SHORT */}
      {!isWait && <SuccessRateBar rate={signal?.success_rate} />}

      {/* Timeframe summary pills */}
      {liveState && (
        <div className="signal-tf-summary">
          <span className="signal-tf-label">Status per Timeframe:</span>
          <div className="signal-tf-pills">
            {Object.entries(liveState).map(([tf, tfData]) => {
              const tfConfig = POSITION_CONFIG[tfData?.position] || POSITION_CONFIG.WAIT;
              return (
                <div key={tf} className={`tf-pill tf-pill--${(tfData?.position || 'wait').toLowerCase()}`}>
                  <span className="tf-pill-tf">{tf}</span>
                  <span className="tf-pill-val">{tfConfig.emoji} {tfData?.position || 'WAIT'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fallback pills dari API jika liveState belum ada */}
      {!liveState && latestByTimeframe && (
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
