/**
 * Database module menggunakan Node.js built-in SQLite (Node v22+)
 * Tidak memerlukan native compilation atau external binary
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/terminal_btc.db');

// Pastikan folder data ada
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    initSchema();
    console.log('✅ Database initialized:', DB_PATH);
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timeframe TEXT NOT NULL,
      position_type TEXT NOT NULL,
      success_rate REAL,
      ema9 REAL,
      ema13 REAL,
      stoch_k REAL,
      stoch_d REAL,
      order_block_zone TEXT,
      outcome TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS webhook_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raw_payload TEXT,
      status TEXT,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      telegram_chat_id TEXT,
      telegram_enabled INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO settings (id, telegram_enabled) VALUES (1, 0);
  `);
}

module.exports = { getDb };
