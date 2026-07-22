import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSecret, verify, generate } from 'otplib';
import { db, initializeDatabase } from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const publicDir      = path.join(__dirname, '..', 'public');
const clientBuildDir = path.join(__dirname, '..', 'client', 'dist');
const useClientBuild = fs.existsSync(clientBuildDir);
const indexFile = useClientBuild
  ? path.join(clientBuildDir, 'index.html')
  : path.join(publicDir, 'index.html');

if (useClientBuild) app.use(express.static(clientBuildDir));
app.use(express.static(publicDir));

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

/* ─── Middleware ─── */
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.twoFactorPending) return res.status(403).json({ error: 'Full authentication required' });
    req.user = payload; next();
  } catch { return res.status(403).json({ error: 'Invalid token' }); }
}

function authenticatePendingToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload.twoFactorPending) return res.status(403).json({ error: 'Invalid two-factor token' });
    req.user = payload; next();
  } catch { return res.status(403).json({ error: 'Invalid token' }); }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}
function requireCoordinatorOrAdmin(req, res, next) {
  if (req.user?.role === 'admin' || req.user?.role === 'coordinator') return next();
  return res.status(403).json({ error: 'Coordinator or Admin only' });
}

function requireAdminOrInspectionCoordinator(req, res, next) {
  if (req.user?.role === 'admin' || req.user?.role === 'inspection_coordinator') return next();
  return res.status(403).json({ error: 'Admin or Inspection Coordinator only' });
}

function requireHostOrAdmin(req, res, next) {
  if (req.user?.role === 'admin' || req.user?.role === 'host') return next();
  return res.status(403).json({ error: 'Admin or Host only' });
}
 
function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function activeSession() {
  return db.prepare("SELECT * FROM sessions WHERE status = 'active' ORDER BY id DESC LIMIT 1").get();
}

initializeDatabase();

/* ═══════════════════════════════════════════
   AUTH
═══════════════════════════════════════════ */
app.get('/', (req, res) => res.sendFile(indexFile));

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });

  if (user.two_factor_enabled) {
    const tempToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role, twoFactorPending: true },
      JWT_SECRET, { expiresIn: '5m' }
    );
    return res.json({
      requires2fa: true, tempToken,
      user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role },
    });
  }
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  return res.json({ token, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } });
});

app.post('/api/auth/verify-2fa', authenticatePendingToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!req.user?.twoFactorPending) return res.status(403).json({ error: 'جلسة المصادقة غير صالحة' });
    if (!code) return res.status(400).json({ error: 'رمز المصادقة مطلوب' });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user || !user.two_factor_enabled || !user.two_factor_secret)
      return res.status(400).json({ error: 'المصادقة الثنائية غير مفعلة لهذا المستخدم' });

    const codeStr = String(code).trim();
    if (codeStr.length !== 6) return res.status(401).json({ error: 'رمز المصادقة يجب أن يتكون من 6 أرقام' });

    const result = await verify({ token: codeStr, secret: user.two_factor_secret });
    if (!result?.valid) return res.status(401).json({ error: 'رمز المصادقة الثنائية غير صحيح' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ token, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } });
  } catch (err) {
    console.error('2FA Verification Error:', err);
    return res.status(500).json({ error: 'حدث خطأ أثناء التحقق من رمز المصادقة' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => res.json({ user: req.user }));

/* ═══════════════════════════════════════════
   SESSIONS
═══════════════════════════════════════════ */
app.get('/api/sessions', authenticateToken, requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM sessions ORDER BY id DESC').all();
  res.json(rows);
});

app.get('/api/sessions/active', authenticateToken, (req, res) => {
  const session = activeSession();
  res.json(session || null);
});

app.post('/api/sessions', authenticateToken, requireAdmin, (req, res) => {
  const { name, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'اسم الجلسة مطلوب' });
  db.prepare("UPDATE sessions SET status='closed', end_date=CURRENT_TIMESTAMP WHERE status='active'").run();
  const result = db.prepare(
    "INSERT INTO sessions (name, status, notes, created_by) VALUES (?, 'active', ?, ?)"
  ).run(name, notes || '', req.user.id);
  const created = db.prepare('SELECT * FROM sessions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

app.post('/api/sessions/:id/close', authenticateToken, requireAdmin, (req, res) => {
  const { notes } = req.body;
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });
  if (session.status === 'closed') return res.status(400).json({ error: 'الجلسة مغلقة مسبقاً' });
  db.prepare("UPDATE sessions SET status='closed', end_date=CURRENT_TIMESTAMP, notes=? WHERE id=?")
    .run(notes ?? session.notes, req.params.id);
  res.json(db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id));
});

