import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import toast from 'react-hot-toast';
import PrintableDatabaseTable from '../components/PrintableDatabaseTable';

function fmt(n) { return Number(n || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function Dashboard() {
    const { user } = useAuth();
    const [report, setReport]   = useState({ total_usage: 0, total_pay: 0, total_daily_pay: 0, grand_total_wages: 0 });
    const [recent, setRecent]   = useState([]);
    const [workers, setWorkers] = useState(null);
    const [activeSession, setActiveSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pending, setPending] = useState({ usage: [], boxes: [], daily: [] });
    const [pendingLoading, setPendingLoading] = useState(true);
    const [approvingId, setApprovingId] = useState(null);

    const loadPending = useCallback(async () => {
        try {
            const p = await api.getPendingApprovals();
            setPending(p);
        } catch { /* silent */ }
        finally { setPendingLoading(false); }
    }, []);

    useEffect(() => {
        const today = new Date().toISOString().slice(0, 10);
        async function load() {
            try {
                const [r, usage, shifts, wrk, sess, dailyWork] = await Promise.all([
                    api.getDailyReport(today),
                    api.getUsage(today),
                    api.getShifts(today),
                    api.getWorkers(),
                    api.getActiveSession(),
                    api.getDailyWorkRecords(today)
                ]);
                setReport(r);
                setWorkers(wrk);
                setActiveSession(sess);
                const rows = [];
                usage.slice(-5).reverse().forEach(u => {
                    rows.push({ type: 'صنف', detail: `${u.worker_name}`, value: fmt(u.total_price) });
                });
                shifts.slice(-5).reverse().forEach(s => {
                    rows.push({ type: 'دوام ساعة', detail: `${s.worker_name} (${s.shift_start}–${s.shift_end})`, value: fmt(s.total_pay) });
                });
                dailyWork.slice(-5).reverse().forEach(d => {
                    rows.push({ type: 'أعداد', detail: `${d.worker_name} (${d.boxes_count} بكسة)`, value: fmt(d.total_pay) });
                });
                setRecent(rows);
            } catch { /* silent */ }
            finally { setLoading(false); }
        }
        load();
        loadPending();
    }, [loadPending]);

    const totalPending = (pending.usage?.length || 0) + (pending.boxes?.length || 0) + (pending.daily?.length || 0);

    async function handleApprove(type, id) {
        setApprovingId(`${type}-${id}`);
        try {
            await api.approveRecord(type, id);
            toast.success('تمت الموافقة على الإدخال بنجاح');
            loadPending();
        } catch (e) { toast.error(e.message); }
        finally { setApprovingId(null); }
    }

    async function handleReject(type, id) {
        if (!window.confirm('هل تريد رفض وحذف هذا الإدخال؟')) return;
        setApprovingId(`${type}-${id}`);
        try {
            await api.rejectRecord(type, id);
            toast.success('تم رفض الإدخال');
            loadPending();
        } catch (e) { toast.error(e.message); }
        finally { setApprovingId(null); }
    }

    const todayStr = new Date().toLocaleDateString('ar-EG', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء الخير' : 'مساء النور';

    const printableColumns = [
        { field: 'full_name',    label: 'الاسم'         },
        { field: 'hourly_rate',  label: 'سعر الساعة', render: row => `${Number(row.hourly_rate || 0).toFixed(2)} د.أ` },
        { field: 'is_active',    label: 'الحالة',     render: row => (row.is_active ? 'نشط' : 'متوقف')             },
    ];

    // Build flat pending rows for table display
    const pendingRows = [
        ...(pending.usage || []).map(r => ({
            key: `usage-${r.id}`,
            type: 'usage',
            id: r.id,
            typeLabel: 'صنف',
            name: r.category_name || '—',
            worker: r.worker_name || r.created_by_name || '—',
            detail: `الكمية: ${r.quantity}`,
            value: fmt(r.total_price),
            submittedBy: r.created_by_name || '—',
            date: r.entry_date || '—',
        })),
        ...(pending.boxes || []).map(r => ({
            key: `boxes-${r.id}`,
            type: 'boxes',
            id: r.id,
            typeLabel: 'بكسات',
            name: r.worker_name || '—',
            worker: r.worker_name || '—',
            detail: `العدد: ${r.boxes_count}`,
            value: '—',
            submittedBy: r.created_by_name || '—',
            date: r.alloc_date || '—',
        })),
        ...(pending.daily || []).map(r => ({
            key: `daily-${r.id}`,
            type: 'daily',
            id: r.id,
            typeLabel: 'أعداد',
            name: r.worker_name || '—',
            worker: r.worker_name || '—',
            detail: `${r.boxes_count} بكسة`,
            value: fmt(r.total_pay),
            submittedBy: r.created_by_name || '—',
            date: r.work_date || '—',
        })),
    ];

    return (
        <>
            {/* Page Header */}
            <div className="page-header">
                <h2 className="page-title">لوحة التحكم</h2>
                <p className="page-sub">
                    {greeting}، {user?.full_name || user?.username} · {todayStr}
                </p>
                {activeSession && (
                    <div style={{ marginTop: '8px' }}>
                        <span className="badge badge-blue">الجلسة النشطة الحالية: {activeSession.name}</span>
                    </div>
                )}
            </div>

            {/* Stat Cards */}
            <div className="stat-row">
                <div className="stat-card tomato">
                    <div className="label">قيمة الأصناف اليوم</div>
                    <div className="value">{loading ? '—' : fmt(report.total_usage)}</div>
                    <div className="stat-unit">دينار أردني</div>
                </div>
                <div className="stat-card leaf">
                    <div className="label">أجور العمال اليوم الكلية</div>
                    <div className="value">{loading ? '—' : fmt(report.grand_total_wages)}</div>
                    <div className="stat-unit">دينار أردني</div>
                </div>
                <div className="stat-card carrot">
                    <div className="label">عمال الساعة النشطون</div>
                    <div className="value">{loading ? '—' : (workers?.length || 0)}</div>
                    <div className="stat-unit">عامل مسجّل</div>
                </div>
            </div>

            {/* Pending Approvals Table */}
            <div className="section" style={{ marginBottom: '20px' }}>
                <div className="section-header">
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        طلبات بانتظار الموافقة
                        {totalPending > 0 && (
                            <span className="badge badge-red" style={{ fontSize: '12px', padding: '3px 10px' }}>
                                {totalPending}
                            </span>
                        )}
                    </h3>
                </div>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>النوع</th>
                                <th>العامل / الصنف</th>
                                <th>التفاصيل</th>
                                <th>القيمة (د.أ)</th>
                                <th>التاريخ</th>
                                <th>أُدخل بواسطة</th>
                                <th>الإجراء</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pendingLoading ? (
                                <tr className="empty-row"><td colSpan={7}>جاري التحميل...</td></tr>
                            ) : pendingRows.length === 0 ? (
                                <tr className="empty-row">
                                    <td colSpan={7}>
                                        <div className="empty-state">
                                            <div className="empty-text">لا توجد طلبات معلقة</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : pendingRows.map(r => (
                                <tr key={r.key}>
                                    <td>
                                        <span className={`badge ${r.type === 'usage' ? 'badge-red' : r.type === 'daily' ? 'badge-amber' : 'badge-blue'}`}>
                                            {r.typeLabel}
                                        </span>
                                    </td>
                                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                                    <td style={{ color: 'var(--ink-soft)' }}>{r.detail}</td>
                                    <td className="total-cell">{r.value}</td>
                                    <td style={{ color: 'var(--ink-soft)', fontSize: '12px' }}>{r.date}</td>
                                    <td style={{ color: 'var(--ink-soft)', fontSize: '12px' }}>{r.submittedBy}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            <button
                                                className="btn-approve"
                                                disabled={!!approvingId}
                                                onClick={() => handleApprove(r.type, r.id)}
                                            >
                                                موافقة
                                            </button>
                                            <button
                                                className="btn-del"
                                                disabled={!!approvingId}
                                                onClick={() => handleReject(r.type, r.id)}
                                            >
                                                رفض
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Workers printable table */}
            <PrintableDatabaseTable
                title="جدول عمال الساعة"
                subtitle="قائمة عمال الساعة المسجّلين في النظام"
                columns={printableColumns}
                rows={workers}
                loading={!workers}
                noDataMessage="لا توجد بيانات للعمال بعد"
            />

            {/* Recent activity */}
            <div className="section">
                <h3>آخر الحركات اليوم</h3>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>النوع</th>
                                <th>التفاصيل</th>
                                <th>القيمة (د.أ)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr className="empty-row"><td colSpan={3}>جاري التحميل...</td></tr>
                            ) : recent.length === 0 ? (
                                <tr className="empty-row">
                                    <td colSpan={3}>
                                        <div className="empty-state">
                                            <div className="empty-text">لا توجد حركات اليوم بعد</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : recent.map((r, i) => (
                                <tr key={i}>
                                    <td>
                                        <span className={`badge ${r.type === 'صنف' ? 'badge-red' : r.type === 'أعداد' ? 'badge-amber' : 'badge-green'}`}>
                                            {r.type}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--ink-soft)' }}>{r.detail}</td>
                                    <td className="total-cell">{r.value}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
