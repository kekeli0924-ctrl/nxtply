import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db;

function resolveDbPath() {
  return process.env.DB_PATH === ':memory:'
    ? ':memory:'
    : process.env.DB_PATH
      ? path.resolve(process.env.DB_PATH)
      : path.join(__dirname, 'data', 'nxtply.db');
}

export function getDb() {
  if (!db) {
    const dbPath = resolveDbPath();
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
    runMigrations(db);
  }
  return db;
}

export function resetDb() {
  if (db) {
    db.close();
    db = null;
  }
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      duration INTEGER NOT NULL DEFAULT 0,
      drills TEXT NOT NULL DEFAULT '[]',
      notes TEXT DEFAULT '',
      intention TEXT DEFAULT '',
      session_type TEXT DEFAULT '',
      position TEXT DEFAULT 'general',
      quick_rating INTEGER DEFAULT 3,
      body_check TEXT,
      shooting TEXT,
      passing TEXT,
      fitness TEXT,
      delivery TEXT,
      attacking TEXT,
      reflection TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      opponent TEXT NOT NULL,
      result TEXT NOT NULL CHECK(result IN ('W', 'D', 'L')),
      minutes_played INTEGER DEFAULT 0,
      goals INTEGER DEFAULT 0,
      assists INTEGER DEFAULT 0,
      shots INTEGER DEFAULT 0,
      passes_completed INTEGER DEFAULT 0,
      rating INTEGER DEFAULT 6,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date);

    CREATE TABLE IF NOT EXISTS custom_drills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK(id = 1) DEFAULT 1,
      distance_unit TEXT DEFAULT 'km',
      weekly_goal INTEGER DEFAULT 3,
      age_group TEXT,
      skill_level TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO settings (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS personal_records (
      id INTEGER PRIMARY KEY CHECK(id = 1) DEFAULT 1,
      data TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO personal_records (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS training_plans (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      drills TEXT NOT NULL DEFAULT '[]',
      target_duration INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_training_plans_date ON training_plans(date);

    CREATE TABLE IF NOT EXISTS idp_goals (
      id TEXT PRIMARY KEY,
      corner TEXT NOT NULL CHECK(corner IN ('technical', 'tactical', 'physical', 'psychological')),
      text TEXT NOT NULL,
      target_date TEXT,
      progress INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS decision_journal (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      match_id TEXT,
      match_label TEXT,
      decisions TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_decision_journal_date ON decision_journal(date);

    CREATE TABLE IF NOT EXISTS benchmarks (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('lspt', 'lsst')),
      score REAL NOT NULL DEFAULT 0,
      data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_benchmarks_date ON benchmarks(date);

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// Migration system — add new migrations to the array
const migrations = [
  { version: 1, up: (db) => db.exec("ALTER TABLE sessions ADD COLUMN idp_goals TEXT DEFAULT '[]'") },
  { version: 2, up: (db) => {
    db.exec("ALTER TABLE settings ADD COLUMN player_name TEXT");
    db.exec("ALTER TABLE settings ADD COLUMN onboarding_complete INTEGER DEFAULT 0");
  }},
  { version: 3, up: (db) => db.exec("ALTER TABLE sessions ADD COLUMN media_links TEXT DEFAULT '[]'") },
];

function runMigrations(db) {
  const current = db.prepare('SELECT MAX(version) as v FROM schema_version').get()?.v || 0;
  for (const m of migrations) {
    if (m.version > current) {
      m.up(db);
      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(m.version);
    }
  }
}
