-- Schema untuk Terminal BTC SQLite Database

-- Tabel Users (Autentikasi)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Signals (Sinyal Trading dari TradingView)
CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timeframe TEXT NOT NULL,        -- '15m', '1H', '4H', '1D'
  position_type TEXT NOT NULL,    -- 'LONG', 'SHORT', 'WAIT'
  success_rate REAL,              -- Persentase keberhasilan (dihitung dari histori)
  ema9 REAL,
  ema13 REAL,
  stoch_k REAL,
  stoch_d REAL,
  order_block_zone TEXT,          -- Contoh: "65000-65500"
  outcome TEXT,                   -- 'WIN', 'LOSS', NULL (belum diketahui)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Webhook Logs (untuk debugging)
CREATE TABLE IF NOT EXISTS webhook_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  raw_payload TEXT,
  status TEXT,    -- 'success', 'error', 'invalid_secret'
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Settings (Pengaturan Notifikasi)
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  telegram_chat_id TEXT,
  telegram_enabled INTEGER DEFAULT 0,  -- 0 = disabled, 1 = enabled
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings row
INSERT OR IGNORE INTO settings (id, telegram_enabled) VALUES (1, 0);
