const express = require('express');
const { saveSignal, logWebhook } = require('../services/signalService');
const { sendSignalNotification } = require('../services/telegram');

const router = express.Router();

/**
 * POST /api/webhook
 * Endpoint untuk menerima alert dari TradingView Pine Script
 * 
 * Payload yang diharapkan (dari TradingView):
 * {
 *   "secret": "YOUR_WEBHOOK_SECRET",
 *   "timeframe": "1H",
 *   "position": "LONG",
 *   "ema9": 65420.5,
 *   "ema13": 65380.2,
 *   "stoch_k": 78.3,
 *   "stoch_d": 72.1,
 *   "order_block": "65000-65500"
 * }
 */
router.post('/', async (req, res) => {
  const payload = req.body;

  // Validasi secret token
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (webhookSecret && payload.secret !== webhookSecret) {
    logWebhook(payload, 'invalid_secret');
    return res.status(401).json({ error: 'Unauthorized: Invalid secret token' });
  }

  // Validasi field wajib
  const validPositions = ['LONG', 'SHORT', 'WAIT'];
  const validTimeframes = ['15m', '30m', '1H', '4H', '1D', '1W'];

  if (!payload.position || !validPositions.includes(payload.position.toUpperCase())) {
    logWebhook(payload, 'error', 'Invalid or missing position');
    return res.status(400).json({ error: 'Field "position" wajib diisi: LONG, SHORT, atau WAIT' });
  }

  if (!payload.timeframe) {
    logWebhook(payload, 'error', 'Missing timeframe');
    return res.status(400).json({ error: 'Field "timeframe" wajib diisi' });
  }

  try {
    // Normalisasi data
    const signalData = {
      timeframe: payload.timeframe,
      position: payload.position.toUpperCase(),
      ema9: payload.ema9 || null,
      ema13: payload.ema13 || null,
      stoch_k: payload.stoch_k || null,
      stoch_d: payload.stoch_d || null,
      order_block: payload.order_block || null,
    };

    // Simpan sinyal
    const signal = saveSignal(signalData);

    // Log webhook berhasil
    logWebhook(payload, 'success');

    // Emit ke semua client via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('new_signal', signal);
      console.log('📡 Sinyal di-broadcast ke semua client WebSocket');
    }

    // Kirim notifikasi Telegram (async, tidak blocking response)
    sendSignalNotification(signal).catch(err => {
      console.error('Telegram notification error:', err.message);
    });

    console.log(`✅ Webhook diterima: ${signal.position_type} @ ${signal.timeframe}`);
    res.json({ success: true, signal });

  } catch (error) {
    console.error('Webhook processing error:', error);
    logWebhook(payload, 'error', error.message);
    res.status(500).json({ error: 'Gagal memproses webhook' });
  }
});

module.exports = router;
