import { useEffect, useRef, useState } from 'react';
import './Chart.css';

const TIMEFRAMES = [
  { label: '15m', tv: '15' },
  { label: '30m', tv: '30' },
  { label: '1H', tv: '60' },
  { label: '4H', tv: '240' },
  { label: '1D', tv: 'D' },
];

export default function ChartPanel({ multiView }) {
  const [activeTimeframe, setActiveTimeframe] = useState('60');
  const containerRef = useRef(null);
  const widgetRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Remove existing widget
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: 'BINANCE:BTCUSDT',
      interval: activeTimeframe,
      timezone: 'Asia/Jakarta',
      theme: 'dark',
      style: '1',
      locale: 'id',
      backgroundColor: 'rgba(14, 17, 23, 0)',
      gridColor: 'rgba(255, 255, 255, 0.04)',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
      studies: [
        'MASimple@tv-basicstudies',
        'MASimple@tv-basicstudies',
        'Stochastic@tv-basicstudies',
      ],
      studies_overrides: {
        'moving average.length': 9,
        'moving average.source': 'close',
        'moving average.plot.color': '#f7931a',
      },
    });

    containerRef.current.appendChild(script);
    widgetRef.current = script;
  }, [activeTimeframe]);

  if (multiView) {
    return (
      <div className="chart-multi">
        <div className="chart-multi-header">
          <span className="chart-multi-title">Multi-Timeframe View</span>
        </div>
        <div className="chart-multi-grid">
          {TIMEFRAMES.slice(0, 4).map((tf) => (
            <div key={tf.label} className="chart-multi-item">
              <div className="chart-multi-label">
                <span className="tf-badge">BTC/USDT</span>
                <span className="tf-badge tf-badge--active">{tf.label}</span>
              </div>
              <div className="chart-multi-embed">
                <MultiChart interval={tf.tv} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="chart-panel">
      <div className="chart-header">
        <div className="chart-title-group">
          <span className="chart-symbol">BTC/USDT</span>
          <span className="chart-exchange">Binance • Perpetual</span>
        </div>
        <div className="chart-timeframes" id="chart-timeframes">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.tv}
              id={`tf-btn-${tf.label}`}
              className={`tf-btn ${activeTimeframe === tf.tv ? 'tf-btn--active' : ''}`}
              onClick={() => setActiveTimeframe(tf.tv)}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-body">
        <div className="tradingview-widget-container" ref={containerRef} style={{ height: '100%', width: '100%' }}>
          <div className="tradingview-widget-container__widget" style={{ height: '100%', width: '100%' }} />
        </div>
      </div>
    </div>
  );
}

function MultiChart({ interval }) {
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
      width: '100%',
      height: '100%',
      locale: 'id',
      dateRange: interval === '15' || interval === '30' ? '1D' : interval === '60' ? '1M' : '12M',
      colorTheme: 'dark',
      trendLineColor: 'rgba(247, 147, 26, 0.8)',
      underLineColor: 'rgba(247, 147, 26, 0.1)',
      underLineBottomColor: 'rgba(247, 147, 26, 0)',
      isTransparent: true,
      autosize: true,
      largeChartUrl: '',
    });

    ref.current.appendChild(script);
  }, [interval]);

  return (
    <div ref={ref} style={{ height: '100%', width: '100%' }}>
      <div className="tradingview-widget-container__widget" style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
