const { getDb } = require('../db/database');

/**
 * Hitung success rate untuk tipe posisi dan timeframe tertentu
 */
function calculateSuccessRate(timeframe, positionType) {
  const db = getDb();
  const result = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN outcome = 'WIN' THEN 1 ELSE 0 END) as wins
    FROM signals
    WHERE timeframe = ? AND position_type = ? AND outcome IS NOT NULL
  `).get(timeframe, positionType);
  
  if (!result || result.total === 0) return null;
  
  return Math.round((result.wins / result.total) * 100);
}

/**
 * Simpan sinyal baru ke database
 */
function saveSignal(data) {
  const db = getDb();
  const { timeframe, position, ema9, ema13, stoch_k, stoch_d, order_block, entry_price, tp1, tp2, sl } = data;

  const successRate = calculateSuccessRate(timeframe, position);

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
 * Periksa sinyal yang belum memiliki outcome (WIN/LOSS).
 * Dibandingkan dengan harga terkini per timeframe.
 * - WIN  : harga mencapai TP1
 * - LOSS : harga mencapai SL
 * @param {Object} priceMap - { '15m': 64500, '1H': 64490, ... }
 * @param {Object} io - Socket.IO server instance (opsional)
 */
function checkOpenSignalOutcomes(priceMap, io = null) {
  const db = getDb();

  // Ambil semua sinyal yang belum ada outcome dan punya TP1 & SL
  const openSignals = db.prepare(`
    SELECT * FROM signals
    WHERE outcome IS NULL
      AND tp1 IS NOT NULL
      AND sl IS NOT NULL
  `).all();

  for (const sig of openSignals) {
    const currentPrice = priceMap[sig.timeframe];
    if (!currentPrice) continue;

    let outcome = null;

    if (sig.position_type === 'LONG') {
      if (currentPrice >= sig.tp1)  outcome = 'WIN';
      else if (currentPrice <= sig.sl) outcome = 'LOSS';
    } else if (sig.position_type === 'SHORT') {
      if (currentPrice <= sig.tp1)  outcome = 'WIN';
      else if (currentPrice >= sig.sl) outcome = 'LOSS';
    }

    if (outcome) {
      // Update outcome di database
      db.prepare('UPDATE signals SET outcome = ? WHERE id = ?').run(outcome, sig.id);
      console.log(`📊 Outcome: Sinyal #${sig.id} [${sig.timeframe}] ${sig.position_type} → ${outcome} (price: ${currentPrice})`);

      // Update success_rate semua sinyal dengan timeframe+position_type yang sama
      const rate = calculateSuccessRate(sig.timeframe, sig.position_type);
      if (rate !== null) {
        db.prepare(`
          UPDATE signals SET success_rate = ?
          WHERE timeframe = ? AND position_type = ?
        `).run(rate, sig.timeframe, sig.position_type);
      }

      // Emit ke frontend agar SignalPanel bisa update real-time
      const updatedSignal = db.prepare('SELECT * FROM signals WHERE id = ?').get(sig.id);
      if (io) {
        io.emit('signal_outcome', {
          signal: updatedSignal,
          outcome,
          currentPrice,
          success_rate: rate,
        });
      }
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
  checkOpenSignalOutcomes,
};

