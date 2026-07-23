import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  CrosshairMode,
  LineStyle,
  CandlestickSeries,
  LineSeries,
} from 'lightweight-charts';
import api from '../../lib/api';
import './Chart.css';

const TIMEFRAMES = [
  { label: '15m', api: '15m' },
  { label: '1H',  api: '1H'  },
  { label: '4H',  api: '4H'  },
  { label: '1D',  api: '1D'  },
];

/* ─── Warna desain ─── */
const COLORS = {
  background: '#0e1117',
  grid:       'rgba(255,255,255,0.04)',
  border:     'rgba(255,255,255,0.08)',
  text:       '#8892a4',
  up:         '#00d084',
  down:       '#ff4d6d',
  ema9:       '#f7931a',   // oranye BTC
  ema13:      '#3b9efa',   // biru
  stochK:     '#00d084',   // hijau
  stochD:     '#ff4d6d',   // merah
};

export default function ChartPanel({ multiView }) {
  const [activeTimeframe, setActiveTimeframe] = useState('1H');
  const [error, setError] = useState(null);

  const mainRef  = useRef(null);
  const stochRef = useRef(null);
  const cleanupRef = useRef(null); // menyimpan fungsi cleanup chart

  /* ----- Build charts menggunakan lightweight-charts v5 API ----- */
  const buildAndLoad = useCallback(async (tf) => {
    /* hapus chart lama */
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    if (!mainRef.current || !stochRef.current) return;

    /* ---------- Buat main chart ---------- */
    const mainChart = createChart(mainRef.current, {
      layout: {
        background: { color: COLORS.background },
        textColor:  COLORS.text,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: COLORS.grid },
        horzLines: { color: COLORS.grid },
      },
      rightPriceScale: {
        borderColor:  COLORS.border,
        scaleMargins: { top: 0.08, bottom: 0.05 },
      },
      timeScale: {
        borderColor:    COLORS.border,
        timeVisible:    true,
        secondsVisible: false,
      },
      crosshair: { mode: CrosshairMode.Normal },
      width:  mainRef.current.clientWidth,
      height: mainRef.current.clientHeight,
    });

    /* v5 API: chart.addSeries(SeriesType, options) */
    const candleSeries = mainChart.addSeries(CandlestickSeries, {
      upColor:       COLORS.up,
      downColor:     COLORS.down,
      borderVisible: false,
      wickUpColor:   COLORS.up,
      wickDownColor: COLORS.down,
    });

    const ema9Series = mainChart.addSeries(LineSeries, {
      color:                    COLORS.ema9,
      lineWidth:                2,
      title:                    'EMA 9',
      crosshairMarkerVisible:   false,
      lastValueVisible:         true,
      priceLineVisible:         false,
    });

    const ema13Series = mainChart.addSeries(LineSeries, {
      color:                    COLORS.ema13,
      lineWidth:                2,
      title:                    'EMA 13',
      crosshairMarkerVisible:   false,
      lastValueVisible:         true,
      priceLineVisible:         false,
    });

    /* ---------- Buat stochastic chart ---------- */
    const stochChart = createChart(stochRef.current, {
      layout: {
        background: { color: COLORS.background },
        textColor:  COLORS.text,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: COLORS.grid },
        horzLines: { color: COLORS.grid },
      },
      rightPriceScale: {
        borderColor:  COLORS.border,
        scaleMargins: { top: 0.1, bottom: 0.1 },
        minimumWidth: 60,
      },
      timeScale: {
        borderColor:    COLORS.border,
        timeVisible:    false,
        secondsVisible: false,
        visible:        false,
      },
      crosshair: { mode: CrosshairMode.Normal },
      width:  stochRef.current.clientWidth,
      height: stochRef.current.clientHeight,
    });

    /* Garis level OB/OS */
    const obSeries = stochChart.addSeries(LineSeries, {
      color: 'rgba(255,77,109,0.35)', lineWidth: 1, lineStyle: LineStyle.Dashed,
      crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false,
    });
    const osSeries = stochChart.addSeries(LineSeries, {
      color: 'rgba(0,208,132,0.35)',  lineWidth: 1, lineStyle: LineStyle.Dashed,
      crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false,
    });

    const stochKSeries = stochChart.addSeries(LineSeries, {
      color: COLORS.stochK, lineWidth: 2, title: '%K',
      crosshairMarkerVisible: false, priceLineVisible: false,
    });
    const stochDSeries = stochChart.addSeries(LineSeries, {
      color: COLORS.stochD, lineWidth: 1, title: '%D',
      crosshairMarkerVisible: false, priceLineVisible: false,
    });

    /* ---------- Sync timeScale antar chart ---------- */
    const syncMain = () => {
      const r = mainChart.timeScale().getVisibleLogicalRange();
      if (r) stochChart.timeScale().setVisibleLogicalRange(r);
    };
    const syncStoch = () => {
      const r = stochChart.timeScale().getVisibleLogicalRange();
      if (r) mainChart.timeScale().setVisibleLogicalRange(r);
    };
    mainChart.timeScale().subscribeVisibleLogicalRangeChange(syncMain);
    stochChart.timeScale().subscribeVisibleLogicalRangeChange(syncStoch);

    /* ---------- ResizeObserver ---------- */
    const ro = new ResizeObserver(() => {
      if (mainRef.current)  mainChart.applyOptions({ width: mainRef.current.clientWidth,  height: mainRef.current.clientHeight });
      if (stochRef.current) stochChart.applyOptions({ width: stochRef.current.clientWidth, height: stochRef.current.clientHeight });
    });
    if (mainRef.current)  ro.observe(mainRef.current);
    if (stochRef.current) ro.observe(stochRef.current);

    /* ---------- Load data dari API ---------- */
    try {
      setError(null);
      const res = await api.get(`/chart-data?timeframe=${tf}&limit=200`);
      const candles = res.data.candles;

      if (candles?.length) {
        /* Helper: filter hanya data point numerik yang valid */
        const valid = (c, key) => c[key] !== null && c[key] !== undefined && Number.isFinite(c[key]);

        candleSeries.setData(
          candles
            .filter(c => valid(c,'open') && valid(c,'high') && valid(c,'low') && valid(c,'close'))
            .map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }))
        );

        ema9Series.setData(
          candles.filter(c => valid(c, 'ema9')).map(c => ({ time: c.time, value: c.ema9 }))
        );
        ema13Series.setData(
          candles.filter(c => valid(c, 'ema13')).map(c => ({ time: c.time, value: c.ema13 }))
        );

        const stochK = candles.filter(c => valid(c, 'stoch_k') && valid(c, 'stoch_d'));
        stochKSeries.setData(stochK.map(c => ({ time: c.time, value: c.stoch_k })));
        stochDSeries.setData(stochK.map(c => ({ time: c.time, value: c.stoch_d })));

        /* Level 80 / 20 */
        const stochTimes = stochK.map(c => c.time);
        obSeries.setData(stochTimes.map(t => ({ time: t, value: 80 })));
        osSeries.setData(stochTimes.map(t => ({ time: t, value: 20 })));

        mainChart.timeScale().fitContent();
        stochChart.timeScale().fitContent();
      }
    } catch (err) {
      console.error('Chart data error:', err.message);
      setError('Gagal memuat data chart: ' + err.message);
    }

    /* ---------- Cleanup function ---------- */
    cleanupRef.current = () => {
      ro.disconnect();
      mainChart.timeScale().unsubscribeVisibleLogicalRangeChange(syncMain);
      stochChart.timeScale().unsubscribeVisibleLogicalRangeChange(syncStoch);
      mainChart.remove();
      stochChart.remove();
    };
  }, []);

  useEffect(() => {
    if (multiView) return;
    buildAndLoad(activeTimeframe);

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [activeTimeframe, multiView, buildAndLoad]);

  /* ── Multi-view ── */
  if (multiView) return <MultiView />;

  return (
    <div className="chart-panel">
      {/* Header */}
      <div className="chart-header">
        <div className="chart-title-group">
          <span className="chart-symbol">BTC/USDT</span>
          <span className="chart-exchange">Binance • Perpetual</span>
          <div className="chart-legend">
            <span className="legend-item" style={{ color: COLORS.ema9 }}>● EMA 9</span>
            <span className="legend-item" style={{ color: COLORS.ema13 }}>● EMA 13</span>
            <span className="legend-item" style={{ color: COLORS.stochK }}>● %K</span>
            <span className="legend-item" style={{ color: COLORS.stochD }}>● %D</span>
          </div>
        </div>
        <div className="chart-timeframes" id="chart-timeframes">
          {TIMEFRAMES.map(tf => (
            <button
              key={tf.api}
              id={`tf-btn-${tf.label}`}
              className={`tf-btn ${activeTimeframe === tf.api ? 'tf-btn--active' : ''}`}
              onClick={() => setActiveTimeframe(tf.api)}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ padding: '12px 20px', color: '#ff4d6d', fontSize: '13px', background: 'rgba(255,77,109,0.08)', borderBottom: '1px solid rgba(255,77,109,0.2)' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Chart body */}
      <div className="chart-body chart-body--split">
        <div className="chart-main-pane" ref={mainRef} />

        <div className="chart-stoch-header">
          <span>Stochastic (5,3,3)</span>
          <span style={{ color: COLORS.stochK }}>%K</span>
          <span style={{ color: COLORS.stochD }}>%D</span>
          <span className="stoch-level-label">— OB:80 / OS:20</span>
        </div>
        <div className="chart-stoch-pane" ref={stochRef} />
      </div>
    </div>
  );
}

/* ─── Multi Timeframe View ─── */
function MultiView() {
  return (
    <div className="chart-multi">
      <div className="chart-multi-header">
        <span className="chart-multi-title">Multi-Timeframe View</span>
      </div>
      <div className="chart-multi-grid">
        {[
          { label: '15m', range: '1D' },
          { label: '1H',  range: '1M' },
          { label: '4H',  range: '6M' },
          { label: '1D',  range: '12M' },
        ].map(tf => (
          <div key={tf.label} className="chart-multi-item">
            <div className="chart-multi-label">
              <span className="tf-badge">BTC/USDT</span>
              <span className="tf-badge tf-badge--active">{tf.label}</span>
            </div>
            <div className="chart-multi-embed">
              <MultiChart dateRange={tf.range} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MultiChart({ dateRange }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: 'BINANCE:BTCUSDT',
      width: '100%', height: '100%',
      locale: 'id',
      dateRange,
      colorTheme: 'dark',
      trendLineColor: 'rgba(247,147,26,0.8)',
      underLineColor: 'rgba(247,147,26,0.1)',
      underLineBottomColor: 'rgba(247,147,26,0)',
      isTransparent: true,
      autosize: true,
    });
    ref.current.appendChild(script);
  }, [dateRange]);

  return <div ref={ref} style={{ height: '100%', width: '100%' }} />;
}
