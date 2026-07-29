/**
 * Backtest Route — POST /api/backtest/run
 *
 * Mengambil data historis dari Binance, menjalankan logika sinyal yang sama
 * dengan signal engine, dan menyimpan hasilnya ke tabel signals dengan source='backtest'.
 *
 * Algoritma:
 * 1. Fetch candles dari Binance dengan rentang [startDate - warmup, endDate]
 * 2. Hitung EMA9, EMA13, Stochastic untuk seluruh dataset sekaligus
 * 3. Iterasi candle mulai dari startDate, cek kondisi crossover
 * 4. Jika ada sinyal baru (bukan duplikat timeframe), cari outcome dari candle berikutnya
 * 5. Simpan ke DB dengan created_at sesuai waktu candle (bukan waktu sekarang)
 */

const express    = require('express');
const axios      = require('axios');
const https      = require('https');
const { authenticateToken }                                       = require('../middleware/auth');
const { getDb }                                                   = require('../db/database');
const { calcEMA, calcStochastic, calcATR, detectOrderBlock, calcTPSL } = require('../services/indicatorService');

const router = express.Router();

/* ────────── Binance helpers ────────── */
const BINANCE_ENDPOINTS = [
  'https://data-api.binance.vision',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api.binance.com',
];

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const TF_INTERVAL = { '15m': '15m', '1H': '1h', '4H': '4h', '1D': '1d' };

/**
 * Fetch candles dengan pagination (mendukung lebih dari 1000 candle)
 */
async function fetchKlinesRange(symbol, tf, startMs, endMs) {
  const interval   = TF_INTERVAL[tf];
  const allCandles = [];
  let   currentStart = startMs;

  while (currentStart < endMs) {
    let fetched = false;
    for (const base of BINANCE_ENDPOINTS) {
      try {
        const res = await axios.get(`${base}/api/v3/klines`, {
          params: { symbol, interval, startTime: currentStart, endTime: endMs, limit: 1000 },
          timeout: 20000,
          httpsAgent,
        });

        const batch = res.data.map(k => ({
          openTime: k[0],
          open:     parseFloat(k[1]),
          high:     parseFloat(k[2]),
          low:      parseFloat(k[3]),
          close:    parseFloat(k[4]),
          volume:   parseFloat(k[5]),
        }));

        if (batch.length === 0) { currentStart = endMs; fetched = true; break; }

        allCandles.push(...batch);
        currentStart = batch.length < 1000 ? endMs : batch[batch.length - 1].openTime + 1;
        fetched = true;
        break; // Sukses, keluar dari endpoint loop
      } catch (e) {
        // Coba endpoint berikutnya
      }
    }
    if (!fetched) break; // Semua endpoint gagal
  }

  return allCandles;
}

/* ────────── Signal detection (identik dengan signalEngine.js) ────────── */
function detectSignal(prevEma9, prevEma13, currEma9, currEma13, stochK, prevStochK) {
  const prevBullish = prevEma9 <= prevEma13;
  const currBullish = currEma9  > currEma13;
  const prevBearish = prevEma9 >= prevEma13;
  const currBearish = currEma9  < currEma13;

  // Konfirmasi momentum arah Stochastic
  const momentumBullish = prevStochK != null ? stochK >= prevStochK : true;
  const momentumBearish = prevStochK != null ? stochK <= prevStochK : true;

  if (prevBullish && currBullish && momentumBullish) return 'LONG';
  if (prevBearish && currBearish && momentumBearish) return 'SHORT';
  return null;
}

/**
 * Tentukan outcome sinyal dari candle-candle setelah entry
 * Cek mana yang tersentuh lebih dulu: TP1 atau SL
 */
function determineOutcome(position, tp1, sl, futureCandles) {
  for (const c of futureCandles) {
    if (position === 'LONG') {
      const hitTP = c.high >= tp1;
      const hitSL = c.low  <= sl;
      if (hitTP && !hitSL) return 'WIN';
      if (hitSL && !hitTP) return 'LOSS';
      if (hitTP && hitSL) {
        // Keduanya kena di candle yang sama → asumsi berdasarkan urutan:
        // Jika candle bullish (close > open), kemungkinan TP dulu
        return c.close >= c.open ? 'WIN' : 'LOSS';
      }
    } else { // SHORT
      const hitTP = c.low  <= tp1;
      const hitSL = c.high >= sl;
      if (hitTP && !hitSL) return 'WIN';
      if (hitSL && !hitTP) return 'LOSS';
      if (hitTP && hitSL) {
        return c.close <= c.open ? 'WIN' : 'LOSS';
      }
    }
  }
  return null; // Belum mencapai TP/SL (RUNNING)
}

