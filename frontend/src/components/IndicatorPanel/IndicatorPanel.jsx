import './IndicatorPanel.css';

function IndicatorRow({ label, value, unit = '', colorClass = '' }) {
  const displayVal = value !== null && value !== undefined
    ? `${Number(value).toFixed(2)}${unit}`
    : '—';

  return (
    <div className="ind-row">
      <span className="ind-label">{label}</span>
      <span className={`ind-value mono ${colorClass}`}>{displayVal}</span>
    </div>
  );
}

function StochBar({ k, d }) {
  const kVal = k !== null && k !== undefined ? Number(k) : null;
  const dVal = d !== null && d !== undefined ? Number(d) : null;

  const getZone = (val) => {
    if (val === null) return 'neutral';
    if (val >= 80) return 'overbought';
    if (val <= 20) return 'oversold';
    return 'neutral';
  };

  const zoneK = getZone(kVal);
  const zoneD = getZone(dVal);

  return (
    <div className="stoch-bars">
      <div className="stoch-bar-item">
        <div className="stoch-bar-header">
          <span className="stoch-bar-label">%K</span>
          <span className={`stoch-bar-value mono stoch--${zoneK}`}>
            {kVal !== null ? kVal.toFixed(2) : '—'}
          </span>
        </div>
        <div className="stoch-bar-track">
          <div
            className={`stoch-bar-fill stoch-fill--${zoneK}`}
            style={{ width: `${kVal ?? 0}%` }}
          />
          {/* Overbought line */}
          <div className="stoch-line stoch-line--overbought" />
          {/* Oversold line */}
          <div className="stoch-line stoch-line--oversold" />
        </div>
      </div>
      <div className="stoch-bar-item">
        <div className="stoch-bar-header">
          <span className="stoch-bar-label">%D</span>
          <span className={`stoch-bar-value mono stoch--${zoneD}`}>
            {dVal !== null ? dVal.toFixed(2) : '—'}
          </span>
        </div>
        <div className="stoch-bar-track">
          <div
            className={`stoch-bar-fill stoch-fill--${zoneD}`}
            style={{ width: `${dVal ?? 0}%` }}
          />
          <div className="stoch-line stoch-line--overbought" />
          <div className="stoch-line stoch-line--oversold" />
        </div>
      </div>
    </div>
  );
}

export default function IndicatorPanel({ signal }) {
  const getEmaTrend = () => {
    if (!signal?.ema9 || !signal?.ema13) return null;
    return signal.ema9 > signal.ema13 ? 'bullish' : 'bearish';
  };

  const emaTrend = getEmaTrend();

  return (
    <div className="indicator-panel" id="indicator-panel">
      <div className="ind-panel-header">
        <h3 className="ind-panel-title">Indikator Teknikal</h3>
        <span className="ind-panel-sub">EMA • Stochastic • Order Block</span>
      </div>

      <div className="ind-sections">
        {/* EMA Section */}
        <div className="ind-section">
          <div className="ind-section-header">
            <span className="ind-section-title">EMA</span>
            {emaTrend && (
              <span className={`ind-trend-badge ind-trend--${emaTrend}`}>
                {emaTrend === 'bullish' ? '↑ Bullish' : '↓ Bearish'}
              </span>
            )}
          </div>
          <div className="ind-rows">
            <IndicatorRow
              label="EMA 9 (Fast)"
              value={signal?.ema9}
              colorClass={emaTrend === 'bullish' ? 'text-long' : emaTrend === 'bearish' ? 'text-short' : ''}
            />
            <IndicatorRow
              label="EMA 13 (Slow)"
              value={signal?.ema13}
            />
            {signal?.ema9 && signal?.ema13 && (
              <div className="ema-diff-row">
                <span className="ind-label">Selisih (9-13)</span>
                <span className={`ind-value mono ${signal.ema9 > signal.ema13 ? 'text-long' : 'text-short'}`}>
                  {(signal.ema9 - signal.ema13).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Stochastic Section */}
        <div className="ind-section">
          <div className="ind-section-header">
            <span className="ind-section-title">Stochastic (5,3,3)</span>
            {signal?.stoch_k && (
              <span className={`ind-zone-badge ${
                signal.stoch_k >= 80 ? 'zone--overbought' :
                signal.stoch_k <= 20 ? 'zone--oversold' : 'zone--neutral'
              }`}>
                {signal.stoch_k >= 80 ? 'Overbought' :
                 signal.stoch_k <= 20 ? 'Oversold' : 'Neutral'}
              </span>
            )}
          </div>
          <StochBar k={signal?.stoch_k} d={signal?.stoch_d} />
        </div>

        {/* Order Block Section */}
        <div className="ind-section">
          <div className="ind-section-header">
            <span className="ind-section-title">Order Block</span>
            <span className="ind-section-badge">SMC</span>
          </div>
          <div className="ob-zone">
            {signal?.order_block_zone ? (
              <>
                <div className="ob-zone-label">Zone Teridentifikasi</div>
                <div className="ob-zone-value mono">{signal.order_block_zone}</div>
                <div className="ob-zone-desc">
                  Area potensi akumulasi/distribusi order institusional
                </div>
              </>
            ) : (
              <div className="ob-zone-empty">
                <span>Belum ada data Order Block</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
