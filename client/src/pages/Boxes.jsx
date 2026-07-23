import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import toast from 'react-hot-toast';

function fmt(n) { return Number(n || 0).toFixed(2); }

function badgeClass(color) {
    const map = {
        'red': 'badge-red', 'blue': 'badge-blue', 'green': 'badge-green',
        'amber': 'badge-amber', 'purple': 'badge-purple', 'grey': 'badge-grey'
    };
    return map[color] || 'badge-grey';
}

export default function Boxes() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const canModify = isAdmin || user?.role === 'coordinator' || user?.role === 'host';

    // Tabs: 'records' or 'manage-workers'
    const [activeTab, setActiveTab] = useState('records');

    // Count workers list
    const [workers, setWorkers] = useState([]);
    // Daily work records list
    const [records, setRecords] = useState([]);

    // Recording form state
    const [workerId, setWorkerId] = useState('');
    const [boxesCount, setBoxesCount] = useState('');
    const [notes, setNotes] = useState('');
    const [editRecordId, setEditRecordId] = useState(null);

    // Category box registration state
    const [categories, setCategories] = useState([]);
    const [catWorkers, setCatWorkers] = useState([]);
    const [useCat, setUseCat] = useState('');
    const [useWorker, setUseWorker] = useState('');
    const [useQty, setUseQty] = useState('');
    const [allowHourlyBoxes, setAllowHourlyBoxes] = useState(() => {
        return localStorage.getItem('allowHourlyBoxesForCoordinators') === 'true';
    });

    // Usage (سجل البكس) state
    const [usage, setUsage] = useState([]);

    // Inspection records & targets state
    const [inspRecords, setInspRecords] = useState([]);
    const [inspTargets, setInspTargets] = useState([]);
    const [inspWorkerName, setInspWorkerName] = useState('');
    const [inspBoxesCount, setInspBoxesCount] = useState('');
    const [inspStartTime, setInspStartTime] = useState('');
    const [inspDate, setInspDate] = useState(new Date().toISOString().slice(0, 10));
    
    // Admin only Target assignment state
    const [targetWorkerName, setTargetWorkerName] = useState('');
    const [targetBoxesCount, setTargetBoxesCount] = useState('');

    function toggleAllowHourlyBoxes() {
        const newValue = !allowHourlyBoxes;
        setAllowHourlyBoxes(newValue);
        localStorage.setItem('allowHourlyBoxesForCoordinators', String(newValue));
        toast.success(newValue ? 'تم تفعيل ظهور قسم أعداد عمال الساعة للمنسقين' : 'تم تخصيص هذا القسم للمسؤولة فقط');
    }

    // Worker management state
    const [newWorkerName, setNewWorkerName] = useState('');
    const [newWorkerRate, setNewWorkerRate] = useState('');
    const [newWorkerNotes, setNewWorkerNotes] = useState('');
    const [editingWorkerId, setEditingWorkerId] = useState(null);
    const [editWorkerName, setEditWorkerName] = useState('');
    const [editWorkerRate, setEditWorkerRate] = useState('');
    const [editWorkerNotes, setEditWorkerNotes] = useState('');

    const load = useCallback(async () => {
        try {
            const [w, r, c, hw, insp, u, t] = await Promise.all([
                api.getDailyWorkers(),
                api.getDailyWorkRecords(),
                api.getCategories(),
                api.getWorkers(),
                api.getInspectionRecords(),
                api.getUsage(),
                api.getInspectionTargets()
            ]);
            setWorkers(w || []);
            setRecords(r || []);
            setCategories(c || []);
            setCatWorkers(hw || []);
            setInspRecords(insp || []);
            setUsage(u || []);
            setInspTargets(t || []);
            if (w?.length && !workerId) setWorkerId(String(w[0].id));
            if (c?.length && !useCat) setUseCat(String(c[0].id));
        } catch (e) {
            toast.error('فشل تحميل البيانات');
        }
    }, [workerId, useCat]);

    useEffect(() => {
        load();
    }, [load]);

    // ─── Record submission ───
    async function submitRecord() {
        if (!workerId || !boxesCount) {
            toast.error('الرجاء اختيار العامل وتحديد عدد الأعداد');
            return;
        }
        const date = new Date().toISOString().slice(0, 10);
        try {
            if (editRecordId) {
                await api.updateDailyWorkRecord(editRecordId, {
                    boxes_count: parseInt(boxesCount),
                    notes: notes
                });
                toast.success('تم تحديث السجل بنجاح');
                setEditRecordId(null);
            } else {
                await api.createDailyWorkRecord({
                    worker_id: parseInt(workerId),
                    boxes_count: parseInt(boxesCount),
                    work_date: date,
                    notes: notes
                });
                toast.success('تم حفظ السجل بنجاح وسيظهر بعد موافقة المسؤولة');
            }
            setBoxesCount('');
            setNotes('');
            load();
        } catch (e) {
            toast.error(e.message);
        }
    }

    async function addCategoryUsage() {
        if (!useCat || !useWorker || !useQty) {
            toast.error('أدخل كل الحقول لتسجيل البكس');
            return;
        }
        const date = new Date().toISOString().slice(0, 10);
        try {
            await api.createUsage(parseInt(useCat), useWorker, parseFloat(useQty), date);
            toast.success('تم تسجيل البكس بنجاح وسيظهر بعد موافقة المسؤولة');
            setUseWorker('');
            setUseQty('');
            load();
        } catch (e) {
            toast.error(e.message);
        }
    }

    async function deleteUsage(id) {
        if (!window.confirm('تأكيد الحذف؟')) return;
        try {
            await api.deleteUsage(id);
            toast.success('تم حذف التسجيل');
            load();
        } catch (e) {
            toast.error(e.message);
        }
    }

    async function deleteRecord(id) {
        if (!window.confirm('تأكيد حذف هذا السجل؟')) return;
        try {
            await api.deleteDailyWorkRecord(id);
            toast.success('تم الحذف');
            load();
        } catch (e) {
            toast.error(e.message);
        }
    }

    function startEditRecord(rec) {
        setEditRecordId(rec.id);
        setWorkerId(String(rec.worker_id));
        setBoxesCount(String(rec.boxes_count));
        setNotes(rec.notes || '');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ─── Inspection Records Management ───
    async function submitInspectionRecord() {
        if (!inspWorkerName || !inspBoxesCount) {
            toast.error('أدخل اسم العامل وعدد أعداد الفحص');
            return;
        }
        try {
            await api.createInspectionRecord({
                worker_name: inspWorkerName,
                boxes_count: parseInt(inspBoxesCount),
                work_date: inspDate || new Date().toISOString().slice(0, 10),
                start_time: inspStartTime || null
            });
            toast.success('تم تسجيل أعداد الفحص بنجاح');
            // setInspWorkerName(''); -- Don't clear worker name so it's easier to enter multiple
            setInspBoxesCount('');
            setInspStartTime('');
            load();
        } catch (e) {
            toast.error(e.message);
        }
    }

    async function deleteInspectionRecord(id) {
        if (!window.confirm('تأكيد حذف سجل الفحص هذا؟')) return;
        try {
            await api.deleteInspectionRecord(id);
            toast.success('تم الحذف');
            load();
        } catch (e) {
            toast.error(e.message);
        }
    }

    async function submitInspectionTarget() {
        if (!targetWorkerName || !targetBoxesCount) {
            toast.error('أدخل اسم العامل والعدد المطلوب');
            return;
        }
        try {
            await api.createInspectionTarget({
                worker_name: targetWorkerName,
                target_boxes: parseInt(targetBoxesCount),
                target_date: new Date().toISOString().slice(0, 10)
            });
            toast.success('تم تحديد الهدف بنجاح');
            setTargetWorkerName('');
            setTargetBoxesCount('');
            load();
        } catch (e) {
            toast.error(e.message);
        }
    }

    async function deleteInspectionTarget(id) {
        if (!window.confirm('تأكيد حذف الهدف؟')) return;
        try {
            await api.deleteInspectionTarget(id);
            toast.success('تم الحذف');
            load();
        } catch (e) {
            toast.error(e.message);
        }
    }

    // ─── Worker Management ───
    async function handleAddWorker() {
        if (!newWorkerName || !newWorkerRate) {
            toast.error('الرجاء إدخال الاسم والأجر اليومي');
            return;
        }
        try {
            await api.createDailyWorker({
                full_name: newWorkerName,
                daily_rate: parseFloat(newWorkerRate),
                notes: newWorkerNotes
            });
            toast.success('تم إضافة العامل بنجاح');
            setNewWorkerName('');
            setNewWorkerRate('');
            setNewWorkerNotes('');
            load();
        } catch (e) {
            toast.error(e.message);
        }
    }

    async function handleSaveWorkerEdit() {
        if (!editWorkerName || !editWorkerRate) {
            toast.error('الاسم والأجر مطلوبان');
            return;
        }
        try {
            await api.updateDailyWorker(editingWorkerId, {
                full_name: editWorkerName,
                daily_rate: parseFloat(editWorkerRate),
                notes: editWorkerNotes
            });
            toast.success('تم تحديث بيانات العامل');
            setEditingWorkerId(null);
            load();
        } catch (e) {
            toast.error(e.message);
        }
    }

    async function handleDeleteWorker(id) {
        if (!window.confirm('هل تريد حذف هذا العامل؟ سيؤدي ذلك لإخفائه من القائمة.')) return;
        try {
            await api.deleteDailyWorker(id);
            toast.success('تم حذف العامل');
            load();
        } catch (e) {
            toast.error(e.message);
        }
    }

    function startEditWorker(w) {
        setEditingWorkerId(w.id);
        setEditWorkerName(w.full_name);
        setEditWorkerRate(String(w.daily_rate));
        setEditWorkerNotes(w.notes || '');
    }

    const totalBoxes = records.reduce((s, r) => s + (r.boxes_count || 0), 0);

    return (
        <>
            <div className="page-header">
                <h2 className="page-title">تسجيل الأعداد</h2>
                <p className="page-sub">تسجيل وتتبع عدد الأعداد (البكس) لعمال الأعداد يومياً</p>
            </div>

            {/* Navigation Tabs */}
            <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '20px',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '10px'
            }}>
                <button
                    type="button"
                    className={`btn ${activeTab === 'records' ? 'btn-primary' : 'btn-outline'}`}
                    style={{ padding: '8px 16px', fontSize: '13px', borderRadius: 'var(--radius-md)', width: 'auto' }}
                    onClick={() => setActiveTab('records')}
                >
                    تسجيل الأعداد اليومية
                </button>
                {isAdmin && (
                    <button
                        type="button"
                        className={`btn ${activeTab === 'manage-workers' ? 'btn-primary' : 'btn-outline'}`}
                        style={{ padding: '8px 16px', fontSize: '13px', borderRadius: 'var(--radius-md)', width: 'auto' }}
                        onClick={() => setActiveTab('manage-workers')}
                    >
                        إدارة عمال الأعداد
                    </button>
                )}
            </div>

            {activeTab === 'records' ? (
                <>
                    {/* Summary stats */}
                    {records.length > 0 && (
                        <div className="stat-row" style={{ marginBottom: '20px' }}>
                            <div className="stat-card carrot">
                                <div className="label">إجمالي الأعداد المسجّلة</div>
                                <div className="value">{totalBoxes}</div>
                                <div className="stat-unit">عدد (بكسة)</div>
                            </div>
                            <div className="stat-card leaf">
                                <div className="label">عدد السجلات</div>
                                <div className="value">{records.length}</div>
                                <div className="stat-unit">سجل</div>
                            </div>
                        </div>
                    )}

                    {/* Recording Form */}
                    {canModify && (
                        <div className="section">
                            <h3>{editRecordId ? 'تعديل السجل' : 'تسجيل أعداد جديدة'}</h3>
                            <div className="boxes-form-grid">
                                <div className="field">
                                    <label>العامل</label>
                                    <select value={workerId} onChange={e => setWorkerId(e.target.value)}>
                                        <option value="">اختر عامل الأعداد...</option>
                                        {workers.map(w => (
                                            <option key={w.id} value={w.id}>
                                                {w.full_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="field">
                                    <label>العدد (البكس)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={boxesCount}
                                        onChange={e => setBoxesCount(e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="field field-full">
                                    <label>ملاحظات</label>
                                    <input
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        placeholder="ملاحظات اختيارية..."
                                    />
                                </div>
                                <div className="field btn-submit-wrapper" style={{ margin: 0 }}>
                                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={submitRecord}>
                                        {editRecordId ? 'حفظ التعديل' : 'تسجيل العدد'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Hourly Workers Box Recording Form */}
                    {(isAdmin || allowHourlyBoxes) && (
                        <div className="section" style={{ borderRight: '4px solid var(--carrot)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                                <h3 style={{ margin: 0 }}>تسجيل أعداد لعمال الساعة</h3>
                                {isAdmin && (
                                    <button
                                        type="button"
                                        className={`btn ${allowHourlyBoxes ? 'btn-success' : 'btn-outline'} btn-sm`}
                                        onClick={toggleAllowHourlyBoxes}
                                        style={{ fontSize: '12px' }}
                                    >
                                        {allowHourlyBoxes ? 'إظهار للمنسقين (مفعل)' : 'إخفاء عن المنسقين (معطل)'}
                                    </button>
                                )}
                            </div>
                            <div className="boxes-form-grid">
                                <div className="field">
                                    <label>اسم العامل</label>
                                    <select value={useWorker} onChange={e => setUseWorker(e.target.value)}>
                                        <option value="">اختر العامل...</option>
                                        {catWorkers.map(w => (
                                            <option key={w.id} value={w.full_name}>
                                                {w.full_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="field">
                                    <label>الصنف</label>
                                    <select value={useCat} onChange={e => setUseCat(e.target.value)}>
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.name} ({fmt(c.unit_price)} د.أ/بكس)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="field">
                                    <label>عدد البكس</label>
                                    <input
                                        type="number" step="1" min="1"
                                        value={useQty}
                                        onChange={e => setUseQty(e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="field btn-submit-wrapper" style={{ margin: 0 }}>
                                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={addCategoryUsage}>
                                        تسجيل
                                    </button>
                                </div>
                            </div>

                            {/* سجل البكس Table */}
                            <div style={{ marginTop: '24px' }}>
                                <h4 style={{ marginBottom: '16px', color: 'var(--ink)' }}>سجل البكس</h4>
                                <div className="table-wrapper">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>العامل</th>
                                                <th>الصنف</th>
                                                <th>عدد البكس</th>
                                                <th>الإجمالي (د.أ)</th>
                                                <th>التاريخ</th>
                                                {isAdmin && <th>الإجراءات</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {usage.length === 0 ? (
                                                <tr className="empty-row">
                                                    <td colSpan={isAdmin ? 6 : 5}>
                                                        <div className="empty-state">
                                                            <div className="empty-text">لا توجد سجلات بعد</div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : usage.map(u => {
                                                const cat = categories.find(c => c.id === u.category_id);
                                                const totalVal = u.total_price || (Number(u.quantity) * Number(cat?.unit_price || 0));
                                                const entryDate = u.entry_date
                                                    ? new Date(u.entry_date).toLocaleDateString('ar-EG')
                                                    : '';
                                                return (
                                                    <tr key={u.id}>
                                                        <td><strong>{u.worker_name}</strong></td>
                                                        <td>
                                                            <span className={`badge ${badgeClass(cat?.color)}`}>
                                                                {cat?.name || 'صنف محذوف'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className="badge badge-grey">{u.quantity}</span>
                                                        </td>
                                                        <td className="total-cell">{fmt(totalVal)}</td>
                                                        <td style={{ color: 'var(--ink-soft)' }}>{entryDate}</td>
                                                        {isAdmin && (
                                                            <td>
                                                                <div className="action-btns">
                                                                    <button className="btn-del" onClick={() => deleteUsage(u.id)}>
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
                        </div>
                    )}
                    
                    {/* Inspection Workers Form & Table */}
                    {(isAdmin || user?.role === 'inspection_coordinator' || user?.role === 'coordinator') && (
                        <>
                            {(isAdmin || user?.role === 'inspection_coordinator') && (
                                <div className="section" style={{ borderRight: '4px solid var(--primary)' }}>
                                    <h3>تحديد العدد المطلوب</h3>
                                    <div className="boxes-form-grid">
                                        <div className="field">
                                            <label>اسم العامل</label>
                                            <input
                                                value={targetWorkerName}
                                                onChange={e => setTargetWorkerName(e.target.value)}
                                                placeholder="أدخل أو ابحث عن اسم العامل"
                                                list="workers-list"
                                            />
                                            <datalist id="workers-list">
                                                {catWorkers.map(w => (
                                                    <option key={w.id} value={w.full_name} />
                                                ))}
                                            </datalist>
                                        </div>
                                        <div className="field">
                                            <label>العدد المطلوب تحقيقه (بكس)</label>
                                            <input
                                                type="number" min="1" step="1"
                                                value={targetBoxesCount}
                                                onChange={e => setTargetBoxesCount(e.target.value)}
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="field btn-submit-wrapper" style={{ margin: 0 }}>
                                            <button className="btn btn-primary" style={{ width: '100%' }} onClick={submitInspectionTarget}>
                                                حفظ الهدف
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(isAdmin || user?.role === 'inspection_coordinator') && (
                                <div className="section" style={{ borderRight: '4px solid var(--leaf)' }}>
                                    <h3>تسجيل إنجاز الفحص</h3>
                                    <div className="boxes-form-grid">
                                        <div className="field">
                                            <label>اسم العامل</label>
                                            <select
                                                value={inspWorkerName}
                                                onChange={e => setInspWorkerName(e.target.value)}
                                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }}
                                            >
                                                <option value="">-- اختر اسم العامل --</option>
                                                {inspectionTargets.map(t => (
                                                    <option key={t.id} value={t.worker_name}>
                                                        {t.worker_name} (الهدف: {t.target_boxes} بكس)
                                                    </option>
                                                ))}
                                                {catWorkers.filter(w => !inspectionTargets.some(t => t.worker_name === w.full_name)).length > 0 && (
                                                    <optgroup label="باقي العمال">
                                                        {catWorkers.filter(w => !inspectionTargets.some(t => t.worker_name === w.full_name)).map(w => (
                                                            <option key={w.id} value={w.full_name}>{w.full_name}</option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                            </select>
                                        </div>
                                        <div className="field">
                                            <label>العدد (البكس)</label>
                                            <input
                                                type="number" min="1" step="1"
                                                value={inspBoxesCount}
                                                onChange={e => setInspBoxesCount(e.target.value)}
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="field btn-submit-wrapper" style={{ margin: 0 }}>
                                            <button className="btn btn-success" style={{ width: '100%' }} onClick={submitInspectionRecord}>
                                                تسجيل فحص
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="section">
                                <h3>متابعة إنجاز عمال الفحص</h3>
                                <div className="table-wrapper">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>العامل</th>
                                                <th>الهدف المطلوب</th>
                                                <th>المُنجز</th>
                                                <th>المتبقي</th>
                                                <th>الحالة / التقدم</th>
                                                {isAdmin && <th>الإجراءات</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Array.from(new Set([...inspTargets.map(t => t.worker_name), ...inspRecords.map(r => r.worker_name)])).length === 0 ? (
                                                <tr className="empty-row">
                                                    <td colSpan={isAdmin ? 6 : 5}>
                                                        <div className="empty-state">
                                                            <div className="empty-text">لا توجد أهداف أو سجلات أعداد فحص بعد</div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : Array.from(new Set([...inspTargets.map(t => t.worker_name), ...inspRecords.map(r => r.worker_name)])).map(workerName => {
                                                const targetRow = inspTargets.find(t => t.worker_name === workerName);
                                                const target = targetRow ? targetRow.target_boxes : 0;
                                                const completed = inspRecords.filter(r => r.worker_name === workerName).reduce((sum, r) => sum + r.boxes_count, 0);
                                                const remaining = Math.max(0, target - completed);
                                                const pct = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 100;
                                                const isDone = target > 0 && completed >= target;
                                                
                                                return (
                                                    <tr key={workerName} style={isDone ? { backgroundColor: 'rgba(34, 197, 94, 0.05)' } : {}}>
                                                        <td><strong>{workerName}</strong></td>
                                                        <td><span className="badge badge-grey">{target > 0 ? target : 'غير محدد'}</span></td>
                                                        <td><span className="badge badge-amber">{completed}</span></td>
                                                        <td><span className="badge badge-red">{target > 0 ? remaining : '—'}</span></td>
                                                        <td style={{ minWidth: '150px' }}>
                                                            {isDone ? (
                                                                <div style={{ color: 'var(--leaf)', fontWeight: 'bold', fontSize: '13px' }}>
                                                                    ✓ اكتملت المهمة للعمالة {workerName}
                                                                </div>
                                                            ) : (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <div style={{ flex: 1, background: '#eee', height: '6px', borderRadius: '4px', overflow: 'hidden' }}>
                                                                        <div style={{ width: `${pct}%`, background: 'var(--leaf)', height: '100%' }}></div>
                                                                    </div>
                                                                    <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>{pct}%</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                        {isAdmin && (
                                                            <td>
                                                                {targetRow && (
                                                                    <div className="action-btns">
                                                                        <button className="btn-del" onClick={() => deleteInspectionTarget(targetRow.id)}>
                                                                            حذف الهدف
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="table-wrapper" style={{ marginTop: '24px' }}>
                                    <h4 style={{ marginBottom: '16px', color: 'var(--ink)' }}>تفاصيل إدخالات الفحص</h4>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>العامل</th>
                                                <th>العدد (بكس)</th>
                                                <th>وقت البدء</th>
                                                <th>التاريخ</th>
                                                {isAdmin && <th>الإجراءات</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {inspRecords.length === 0 ? (
                                                <tr className="empty-row">
                                                    <td colSpan={isAdmin ? 5 : 4}>
                                                        <div className="empty-state">
                                                            <div className="empty-text">لا توجد سجلات أعداد فحص بعد</div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : inspRecords.map(r => (
                                                <tr key={r.id}>
                                                    <td><strong>{r.worker_name}</strong></td>
                                                    <td><span className="badge badge-green">{r.boxes_count}</span></td>
                                                    <td>{r.start_time || '—'}</td>
                                                    <td style={{ color: 'var(--ink-soft)' }}>
                                                        {new Date(r.work_date).toLocaleDateString('ar-EG')}
                                                    </td>
                                                    {isAdmin && (
                                                        <td>
                                                            <div className="action-btns">
                                                                <button className="btn-del" onClick={() => deleteInspectionRecord(r.id)}>
                                                                    حذف
                                                                </button>
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="section">
                        <h3>سجل الأعداد اليوم</h3>
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>العامل</th>
                                        <th>العدد (بكس)</th>
                                        <th>الأجر اليومي (د.أ)</th>
                                        <th>التاريخ</th>
                                        <th>الملاحظات</th>
                                        {isAdmin && <th>الإجراءات</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.length === 0 ? (
                                        <tr className="empty-row">
                                            <td colSpan={isAdmin ? 6 : 5}>
                                                <div className="empty-state">
                                                    <div className="empty-text">لا توجد سجلات بعد</div>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : records.map(r => {
                                        const entryDate = r.work_date
                                            ? new Date(r.work_date).toLocaleDateString('ar-EG')
                                            : '';
                                        return (
                                            <tr key={r.id}>
                                                <td><strong>{r.worker_name}</strong></td>
                                                <td>
                                                    <span className="badge badge-blue">{r.boxes_count}</span>
                                                </td>
                                                <td className="total-cell">{fmt(r.total_pay)}</td>
                                                <td style={{ color: 'var(--ink-soft)' }}>{entryDate}</td>
                                                <td style={{ color: 'var(--ink-soft)', fontSize: '13px' }}>{r.notes || '—'}</td>
                                                {isAdmin && (
                                                    <td>
                                                        <div className="action-btns">
                                                            <button className="btn-edit" onClick={() => startEditRecord(r)}>
                                                                تعديل
                                                            </button>
                                                            <button className="btn-del" onClick={() => deleteRecord(r.id)}>
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
            ) : (
                /* Manage Workers Tab */
                <div className="section">
                    <h3>إضافة عامل أعداد جديد</h3>
                    <div className="form-row">
                        <div className="field">
                            <label>اسم العامل الكامل</label>
                            <input
                                value={newWorkerName}
                                onChange={e => setNewWorkerName(e.target.value)}
                                placeholder="اسم العامل"
                            />
                        </div>
                        <div className="field">
                            <label>سعر البكسة (د.أ)</label>
                            <input
                                type="number" step="0.01" min="0"
                                value={newWorkerRate}
                                onChange={e => setNewWorkerRate(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="field" style={{ flex: 2 }}>
                            <label>ملاحظات</label>
                            <input
                                value={newWorkerNotes}
                                onChange={e => setNewWorkerNotes(e.target.value)}
                                placeholder="ملاحظات اختيارية..."
                            />
                        </div>
                        <button className="btn btn-success" style={{ width: 'auto' }} onClick={handleAddWorker}>
                            إضافة عامل
                        </button>
                    </div>

                    {workers.length > 0 && (
                        <div style={{ marginTop: '24px' }}>
                            <h4 style={{ marginBottom: '10px', color: 'var(--ink-soft)' }}>قائمة عمال الأعداد الحاليين:</h4>
                            <div className="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>الاسم</th>
                                            <th>الأجر اليومي الثابت</th>
                                            <th>ملاحظات</th>
                                            <th>الإجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {workers.map(w => (
                                            <tr key={w.id}>
                                                <td>
                                                    {editingWorkerId === w.id ? (
                                                        <input
                                                            value={editWorkerName}
                                                            onChange={e => setEditWorkerName(e.target.value)}
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
                                                            value={editWorkerRate}
                                                            onChange={e => setEditWorkerRate(e.target.value)}
                                                            style={{ padding: '4px 8px', margin: 0, width: '90px' }}
                                                        />
                                                    ) : (
                                                        `${fmt(w.daily_rate)} د.أ`
                                                    )}
                                                </td>
                                                <td>
                                                    {editingWorkerId === w.id ? (
                                                        <input
                                                            value={editWorkerNotes}
                                                            onChange={e => setEditWorkerNotes(e.target.value)}
                                                            style={{ padding: '4px 8px', margin: 0, width: '100%' }}
                                                        />
                                                    ) : (
                                                        <span style={{ color: 'var(--ink-soft)' }}>{w.notes || '—'}</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {editingWorkerId === w.id ? (
                                                        <div className="action-btns">
                                                            <button className="btn-edit" onClick={handleSaveWorkerEdit}>حفظ</button>
                                                            <button className="btn-del" onClick={() => setEditingWorkerId(null)}>إلغاء</button>
                                                        </div>
                                                    ) : (
                                                        <div className="action-btns">
                                                            <button className="btn-edit" onClick={() => startEditWorker(w)}>تعديل</button>
                                                            <button className="btn-del" onClick={() => handleDeleteWorker(w.id)}>حذف</button>
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
        </>
    );
}
