const express = require('express');
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { testConnection } = require('../services/telegram');

const router = express.Router();

/**
 * GET /api/settings
 * Ambil pengaturan notifikasi (protected)
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    
    // Jangan expose chat_id lengkap, hanya beberapa digit terakhir
    const maskedSettings = {
      ...settings,
      telegram_chat_id: settings?.telegram_chat_id
        ? `***${settings.telegram_chat_id.slice(-4)}`
        : null,
      has_telegram_chat_id: !!(settings?.telegram_chat_id),
    };

    res.json({ settings: maskedSettings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Gagal mengambil pengaturan' });
  }
});

/**
 * PUT /api/settings
 * Update pengaturan notifikasi (protected)
 */
router.put('/', authenticateToken, (req, res) => {
  try {
    const { telegram_chat_id, telegram_enabled } = req.body;
    const db = getDb();

    const updates = [];
    const values = [];

    if (telegram_chat_id !== undefined) {
      updates.push('telegram_chat_id = ?');
      values.push(telegram_chat_id);
    }

    if (telegram_enabled !== undefined) {
      updates.push('telegram_enabled = ?');
      values.push(telegram_enabled ? 1 : 0);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    if (updates.length === 1) {
      return res.status(400).json({ error: 'Tidak ada data yang diupdate' });
    }

    db.prepare(`UPDATE settings SET ${updates.join(', ')} WHERE id = 1`).run(...values);

    const updated = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    res.json({ 
      message: 'Pengaturan berhasil diupdate',
      settings: {
        ...updated,
        telegram_chat_id: updated?.telegram_chat_id
          ? `***${updated.telegram_chat_id.slice(-4)}`
          : null,
        has_telegram_chat_id: !!(updated?.telegram_chat_id),
      }
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Gagal mengupdate pengaturan' });
  }
});

/**
 * POST /api/settings/test-telegram
 * Test koneksi Telegram (protected)
 */
router.post('/test-telegram', authenticateToken, async (req, res) => {
  try {
    const { chat_id } = req.body;
    const db = getDb();
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    const targetChatId = chat_id || settings?.telegram_chat_id;

    if (!targetChatId) {
      return res.status(400).json({ error: 'Chat ID Telegram belum dikonfigurasi' });
    }

    await testConnection(targetChatId);
    res.json({ success: true, message: 'Pesan test berhasil dikirim ke Telegram!' });
  } catch (error) {
    console.error('Test telegram error:', error);
    res.status(500).json({ error: `Gagal mengirim test: ${error.message}` });
  }
});

module.exports = router;
