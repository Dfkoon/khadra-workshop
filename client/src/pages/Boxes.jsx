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

    // Inspection records, targets & workers state
    const [inspRecords, setInspRecords] = useState([]);
    const [inspTargets, setInspTargets] = useState([]);
    const [inspWorkers, setInspWorkers] = useState([]);
    const [newInspWorkerInput, setNewInspWorkerInput] = useState('');
    const [inspWorkerName, setInspWorkerName] = useState('');
    const [inspBoxesCount, setInspBoxesCount] = useState('');
    const [inspStartTime, setInspStartTime] = useState('');
    const [inspDate, setInspDate] = useState(new Date().toISOString().slice(0, 10));
    
    // Admin only Target assignment state
    const [targetWorkerName, setTargetWorkerName] = useState('');
    const [targetBoxesCount, setTargetBoxesCount] = useState('');
    const [targetMode, setTargetMode] = useState('auto'); // 'auto' or 'single'
    const [bulkTotalBoxes, setBulkTotalBoxes] = useState('');
    const [selectedWorkersForTarget, setSelectedWorkersForTarget] = useState([]);

    function getBulkDistribution() {
        const total = parseInt(bulkTotalBoxes);
        if (!total || total <= 0 || selectedWorkersForTarget.length === 0) return [];
        const count = selectedWorkersForTarget.length;
        const base = Math.floor(total / count);
        const remainder = total % count;
        return selectedWorkersForTarget.map((wName, idx) => ({
            worker_name: wName,
            target_boxes: base + (idx < remainder ? 1 : 0)
        }));
    }

    async function submitBulkInspectionTargets() {
        const dist = getBulkDistribution();
        if (dist.length === 0) {
            toast.error('يرجى إدخال العدد الكلي واختيار عامل واحد على الأقل');
            return;
        }
        try {
            const targetDate = new Date().toISOString().slice(0, 10);
            for (const item of dist) {
                await api.createInspectionTarget({
                    worker_name: item.worker_name,
                    target_boxes: item.target_boxes,
                    target_date: targetDate
                });
            }
            toast.success(`تم توزيع وتقسيم ${bulkTotalBoxes} بكس على ${dist.length} عمال فحص بنجاح ✨`);
            setBulkTotalBoxes('');
            load();
        } catch (e) {
            toast.error(e.message);
        }
    }

    async function handleAddInspectionWorker(nameOverride) {
        const name = (nameOverride || newInspWorkerInput).trim();
        if (!name) {
            toast.error('أدخل اسم عامل الفحص');
            return;
        }
        try {
            await api.createInspectionWorker({ full_name: name });
            toast.success('تمت إضافة عامل الفحص بنجاح');
            setNewInspWorkerInput('');
            const updated = await api.getInspectionWorkers();
            setInspWorkers(updated || []);
            if (!selectedWorkersForTarget.includes(name)) {
                setSelectedWorkersForTarget(prev => [...prev, name]);
            }
        } catch (e) {
            toast.error(e.message);
        }
    }

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
            const [w, r, c, hw, insp, u, t, iw] = await Promise.all([
                api.getDailyWorkers(),
                api.getDailyWorkRecords(),
                api.getCategories(),
                api.getWorkers(),
                api.getInspectionRecords(),
                api.getUsage(),
                api.getInspectionTargets(),
                api.getInspectionWorkers()
            ]);
            setWorkers(w || []);
            setRecords(r || []);
            setCategories(c || []);
            setCatWorkers(hw || []);
            setInspRecords(insp || []);
            setUsage(u || []);
            setInspTargets(t || []);
            setInspWorkers(iw || []);
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
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
                                        <h3 style={{ margin: 0 }}>تحديد العدد المطلوب (الأهداف)</h3>
                                        <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-2)', padding: '4px', borderRadius: '10px' }}>
                                            <button
                                                type="button"
                                                className={`btn ${targetMode === 'auto' ? 'btn-primary' : 'btn-ghost'}`}
                                                style={{ padding: '6px 14px', fontSize: '13px', minHeight: '34px', borderRadius: '8px' }}
                                                onClick={() => setTargetMode('auto')}
                                            >
                                                توزيع كلي آلي ⚡
                                            </button>
                                            <button
                                                type="button"
                                                className={`btn ${targetMode === 'single' ? 'btn-primary' : 'btn-ghost'}`}
                                                style={{ padding: '6px 14px', fontSize: '13px', minHeight: '34px', borderRadius: '8px' }}
                                                onClick={() => setTargetMode('single')}
                                            >
                                                تحديد فردي لِعامل 👤
                                            </button>
                                        </div>
                                    </div>

                                    {targetMode === 'auto' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', alignItems: 'flex-start' }}>
                                                <div className="field">
                                                    <label style={{ fontWeight: 'bold' }}>إجمالي العدد المطلوب لليوم (مثلاً 50)</label>
                                                    <input
                                                        type="number" min="1" step="1"
                                                        value={bulkTotalBoxes}
                                                        onChange={e => setBulkTotalBoxes(e.target.value)}
                                                        placeholder="أدخل العدد الكلي (مثل 50)"
                                                    />
                                                </div>
                                                <div className="field">
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                        <label style={{ fontWeight: 'bold', margin: 0 }}>اختيار عمال الفحص المستهدفين ({selectedWorkersForTarget.length})</label>
                                                        {inspWorkers.length > 0 && (
                                                            <button
                                                                type="button"
                                                                style={{ background: 'none', border: 'none', color: 'var(--tomato)', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                                                onClick={() => {
                                                                    const allNames = Array.from(new Set([...inspWorkers.map(w => w.full_name), ...inspTargets.map(t => t.worker_name)]));
                                                                    if (selectedWorkersForTarget.length === allNames.length) {
                                                                        setSelectedWorkersForTarget([]);
                                                                    } else {
                                                                        setSelectedWorkersForTarget(allNames);
                                                                    }
                                                                }}
                                                            >
                                                                {selectedWorkersForTarget.length === Array.from(new Set([...inspWorkers.map(w => w.full_name), ...inspTargets.map(t => t.worker_name)])).length ? 'إلغاء التحديد' : 'تحديد جميع عمال الفحص'}
                                                            </button>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Quick add inspection worker inline input */}
                                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                                        <input
                                                            value={newInspWorkerInput}
                                                            onChange={e => setNewInspWorkerInput(e.target.value)}
                                                            placeholder="إضافة اسم عامل/عاملة فحص جديد..."
                                                            style={{ fontSize: '13px', padding: '6px 10px', height: '36px', minHeight: '36px' }}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleAddInspectionWorker();
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline"
                                                            style={{ minHeight: '36px', height: '36px', padding: '0 12px', fontSize: '13px', whiteSpace: 'nowrap' }}
                                                            onClick={() => handleAddInspectionWorker()}
                                                        >
                                                            + إضافة عامل فحص
                                                        </button>
                                                    </div>

                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '120px', overflowY: 'auto', padding: '8px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--line)' }}>
                                                        {Array.from(new Set([...inspWorkers.map(w => w.full_name), ...inspTargets.map(t => t.worker_name)])).length === 0 ? (
                                                            <span style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>أدخل أسماء عمال الفحص أعلاه لإظهارهم هنا والبدء بالتوزيع</span>
                                                        ) : Array.from(new Set([...inspWorkers.map(w => w.full_name), ...inspTargets.map(t => t.worker_name)])).map(wName => {
                                                            const isSelected = selectedWorkersForTarget.includes(wName);
                                                            return (
                                                                <button
                                                                    key={wName}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (isSelected) {
                                                                            setSelectedWorkersForTarget(selectedWorkersForTarget.filter(n => n !== wName));
                                                                        } else {
                                                                            setSelectedWorkersForTarget([...selectedWorkersForTarget, wName]);
                                                                        }
                                                                    }}
                                                                    style={{
                                                                        padding: '6px 12px',
                                                                        borderRadius: '20px',
                                                                        border: isSelected ? '1.5px solid var(--tomato)' : '1px solid #cbd5e1',
                                                                        background: isSelected ? 'var(--tomato-xlight)' : '#fff',
                                                                        color: isSelected ? 'var(--tomato-dark)' : 'var(--ink)',
                                                                        fontWeight: isSelected ? 'bold' : 'normal',
                                                                        fontSize: '13px',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.15s'
                                                                    }}
                                                                >
                                                                    {isSelected ? '✓ ' : '+ '}{wName}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Live Distribution Preview Card */}
                                            {getBulkDistribution().length > 0 && (
                                                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '14px 16px', borderRadius: '10px' }}>
                                                    <div style={{ fontWeight: 'bold', fontSize: '13.5px', color: '#166534', marginBottom: '8px' }}>
                                                        📊 المعاينة التلقائية للتوزيع ({bulkTotalBoxes} بكس مقسمة على {selectedWorkersForTarget.length} عمال فحص):
                                                    </div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                        {getBulkDistribution().map(item => (
                                                            <span key={item.worker_name} style={{ background: '#fff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #86efac', fontSize: '13px', color: '#15803d', fontWeight: 'bold' }}>
                                                                {item.worker_name}: <span style={{ color: 'var(--tomato-dark)', fontSize: '14px' }}>{item.target_boxes}</span> بكس
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div style={{ marginTop: '4px' }}>
                                                <button className="btn btn-primary" style={{ width: '100%' }} onClick={submitBulkInspectionTargets}>
                                                    حفظ وتوزيع الهدف الكلي على عمال الفحص
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="boxes-form-grid">
                                            <div className="field">
                                                <label>اسم عامل الفحص</label>
                                                <input
                                                    value={targetWorkerName}
                                                    onChange={e => setTargetWorkerName(e.target.value)}
                                                    placeholder="أدخل أو اختر اسم عامل الفحص"
                                                    list="insp-workers-list"
                                                />
                                                <datalist id="insp-workers-list">
                                                    {Array.from(new Set([...inspWorkers.map(w => w.full_name), ...inspTargets.map(t => t.worker_name)])).map(name => (
                                                        <option key={name} value={name} />
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
                                    )}
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
                                                {inspTargets.map(t => (
                                                    <option key={t.id} value={t.worker_name}>
                                                        {t.worker_name} (الهدف: {t.target_boxes} بكس)
                                                    </option>
                                                ))}
                                                {inspWorkers.filter(w => !inspTargets.some(t => t.worker_name === w.full_name)).length > 0 && (
                                                    <optgroup label="باقي عمال الفحص">
                                                        {inspWorkers.filter(w => !inspTargets.some(t => t.worker_name === w.full_name)).map(w => (
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
                                                تسجيل عدد
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="section">
                                <h3>متابعة إنجاز عمال الفحص</h3>
                                {(() => {
                                    const allWorkerNames = Array.from(new Set([...inspTargets.map(t => t.worker_name), ...inspRecords.map(r => r.worker_name)]));
                                    const totalInspTarget = inspTargets.reduce((sum, t) => sum + Number(t.target_boxes || 0), 0);
                                    const totalInspCompleted = inspRecords.reduce((sum, r) => sum + Number(r.boxes_count || 0), 0);
                                    const totalInspRemaining = allWorkerNames.reduce((sum, workerName) => {
                                        const targetRow = inspTargets.find(t => t.worker_name === workerName);
                                        const target = targetRow ? targetRow.target_boxes : 0;
                                        const completed = inspRecords.filter(r => r.worker_name === workerName).reduce((s, r) => s + r.boxes_count, 0);
                                        return sum + Math.max(0, target - completed);
                                    }, 0);

                                    return (
                                        <>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                                                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px', fontWeight: 'bold' }}>إجمالي الهدف المطلوب</div>
                                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{totalInspTarget}</div>
                                                </div>
                                                <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '12px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '13px', color: '#166534', marginBottom: '6px', fontWeight: 'bold' }}>إجمالي المُنْجَز</div>
                                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#15803d' }}>{totalInspCompleted}</div>
                                                </div>
                                                <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '12px', border: '1px solid #fecaca', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '13px', color: '#991b1b', marginBottom: '6px', fontWeight: 'bold' }}>إجمالي المتبقي</div>
                                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>{totalInspRemaining}</div>
                                                </div>
                                            </div>

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
                                                        {allWorkerNames.length === 0 ? (
                                                            <tr className="empty-row">
                                                                <td colSpan={isAdmin ? 6 : 5}>
                                                                    <div className="empty-state">
                                                                        <div className="empty-text">لا توجد أهداف أو سجلات أعداد فحص بعد</div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ) : allWorkerNames.map(workerName => {
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
                                                    {allWorkerNames.length > 0 && (
                                                        <tfoot>
                                                            <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                                                                <td>الإجمالي العام</td>
                                                                <td><span className="badge badge-grey">{totalInspTarget}</span></td>
                                                                <td><span className="badge badge-amber">{totalInspCompleted}</span></td>
                                                                <td><span className="badge badge-red">{totalInspRemaining}</span></td>
                                                                <td colSpan={isAdmin ? 2 : 1}></td>
                                                            </tr>
                                                        </tfoot>
                                                    )}
                                                </table>
                                            </div>
                                        </>
                                    );
                                })()}
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
