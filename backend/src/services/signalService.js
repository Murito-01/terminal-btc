const { getDb } = require('../db/database');

/**
 * Hitung success rate keseluruhan (lintas semua timeframe & posisi)
 * agar mencerminkan performa strategi secara global.
 */
function calculateSuccessRate() {
  const db = getDb();
  const result = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN outcome = 'WIN' THEN 1 ELSE 0 END) as wins
    FROM signals
    WHERE outcome IS NOT NULL
  `).get();
  
  if (!result || result.total === 0) return null;
  
  return Math.round((result.wins / result.total) * 100);
}

/**
 * Update kolom success_rate di SEMUA sinyal dengan nilai terkini.
 * Dipanggil setelah backtest atau setelah outcome sinyal diperbarui.
 */
function refreshAllSuccessRates() {
  const db = getDb();
  const rate = calculateSuccessRate();
  if (rate !== null) {
    db.prepare('UPDATE signals SET success_rate = ?').run(rate);
    console.log(`🔄 Success rate diperbarui: ${rate}% (semua sinyal)`);
  }
  return rate;
}

/**
 * Simpan sinyal baru ke database
 */
function saveSignal(data) {
  const db = getDb();
  const { timeframe, position, ema9, ema13, stoch_k, stoch_d, order_block, entry_price, tp1, tp2, sl } = data;

  const successRate = calculateSuccessRate(); // global win rate

  const stmt = db.prepare(`
    INSERT INTO signals (timeframe, position_type, success_rate, ema9, ema13, stoch_k, stoch_d, order_block_zone, entry_price, tp1, tp2, sl)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    timeframe,
    position,
    successRate,
    ema9        !== undefined ? ema9        : null,
    ema13       !== undefined ? ema13       : null,
    stoch_k     !== undefined ? stoch_k     : null,
    stoch_d     !== undefined ? stoch_d     : null,
    order_block || null,
    entry_price !== undefined ? entry_price : null,
    tp1         !== undefined ? tp1         : null,
    tp2         !== undefined ? tp2         : null,
    sl          !== undefined ? sl          : null,
  );

  return db.prepare('SELECT * FROM signals WHERE id = ?').get(result.lastInsertRowid);
}

/**
 * Periksa sinyal yang belum memiliki outcome (WIN/LOSS) menggunakan data
 * historis OHLCV dari Binance.
 *
 * Pendekatan yang benar:
 *   - Ambil semua candle sejak sinyal dibuat hingga sekarang
 *   - Iterasi candle satu per satu, cek HIGH/LOW
 *   - Mana yang tersentuh lebih dulu (TP atau SL) = outcome
 *
 * Catatan: fungsi ini ASYNC karena mengambil data dari Binance API.
 *
 * @param {Object} io - Socket.IO instance (opsional)
 */
async function checkOpenSignalOutcomes(io = null) {
  const { getKlinesRange } = require('./binanceService');
  const db = getDb();

  // Ambil semua sinyal yang belum ada outcome dan punya TP1 & SL
  const openSignals = db.prepare(`
    SELECT * FROM signals
    WHERE outcome IS NULL
      AND tp1 IS NOT NULL
      AND sl  IS NOT NULL
  `).all();

  if (openSignals.length === 0) return;

  const TF_MAP = { '15m': '15m', '1H': '1h', '4H': '4h', '1D': '1d' };

  for (const sig of openSignals) {
    try {
      const interval   = TF_MAP[sig.timeframe] || '1h';
      // Waktu mulai: saat candle sinyal DITUTUP (gunakan created_at sebagai titik awal)
      const startMs    = new Date(sig.created_at).getTime();
      const nowMs      = Date.now();

      // Ambil candle dari waktu sinyal dibuat sampai sekarang
      const candles = await getKlinesRange('BTCUSDT', interval, startMs, nowMs);
      if (!candles || candles.length === 0) continue;

      let outcome = null;

      for (const c of candles) {
        if (sig.position_type === 'LONG') {
          const hitTP = c.high >= sig.tp1;
          const hitSL = c.low  <= sig.sl;
          if (hitTP && !hitSL) { outcome = 'WIN';  break; }
          if (hitSL && !hitTP) { outcome = 'LOSS'; break; }
          if (hitTP && hitSL)  { outcome = c.close >= c.open ? 'WIN' : 'LOSS'; break; }
        } else if (sig.position_type === 'SHORT') {
          const hitTP = c.low  <= sig.tp1;
          const hitSL = c.high >= sig.sl;
          if (hitTP && !hitSL) { outcome = 'WIN';  break; }
          if (hitSL && !hitTP) { outcome = 'LOSS'; break; }
          if (hitTP && hitSL)  { outcome = c.close <= c.open ? 'WIN' : 'LOSS'; break; }
        }
      }

      if (outcome) {
        db.prepare('UPDATE signals SET outcome = ? WHERE id = ?').run(outcome, sig.id);
        console.log(`📊 Outcome: Sinyal #${sig.id} [${sig.timeframe}] ${sig.position_type} → ${outcome}`);

        // Refresh success_rate global untuk semua sinyal
        refreshAllSuccessRates();

        // Emit ke frontend
        const updatedSignal = db.prepare('SELECT * FROM signals WHERE id = ?').get(sig.id);
        if (io) {
          io.emit('signal_outcome', {
            signal:       updatedSignal,
            outcome,
            success_rate: calculateSuccessRate(),
          });
        }
      }
    } catch (err) {
      console.error(`[checkOutcome] Error sinyal #${sig.id}:`, err.message);
    }
  }
}


/**
 * Ambil semua sinyal dengan pagination
 */
function getAllSignals(page = 1, limit = 50) {
  const db = getDb();
  const offset = (page - 1) * limit;
  
  const signals = db.prepare(`
    SELECT * FROM signals ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(limit, offset);

  const totalRow = db.prepare('SELECT COUNT(*) as count FROM signals').get();

  return { signals, total: totalRow.count, page, limit };
}

/**
 * Ambil sinyal terbaru per timeframe
 */
function getLatestSignals() {
  const db = getDb();
  const timeframes = ['15m', '1H', '4H', '1D'];
  const latest = {};

  for (const tf of timeframes) {
    const signal = db.prepare(`
      SELECT * FROM signals WHERE timeframe = ? ORDER BY created_at DESC LIMIT 1
    `).get(tf);
    latest[tf] = signal || null;
  }

  return latest;
}

/**
 * Ambil sinyal terbaru secara keseluruhan
 */
function getLatestSignal() {
  const db = getDb();
  return db.prepare('SELECT * FROM signals ORDER BY created_at DESC LIMIT 1').get();
}

/**
 * Log webhook masuk
 */
function logWebhook(payload, status, errorMessage = null) {
  const db = getDb();
  db.prepare(`
    INSERT INTO webhook_logs (raw_payload, status, error_message)
    VALUES (?, ?, ?)
  `).run(JSON.stringify(payload), status, errorMessage);
}

module.exports = {
  saveSignal,
  getAllSignals,
  getLatestSignals,
  getLatestSignal,
  logWebhook,
  calculateSuccessRate,
  refreshAllSuccessRates,
  checkOpenSignalOutcomes,
};

