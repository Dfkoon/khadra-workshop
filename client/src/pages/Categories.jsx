import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import toast from 'react-hot-toast';

function fmt(n) { return Number(n || 0).toFixed(2); }

export default function Categories() {
    const { user } = useAuth();
    const isAdmin       = user?.role === 'admin';
    const isCoordinator = user?.role === 'coordinator';
    const isHost        = user?.role === 'host';
    const canAddEntries = isAdmin || isCoordinator;
    const canDelete     = isAdmin;

    const [categories, setCategories] = useState([]);
    const [usage,      setUsage]      = useState([]);
    const [workers,    setWorkers]    = useState([]);

    const [catName,  setCatName]  = useState('');
    const [catPrice, setCatPrice] = useState('');
    const [useCat,   setUseCat]   = useState('');
    const [useWorker,setUseWorker]= useState('');
    const [useQty,   setUseQty]   = useState('');

    // Edit states for categories
    const [editingCatId, setEditingCatId] = useState(null);
    const [editCatName, setEditCatName] = useState('');
    const [editCatPrice, setEditCatPrice] = useState('');

    const load = useCallback(async () => {
        try {
            const [c, u, w] = await Promise.all([
                api.getCategories(), api.getUsage(), api.getWorkers(),
            ]);
            setCategories(c || []);
            setUsage(u || []);
            setWorkers(w || []);
            if (c?.length && !useCat) setUseCat(String(c[0].id));
        } catch (e) { toast.error('فشل تحميل البيانات'); }
    }, [useCat]);

    useEffect(() => { load(); }, [load]);

    async function addCategory() {
        if (!catName || !catPrice) { toast.error('أدخل اسم الصنف والسعر'); return; }
        try {
            await api.createCategory(catName, parseFloat(catPrice), 'كغم');
            toast.success('تمت إضافة الصنف بنجاح');
            setCatName(''); setCatPrice('');
            load();
        } catch (e) { toast.error(e.message); }
    }

    async function startEditCat(c) {
        setEditingCatId(c.id);
        setEditCatName(c.name);
        setEditCatPrice(String(c.unit_price));
    }

    async function saveCatEdit() {
        if (!editCatName || !editCatPrice) {
            toast.error('الاسم والسعر مطلوبان');
            return;
        }
        try {
            await api.updateCategory(editingCatId, editCatName, parseFloat(editCatPrice));
            toast.success('تم تحديث الصنف بنجاح');
            setEditingCatId(null);
            load();
        } catch (e) {
            toast.error(e.message);
        }
    }

    async function addUsage() {
        if (!useCat || !useWorker || !useQty) { toast.error('أدخل كل الحقول'); return; }
        const date = new Date().toISOString().slice(0, 10);
        try {
            await api.createUsage(parseInt(useCat), useWorker, parseFloat(useQty), date);
            toast.success('تم تسجيل الاستخدام بنجاح وسيظهر في السجلات بعد موافقة المسؤولة');
            setUseWorker(''); setUseQty('');
            load();
        } catch (e) { toast.error(e.message); }
    }

    async function deleteUsage(id) {
        if (!window.confirm('تأكيد حذف هذا السجل؟')) return;
        try { await api.deleteUsage(id); toast.success('تم الحذف'); load(); }
        catch (e) { toast.error(e.message); }
    }

    function badgeClass(color) {
        if (!color) return 'badge-green';
        return color === 'red' ? 'badge-red' : color === 'green' ? 'badge-green' : 'badge-amber';
    }

    return (
        <>
            <div className="page-header">
                <h2 className="page-title">جدول الأصناف والبكس</h2>
                <p className="page-sub">تسجيل عدد الصناديق (البكس) لكل عامل حسب الصنف</p>
            </div>

            {isHost && (
                <div className="locked-note">
                    أنت بصلاحية اطلاع فقط على هذا الجدول، لا يمكنك الإضافة أو التعديل.
                </div>
            )}

            {isAdmin && (
                <div className="section">
                    <h3>إضافة وتعديل الأصناف</h3>
                    <div className="form-row">
                        <div className="field">
                            <label>اسم الصنف الجديد</label>
                            <input
                                value={catName}
                                onChange={e => setCatName(e.target.value)}
                                placeholder="مثلاً: باذنجان، طماطم..."
                                onKeyDown={e => e.key === 'Enter' && addCategory()}
                            />
                        </div>
                        <div className="field">
                            <label>سعر الصندوق الواحد (د.أ)</label>
                            <input
                                type="number" step="0.01" min="0"
                                value={catPrice}
                                onChange={e => setCatPrice(e.target.value)}
                                placeholder="0.00"
                                onKeyDown={e => e.key === 'Enter' && addCategory()}
                            />
                        </div>
                        <button className="btn btn-success" style={{ width: 'auto' }} onClick={addCategory}>
                            إضافة صنف
                        </button>
                    </div>

                    {categories.length > 0 && (
                        <div style={{ marginTop: '16px' }}>
                            <h4 style={{ marginBottom: '8px', fontSize: '14px', color: 'var(--ink-soft)' }}>الأصناف الحالية وإمكانية تعديلها:</h4>
                            <div className="table-wrapper">
                                <table style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)' }}>
                                    <thead>
                                        <tr>
                                            <th>اسم الصنف</th>
                                            <th>سعر الصندوق (بكسة)</th>
                                            <th>الإجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {categories.map(c => (
                                            <tr key={c.id}>
                                                <td>
                                                    {editingCatId === c.id ? (
                                                        <input
                                                            value={editCatName}
                                                            onChange={e => setEditCatName(e.target.value)}
                                                            style={{ padding: '4px 8px', margin: 0 }}
                                                        />
                                                    ) : (
                                                        <strong>{c.name}</strong>
                                                    )}
                                                </td>
                                                <td>
                                                    {editingCatId === c.id ? (
                                                        <input
                                                            type="number" step="0.01"
                                                            value={editCatPrice}
                                                            onChange={e => setEditCatPrice(e.target.value)}
                                                            style={{ padding: '4px 8px', margin: 0, width: '100px' }}
                                                        />
                                                    ) : (
                                                        `${fmt(c.unit_price)} د.أ`
                                                    )}
                                                </td>
                                                <td>
                                                    {editingCatId === c.id ? (
                                                        <div className="action-btns">
                                                            <button className="btn-edit" onClick={saveCatEdit}>حفظ</button>
                                                            <button className="btn-del" onClick={() => setEditingCatId(null)}>إلغاء</button>
                                                        </div>
                                                    ) : (
                                                        <button className="btn-edit" onClick={() => startEditCat(c)}>تعديل</button>
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
