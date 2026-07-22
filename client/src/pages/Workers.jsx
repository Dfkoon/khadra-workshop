import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import toast from 'react-hot-toast';

function fmt(n) { return Number(n || 0).toFixed(2); }

function formatTime12h(timeStr) {
    if (!timeStr) return '—';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    const h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? 'م' : 'ص';
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
}

function formatHoursMinutes(decimalHours) {
    if (!decimalHours) return '0 س';
    const h = Math.floor(decimalHours);
    const m = Math.round((decimalHours - h) * 60);
    if (h === 0) return `${m} د`;
    if (m === 0) return `${h} س`;
    return `${h} س و ${m} د`;
}

export default function Workers() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [workers, setWorkers] = useState([]);
    const [shifts,  setShifts]  = useState([]);

    const [wName, setWName] = useState('');
    const [wRate, setWRate] = useState('');
    const [wNotes, setWNotes] = useState('');

    const [shiftWid,   setShiftWid]   = useState('');
    const [shiftStart, setShiftStart] = useState(() => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    });
    const [shiftEnd,   setShiftEnd]   = useState(() => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    });

    const [actionType, setActionType] = useState('both'); // 'start', 'end', 'both'
    const [targetMode, setTargetMode] = useState('single'); // 'single', 'all', 'manual', 'exclude'
    const [selectedWorkerIds, setSelectedWorkerIds] = useState([]);

    // Edit states for worker profile
    const [editingWorkerId, setEditingWorkerId] = useState(null);
    const [editWName, setEditWName] = useState('');
    const [editWRate, setEditWRate] = useState('');
    const [editWNotes, setEditWNotes] = useState('');

    const load = useCallback(async () => {
        try {
            const [w, s, a] = await Promise.all([api.getWorkers(), api.getShifts(), api.getAttendance()]);
            
            const today = new Date().toISOString().slice(0, 10);
            const todayHourly = (a || []).filter(r => r.attendance_date?.slice(0, 10) === today && (r.status === 'hourly' || r.status === 'present')).map(r => r.worker_name);
            const activeWorkers = (w || []).filter(worker => todayHourly.includes(worker.full_name));

            setWorkers(activeWorkers);
            setShifts(s || []);
            if (activeWorkers.length && !shiftWid) setShiftWid(String(activeWorkers[0].id));
        } catch (e) { toast.error('فشل تحميل البيانات'); }
    }, [shiftWid]);

    useEffect(() => { load(); }, [load]);

    async function addWorker() {
        if (!wName || !wRate) { toast.error('أدخل اسم العامل وسعر الساعة'); return; }
        try {
            await api.createWorker(wName, parseFloat(wRate), wNotes);
            toast.success('تمت إضافة العامل بنجاح');
            setWName(''); setWRate(''); setWNotes('');
            load();
        } catch (e) { toast.error(e.message); }
    }

    async function handleRegisterShifts() {
        if (actionType !== 'end' && !shiftStart) {
            toast.error('الرجاء تحديد وقت البدء');
            return;
        }
        if (actionType !== 'start' && !shiftEnd) {
            toast.error('الرجاء تحديد وقت الانتهاء');
            return;
        }

        let targetIds = [];
        if (targetMode === 'single') {
            if (!shiftWid) { toast.error('الرجاء اختيار العامل'); return; }
            targetIds = [parseInt(shiftWid)];
        } else if (targetMode === 'all') {
            targetIds = workers.map(w => w.id);
        } else if (targetMode === 'manual') {
            if (selectedWorkerIds.length === 0) { toast.error('الرجاء اختيار عامل واحد على الأقل'); return; }
            targetIds = selectedWorkerIds;
        } else if (targetMode === 'exclude') {
            targetIds = workers.filter(w => !selectedWorkerIds.includes(w.id)).map(w => w.id);
        }

        if (targetIds.length === 0) {
            toast.error('لم يتم تحديد أي عمال للتسجيل');
            return;
        }

        const date = new Date().toISOString().slice(0, 10);
        let successCount = 0;
        let errorCount = 0;

        try {
            if (actionType === 'start' || actionType === 'both') {
                await Promise.all(targetIds.map(async (wid) => {
                    try {
                        const endVal = actionType === 'both' ? shiftEnd : '';
                        await api.createShift(wid, date, shiftStart, endVal);
                        successCount++;
                    } catch {
                        errorCount++;
                    }
                }));
            } else if (actionType === 'end') {
                const todayShifts = await api.getShifts(date);
                await Promise.all(targetIds.map(async (wid) => {
                    const activeShift = todayShifts.find(s => s.worker_id === wid && (!s.shift_end || s.shift_end === ''));
                    if (activeShift) {
                        try {
                            await api.updateShift(activeShift.id, { shift_end: shiftEnd });
                            successCount++;
                        } catch {
                            errorCount++;
                        }
                    } else {
                        errorCount++;
                    }
                }));
            }

            if (successCount > 0) {
                toast.success(`تم تسجيل الدوام بنجاح لـ ${successCount} عامل`);
            }
            if (errorCount > 0) {
                toast.error(`لم يتم تسجيل الدوام لـ ${errorCount} عامل (تأكد من عدم وجود وردية مفتوحة لهم بالفعل)`);
            }

            setShiftStart('');
            setShiftEnd('');
            setSelectedWorkerIds([]);
            load();
        } catch {
            toast.error('حدث خطأ أثناء حفظ السجلات');
        }
    }

    async function deleteShift(id) {
        if (!window.confirm('تأكيد حذف سجل الدوام؟')) return;
        try { await api.deleteShift(id); toast.success('تم الحذف'); load(); }
        catch (e) { toast.error(e.message); }
    }

    async function startEditWorker(w) {
        setEditingWorkerId(w.id);
        setEditWName(w.full_name);
        setEditWRate(String(w.hourly_rate));
        setEditWNotes(w.notes || '');
    }

    async function saveWorkerEdit() {
        if (!editWName || !editWRate) {
            toast.error('الاسم والأجر مطلوبان');
            return;
        }
        try {
            await api.updateWorker(editingWorkerId, {
                full_name: editWName,
                hourly_rate: parseFloat(editWRate),
                notes: editWNotes
            });
            toast.success('تم تحديث بيانات العامل');
            setEditingWorkerId(null);
            load();
        } catch (e) {
            toast.error(e.message);
        }
    }

    return (
        <>
            <div className="page-header">
                <h2 className="page-title">عمال الساعة</h2>
                <p className="page-sub">تحديد سعر الساعة، ثم تسجيل وقت الدوام لحساب الأجر تلقائياً</p>
            </div>

            {isAdmin && (
                <div className="section">
                    <h3>إضافة عامل ساعة جديد</h3>
                    <div className="form-row">
                        <div className="field">
                            <label>اسم العامل الكامل</label>
                            <input
                                value={wName}
                                onChange={e => setWName(e.target.value)}
                                placeholder="اسم العامل"
                                onKeyDown={e => e.key === 'Enter' && addWorker()}
                            />
                        </div>
                        <div className="field">
                            <label>سعر الساعة (د.أ)</label>
                            <input
                                type="number" step="0.01" min="0"
                                value={wRate}
                                onChange={e => setWRate(e.target.value)}
                                placeholder="0.00"
                                onKeyDown={e => e.key === 'Enter' && addWorker()}
                            />
                        </div>
                        <div className="field" style={{ flex: 2 }}>
                            <label>ملاحظات العامل</label>
                            <input
                                value={wNotes}
                                onChange={e => setWNotes(e.target.value)}
                                placeholder="ملاحظات المسؤولة عن هذا العامل"
                                onKeyDown={e => e.key === 'Enter' && addWorker()}
                            />
                        </div>
                        <button className="btn btn-success" style={{ width: 'auto' }} onClick={addWorker}>
                            إضافة عامل
                        </button>
                    </div>

                    {workers.length > 0 && (
                        <div style={{ marginTop: '16px' }}>
                            <h4 style={{ marginBottom: '8px', fontSize: '14px', color: 'var(--ink-soft)' }}>قائمة عمال الساعة الحاليين:</h4>
                            <div className="table-wrapper">
                                <table style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)' }}>
                                    <thead>
                                        <tr>
                                            <th>الاسم</th>
                                            <th>سعر الساعة</th>
                                            <th>ملاحظات العامل</th>
                                            <th>الإجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {workers.map(w => (
                                            <tr key={w.id}>
                                                <td>
                                                    {editingWorkerId === w.id ? (
                                                        <input
                                                            value={editWName}
                                                            onChange={e => setEditWName(e.target.value)}
                                                            className="field"
                                                            style={{ padding: '4px 8px', margin: 0 }}
                                                        />
                                                    ) : (
                                                        <strong>{w.full_name}</strong>
                                                    )}
                                                </td>
                                                <td>
                                                    {editingWorkerId === w.id ? (
                                                        <input
                                                            type="number" step="0.01"
                                                            value={editWRate}
                                                            onChange={e => setEditWRate(e.target.value)}
                                                            style={{ padding: '4px 8px', margin: 0, width: '80px' }}
                                                        />
                                                    ) : (
                                                        `${fmt(w.hourly_rate)} د.أ`
                                                    )}
                                                </td>
                                                <td>
                                                    {editingWorkerId === w.id ? (
                                                        <input
                                                            value={editWNotes}
                                                            onChange={e => setEditWNotes(e.target.value)}
                                                            style={{ padding: '4px 8px', margin: 0, width: '100%' }}
                                                        />
                                                    ) : (
                                                        <span style={{ color: 'var(--ink-soft)' }}>{w.notes || 'لا يوجد ملاحظات'}</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {editingWorkerId === w.id ? (
                                                        <div className="action-btns">
                                                            <button className="btn-edit" onClick={saveWorkerEdit}>حفظ</button>
                                                            <button className="btn-del" onClick={() => setEditingWorkerId(null)}>إلغاء</button>
                                                        </div>
                                                    ) : (
                                                        <div className="action-btns">
                                                            <button className="btn-edit" onClick={() => startEditWorker(w)}>تعديل</button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="section">
                <h3>تسجيل دوام عمال الساعة</h3>
                
                <div className="shift-tabs">
                    <button
                        type="button"
                        className={`btn ${actionType === 'both' ? 'btn-primary' : 'btn-outline'}`}
                        style={{ padding: '8px 12px', fontSize: '13px', borderRadius: 'var(--radius-md)' }}
                        onClick={() => setActionType('both')}
                    >
                        تسجيل كامل (بدء وانتهاء)
                    </button>
                    <button
                        type="button"
                        className={`btn ${actionType === 'start' ? 'btn-primary' : 'btn-outline'}`}
                        style={{ padding: '8px 12px', fontSize: '13px', borderRadius: 'var(--radius-md)' }}
                        onClick={() => setActionType('start')}
                    >
                        تسجيل بدء الدوام فقط
                    </button>
                    <button
                        type="button"
                        className={`btn ${actionType === 'end' ? 'btn-primary' : 'btn-outline'}`}
                        style={{ padding: '8px 12px', fontSize: '13px', borderRadius: 'var(--radius-md)' }}
                        onClick={() => setActionType('end')}
                    >
                        تسجيل انتهاء الدوام (لاحقاً)
                    </button>
                </div>

                <div className="shift-form-grid">
                    <div className="field">
                        <label>تحديد العمال</label>
                        <select value={targetMode} onChange={e => {
                            setTargetMode(e.target.value);
                            setSelectedWorkerIds([]);
                        }}>
                            <option value="single">عامل محدد</option>
                            <option value="all">جميع العمال</option>
                            <option value="manual">تحديد يدوي (مجموعة)</option>
                            <option value="exclude">الجميع باستثناء (مجموعة)</option>
                        </select>
                    </div>

                    {targetMode === 'single' && (
                        <div className="field">
                            <label>العامل</label>
                            <select value={shiftWid} onChange={e => setShiftWid(e.target.value)}>
                                {workers.map(w => (
                                    <option key={w.id} value={w.id}>
                                        {w.full_name} ({fmt(w.hourly_rate)} د.أ/ساعة)
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="shift-time-group">
                        {actionType !== 'end' && (
                            <div className="field">
                                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>وقت البدء</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const now = new Date();
                                            setShiftStart(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--leaf)',
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            padding: 0
                                        }}
                                    >
                                        الوقت الحالي
                                    </button>
                                </label>
                                <input type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)} />
                            </div>
                        )}

                        {actionType !== 'start' && (
                            <div className="field">
                                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>وقت الانتهاء</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const now = new Date();
                                            setShiftEnd(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--leaf)',
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            padding: 0
                                        }}
                                    >
                                        الوقت الحالي
                                    </button>
                                </label>
                                <input type="time" value={shiftEnd} onChange={e => setShiftEnd(e.target.value)} />
                            </div>
                        )}
                    </div>

                    <div className="field btn-submit-wrapper" style={{ margin: 0 }}>
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleRegisterShifts}>
                            {actionType === 'both' ? 'تسجيل الدوام كامل' : actionType === 'start' ? 'تسجيل بدء الدوام' : 'تسجيل انتهاء الدوام'}
                        </button>
                    </div>
                </div>

                {(targetMode === 'manual' || targetMode === 'exclude') && (
                    <div style={{
                        marginTop: '16px',
                        background: 'var(--surface-2)',
                        padding: '16px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)'
                    }}>
                        <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '10px', color: 'var(--ink-soft)' }}>
                            {targetMode === 'manual' ? 'اختر العمال المطلوبين للتسجيل:' : 'اختر العمال المستثنين من التسجيل:'}
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                            gap: '10px'
                        }}>
                            {workers.map(w => {
                                const isChecked = selectedWorkerIds.includes(w.id);
                                return (
                                    <label key={w.id} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '8px 12px',
                                        background: isChecked ? 'var(--paper)' : 'transparent',
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid',
                                        borderColor: isChecked ? 'var(--primary-light)' : 'transparent',
                                        cursor: 'pointer',
                                        userSelect: 'none'
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {
                                                if (isChecked) {
                                                    setSelectedWorkerIds(prev => prev.filter(id => id !== w.id));
                                                } else {
                                                    setSelectedWorkerIds(prev => [...prev, w.id]);
                                                }
                                            }}
                                        />
                                        <span style={{ fontSize: '13px', fontWeight: isChecked ? '700' : 'normal' }}>
                                            {w.full_name}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <div className="section">
                <h3>سجل الدوام</h3>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>العامل</th>
                                <th>وقت البدء</th>
                                <th>وقت الانتهاء</th>
                                <th>الساعات</th>
                                <th>سعر الساعة</th>
                                <th>الإجمالي (د.أ)</th>
                                {isAdmin && <th>الإجراءات</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {shifts.length === 0 ? (
                                <tr className="empty-row">
                                    <td colSpan={isAdmin ? 7 : 6}>
                                        <div className="empty-state">
                                            <div className="empty-text">لا توجد سجلات دوام بعد</div>
                                        </div>
                                    </td>
                                </tr>
                             ) : shifts.map(r => {
                                const w = workers.find(x => x.id === r.worker_id);
                                const isOpenShift = !r.shift_end || r.shift_end === '';
                                return (
                                    <tr key={r.id}>
                                        <td><strong>{w?.full_name || r.worker_name || 'عامل محذوف'}</strong></td>
                                        <td>
                                            <span className="badge badge-grey">{formatTime12h(r.shift_start)}</span>
                                        </td>
                                        <td>
                                            {isOpenShift ? (
                                                <span className="badge badge-amber">قيد العمل</span>
                                            ) : (
                                                <span className="badge badge-grey">{formatTime12h(r.shift_end)}</span>
                                            )}
                                        </td>
                                        <td>
                                            {isOpenShift ? (
                                                <span style={{ color: 'var(--ink-muted)' }}>—</span>
                                            ) : (
                                                <span className="badge badge-blue">{formatHoursMinutes(r.hours_worked)}</span>
                                            )}
                                        </td>
                                        <td style={{ color: 'var(--ink-soft)' }}>{fmt(r.hourly_rate_snapshot)}</td>
                                        <td className="total-cell">
                                            {isOpenShift ? (
                                                <span style={{ color: 'var(--ink-muted)' }}>—</span>
                                            ) : (
                                                fmt(r.total_pay)
                                            )}
                                        </td>
                                        {isAdmin && (
                                            <td>
                                                <div className="action-btns">
                                                    <button className="btn-del" onClick={() => deleteShift(r.id)}>
                                                        حذف
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