app.patch('/api/sessions/:id', authenticateToken, requireAdmin, (req, res) => {
  const { notes } = req.body;
  db.prepare('UPDATE sessions SET notes=? WHERE id=?').run(notes ?? '', req.params.id);
  res.json(db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id));
});

/* ═══════════════════════════════════════════
   CATEGORIES
═══════════════════════════════════════════ */
app.get('/api/categories', authenticateToken, (req, res) => {
  res.json(db.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY id').all());
});

app.post('/api/categories', authenticateToken, requireAdmin, (req, res) => {
  const { name, unit_price, unit_type } = req.body;
  const result = db.prepare('INSERT INTO categories (name, unit_price, unit_type, is_active) VALUES (?, ?, ?, 1)')
    .run(name, Number(unit_price || 0), unit_type || '');
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/categories/:id', authenticateToken, requireAdmin, (req, res) => {
  const { name, unit_price } = req.body;
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!category) return res.status(404).json({ error: 'الصنف غير موجود' });
  db.prepare('UPDATE categories SET name = ?, unit_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(name ?? category.name, Number(unit_price ?? category.unit_price), req.params.id);
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
});

/* ═══════════════════════════════════════════
   CATEGORY USAGE
═══════════════════════════════════════════ */
app.get('/api/category-usage', authenticateToken, (req, res) => {
  const { date, session_id } = req.query;
  let rows;
  if (date)
    rows = db.prepare('SELECT * FROM category_usage WHERE entry_date = ? AND approved = 1 ORDER BY id').all(date);
  else if (session_id)
    rows = db.prepare('SELECT * FROM category_usage WHERE session_id = ? AND approved = 1 ORDER BY entry_date DESC, id DESC').all(session_id);
  else
    rows = db.prepare('SELECT * FROM category_usage WHERE approved = 1 ORDER BY entry_date DESC, id DESC').all();
  res.json(rows);
});

app.post('/api/category-usage', authenticateToken, (req, res) => {
  const { category_id, worker_name, quantity, entry_date } = req.body;
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(category_id);
  if (!category) return res.status(404).json({ error: 'الصنف غير موجود' });
  const total_price  = Number(quantity) * Number(category.unit_price);
  const session      = activeSession();
  const approved     = req.user.role === 'admin' ? 1 : 0;
  const result = db.prepare(
    'INSERT INTO category_usage (category_id, worker_name, quantity, total_price, entry_date, session_id, approved, created_by) VALUES (?,?,?,?,?,?,?,?)'
  ).run(category_id, worker_name, Number(quantity), Number(total_price.toFixed(2)), entry_date, session?.id ?? null, approved, req.user.id);
  res.status(201).json(db.prepare('SELECT * FROM category_usage WHERE id = ?').get(result.lastInsertRowid));
});

app.delete('/api/category-usage/:id', authenticateToken, requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM category_usage WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'السجل غير موجود' });
  db.prepare('DELETE FROM category_usage WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

/* ═══════════════════════════════════════════
   HOURLY WORKERS
═══════════════════════════════════════════ */
app.get('/api/hourly-workers', authenticateToken, (req, res) => {
  res.json(db.prepare('SELECT * FROM hourly_workers WHERE is_active = 1 ORDER BY id').all());
});

app.post('/api/hourly-workers', authenticateToken, requireAdmin, (req, res) => {
  const { full_name, hourly_rate, notes } = req.body;
  const result = db.prepare('INSERT INTO hourly_workers (full_name, hourly_rate, notes, is_active) VALUES (?, ?, ?, 1)')
    .run(full_name, Number(hourly_rate || 0), notes || '');
  res.status(201).json(db.prepare('SELECT * FROM hourly_workers WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/hourly-workers/:id', authenticateToken, requireAdmin, (req, res) => {
  const { full_name, hourly_rate, notes } = req.body;
  const worker = db.prepare('SELECT * FROM hourly_workers WHERE id = ?').get(req.params.id);
  if (!worker) return res.status(404).json({ error: 'العامل غير موجود' });
  db.prepare('UPDATE hourly_workers SET full_name=?, hourly_rate=?, notes=? WHERE id=?')
    .run(full_name ?? worker.full_name, Number(hourly_rate ?? worker.hourly_rate), notes ?? worker.notes, req.params.id);
  res.json(db.prepare('SELECT * FROM hourly_workers WHERE id = ?').get(req.params.id));
});

/* ═══════════════════════════════════════════
   SHIFT RECORDS
═══════════════════════════════════════════ */
app.get('/api/shift-records', authenticateToken, (req, res) => {
  const { date, session_id } = req.query;
  let rows;
  const base = 'SELECT sr.*, hw.full_name as worker_name FROM shift_records sr JOIN hourly_workers hw ON sr.worker_id = hw.id';
  if (date)
    rows = db.prepare(`${base} WHERE sr.shift_date = ? ORDER BY sr.id`).all(date);
  else if (session_id)
    rows = db.prepare(`${base} WHERE sr.session_id = ? ORDER BY sr.shift_date DESC, sr.id DESC`).all(session_id);
  else
    rows = db.prepare(`${base} ORDER BY sr.shift_date DESC, sr.id DESC`).all();
  res.json(rows);
});

app.post('/api/shift-records', authenticateToken, requireAdmin, (req, res) => {
  const { worker_id, shift_date, shift_start, shift_end } = req.body;
  const worker = db.prepare('SELECT * FROM hourly_workers WHERE id = ?').get(worker_id);
  if (!worker) return res.status(404).json({ error: 'العامل غير موجود' });

  const end = shift_end || '';
  let hoursWorked = 0;
  let total_pay = 0;

  if (shift_start && end) {
    hoursWorked = (timeToMinutes(end) - timeToMinutes(shift_start)) / 60;
    if (hoursWorked < 0) hoursWorked += 24;
    total_pay = Number((hoursWorked * Number(worker.hourly_rate)).toFixed(2));
  }

  const session = activeSession();
  const result = db.prepare(
    'INSERT INTO shift_records (worker_id, shift_date, shift_start, shift_end, hours_worked, hourly_rate_snapshot, total_pay, session_id, created_by) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(worker_id, shift_date, shift_start, end, Number(hoursWorked.toFixed(2)), Number(worker.hourly_rate), total_pay, session?.id ?? null, req.user.id);
  res.status(201).json(db.prepare('SELECT * FROM shift_records WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/shift-records/:id', authenticateToken, requireAdmin, (req, res) => {
  const { shift_start, shift_end } = req.body;
  const row = db.prepare('SELECT * FROM shift_records WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'السجل غير موجود' });

  const start = shift_start !== undefined ? shift_start : row.shift_start;
  const end   = shift_end !== undefined ? shift_end : row.shift_end;
  let hoursWorked = 0;
  let total_pay = 0;

  if (start && end) {
    hoursWorked = (timeToMinutes(end) - timeToMinutes(start)) / 60;
    if (hoursWorked < 0) hoursWorked += 24;
    total_pay = Number((hoursWorked * Number(row.hourly_rate_snapshot)).toFixed(2));
  }

  db.prepare('UPDATE shift_records SET shift_start = ?, shift_end = ?, hours_worked = ?, total_pay = ? WHERE id = ?')
    .run(start, end, Number(hoursWorked.toFixed(2)), total_pay, req.params.id);
  res.json(db.prepare('SELECT * FROM shift_records WHERE id = ?').get(req.params.id));
});

app.delete('/api/shift-records/:id', authenticateToken, requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM shift_records WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'السجل غير موجود' });
  db.prepare('DELETE FROM shift_records WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

/* ═══════════════════════════════════════════
   BOX ALLOCATIONS (عمال ساعة)
═══════════════════════════════════════════ */
app.get('/api/box-allocations', authenticateToken, (req, res) => {
  const { date, session_id } = req.query;
  const base = 'SELECT ba.*, hw.full_name as worker_name FROM box_allocations ba JOIN hourly_workers hw ON ba.worker_id = hw.id';
  let rows;
  if (date)
    rows = db.prepare(`${base} WHERE ba.alloc_date = ? AND ba.approved = 1 ORDER BY ba.id`).all(date);
  else if (session_id)
    rows = db.prepare(`${base} WHERE ba.session_id = ? AND ba.approved = 1 ORDER BY ba.alloc_date DESC, ba.id DESC`).all(session_id);
  else
    rows = db.prepare(`${base} WHERE ba.approved = 1 ORDER BY ba.alloc_date DESC, ba.id DESC`).all();
  res.json(rows);
});

app.post('/api/box-allocations', authenticateToken, requireCoordinatorOrAdmin, (req, res) => {
  const { worker_id, boxes_count, alloc_date } = req.body;
  const worker = db.prepare('SELECT * FROM hourly_workers WHERE id = ?').get(worker_id);
  if (!worker) return res.status(404).json({ error: 'العامل غير موجود' });
  const date    = alloc_date || new Date().toISOString().slice(0, 10);
  const session = activeSession();
  const approved = req.user.role === 'admin' ? 1 : 0;
  const result = db.prepare('INSERT INTO box_allocations (worker_id, boxes_count, alloc_date, session_id, approved, created_by) VALUES (?,?,?,?,?,?)')
    .run(worker_id, Number(boxes_count || 0), date, session?.id ?? null, approved, req.user.id);
  const created = db.prepare('SELECT ba.*, hw.full_name as worker_name FROM box_allocations ba JOIN hourly_workers hw ON ba.worker_id = hw.id WHERE ba.id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

app.put('/api/box-allocations/:id', authenticateToken, requireCoordinatorOrAdmin, (req, res) => {
  const { worker_id, boxes_count } = req.body;
  const row = db.prepare('SELECT * FROM box_allocations WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'السجل غير موجود' });
  const worker = db.prepare('SELECT * FROM hourly_workers WHERE id = ?').get(worker_id);
  if (!worker) return res.status(404).json({ error: 'العامل غير موجود' });
  db.prepare('UPDATE box_allocations SET worker_id=?, boxes_count=? WHERE id=?')
    .run(worker_id, Number(boxes_count || 0), req.params.id);
  const updated = db.prepare('SELECT ba.*, hw.full_name as worker_name FROM box_allocations ba JOIN hourly_workers hw ON ba.worker_id = hw.id WHERE ba.id = ?').get(req.params.id);
  res.json(updated);
});

app.delete('/api/box-allocations/:id', authenticateToken, requireCoordinatorOrAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM box_allocations WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'السجل غير موجود' });
  db.prepare('DELETE FROM box_allocations WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

/* ═══════════════════════════════════════════
   DAILY WORKERS — عمال المياومة
═══════════════════════════════════════════ */
app.get('/api/daily-workers', authenticateToken, (req, res) => {
  res.json(db.prepare('SELECT * FROM daily_workers WHERE is_active = 1 ORDER BY id').all());
});

app.post('/api/daily-workers', authenticateToken, requireAdmin, (req, res) => {
  const { full_name, daily_rate, notes } = req.body;
  if (!full_name) return res.status(400).json({ error: 'الاسم مطلوب' });
  const result = db.prepare('INSERT INTO daily_workers (full_name, daily_rate, notes, is_active) VALUES (?,?,?,1)')
    .run(full_name, Number(daily_rate || 0), notes || '');
  res.status(201).json(db.prepare('SELECT * FROM daily_workers WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/daily-workers/:id', authenticateToken, requireAdmin, (req, res) => {
  const { full_name, daily_rate, notes, is_active } = req.body;
  const worker = db.prepare('SELECT * FROM daily_workers WHERE id = ?').get(req.params.id);
  if (!worker) return res.status(404).json({ error: 'العامل غير موجود' });
  db.prepare('UPDATE daily_workers SET full_name=?, daily_rate=?, notes=?, is_active=? WHERE id=?')
    .run(
      full_name   ?? worker.full_name,
      Number(daily_rate ?? worker.daily_rate),
      notes       ?? worker.notes,
      is_active   !== undefined ? (is_active ? 1 : 0) : worker.is_active,
      req.params.id
    );
  res.json(db.prepare('SELECT * FROM daily_workers WHERE id = ?').get(req.params.id));
});

app.delete('/api/daily-workers/:id', authenticateToken, requireAdmin, (req, res) => {
  db.prepare('UPDATE daily_workers SET is_active=0 WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

/* ═══════════════════════════════════════════
   DAILY WORK RECORDS — سجلات المياومة
═══════════════════════════════════════════ */
app.get('/api/daily-work-records', authenticateToken, (req, res) => {
  const { date, session_id } = req.query;
  const base = 'SELECT dwr.*, dw.full_name as worker_name, dw.daily_rate FROM daily_work_records dwr JOIN daily_workers dw ON dwr.worker_id = dw.id';
  let rows;
  if (date)
    rows = db.prepare(`${base} WHERE dwr.work_date = ? AND dwr.approved = 1 ORDER BY dwr.id`).all(date);
  else if (session_id)
    rows = db.prepare(`${base} WHERE dwr.session_id = ? AND dwr.approved = 1 ORDER BY dwr.work_date DESC, dwr.id DESC`).all(session_id);
  else
    rows = db.prepare(`${base} WHERE dwr.approved = 1 ORDER BY dwr.work_date DESC, dwr.id DESC`).all();
  res.json(rows);
});

app.post('/api/daily-work-records', authenticateToken, requireCoordinatorOrAdmin, (req, res) => {
  const { worker_id, work_date, boxes_count, notes } = req.body;
  const worker = db.prepare('SELECT * FROM daily_workers WHERE id = ?').get(worker_id);
  if (!worker) return res.status(404).json({ error: 'العامل غير موجود' });
  const date    = work_date || new Date().toISOString().slice(0, 10);
  const boxes   = Number(boxes_count || 0);
  const total_pay = boxes * Number(worker.daily_rate);
  const session = activeSession();
  const approved = req.user.role === 'admin' ? 1 : 0;
  const result = db.prepare(
    'INSERT INTO daily_work_records (worker_id, work_date, boxes_count, total_pay, notes, session_id, approved, created_by) VALUES (?,?,?,?,?,?,?,?)'
  ).run(worker_id, date, boxes, total_pay, notes || '', session?.id ?? null, approved, req.user.id);
  const created = db.prepare('SELECT dwr.*, dw.full_name as worker_name, dw.daily_rate FROM daily_work_records dwr JOIN daily_workers dw ON dwr.worker_id = dw.id WHERE dwr.id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

app.put('/api/daily-work-records/:id', authenticateToken, requireCoordinatorOrAdmin, (req, res) => {
  const { boxes_count, notes } = req.body;
  const row = db.prepare('SELECT * FROM daily_work_records WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'السجل غير موجود' });
  const worker = db.prepare('SELECT daily_rate FROM daily_workers WHERE id = ?').get(row.worker_id);
  const new_boxes = Number(boxes_count ?? row.boxes_count);
  const total_pay = new_boxes * Number(worker.daily_rate);
  db.prepare('UPDATE daily_work_records SET boxes_count=?, total_pay=?, notes=? WHERE id=?')
    .run(new_boxes, total_pay, notes ?? row.notes, req.params.id);
  const updated = db.prepare('SELECT dwr.*, dw.full_name as worker_name, dw.daily_rate FROM daily_work_records dwr JOIN daily_workers dw ON dwr.worker_id = dw.id WHERE dwr.id = ?').get(req.params.id);
  res.json(updated);
});

app.delete('/api/daily-work-records/:id', authenticateToken, requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM daily_work_records WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'السجل غير موجود' });
  db.prepare('DELETE FROM daily_work_records WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

/* ═══════════════════════════════════════════
   ATTENDANCE
═══════════════════════════════════════════ */
app.get('/api/attendance', authenticateToken, requireHostOrAdmin, (req, res) => {
  const { date } = req.query;
  const rows = date
    ? db.prepare('SELECT * FROM attendance WHERE attendance_date = ? ORDER BY id').all(date)
    : db.prepare('SELECT * FROM attendance ORDER BY attendance_date DESC, id DESC LIMIT 300').all();
  res.json(rows);
});

app.post('/api/attendance', authenticateToken, requireHostOrAdmin, (req, res) => {
  const { worker_name, attendance_date, status, hourly_rate } = req.body;
  if (!worker_name || !attendance_date || !status) return res.status(400).json({ error: 'بيانات ناقصة' });
  if (!['present','absent','hourly','daily','count'].includes(status)) return res.status(400).json({ error: 'حالة غير صحيحة' });
  
  if (status === 'hourly') {
      const exists = db.prepare('SELECT id FROM hourly_workers WHERE full_name = ?').get(worker_name);
      if (!exists) {
          db.prepare('INSERT INTO hourly_workers (full_name, hourly_rate) VALUES (?, ?)').run(worker_name, Number(hourly_rate || 1.25));
      } else if (hourly_rate) {
          db.prepare('UPDATE hourly_workers SET hourly_rate = ? WHERE id = ?').run(Number(hourly_rate), exists.id);
      }
  }

  const session = activeSession();
  const result = db.prepare('INSERT INTO attendance (worker_name, attendance_date, status, session_id, created_by) VALUES (?,?,?,?,?)')
    .run(worker_name, attendance_date, status, session?.id ?? null, req.user.id);
  res.status(201).json(db.prepare('SELECT * FROM attendance WHERE id = ?').get(result.lastInsertRowid));
});

app.delete('/api/attendance/:id', authenticateToken, requireHostOrAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM attendance WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'السجل غير موجود' });
  db.prepare('DELETE FROM attendance WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

/* ═══════════════════════════════════════════
   INSPECTION WORK RECORDS (سجل أعداد عمال الفحص)
═══════════════════════════════════════════ */
app.get('/api/inspection-records', authenticateToken, (req, res) => {
  const { date, session_id } = req.query;
  const session = activeSession();
  let sql = 'SELECT * FROM inspection_records WHERE 1=1';
  const params = [];
  if (date) {
    sql += ' AND work_date = ?';
    params.push(date);
  } else if (session_id) {
    sql += ' AND session_id = ?';
    params.push(session_id);
  } else if (session) {
    sql += ' AND (session_id = ? OR session_id IS NULL)';
    params.push(session.id);
  }
  sql += ' ORDER BY id DESC LIMIT 300';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/inspection-records', authenticateToken, (req, res) => {
  const { worker_name, boxes_count, work_date, start_time, notes } = req.body;
  if (!worker_name || !boxes_count) return res.status(400).json({ error: 'اسم العامل وعدد الأعداد مطلوبان' });
  const date = work_date || new Date().toISOString().slice(0, 10);
  const session = activeSession();
  const result = db.prepare(`
    INSERT INTO inspection_records (worker_name, boxes_count, work_date, start_time, notes, session_id, created_by, approved)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(worker_name, parseInt(boxes_count), date, start_time || null, notes || '', session?.id ?? null, req.user.id);

  res.status(201).json(db.prepare('SELECT * FROM inspection_records WHERE id = ?').get(result.lastInsertRowid));
});

app.delete('/api/inspection-records/:id', authenticateToken, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM inspection_records WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

/* ═══════════════════════════════════════════
   INSPECTION TARGETS (أهداف عمال الفحص)
═══════════════════════════════════════════ */
app.get('/api/inspection-targets', authenticateToken, (req, res) => {
  const { date } = req.query;
  let sql = 'SELECT * FROM inspection_targets';
  const params = [];
  if (date) {
    sql += ' WHERE target_date = ?';
    params.push(date);
  }
  sql += ' ORDER BY id DESC';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/inspection-targets', authenticateToken, requireAdminOrInspectionCoordinator, (req, res) => {
  const { worker_name, target_boxes, target_date } = req.body;
  if (!worker_name || !target_boxes) return res.status(400).json({ error: 'الاسم والعدد مطلوبان' });
  const date = target_date || new Date().toISOString().slice(0, 10);
  try {
    const result = db.prepare(`
      INSERT INTO inspection_targets (worker_name, target_boxes, target_date, created_by)
      VALUES (?, ?, ?, ?)
    `).run(worker_name, parseInt(target_boxes), date, req.user.id);
    res.status(201).json(db.prepare('SELECT * FROM inspection_targets WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'تم تحديد هدف لهذا العامل في هذا اليوم مسبقاً' });
    }
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/inspection-targets/:id', authenticateToken, requireAdminOrInspectionCoordinator, (req, res) => {
  db.prepare('DELETE FROM inspection_targets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

/* ═══════════════════════════════════════════
   USERS
═══════════════════════════════════════════ */
app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT id, full_name, username, role, is_active, two_factor_enabled, created_at FROM users ORDER BY id').all());
});

app.post('/api/users', authenticateToken, requireAdmin, (req, res) => {
  const { full_name, username, password, role } = req.body;
  if (!full_name || !username || !password || !role) return res.status(400).json({ error: 'بيانات ناقصة' });
  if (!['admin','coordinator','host','inspection_coordinator'].includes(role)) return res.status(400).json({ error: 'دور غير صحيح' });
  try {
    const result = db.prepare('INSERT INTO users (full_name, username, password_hash, role, is_active) VALUES (?,?,?,?,1)')
      .run(full_name, username, bcrypt.hashSync(password, 10), role);
    res.status(201).json(db.prepare('SELECT id, full_name, username, role, is_active, created_at FROM users WHERE id = ?').get(result.lastInsertRowid));
  } catch { res.status(400).json({ error: 'اسم المستخدم موجود مسبقاً' }); }
});

app.put('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const { full_name, username, password, role, is_active } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
  if (role && !['admin','coordinator','host','inspection_coordinator'].includes(role)) return res.status(400).json({ error: 'دور غير صحيح' });
  const updates = []; const params = [];
  if (full_name)                   { updates.push('full_name = ?');     params.push(full_name); }
  if (username)                    { updates.push('username = ?');      params.push(username);  }
  if (typeof is_active !== 'undefined') { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
  if (role)                        { updates.push('role = ?');          params.push(role);      }
  if (password)                    { updates.push('password_hash = ?'); params.push(bcrypt.hashSync(password, 10)); }
  if (!updates.length) return res.status(400).json({ error: 'لا توجد بيانات للتحديث' });
  try {
    params.push(req.params.id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    res.json(db.prepare('SELECT id, full_name, username, role, is_active, two_factor_enabled, created_at FROM users WHERE id = ?').get(req.params.id));
  } catch { res.status(400).json({ error: 'اسم المستخدم موجود مسبقاً' }); }
});

app.post('/api/users/:id/two-factor', authenticateToken, requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
  const secret = generateSecret();
  db.prepare('UPDATE users SET two_factor_enabled=1, two_factor_secret=? WHERE id=?').run(secret, req.params.id);
  res.json({ two_factor_secret: secret });
});

app.delete('/api/users/:id/two-factor', authenticateToken, requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
  db.prepare('UPDATE users SET two_factor_enabled=0, two_factor_secret=NULL WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

/* ─── Generate current OTP code for a user (admin only) ─── */
app.get('/api/users/:id/current-otp', authenticateToken, requireAdmin, async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
  if (!user.two_factor_enabled || !user.two_factor_secret)
    return res.status(400).json({ error: '2FA غير مفعّلة لهذا المستخدم' });
  try {
    const code = await generate({ secret: user.two_factor_secret });
    const epoch      = Math.floor(Date.now() / 1000);
    const remaining  = 30 - (epoch % 30);
    res.json({ code, remaining });
  } catch {
    res.status(500).json({ error: 'فشل توليد الرمز' });
  }
});

app.delete('/api/users/:username', authenticateToken, requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
  if (user.role === 'admin') return res.status(403).json({ error: 'لا يمكن حذف المسؤول' });
  db.prepare('DELETE FROM users WHERE username = ?').run(req.params.username);
  res.json({ success: true });
});

/* ═══════════════════════════════════════════
   APPROVALS — نظام الاعتماد والموافقة
═══════════════════════════════════════════ */
app.get('/api/approvals/pending', authenticateToken, requireAdmin, (req, res) => {
  const usage = db.prepare(`
    SELECT cu.*, c.name as category_name, u.full_name as created_by_name 
    FROM category_usage cu 
    JOIN categories c ON cu.category_id = c.id 
    JOIN users u ON cu.created_by = u.id 
    WHERE cu.approved = 0
  `).all();

  const boxes = db.prepare(`
    SELECT ba.*, hw.full_name as worker_name, u.full_name as created_by_name 
    FROM box_allocations ba 
    JOIN hourly_workers hw ON ba.worker_id = hw.id 
    JOIN users u ON ba.created_by = u.id 
    WHERE ba.approved = 0
  `).all();

  const daily = db.prepare(`
    SELECT dwr.*, dw.full_name as worker_name, u.full_name as created_by_name 
    FROM daily_work_records dwr 
    JOIN daily_workers dw ON dwr.worker_id = dw.id 
    JOIN users u ON dwr.created_by = u.id 
    WHERE dwr.approved = 0
  `).all();

  res.json({ usage, boxes, daily });
});

app.post('/api/approvals/:type/:id/approve', authenticateToken, requireAdmin, (req, res) => {
  const { type, id } = req.params;
  if (type === 'usage') {
    db.prepare('UPDATE category_usage SET approved = 1 WHERE id = ?').run(id);
  } else if (type === 'boxes') {
    db.prepare('UPDATE box_allocations SET approved = 1 WHERE id = ?').run(id);
  } else if (type === 'daily') {
    db.prepare('UPDATE daily_work_records SET approved = 1 WHERE id = ?').run(id);
  } else {
    return res.status(400).json({ error: 'نوع غير مدعوم' });
  }
  res.json({ success: true });
});

app.delete('/api/approvals/:type/:id/reject', authenticateToken, requireAdmin, (req, res) => {
  const { type, id } = req.params;
  if (type === 'usage') {
    db.prepare('DELETE FROM category_usage WHERE id = ?').run(id);
  } else if (type === 'boxes') {
    db.prepare('DELETE FROM box_allocations WHERE id = ?').run(id);
  } else if (type === 'daily') {
    db.prepare('DELETE FROM daily_work_records WHERE id = ?').run(id);
  } else {
    return res.status(400).json({ error: 'نوع غير مدعوم' });
  }
  res.json({ success: true });
});

/* ═══════════════════════════════════════════
   ARCHIVE — الأرشيف اليومي
═══════════════════════════════════════════ */
app.get('/api/archive/daily', authenticateToken, requireAdmin, (req, res) => {
  const { date, session_id } = req.query;

  let hourlyFilter = '1=1', dailyFilter = '1=1';
  const hParams = [], dParams = [];

  if (date) {
    hourlyFilter = 'sr.shift_date = ?';   hParams.push(date);
    dailyFilter  = 'dwr.work_date = ? AND dwr.approved = 1';   dParams.push(date);
  } else if (session_id) {
    hourlyFilter = 'sr.session_id = ?';   hParams.push(session_id);
    dailyFilter  = 'dwr.session_id = ? AND dwr.approved = 1';  dParams.push(session_id);
  }

  const hourlyRecords = db.prepare(`
    SELECT sr.*, hw.full_name as worker_name, hw.notes as worker_notes
    FROM shift_records sr
    JOIN hourly_workers hw ON sr.worker_id = hw.id
    WHERE ${hourlyFilter}
    ORDER BY sr.shift_date DESC, sr.worker_id
  `).all(...hParams);

  const dailyRecords = db.prepare(`
    SELECT dwr.*, dw.full_name as worker_name, dw.daily_rate, dw.notes as worker_notes
    FROM daily_work_records dwr
    JOIN daily_workers dw ON dwr.worker_id = dw.id
    WHERE ${dailyFilter}
    ORDER BY dwr.work_date DESC, dwr.worker_id
  `).all(...dParams);

  const totalHourlyPay = hourlyRecords.reduce((s, r) => s + Number(r.total_pay || 0), 0);
  const totalDailyPay  = dailyRecords.reduce((s, r) => s + Number(r.total_pay || 0), 0);

  res.json({
    hourly_records: hourlyRecords,
    daily_records:  dailyRecords,
    totals: {
      hourly_pay:   Number(totalHourlyPay.toFixed(2)),
      daily_pay:    Number(totalDailyPay.toFixed(2)),
      grand_total:  Number((totalHourlyPay + totalDailyPay).toFixed(2)),
    },
  });
});

/* ═══════════════════════════════════════════
   REPORTS
═══════════════════════════════════════════ */
app.get('/api/reports/daily', authenticateToken, (req, res) => {
  const { date } = req.query;
  const usage   = db.prepare('SELECT COALESCE(SUM(total_price),0) as v FROM category_usage WHERE entry_date=? AND approved = 1').get(date);
  const shifts  = db.prepare('SELECT COALESCE(SUM(total_pay),0) as v FROM shift_records WHERE shift_date=?').get(date);
  const daily   = db.prepare('SELECT COALESCE(SUM(total_pay),0) as v FROM daily_work_records WHERE work_date=? AND approved = 1').get(date);
  res.json({
    date,
    total_usage:       Number(usage.v  || 0).toFixed(2),
    total_pay:         Number(shifts.v || 0).toFixed(2),
    total_daily_pay:   Number(daily.v  || 0).toFixed(2),
    grand_total_wages: Number(Number(shifts.v || 0) + Number(daily.v || 0)).toFixed(2),
  });
});

/* ─── Static SPA fallback ─── */
app.get('*', (req, res) => res.sendFile(indexFile));

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'خطأ داخلي في الخادم' });
});

export { app };
