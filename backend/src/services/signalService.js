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
  const { timeframe, position, ema9, ema13, stoch_k, stoch_d, order_block } = data;

  const successRate = calculateSuccessRate(timeframe, position);

  const stmt = db.prepare(`
    INSERT INTO signals (timeframe, position_type, success_rate, ema9, ema13, stoch_k, stoch_d, order_block_zone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    timeframe,
    position,
    successRate,
    ema9 !== undefined ? ema9 : null,
    ema13 !== undefined ? ema13 : null,
    stoch_k !== undefined ? stoch_k : null,
    stoch_d !== undefined ? stoch_d : null,
    order_block || null
  );

  return db.prepare('SELECT * FROM signals WHERE id = ?').get(result.lastInsertRowid);
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
};
