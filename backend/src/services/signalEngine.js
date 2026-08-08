const { getKlines } = require('./binanceService');
const { analyzeCandles, calcTPSL } = require('./indicatorService');
const { saveSignal, checkOpenSignalOutcomes } = require('./signalService');

// Timeframe yang dianalisa secara otomatis
const TIMEFRAMES = ['15m', '1H', '4H', '1D'];

// Simpan posisi terakhir per timeframe (in-memory cache)
// Di-inisialisasi dari database saat startup untuk tahan restart
const lastSignalPosition = {};

// Durasi minimum (ms) sebelum sinyal yang sama di TF yang sama boleh dibuat ulang
// Ini mencegah duplikasi dalam satu jendela candle yang sama
const TF_COOLDOWN_MS = {
  '15m': 14 * 60 * 1000,       // 14 menit  (1 candle 15m = 15 menit)
  '1H':  59 * 60 * 1000,       // 59 menit
  '4H': 239 * 60 * 1000,       // 239 menit
  '1D': 23 * 60 * 60 * 1000,   // 23 jam
};

// State terkini semua timeframe untuk dikirim ke frontend
const currentState = {};

// Waktu update berikutnya
let nextUpdateAt = null;

/**
 * Inisialisasi lastSignalPosition dari database saat startup.
 * Ini mencegah duplikasi sinyal ketika server di-restart.
 */
function initLastSignalPositionFromDb() {
  try {
    const { getDb } = require('../db/database');
    const db = getDb();
    for (const tf of TIMEFRAMES) {
      const latest = db.prepare(`
        SELECT position_type, created_at FROM signals
        WHERE timeframe = ? AND source != 'backtest'
        ORDER BY created_at DESC LIMIT 1
      `).get(tf);
      if (latest) {
        lastSignalPosition[tf] = {
          position: latest.position_type,
          savedAt:  new Date(latest.created_at).getTime(),
        };
        console.log(`🔄 Init [${tf}]: last signal = ${latest.position_type} at ${latest.created_at}`);
      }
    }
  } catch (e) {
    console.error('[initLastSignal] Error:', e.message);
  }
}

/**
 * Deteksi sinyal dari data indikator yang sudah dihitung
 * - LONG  : EMA9 crossover EMA13 (dari bawah ke atas) + Stoch K naik
 * - SHORT : EMA9 crossunder EMA13 (dari atas ke bawah) + Stoch K turun
 * - null  : tidak ada crossing atau momentum berlawanan
 */
function detectSignal(indicators) {
  const { ema9, ema13, prevEma9, prevEma13, stoch_k, prevStochK } = indicators;

  const prevBullish = prevEma9 <= prevEma13;
  const currBullish = ema9 > ema13;
  const prevBearish = prevEma9 >= prevEma13;
  const currBearish = ema9 < ema13;

  // Konfirmasi momentum: K naik = bullish momentum, K turun = bearish momentum
  const momentumBullish = prevStochK != null ? stoch_k >= prevStochK : true;
  const momentumBearish = prevStochK != null ? stoch_k <= prevStochK : true;

  if (prevBullish && currBullish && momentumBullish) return 'LONG';
  if (prevBearish && currBearish && momentumBearish) return 'SHORT';
  return null;
}

/**
 * Periksa apakah sinyal ini duplikat.
 * Duplikat = posisi sama DAN belum melewati cooldown period timeframe-nya.
 * 
 * Ini menangani dua kasus:
 * 1. Server restart → state di-load dari DB, cooldown masih berlaku
 * 2. Engine berjalan saat kondisi masih sama di beberapa interval berturut-turut
 */
function isDuplicateSignal(timeframe, position) {
  const last = lastSignalPosition[timeframe];
  if (!last) return false;                    // Belum ada sinyal → bukan duplikat
  if (last.position !== position) return false; // Posisi berbeda → bukan duplikat

  const cooldown = TF_COOLDOWN_MS[timeframe] || 14 * 60 * 1000;
  const elapsed  = Date.now() - last.savedAt;
  if (elapsed < cooldown) {
    console.log(`⏳ [${timeframe}] Duplikat diblokir: ${position} baru ${Math.round(elapsed / 1000)}s lalu (cooldown ${Math.round(cooldown / 1000)}s)`);
    return true;
  }
  return false;
}

/**
 * Jalankan analisa untuk satu timeframe
 */
