const TelegramBot = require('node-telegram-bot-api');

let bot = null;

function getBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token.trim() === '') {
    return null;
  }
  if (!bot) {
    bot = new TelegramBot(token, { polling: false });
  }
  return bot;
}

/**
 * Format pesan sinyal untuk Telegram
 */
function formatSignalMessage(signal) {
  const positionEmoji = {
    LONG: '🟢 LONG',
    SHORT: '🔴 SHORT',
    WAIT: '🟡 WAIT AND SEE',
  };

  const emoji = positionEmoji[signal.position_type] || signal.position_type;
  const successRate = signal.success_rate !== null ? `${signal.success_rate}%` : '--';
  const time = new Date(signal.created_at).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let message = `🔔 *SINYAL BARU — Terminal BTC*\n\n`;
  message += `📍 Posisi: *${emoji}*\n`;
  message += `⏱ Timeframe: *${signal.timeframe}*\n`;
  message += `✅ Tingkat Keberhasilan: *${successRate}*\n\n`;

  if (signal.ema9 || signal.ema13) {
    message += `📊 *Indikator:*\n`;
    if (signal.ema9) message += `• EMA 9: \`${Number(signal.ema9).toFixed(2)}\`\n`;
    if (signal.ema13) message += `• EMA 13: \`${Number(signal.ema13).toFixed(2)}\`\n`;
    if (signal.stoch_k) message += `• Stochastic K: \`${Number(signal.stoch_k).toFixed(2)}\`\n`;
    if (signal.stoch_d) message += `• Stochastic D: \`${Number(signal.stoch_d).toFixed(2)}\`\n`;
    if (signal.order_block_zone) message += `• Order Block: \`${signal.order_block_zone}\`\n`;
    message += `\n`;
  }

  message += `🕐 Waktu: ${time} WIB\n`;
  message += `\n_Terminal BTC — Personal Trading Monitor_`;

  return message;
}

/**
 * Kirim notifikasi sinyal ke Telegram
 */
async function sendSignalNotification(signal) {
  const telegramBot = getBot();
  if (!telegramBot) {
    console.warn('⚠️ Telegram bot token tidak dikonfigurasi, notifikasi dilewati.');
    return { success: false, reason: 'Bot not configured' };
  }

  // Ambil chat ID dari settings atau env
  const { getDb } = require('../db/database');
  const db = getDb();
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  
  const chatId = settings?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;
  const isEnabled = settings?.telegram_enabled === 1;

  if (!chatId || chatId.trim() === '') {
    console.warn('⚠️ Telegram Chat ID belum dikonfigurasi.');
    return { success: false, reason: 'Chat ID not configured' };
  }

  if (!isEnabled) {
    console.info('ℹ️ Notifikasi Telegram dinonaktifkan.');
    return { success: false, reason: 'Notifications disabled' };
  }

  // Hanya kirim notifikasi untuk sinyal LONG atau SHORT (bukan WAIT)
  if (signal.position_type === 'WAIT') {
    return { success: false, reason: 'WAIT signal, no notification sent' };
  }

  try {
    const message = formatSignalMessage(signal);
    await telegramBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    console.log(`✅ Notifikasi Telegram dikirim ke Chat ID: ${chatId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Gagal mengirim notifikasi Telegram:', error.message);
    return { success: false, reason: error.message };
  }
}

/**
 * Test koneksi bot Telegram
 */
async function testConnection(chatId) {
  const telegramBot = getBot();
  if (!telegramBot) {
    throw new Error('Bot token belum dikonfigurasi di .env');
  }
  
  await telegramBot.sendMessage(
    chatId,
    '✅ *Terminal BTC — Koneksi Berhasil!*\n\nNotifikasi Telegram sudah aktif.',
    { parse_mode: 'Markdown' }
  );
  return true;
}

module.exports = { sendSignalNotification, testConnection };
