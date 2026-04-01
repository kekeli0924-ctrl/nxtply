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
  { version: 4, up: (db) => {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'player'");
    db.exec(`
      CREATE TABLE IF NOT EXISTS invite_codes (
        code TEXT PRIMARY KEY,
        coach_id INTEGER NOT NULL REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL,
        used_by INTEGER REFERENCES users(id),
        used_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_invite_codes_coach ON invite_codes(coach_id);

      CREATE TABLE IF NOT EXISTS coach_players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coach_id INTEGER NOT NULL,
        player_id INTEGER NOT NULL,
        joined_at TEXT DEFAULT (datetime('now')),
        UNIQUE(coach_id, player_id)
      );
      CREATE INDEX IF NOT EXISTS idx_cp_coach ON coach_players(coach_id);
      CREATE INDEX IF NOT EXISTS idx_cp_player ON coach_players(player_id);

      CREATE TABLE IF NOT EXISTS assigned_plans (
        id TEXT PRIMARY KEY,
        coach_id INTEGER NOT NULL,
        player_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        drills TEXT NOT NULL DEFAULT '[]',
        target_duration INTEGER DEFAULT 0,
        notes TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_ap_player_date ON assigned_plans(player_id, date);
      CREATE INDEX IF NOT EXISTS idx_ap_coach ON assigned_plans(coach_id);
    `);
  }},
  { version: 5, up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS video_analyses (
        id TEXT PRIMARY KEY,
        video_path TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        duration_seconds REAL,
        status TEXT DEFAULT 'uploaded' CHECK(status IN ('uploaded', 'extracting', 'analyzing', 'complete', 'error')),
        frames_extracted INTEGER DEFAULT 0,
        analysis_result TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        completed_at TEXT
      );
    `);
  }},
  { version: 6, up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS friend_connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_a INTEGER NOT NULL,
        user_b INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_a, user_b)
      );
      CREATE INDEX IF NOT EXISTS idx_friends_a ON friend_connections(user_a);
      CREATE INDEX IF NOT EXISTS idx_friends_b ON friend_connections(user_b);
    `);
    db.exec("ALTER TABLE invite_codes ADD COLUMN type TEXT DEFAULT 'coach'");
    db.exec("ALTER TABLE video_analyses ADD COLUMN clip_path TEXT");
    db.exec("ALTER TABLE video_analyses ADD COLUMN clip_timestamp REAL");
  }},
  { version: 7, up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user INTEGER NOT NULL,
        to_user INTEGER NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_messages_users ON messages(from_user, to_user);
      CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_user);

      CREATE TABLE IF NOT EXISTS session_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_comments_session ON session_comments(session_id);
    `);
  }},
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