async function runAnalysisForTimeframe(timeframe, io) {
  try {
    const candles    = await getKlines('BTCUSDT', timeframe, 100);
    const indicators = analyzeCandles(candles);
    const position   = detectSignal(indicators);
    const displayPosition = position || 'WAIT';

    // TP/SL preview (juga untuk WAIT state agar frontend bisa menampilkan level)
    const tpsl = calcTPSL(
      displayPosition === 'WAIT'
        ? (indicators.ema9 > indicators.ema13 ? 'LONG' : 'SHORT')
        : displayPosition,
      indicators.currentPrice,
      indicators.atr
    );

    process.stdout.write(
      `[${timeframe}] Price: ${indicators.currentPrice} | EMA9: ${indicators.ema9} | EMA13: ${indicators.ema13} | StochK: ${indicators.stoch_k} | Signal: ${displayPosition}\n`
    );

    // Update state untuk Socket.IO
    currentState[timeframe] = {
      timeframe,
      position:     displayPosition,
      currentPrice: indicators.currentPrice,
      ema9:         indicators.ema9,
      ema13:        indicators.ema13,
      stoch_k:      indicators.stoch_k,
      stoch_d:      indicators.stoch_d,
      order_block:  indicators.orderBlock,
      atr:          indicators.atr ? parseFloat(indicators.atr.toFixed(2)) : null,
      entry_price:  tpsl.entry || indicators.currentPrice,
      tp1:          tpsl.tp1,
      tp2:          tpsl.tp2,
      sl:           tpsl.sl,
      updated_at:   new Date().toISOString(),
    };

    if (io) {
      io.emit('state_update', { ...currentState, _meta: { next_update_at: nextUpdateAt } });
    }

    // Simpan ke DB hanya jika ada sinyal baru DAN bukan duplikat
    if (position && !isDuplicateSignal(timeframe, position)) {
      // Tandai sebagai "sudah disimpan" SEBELUM INSERT untuk cegah race condition
      lastSignalPosition[timeframe] = {
        position,
        savedAt: Date.now(),
      };

      const signalData = {
        timeframe,
        position,
        ema9:        indicators.ema9,
        ema13:       indicators.ema13,
        stoch_k:     indicators.stoch_k,
        stoch_d:     indicators.stoch_d,
        order_block: indicators.orderBlock,
        entry_price: tpsl.entry,
        tp1:         tpsl.tp1,
        tp2:         tpsl.tp2,
        sl:          tpsl.sl,
      };

      const saved = saveSignal(signalData);

      if (io) {
        io.emit('new_signal', saved);
        console.log(`📡 Sinyal ${position} [${timeframe}]! Entry: ${tpsl.entry} | TP1: ${tpsl.tp1} | SL: ${tpsl.sl}`);
      }

      // Notifikasi Telegram (opsional)
      try {
        const { sendSignalNotification } = require('./telegram');
        const { getDb } = require('../db/database');
        const db = getDb();
        const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
        if (settings?.telegram_enabled === 1 && settings?.telegram_chat_id) {
          await sendSignalNotification(saved, settings.telegram_chat_id);
        }
      } catch (telegramErr) {
        console.error('❌ Gagal kirim notifikasi Telegram:', telegramErr.message);
      }
    }
  } catch (err) {
    console.error(`❌ Error analisa [${timeframe}]:`, err.message);
  }
}

/**
 * Jalankan analisa untuk semua timeframe
 */
async function runAllAnalysis(io) {
  console.log(`\n🔍 [${new Date().toLocaleTimeString('id-ID')}] Menjalankan analisa indikator...`);

  for (const tf of TIMEFRAMES) {
    await runAnalysisForTimeframe(tf, io);
  }

  // Periksa outcome sinyal yang masih terbuka
  await checkOpenSignalOutcomes(io);
}

/**
 * Hitung milidetik hingga menit quarter berikutnya (:00, :15, :30, :45)
 */
function msUntilNextQuarter() {
  const now = new Date();
  const currentMinute = now.getMinutes();
  const currentSecond = now.getSeconds();
  const currentMs     = now.getMilliseconds();

  const nextQuarterMinute = Math.ceil((currentMinute + 1) / 15) * 15 % 60;

  let diffMinutes = nextQuarterMinute - currentMinute;
  if (diffMinutes <= 0) diffMinutes += 60;

  return diffMinutes * 60 * 1000 - currentSecond * 1000 - currentMs;
}

/**
 * Mulai signal engine — berjalan otomatis di menit :00, :15, :30, :45 setiap jam
 * @param {Server} io - Socket.IO server instance
 */
function startSignalEngine(io) {
  const waitMs = msUntilNextQuarter();
  nextUpdateAt = new Date(Date.now() + waitMs).toISOString();

  // Load state terakhir dari DB agar restart tidak menghasilkan duplikat
  initLastSignalPositionFromDb();

  console.log(`🚀 Signal Engine dimulai! Analisa berikutnya pada menit :${String(new Date(Date.now() + waitMs).getMinutes()).padStart(2, '0')} (dalam ${Math.round(waitMs / 1000)} detik)`);

  // Jalankan sekali saat startup untuk refresh state frontend
  runAllAnalysis(io);

  // Penjadwal rekursif ke quarter berikutnya
  function scheduleNext() {
    const delay = msUntilNextQuarter();
    nextUpdateAt = new Date(Date.now() + delay).toISOString();
    setTimeout(() => {
      runAllAnalysis(io);
      scheduleNext();
    }, delay);
  }

  scheduleNext();
}

module.exports = { startSignalEngine, runAllAnalysis, detectSignal, currentState };
