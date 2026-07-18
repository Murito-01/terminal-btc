const express = require('express');
const { getAllSignals, getLatestSignals, getLatestSignal } = require('../services/signalService');
const { authenticateToken } = require('../middleware/auth');

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