/* ────────── Warmup per timeframe ────────── */
const TF_WARMUP_MS = {
  '15m': 200 * 15 * 60 * 1000,      // 200 candle × 15 menit
  '1H':  200 * 60 * 60 * 1000,      // 200 jam
  '4H':  200 * 4 * 60 * 60 * 1000,  // 800 jam
  '1D':  200 * 24 * 60 * 60 * 1000, // 200 hari
};

/* ────────────────────────────────────────────────
   POST /api/backtest/run
   Body: { startDate, endDate, timeframes, clearPrevious }
──────────────────────────────────────────────── */
router.post('/run', authenticateToken, async (req, res) => {
  const {
    startDate     = '2026-07-01',
    endDate       = '2026-07-29',
    timeframes    = ['15m', '1H', '4H', '1D'],
    clearPrevious = true,   // Hapus backtest lama di range yang sama sebelum run baru
  } = req.body;

  try {
    const db = getDb();

    const startMs = new Date(startDate + 'T00:00:00.000Z').getTime();
    const endMs   = new Date(endDate   + 'T23:59:59.999Z').getTime();

    /* Hapus data backtest lama di rentang yang sama agar tidak duplikat */
    if (clearPrevious) {
      db.prepare(`
        DELETE FROM signals
        WHERE source = 'backtest'
          AND created_at >= ?
          AND created_at <= ?
      `).run(
        new Date(startMs).toISOString(),
        new Date(endMs).toISOString()
      );
    }

    const insertStmt = db.prepare(`
      INSERT INTO signals
        (timeframe, position_type, success_rate, ema9, ema13, stoch_k, stoch_d,
         order_block_zone, entry_price, tp1, tp2, sl, outcome, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'backtest', ?)
    `);

    const summary = { total: 0, inserted: 0, byTimeframe: {} };
    const allSignals = [];

    /* ── Iterasi per timeframe ── */
    for (const tf of timeframes) {
      const warmupMs   = TF_WARMUP_MS[tf];
      const fetchStart = startMs - warmupMs;

      console.log(`[Backtest] Fetching ${tf} candles...`);
      const candles = await fetchKlinesRange('BTCUSDT', tf, fetchStart, endMs);

      if (candles.length < 20) {
        summary.byTimeframe[tf] = { error: 'Data tidak cukup', total: 0 };
        continue;
      }
      console.log(`[Backtest] ${tf}: ${candles.length} candles`);

      /* Hitung semua indikator sekaligus atas seluruh dataset */
      const closes = candles.map(c => c.close);
      const ema9Arr  = calcEMA(closes, 9)  || [];
      const ema13Arr = calcEMA(closes, 13) || [];

      let kArr = [], dArr = [];
      try {
        const { k, d } = calcStochastic(candles);
        kArr = k || [];
        dArr = d || [];
      } catch { /* skip */ }

      // Offset: berapa candle warmup di awal sebelum nilai pertama tersedia
      const ema9Off  = candles.length - ema9Arr.length;   // = 8 (EMA period-1)
      const ema13Off = candles.length - ema13Arr.length;  // = 12
      const stochOff = candles.length - kArr.length;      // = 6

      // Indeks candle pertama yang masuk rentang backtest
      const julyStart = candles.findIndex(c => c.openTime >= startMs);
      if (julyStart === -1) {
        summary.byTimeframe[tf] = { error: 'Tidak ada candle di rentang tanggal', total: 0 };
        continue;
      }

      let lastSignal  = null; // Dedup: jangan ulang sinyal yang sama berturut-turut
      const tfSignals = [];

      for (let i = julyStart; i < candles.length; i++) {
        const c = candles[i];

        // Indeks di dalam masing-masing array indikator
        const e9i  = i - ema9Off;
        const e13i = i - ema13Off;
        const ski  = i - stochOff;

        // Butuh setidaknya 1 nilai sebelumnya untuk crossover detection
        if (e9i < 1 || e13i < 1 || ski < 1) continue;

        const currEma9  = ema9Arr[e9i];
        const prevEma9  = ema9Arr[e9i - 1];
        const currEma13 = ema13Arr[e13i];
        const prevEma13 = ema13Arr[e13i - 1];
        const stochK    = kArr[ski];
        const prevStochK = kArr[ski - 1] ?? null;
        const stochD    = dArr[ski] ?? null;

        // Validasi semua nilai numerik
        if (!Number.isFinite(currEma9) || !Number.isFinite(prevEma9) ||
            !Number.isFinite(currEma13) || !Number.isFinite(prevEma13) ||
            !Number.isFinite(stochK)) continue;

        const position = detectSignal(prevEma9, prevEma13, currEma9, currEma13, stochK, prevStochK);

        // Skip jika tidak ada sinyal atau sinyal sama dengan sebelumnya
        if (!position || position === lastSignal) continue;
        lastSignal = position;

        /* Hitung ATR dan TP/SL */
        const window   = candles.slice(Math.max(0, i - 14), i + 1);
        const atr      = calcATR(window, 14);
        if (!atr) continue;

        const entry = c.close;
        const tpsl  = calcTPSL(position, entry, atr);
        if (!tpsl.tp1 || !tpsl.sl) continue;

        /* Order block dari 30 candle terakhir */
        const obWindow    = candles.slice(Math.max(0, i - 30), i + 1);
        const orderBlock  = detectOrderBlock(obWindow);

        /* Tentukan outcome dari candle-candle sesudah sinyal */
        const futureCandles = candles.slice(i + 1);
        const outcome = determineOutcome(position, tpsl.tp1, tpsl.sl, futureCandles);

        const signalTime = new Date(c.openTime).toISOString().replace('T', ' ').replace('Z', '');

        tfSignals.push({
          tf, position, outcome, signalTime,
          ema9:    parseFloat(currEma9.toFixed(2)),
          ema13:   parseFloat(currEma13.toFixed(2)),
          stoch_k: parseFloat(stochK.toFixed(2)),
          stoch_d: stochD != null ? parseFloat(stochD.toFixed(2)) : null,
          ob:      orderBlock,
          entry:   tpsl.entry,
          tp1:     tpsl.tp1,
          tp2:     tpsl.tp2,
          sl:      tpsl.sl,
        });
      }

      /* Insert ke database */
      let inserted = 0;
      for (const s of tfSignals) {
        try {
          insertStmt.run(
            s.tf, s.position, null,
            s.ema9, s.ema13, s.stoch_k, s.stoch_d,
            s.ob, s.entry, s.tp1, s.tp2, s.sl,
            s.outcome, s.signalTime
          );
          inserted++;
        } catch (e) {
          console.error('[Backtest] Insert error:', e.message);
        }
      }

      const wins    = tfSignals.filter(s => s.outcome === 'WIN').length;
      const losses  = tfSignals.filter(s => s.outcome === 'LOSS').length;
      const running = tfSignals.filter(s => !s.outcome).length;

      summary.byTimeframe[tf] = { total: tfSignals.length, inserted, wins, losses, running };
      summary.total    += tfSignals.length;
      summary.inserted += inserted;

      allSignals.push(...tfSignals.map(s => ({ ...s, source: 'backtest' })));

      console.log(`[Backtest] ${tf}: ${inserted} sinyal (W:${wins} L:${losses} R:${running})`);
    }

    // Hitung win rate keseluruhan
    const completed = allSignals.filter(s => s.outcome);
    const wins      = allSignals.filter(s => s.outcome === 'WIN').length;
    const winRate   = completed.length > 0
      ? Math.round((wins / completed.length) * 100)
      : 0;

    res.json({
      success:   true,
      message:   `Backtest selesai! ${summary.inserted} sinyal dari ${startDate} s/d ${endDate} berhasil dimasukkan.`,
      startDate, endDate,
      winRate,
      summary,
    });

  } catch (err) {
    console.error('[Backtest] Fatal error:', err);
    res.status(500).json({ error: 'Backtest gagal: ' + err.message });
  }
});

/* GET /api/backtest/status — cek apakah ada data backtest di DB */
router.get('/status', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN outcome = 'WIN'  THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN outcome = 'LOSS' THEN 1 ELSE 0 END) AS losses,
        SUM(CASE WHEN outcome IS NULL  THEN 1 ELSE 0 END) AS running,
        MIN(created_at) AS from_date,
        MAX(created_at) AS to_date
      FROM signals WHERE source = 'backtest'
    `).get();

    res.json({ hasBacktest: row.total > 0, ...row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
