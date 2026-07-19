const { EMA, Stochastic } = require('technicalindicators');

/**
 * Hitung EMA dari array nilai close
 * @param {number[]} closes - array harga penutupan
 * @param {number} period
 * @returns {number[]}
 */
function calcEMA(closes, period) {
  const result = EMA.calculate({ period, values: closes });
  return result;
}

/**
 * Hitung Stochastic (5, 3, 3) dari data OHLCV
 * @param {Array} candles - array { high, low, close }
 * @returns {{ k: number[], d: number[] }}
 */
function calcStochastic(candles) {
  const highs  = candles.map(c => c.high);
  const lows   = candles.map(c => c.low);
  const closes = candles.map(c => c.close);

  const result = Stochastic.calculate({
    high:         highs,
    low:          lows,
    close:        closes,
    period:       5,
    signalPeriod: 3,
  });

  // result = [{ k, d }, ...]
  const k = result.map(r => r.k);
  const d = result.map(r => r.d);

  return { k, d };
}

/**
 * Deteksi Order Block terakhir secara sederhana.
 * Logika: cari candle besar yang berlawanan arah diikuti reversal.
 * @param {Array} candles
 * @returns {string|null} string "low-high" atau null
 */
function detectOrderBlock(candles) {
  if (candles.length < 5) return null;

  // Hitung rata-rata body candle untuk menentukan "candle besar"
  const bodies = candles.map(c => Math.abs(c.close - c.open));
  const avgBody = bodies.reduce((a, b) => a + b, 0) / bodies.length;

  // Cari dari candle terbaru ke belakang (skip 2 candle terakhir agar ada konfirmasi)
  for (let i = candles.length - 3; i >= 1; i--) {
    const prev = candles[i - 1]; // candle sebelum OB candidate
    const ob   = candles[i];     // kandidat OB
    const next = candles[i + 1]; // konfirmasi

    const obBody = Math.abs(ob.close - ob.open);
    if (obBody < avgBody * 1.2) continue; // Harus candle yang cukup besar

    const isBullishOB  = ob.close > ob.open && next.close < next.open; // Bullish OB → reversal turun
    const isBearishOB  = ob.close < ob.open && next.close > next.open; // Bearish OB → reversal naik

    if (isBullishOB || isBearishOB) {
      const low  = Math.round(ob.low);
      const high = Math.round(ob.high);
      return `${low}-${high}`;
    }
  }

  return null;
}

/**
 * Hitung Average True Range (ATR) dari candles
 * @param {Array} candles
 * @param {number} period - default 14
 */
function calcATR(candles, period = 14) {
  if (candles.length < period + 1) return null;

  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low  = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trs.push(tr);
  }

  // Hitung rata-rata ATR dari 'period' TR terakhir
  const recentTRs = trs.slice(-period);
  return recentTRs.reduce((a, b) => a + b, 0) / period;
}

/**
 * Hitung Take Profit dan Stop Loss berdasarkan ATR
 * - SL : 1.5x ATR dari entry
 * - TP1: 2x ATR dari entry (RR 1:1.33)
 * - TP2: 3x ATR dari entry (RR 1:2)
 * @param {string} position - 'LONG' | 'SHORT'
 * @param {number} entryPrice
 * @param {number} atr
 */
function calcTPSL(position, entryPrice, atr) {
  if (!atr || !entryPrice) return { tp1: null, tp2: null, sl: null };

  const slDist  = atr * 1.5;
  const tp1Dist = atr * 2;
  const tp2Dist = atr * 3;

  if (position === 'LONG') {
    return {
      entry: parseFloat(entryPrice.toFixed(2)),
      sl:    parseFloat((entryPrice - slDist).toFixed(2)),
      tp1:   parseFloat((entryPrice + tp1Dist).toFixed(2)),
      tp2:   parseFloat((entryPrice + tp2Dist).toFixed(2)),
    };
  } else if (position === 'SHORT') {
    return {
      entry: parseFloat(entryPrice.toFixed(2)),
      sl:    parseFloat((entryPrice + slDist).toFixed(2)),
      tp1:   parseFloat((entryPrice - tp1Dist).toFixed(2)),
      tp2:   parseFloat((entryPrice - tp2Dist).toFixed(2)),
    };
  }

  return { entry: entryPrice, tp1: null, tp2: null, sl: null };
}

/**
 * Analisa lengkap dari array candle: kembalikan semua nilai indikator terbaru
 * @param {Array} candles - minimal 50 candle
 * @returns {{ ema9, ema13, stoch_k, stoch_d, orderBlock, atr, currentPrice }}
 */
function analyzeCandles(candles) {
  if (candles.length < 20) {
    throw new Error('Insufficient candle data for analysis');
  }

  const closes = candles.map(c => c.close);

  const ema9Arr  = calcEMA(closes, 9);
  const ema13Arr = calcEMA(closes, 13);
  const { k, d } = calcStochastic(candles);
  const orderBlock = detectOrderBlock(candles);
  const atr = calcATR(candles, 14);

  return {
    currentPrice: parseFloat(candles[candles.length - 1].close.toFixed(2)),
    ema9:         parseFloat(ema9Arr[ema9Arr.length - 1].toFixed(2)),
    ema13:        parseFloat(ema13Arr[ema13Arr.length - 1].toFixed(2)),
    prevEma9:     parseFloat(ema9Arr[ema9Arr.length - 2].toFixed(2)),
    prevEma13:    parseFloat(ema13Arr[ema13Arr.length - 2].toFixed(2)),
    stoch_k:      parseFloat(k[k.length - 1].toFixed(2)),
    stoch_d:      parseFloat(d[d.length - 1].toFixed(2)),
    prevStochK:   parseFloat(k[k.length - 2].toFixed(2)),
    orderBlock,
    atr,
  };
}

module.exports = { calcEMA, calcStochastic, detectOrderBlock, calcATR, calcTPSL, analyzeCandles };
