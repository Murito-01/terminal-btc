const express = require('express');
const { getAllSignals, getLatestSignals, getLatestSignal, calculateSuccessRate } = require('../services/signalService');
const { authenticateToken } = require('../middleware/auth');
const { getDb } = require('../db/database');

const router = express.Router();

/**
 * GET /api/signals
 * Ambil semua sinyal dengan pagination (protected)
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const result = getAllSignals(page, limit);
    res.json(result);
  } catch (error) {
    console.error('Get signals error:', error);
    res.status(500).json({ error: 'Gagal mengambil data sinyal' });
  }
});

/**
 * GET /api/signals/stats
 * Statistik keseluruhan: total WIN, LOSS, win rate, dan breakdown bulan ini
 */
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const db = getDb();

    // Overall stats
    const overall = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN outcome = 'WIN'  THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome = 'LOSS' THEN 1 ELSE 0 END) as losses,
        SUM(CASE WHEN outcome IS NULL  THEN 1 ELSE 0 END) as running
      FROM signals WHERE outcome IS NOT NULL OR outcome IS NULL
    `).get();

    const completed = (overall.wins || 0) + (overall.losses || 0);
    const winRate   = completed > 0
      ? Math.round((overall.wins / completed) * 100)
      : null;

    // Stats bulan ini saja
    const thisMonth = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN outcome = 'WIN'  THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome = 'LOSS' THEN 1 ELSE 0 END) as losses
      FROM signals
      WHERE outcome IS NOT NULL
        AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
    `).get();

    res.json({
      total:     overall.total   || 0,
      wins:      overall.wins    || 0,
      losses:    overall.losses  || 0,
      running:   overall.running || 0,
      win_rate:  winRate,
      this_month: {
        wins:   thisMonth.wins   || 0,
        losses: thisMonth.losses || 0,
        total:  thisMonth.total  || 0,
      },
    });
  } catch (error) {
    console.error('Get signal stats error:', error);
    res.status(500).json({ error: 'Gagal mengambil statistik sinyal' });
  }
});

/**
 * GET /api/signals/latest
 * Ambil sinyal terbaru per timeframe (protected)
 */
router.get('/latest', authenticateToken, (req, res) => {
  try {
    const latest = getLatestSignals();
    res.json(latest);
  } catch (error) {
    console.error('Get latest signals error:', error);
    res.status(500).json({ error: 'Gagal mengambil sinyal terbaru' });
  }
});

/**
 * GET /api/signals/current
 * Ambil sinyal terbaru (1 sinyal, semua timeframe) (protected)
 */
router.get('/current', authenticateToken, (req, res) => {
  try {
    const signal = getLatestSignal();
    res.json({ signal: signal || null });
  } catch (error) {
    console.error('Get current signal error:', error);
    res.status(500).json({ error: 'Gagal mengambil sinyal saat ini' });
  }
});

module.exports = router;
