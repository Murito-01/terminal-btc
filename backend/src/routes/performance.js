const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getDb } = require('../db/database');

const router = express.Router();

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Hitung P&L % dari satu sinyal yang sudah selesai
 * LONG  WIN : (tp1 - entry) / entry * 100
 * LONG  LOSS: (sl  - entry) / entry * 100  ← negatif
 * SHORT WIN : (entry - tp1) / entry * 100
 * SHORT LOSS: (entry - sl ) / entry * 100  ← negatif
 */
function calcPnlPct(signal) {
  const { position_type, outcome, entry_price, tp1, sl } = signal;
  if (!entry_price || entry_price === 0) return 0;
  if (outcome !== 'WIN' && outcome !== 'LOSS') return null; // sinyal masih RUNNING

  if (position_type === 'LONG') {
    if (outcome === 'WIN')  return ((tp1  - entry_price) / entry_price) * 100;
    if (outcome === 'LOSS') return ((sl   - entry_price) / entry_price) * 100; // negatif
  }
  if (position_type === 'SHORT') {
    if (outcome === 'WIN')  return ((entry_price - tp1)  / entry_price) * 100;
    if (outcome === 'LOSS') return ((entry_price - sl)   / entry_price) * 100; // negatif
  }
  return 0;
}

/**
 * GET /api/performance/monthly
 * Kembalikan data performance per bulan/tahun berdasarkan sinyal yang sudah selesai
 *
 * Response:
 * {
 *   years: [2024, 2025, ...],
 *   data: {
 *     "2025": { "1": 12.34, "7": -5.6, ... },   // bulan → net P&L %
 *     ...
 *   },
 *   monthly_avg: { "1": 5.2, ... },
 *   monthly_probability: { "1": 67, ... }  // % bulan positif
 * }
 */
router.get('/monthly', authenticateToken, (req, res) => {
  try {
    const db = getDb();

    // Ambil semua sinyal yang sudah selesai (WIN atau LOSS)
    const signals = db.prepare(`
      SELECT id, position_type, outcome, entry_price, tp1, sl, created_at
      FROM signals
      WHERE outcome IN ('WIN', 'LOSS')
        AND entry_price IS NOT NULL
        AND tp1 IS NOT NULL
        AND sl IS NOT NULL
      ORDER BY created_at ASC
    `).all();

    // Kelompokkan P&L per tahun-bulan
    // data[year][month_1indexed] = sum of pnl for that month
    const data = {};          // { year: { month: { sum, count } } }
    const monthCountPerYear = {}; // { year: Set of months }

    for (const sig of signals) {
      const pnl = calcPnlPct(sig);
      if (pnl === null) continue;

      const d = new Date(sig.created_at);
      const year  = d.getFullYear();
      const month = d.getMonth() + 1; // 1–12

      if (!data[year]) data[year] = {};
      if (!data[year][month]) data[year][month] = { sum: 0, count: 0 };

      data[year][month].sum   += pnl;
      data[year][month].count += 1;

      if (!monthCountPerYear[year]) monthCountPerYear[year] = new Set();
      monthCountPerYear[year].add(month);
    }

    // Konversi ke net P&L per bulan (sum, bukan rata-rata) dan hitung yearly total
    const years = Object.keys(data).map(Number).sort((a, b) => b - a); // descending
    const monthly = {};

    for (const year of years) {
      monthly[year] = {};
      let yearTotal = 0;
      for (let m = 1; m <= 12; m++) {
        if (data[year][m]) {
          const pnl = parseFloat(data[year][m].sum.toFixed(2));
          monthly[year][m] = pnl;
          yearTotal += pnl;
        }
      }
      monthly[year]['year'] = parseFloat(yearTotal.toFixed(2));
    }

    // Average row: rata-rata P&L per bulan lintas semua tahun
    const monthlyAvg = {};
    const monthlyProb = {}; // probabilitas bulan positif (%)

    for (let m = 1; m <= 12; m++) {
      const values = years
        .filter(y => monthly[y][m] !== undefined)
        .map(y => monthly[y][m]);

      if (values.length === 0) {
        monthlyAvg[m] = null;
        monthlyProb[m] = null;
      } else {
        monthlyAvg[m] = parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
        const positiveCount = values.filter(v => v > 0).length;
        monthlyProb[m] = Math.round((positiveCount / values.length) * 100);
      }
    }

    // Year average (lintas semua monthly avg yang ada)
    const avgValues = Object.values(monthlyAvg).filter(v => v !== null);
    const avgYearTotal = avgValues.length > 0
      ? parseFloat(avgValues.reduce((a, b) => a + b, 0).toFixed(2))
      : null;

    // Probability year (rata-rata semua probability bulanan)
    const probValues = Object.values(monthlyProb).filter(v => v !== null);
    const probYearAvg = probValues.length > 0
      ? Math.round(probValues.reduce((a, b) => a + b, 0) / probValues.length)
      : null;

    res.json({
      years,
      data:                monthly,
      monthly_avg:         { ...monthlyAvg, year: avgYearTotal },
      monthly_probability: { ...monthlyProb, year: probYearAvg },
      total_signals:       signals.length,
      updated_at:          new Date().toISOString(),
    });
  } catch (err) {
    console.error('Performance monthly error:', err.message);
    res.status(500).json({ error: 'Gagal mengambil data performance: ' + err.message });
  }
});

module.exports = router;
