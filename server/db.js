import Database from 'better-sqlite3';
import { createClient } from '@libsql/client';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const dbPath     = path.join(__dirname, '..', 'khadra.db');

const tursoUrl = process.env.TURSO_DATABASE_URL || 'https://khadra-db-hussienaldayyat2022-ops.aws-eu-west-1.turso.io';
const tursoToken = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQ3ODg4NjYsImlkIjoiMDE5ZjhkYjMtMWUwMS03YmQ4LWE2ZmQtYjBhMzU2MDMxM2Q2Iiwia2lkIjoiQkxoQjQ4akVoMlRDRnVmdXJUMVpBUUsyQjk3V3YtNFlRejREV3h2OEkzUSIsInJpZCI6ImVkMjhhNjU0LWY2ODItNDBjMy05MzE5LWRmOGNkMzFhN2YxZSJ9.IwRJA-aBRTYLjcMwoIdYhUd8l0qtIJBbEUG1TYQ1GMIGgjbEINPNJqo40MMeaYEjZEacA0w2hjXa7pmLokRWAQ';

let dbDriver;

if (tursoUrl && tursoToken) {
  console.log('Using Turso Cloud Database:', tursoUrl);
  const turso = createClient({ url: tursoUrl, authToken: tursoToken });
  dbDriver = {
    isTurso: true,
    prepare: (sql) => ({
      get: async (...args) => {
        const flatArgs = args.flat();
        const res = await turso.execute({ sql, args: flatArgs.map(a => a === undefined ? null : a) });
        return res.rows[0];
      },
      all: async (...args) => {
        const flatArgs = args.flat();
        const res = await turso.execute({ sql, args: flatArgs.map(a => a === undefined ? null : a) });
        return res.rows;
      },
      run: async (...args) => {
        const flatArgs = args.flat();
        const res = await turso.execute({ sql, args: flatArgs.map(a => a === undefined ? null : a) });
        return { lastInsertRowid: res.lastInsertRowid ? Number(res.lastInsertRowid) : 0, changes: res.rowsAffected };
      }
    }),
    exec: async (sql) => {
      return await turso.executeMultiple(sql);
    }
  };
} else {
  console.log('Using Local SQLite Database:', dbPath);
  const localDb = new Database(dbPath);
  localDb.pragma('journal_mode = WAL');
  dbDriver = {
    isTurso: false,
    prepare: (sql) => ({
      get: (...args) => localDb.prepare(sql).get(...args.flat()),
      all: (...args) => localDb.prepare(sql).all(...args.flat()),
      run: (...args) => localDb.prepare(sql).run(...args.flat()),
    }),
    exec: (sql) => localDb.exec(sql)
  };
}

export const db = dbDriver;

export async function initializeDatabase() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','coordinator','host','inspection_coordinator')),
      two_factor_secret TEXT,
      two_factor_enabled INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      unit_price REAL NOT NULL DEFAULT 0,
      unit_type TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hourly_workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      hourly_rate REAL NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shift_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL,
      shift_date TEXT NOT NULL,
      shift_start TEXT NOT NULL,
      shift_end TEXT NOT NULL,
      hours_worked REAL NOT NULL,
      hourly_rate_snapshot REAL NOT NULL,
      total_pay REAL NOT NULL,
      session_id INTEGER,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(worker_id) REFERENCES hourly_workers(id),
      FOREIGN KEY(created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS box_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL,
      boxes_count INTEGER NOT NULL DEFAULT 0,
      alloc_date TEXT NOT NULL,
      session_id INTEGER,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(worker_id) REFERENCES hourly_workers(id),
      FOREIGN KEY(created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_name TEXT NOT NULL,
      attendance_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('present','absent','hourly','daily','count')),
      session_id INTEGER,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS category_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      worker_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      total_price REAL NOT NULL,
      entry_date TEXT NOT NULL,
      session_id INTEGER,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(category_id) REFERENCES categories(id),
      FOREIGN KEY(created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')),
      notes TEXT DEFAULT '',
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS daily_workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      daily_rate REAL NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS daily_work_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL,
      work_date TEXT NOT NULL,
      boxes_count INTEGER NOT NULL DEFAULT 0,
      total_pay REAL NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      session_id INTEGER,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(worker_id) REFERENCES daily_workers(id),
      FOREIGN KEY(created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS inspection_workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL UNIQUE,
      notes TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inspection_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_name TEXT NOT NULL,
      boxes_count INTEGER NOT NULL DEFAULT 1,
      work_date TEXT NOT NULL,
      start_time TEXT,
      notes TEXT DEFAULT '',
      session_id INTEGER,
      created_by INTEGER NOT NULL,
      approved INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS inspection_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_name TEXT NOT NULL,
      target_boxes INTEGER NOT NULL,
      target_date TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES users(id),
      UNIQUE(worker_name, target_date)
    );
  `);
}
