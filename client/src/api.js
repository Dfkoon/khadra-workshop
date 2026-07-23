const API_BASE = import.meta.env.VITE_API_URL || 'https://khadra-workshop.onrender.com';

function getToken() {
  return localStorage.getItem('khadraToken') || '';
}

async function request(method, path, body = null, authToken = null) {
  const token = authToken || getToken();
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res  = await fetch(`${API_BASE}${path}`, opts);
  const text = await res.text();
  let data = {};

  if (text) {
    try { data = JSON.parse(text); }
    catch (err) { throw new Error(`Invalid JSON: ${err.message}`); }
  }

  if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
  return data;
}

export const api = {
  /* ── Auth ── */
  login:          (username, password) => request('POST', '/api/auth/login', { username, password }),
  me:             ()                   => request('GET',  '/api/auth/me'),
  verifyTwoFactor:(tempToken, code)    => request('POST', '/api/auth/verify-2fa', { code }, tempToken),

  /* ── Sessions ── */
  getSessions:     ()                    => request('GET',  '/api/sessions'),
  getActiveSession:()                    => request('GET',  '/api/sessions/active'),
  createSession:   (name, notes)         => request('POST', '/api/sessions',       { name, notes }),
  closeSession:    (id, notes)           => request('POST', `/api/sessions/${id}/close`, { notes }),
  updateSession:   (id, notes)           => request('PATCH',`/api/sessions/${id}`, { notes }),

  /* ── Categories ── */
  getCategories:  ()                          => request('GET',  '/api/categories'),
  createCategory: (name, unit_price, unit_type) => request('POST', '/api/categories', { name, unit_price, unit_type }),
  updateCategory: (id, name, unit_price)      => request('PUT',  `/api/categories/${id}`, { name, unit_price }),

  /* ── Category Usage ── */
  getUsage:     (date, session_id) => {
    const q = date ? `?date=${date}` : session_id ? `?session_id=${session_id}` : '';
    return request('GET', `/api/category-usage${q}`);
  },
  createUsage:  (category_id, worker_name, quantity, entry_date) =>
    request('POST', '/api/category-usage', { category_id, worker_name, quantity, entry_date }),
  deleteUsage:  (id) => request('DELETE', `/api/category-usage/${id}`),

  /* ── Hourly Workers ── */
  getWorkers:    ()                          => request('GET',  '/api/hourly-workers'),
  createWorker:  (full_name, hourly_rate, notes) => request('POST', '/api/hourly-workers', { full_name, hourly_rate, notes }),
  updateWorker:  (id, data)                  => request('PUT',  `/api/hourly-workers/${id}`, data),

  /* ── Shift Records ── */
  getShifts:    (date, session_id) => {
    const q = date ? `?date=${date}` : session_id ? `?session_id=${session_id}` : '';
    return request('GET', `/api/shift-records${q}`);
  },
  createShift:  (worker_id, shift_date, shift_start, shift_end) =>
    request('POST', '/api/shift-records', { worker_id, shift_date, shift_start, shift_end }),
  updateShift:  (id, data) => request('PUT', `/api/shift-records/${id}`, data),
  deleteShift:  (id) => request('DELETE', `/api/shift-records/${id}`),

  /* ── Box Allocations ── */
  getBoxAllocations:    (date, session_id) => {
    const q = date ? `?date=${date}` : session_id ? `?session_id=${session_id}` : '';
    return request('GET', `/api/box-allocations${q}`);
  },
  createBoxAllocation:  (worker_id, boxes_count, alloc_date) =>
    request('POST', '/api/box-allocations', { worker_id, boxes_count, alloc_date }),
  updateBoxAllocation:  (id, worker_id, boxes_count) =>
    request('PUT',  `/api/box-allocations/${id}`, { worker_id, boxes_count }),
  deleteBoxAllocation:  (id) => request('DELETE', `/api/box-allocations/${id}`),

  /* ── Daily Workers — عمال المياومة ── */
  getDailyWorkers:      ()               => request('GET',  '/api/daily-workers'),
  createDailyWorker:    (data)           => request('POST', '/api/daily-workers',     data),
  updateDailyWorker:    (id, data)       => request('PUT',  `/api/daily-workers/${id}`, data),
  deleteDailyWorker:    (id)             => request('DELETE',`/api/daily-workers/${id}`),

  /* ── Daily Work Records — سجلات المياومة ── */
  getDailyWorkRecords:  (date, session_id) => {
    const q = date ? `?date=${date}` : session_id ? `?session_id=${session_id}` : '';
    return request('GET', `/api/daily-work-records${q}`);
  },
  createDailyWorkRecord:(data)           => request('POST', '/api/daily-work-records', data),
  updateDailyWorkRecord:(id, data)       => request('PUT',  `/api/daily-work-records/${id}`, data),
  deleteDailyWorkRecord:(id)             => request('DELETE',`/api/daily-work-records/${id}`),

  /* ── Inspection Work Records — سجل أعداد عمال الفحص ── */
  getInspectionRecords: (date, session_id) => {
    const q = date ? `?date=${date}` : session_id ? `?session_id=${session_id}` : '';
    return request('GET', `/api/inspection-records${q}`);
  },
  createInspectionRecord: (data) => request('POST', '/api/inspection-records', data),
  deleteInspectionRecord: (id)   => request('DELETE', `/api/inspection-records/${id}`),

  /* ── Inspection Targets ── */
  getInspectionTargets: (date) => {
    const q = date ? `?date=${date}` : '';
    return request('GET', `/api/inspection-targets${q}`);
  },
  createInspectionTarget: (data) => request('POST', '/api/inspection-targets', data),
  deleteInspectionTarget: (id)   => request('DELETE', `/api/inspection-targets/${id}`),

  /* ── Attendance ── */
  getAttendance:    (date) => {
    const q = date ? `?date=${date}` : '';
    return request('GET', `/api/attendance${q}`);
  },
  createAttendance: (worker_name, attendance_date, status, hourly_rate) =>
    request('POST', '/api/attendance', { worker_name, attendance_date, status, hourly_rate }),
  deleteAttendance: (id) => request('DELETE', `/api/attendance/${id}`),

  /* ── Users ── */
  getUsers:          ()      => request('GET',    '/api/users'),
  createUser:        (full_name, username, password, role) =>
    request('POST',  '/api/users', { full_name, username, password, role }),
  updateUser:        (id, u) => request('PUT',    `/api/users/${id}`, u),
  deleteUser:        (username) => request('DELETE', `/api/users/${username}`),
  enableTwoFactor:   (id)    => request('POST',   `/api/users/${id}/two-factor`),
  disableTwoFactor:  (id)    => request('DELETE', `/api/users/${id}/two-factor`),
  getUserOTP:        (id)    => request('GET',    `/api/users/${id}/current-otp`),

  /* ── Approvals — نظام الاعتماد والموافقة ── */
  getPendingApprovals:()             => request('GET',    '/api/approvals/pending'),
  approveRecord:      (type, id)     => request('POST',   `/api/approvals/${type}/${id}/approve`),
  rejectRecord:       (type, id)     => request('DELETE', `/api/approvals/${type}/${id}/reject`),

  /* ── Archive ── */
  getArchiveDaily: (date, session_id) => {
    const q = date ? `?date=${date}` : session_id ? `?session_id=${session_id}` : '';
    return request('GET', `/api/archive/daily${q}`);
  },

  /* ── Reports ── */
  getDailyReport: (date) => request('GET', `/api/reports/daily?date=${date}`),
};
