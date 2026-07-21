const { getKlines } = require('./binanceService');
const { analyzeCandles, calcTPSL } = require('./indicatorService');
const { saveSignal, checkOpenSignalOutcomes } = require('./signalService');

// Timeframe yang dianalisa secara otomatis
const TIMEFRAMES = ['15m', '1H', '4H', '1D'];

// Simpan posisi terakhir per timeframe agar tidak duplikat sinyal yang sama
const lastSignalPosition = {};

// State terkini semua timeframe untuk dikirim ke frontend
const currentState = {};

// Waktu update berikutnya (diisi saat engine dimulai)
let nextUpdateAt = null;

/**
 * Deteksi sinyal dari data indikator yang sudah dihitung
 * Logika:
 * - LONG  : EMA9 crossover EMA13 (dari bawah ke atas) + Stoch K < 40
 * - SHORT : EMA9 crossunder EMA13 (dari atas ke bawah) + Stoch K > 60
 * - WAIT  : tidak ada crossing
 */
function detectSignal(indicators) {
  const { ema9, ema13, prevEma9, prevEma13, stoch_k } = indicators;

  const prevBullish = prevEma9 <= prevEma13;
  const currBullish = ema9 > ema13;
  const prevBearish = prevEma9 >= prevEma13;
  const currBearish = ema9 < ema13;

  if (prevBullish && currBullish && stoch_k < 40) {
    return 'LONG';
  }

  if (prevBearish && currBearish && stoch_k > 60) {
    return 'SHORT';
  }

  return null; // Tidak ada sinyal baru
}

/**
 * Jalankan analisa untuk satu timeframe
 */
async function runAnalysisForTimeframe(timeframe, io) {
  try {
    const candles = await getKlines('BTCUSDT', timeframe, 100);
    const indicators = analyzeCandles(candles);
    const position = detectSignal(indicators);
    const displayPosition = position || 'WAIT';

    // Hitung TP/SL berdasarkan posisi EMA saat ini (untuk preview saat WAIT)
    // atau posisi sinyal aktif (LONG/SHORT)
    const tpsl = calcTPSL(
      displayPosition === 'WAIT'
        ? (indicators.ema9 > indicators.ema13 ? 'LONG' : 'SHORT')
        : displayPosition,
      indicators.currentPrice,
      indicators.atr
    );

    // Log indikator ke console
    process.stdout.write(
      `[${timeframe}] Price: ${indicators.currentPrice} | EMA9: ${indicators.ema9} | EMA13: ${indicators.ema13} | StochK: ${indicators.stoch_k} | Signal: ${displayPosition}\n`
    );

    // Simpan state terkini (termasuk WAIT) untuk Socket.IO
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

    // Emit state update ke semua client (termasuk WAIT state)
    if (io) {
      io.emit('state_update', { ...currentState, _meta: { next_update_at: nextUpdateAt } });
    }

    // Jika ada sinyal LONG/SHORT DAN berbeda dari sinyal terakhir di timeframe ini
    if (position && lastSignalPosition[timeframe] !== position) {
      lastSignalPosition[timeframe] = position;

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

      // Simpan ke database
      const saved = saveSignal(signalData);

      // Broadcast sinyal baru ke frontend
      if (io) {
        io.emit('new_signal', saved);
        console.log(`📡 Sinyal ${position} [${timeframe}]! Entry: ${tpsl.entry} | TP1: ${tpsl.tp1} | TP2: ${tpsl.tp2} | SL: ${tpsl.sl}`);
      }

      // Kirim notifikasi Telegram jika aktif
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

  // Setelah semua timeframe selesai, periksa outcome sinyal terbuka
  const priceMap = {};
  for (const tf of TIMEFRAMES) {
    if (currentState[tf]?.currentPrice) {
      priceMap[tf] = currentState[tf].currentPrice;
    }
  }
  checkOpenSignalOutcomes(priceMap, io);
}

/**
 * Hitung milidetik hingga menit quarter berikutnya (:00, :15, :30, :45)
 */
function msUntilNextQuarter() {
  const now = new Date();
  const currentMinute = now.getMinutes();
  const currentSecond = now.getSeconds();
  const currentMs     = now.getMilliseconds();

  // Menit quarter berikutnya (0, 15, 30, 45)
  const nextQuarterMinute = Math.ceil((currentMinute + 1) / 15) * 15 % 60;

  // Selisih menit
  let diffMinutes = nextQuarterMinute - currentMinute;
  if (diffMinutes <= 0) diffMinutes += 60;

  // Kurangi detik dan milidetik yang sudah berjalan
  const diffMs = diffMinutes * 60 * 1000 - currentSecond * 1000 - currentMs;
  return diffMs;
}

/**
 * Mulai signal engine — berjalan otomatis di menit :00, :15, :30, :45 setiap jam
 * @param {Server} io - Socket.IO server instance
 */
function startSignalEngine(io) {
  const INTERVAL_MS = 15 * 60 * 1000; // 15 menit

  // Hitung waktu menunggu hingga quarter berikutnya
  const waitMs = msUntilNextQuarter();
  nextUpdateAt = new Date(Date.now() + waitMs).toISOString();

  console.log(`🚀 Signal Engine dimulai! Analisa berikutnya pada menit :${String(new Date(Date.now() + waitMs).getMinutes()).padStart(2, '0')} (dalam ${Math.round(waitMs / 1000)} detik)`);

  // Jalankan sekali saat startup
  runAllAnalysis(io);

  // Fungsi penjadwal rekursif
  function scheduleNext() {
    const delay = msUntilNextQuarter();
    nextUpdateAt = new Date(Date.now() + delay).toISOString();

    setTimeout(() => {
      runAllAnalysis(io);
      scheduleNext(); // jadwalkan quarter berikutnya
    }, delay);
  }

  scheduleNext();
}

module.exports = { startSignalEngine, runAllAnalysis, detectSignal, currentState };
