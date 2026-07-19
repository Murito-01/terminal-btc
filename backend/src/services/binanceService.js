const axios = require('axios');
const https = require('https');

// Daftar endpoint Binance — fallback jika satu diblokir ISP Indonesia
// data-api.binance.vision adalah mirror resmi Binance yang tidak diblokir Telkomsel
const BINANCE_ENDPOINTS = [
  'https://data-api.binance.vision',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
  'https://api.binance.com',
];

// HTTPS agent yang menonaktifkan pengecekan sertifikat (untuk mengatasi MITM ISP)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Mapping timeframe UI → format interval Binance API
const TF_MAP = {
  '15m': '15m',
  '30m': '30m',
  '1H':  '1h',
  '4H':  '4h',
  '1D':  '1d',
};

/**
 * Ambil data OHLCV dari Binance API (limit: 100 candle terakhir)
 * Mencoba beberapa endpoint sebagai fallback jika diblokir ISP
 * @param {string} symbol - contoh 'BTCUSDT'
 * @param {string} timeframe - '15m' | '1H' | '4H' | '1D'
 * @returns {Array} array of { open, high, low, close, volume }
 */
async function getKlines(symbol = 'BTCUSDT', timeframe = '1H', limit = 100) {
  const interval = TF_MAP[timeframe] || timeframe.toLowerCase();
  let lastError = null;

  for (const base of BINANCE_ENDPOINTS) {
    try {
      const response = await axios.get(`${base}/api/v3/klines`, {
        params: { symbol, interval, limit },
        timeout: 10000,
        httpsAgent, // Bypass SSL MITM dari ISP
      });

      // Binance returns: [openTime, open, high, low, close, volume, ...]
      return response.data.map(k => ({
        openTime: k[0],
        open:     parseFloat(k[1]),
        high:     parseFloat(k[2]),
        low:      parseFloat(k[3]),
        close:    parseFloat(k[4]),
        volume:   parseFloat(k[5]),
      }));
    } catch (err) {
      lastError = err;
      // Lanjut ke endpoint berikutnya
    }
  }

  throw new Error(`Semua endpoint Binance gagal: ${lastError?.message}`);
}

module.exports = { getKlines, TF_MAP };
