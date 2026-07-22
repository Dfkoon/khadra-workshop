import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const dbPath     = path.join(__dirname, '..', 'khadra.db');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

export function initializeDatabase() {

  /* ─────────────────────────────────────────
     1. جداول موجودة (لا تُغيَّر)
  ───────────────────────────────────────── */
  db.exec(`
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
  `);

  const attendanceSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='attendance'").get();
  if (attendanceSchema && !attendanceSchema.sql.includes("CHECK(status IN ('present','absent','hourly','daily','count'))")) {
    db.exec(`
      ALTER TABLE attendance RENAME TO attendance_old;
      CREATE TABLE attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        worker_name TEXT NOT NULL,
        attendance_date TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('present','absent','hourly','daily','count')),
        session_id INTEGER,
        created_by INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(created_by) REFERENCES users(id)
      );
      INSERT INTO attendance (id, worker_name, attendance_date, status, session_id, created_by, created_at)
        SELECT id, worker_name, attendance_date, status, session_id, created_by, created_at FROM attendance_old;
      DROP TABLE attendance_old;
    `);
  }

  db.exec(`
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

    /* ─────────────────────────────────────────
       2. جداول جديدة
    ───────────────────────────────────────── */

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

  // Migrate users check constraint if old
  const usersSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (usersSchema && usersSchema.sql && !usersSchema.sql.includes('inspection_coordinator')) {
    try {
      db.exec(`
        ALTER TABLE users RENAME TO users_old;
        CREATE TABLE users (
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
        INSERT INTO users (id, full_name, username, password_hash, role, two_factor_secret, two_factor_enabled, is_active, created_at)
          SELECT id, full_name, username, password_hash, role, two_factor_secret, two_factor_enabled, is_active, created_at FROM users_old;
        DROP TABLE users_old;
      `);
    } catch (e) {
      console.log('Users migration skipped/already updated');
    }
  }

  /* ─────────────────────────────────────────
     3. Migrations — إضافة أعمدة مفقودة
  ───────────────────────────────────────── */
  function addColumnIfMissing(table, column, definition) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    if (!cols.includes(column)) {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
    }
  }

  // users
  addColumnIfMissing('users', 'two_factor_secret',  'TEXT');
  addColumnIfMissing('users', 'two_factor_enabled', 'INTEGER NOT NULL DEFAULT 0');

  // hourly_workers
  addColumnIfMissing('hourly_workers', 'notes', "TEXT DEFAULT ''");

  // جداول تحتاج session_id
  ['shift_records','box_allocations','attendance','category_usage'].forEach(t => {
    addColumnIfMissing(t, 'session_id', 'INTEGER');
  });

  // جداول تحتاج approved
  ['category_usage', 'box_allocations', 'daily_work_records'].forEach(t => {
    addColumnIfMissing(t, 'approved', 'INTEGER NOT NULL DEFAULT 1');
  });

  addColumnIfMissing('daily_work_records', 'category_id', 'INTEGER');

  /* ─────────────────────────────────────────
     4. بيانات أولية
  ───────────────────────────────────────── */

  // مستخدم admin
  const adminUser = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  if (!adminUser) {
    db.prepare(`
      INSERT INTO users (full_name, username, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run('المسؤولة', 'admin', bcrypt.hashSync('admin123', 10), 'admin');
  }

  // منسق تجريبي
  const coordUser = db.prepare('SELECT * FROM users WHERE username = ?').get('coordinator1');
  if (!coordUser) {
    db.prepare(`
      INSERT INTO users (full_name, username, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run('منسق تجريبي', 'coordinator1', bcrypt.hashSync('coord123', 10), 'coordinator');
  } else if (coordUser.role !== 'coordinator') {
    db.prepare('UPDATE users SET role = ? WHERE username = ?').run('coordinator', 'coordinator1');
  }

  // مضيف تجريبي
  const hostUser = db.prepare('SELECT * FROM users WHERE username = ?').get('host1');
  if (!hostUser) {
    db.prepare(`
      INSERT INTO users (full_name, username, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run('مضيف تجريبي', 'host1', bcrypt.hashSync('host123', 10), 'host');
  }

  // أصناف أولية
  const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get();
  if (!catCount.c) {
    db.prepare(`
      INSERT INTO categories (name, unit_price, unit_type, is_active) VALUES
      ('بندورة', 2.5, 'كغم', 1),
      ('خيار',  1.75, 'كغم', 1),
      ('فلفل',   3.0, 'كغم', 1)
    `).run();
  }

  // عمال ساعة أوليين
  const hwCount = db.prepare('SELECT COUNT(*) as c FROM hourly_workers').get();
  if (!hwCount.c) {
    db.prepare(`
      INSERT INTO hourly_workers (full_name, hourly_rate, is_active) VALUES
      ('أحمد', 15, 1),
      ('سامي', 12.5, 1)
    `).run();
  }

  /* ─────────────────────────────────────────
     5. جلسة افتراضية إن لم تكن موجودة
  ───────────────────────────────────────── */
  const sessionCount = db.prepare('SELECT COUNT(*) as c FROM sessions').get();
  if (!sessionCount.c) {
    const adminId = db.prepare('SELECT id FROM users WHERE username = ?').get('admin')?.id || 1;
    db.prepare(`
      INSERT INTO sessions (name, status, notes, created_by)
      VALUES ('الجلسة الأولى', 'active', '', ?)
    `).run(adminId);
  }
}
