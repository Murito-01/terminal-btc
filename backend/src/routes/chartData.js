const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getKlines } = require('../services/binanceService');
const { calcEMA, calcStochastic } = require('../services/indicatorService');

const router = express.Router();

/**
 * Konversi nilai ke number yang valid, atau null jika tidak valid
 */
function safeNum(v, decimals = 2) {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (!isFinite(n) || isNaN(n)) return null;
  return parseFloat(n.toFixed(decimals));
}

/**
 * GET /api/chart-data?timeframe=1H&limit=200
 * Kembalikan OHLCV + EMA9, EMA13, Stoch K, Stoch D per candle
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const timeframe = req.query.timeframe || '1H';
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);

    const candles = await getKlines('BTCUSDT', timeframe, limit);
    const closes  = candles.map(c => c.close);

    const ema9Arr  = calcEMA(closes, 9)  || [];
    const ema13Arr = calcEMA(closes, 13) || [];

    let kArr = [], dArr = [];
    try {
      const { k, d } = calcStochastic(candles);
      kArr = Array.isArray(k) ? k : [];
      dArr = Array.isArray(d) ? d : [];
    } catch (e) {
      console.warn('Stochastic calculation error:', e.message);
    }

    // Alignment: EMA/Stoch arrays lebih pendek dari candles (butuh N candle awal untuk warm-up)
    const ema9Offset  = candles.length - ema9Arr.length;
    const ema13Offset = candles.length - ema13Arr.length;
    const stochOffset = candles.length - kArr.length;

    const result = candles.map((c, i) => {
      const e9  = i >= ema9Offset  ? ema9Arr[i - ema9Offset]   : null;
      const e13 = i >= ema13Offset ? ema13Arr[i - ema13Offset] : null;
      const sk  = i >= stochOffset ? kArr[i - stochOffset]     : null;
      const sd  = i >= stochOffset ? dArr[i - stochOffset]     : null;

      return {
        time:    Math.floor(c.openTime / 1000), // Unix timestamp (detik)
        open:    safeNum(c.open, 2),
        high:    safeNum(c.high, 2),
        low:     safeNum(c.low,  2),
        close:   safeNum(c.close, 2),
        volume:  safeNum(c.volume, 4),
        ema9:    safeNum(e9),
        ema13:   safeNum(e13),
        stoch_k: safeNum(sk),
        stoch_d: safeNum(sd),
      };
    });

    res.json({ timeframe, candles: result });
  } catch (err) {
    console.error('Chart data error:', err.message);
    res.status(500).json({ error: 'Gagal mengambil data chart: ' + err.message });
  }
});

module.exports = router;
