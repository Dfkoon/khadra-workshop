import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import toast from 'react-hot-toast';

function fmt(n) { return Number(n || 0).toFixed(2); }

/* ─── Session Preview Modal ─────────────────────────────────── */
function SessionPreviewModal({ session, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const printRef = useRef(null);

    useEffect(() => {
        if (!session) return;
        setLoading(true);
        api.getArchiveDaily('', session.id)
            .then(res => setData(res))
            .catch(() => toast.error('فشل تحميل بيانات الجلسة'))
            .finally(() => setLoading(false));
    }, [session]);

    function handlePrint() {
        const content = printRef.current?.innerHTML;
        if (!content) return;
        const win = window.open('', '_blank');
        win.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8"/>
                <title>تقرير جلسة: ${session.name}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 24px; direction: rtl; color: #111; }
                    h1 { font-size: 20px; margin-bottom: 4px; }
                    p.sub { color: #666; font-size: 13px; margin-top: 0; }
                    .stats { display: flex; gap: 16px; margin: 16px 0; flex-wrap: wrap; }
                    .stat-box { border: 1px solid #ddd; border-radius: 8px; padding: 12px 20px; min-width: 160px; }
                    .stat-box .lbl { font-size: 12px; color: #666; }
                    .stat-box .val { font-size: 22px; font-weight: 700; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
                    th { background: #f5f5f5; font-size: 12px; padding: 8px; text-align: right; border-bottom: 2px solid #ddd; }
                    td { padding: 8px; font-size: 13px; border-bottom: 1px solid #eee; }
                    h2 { font-size: 15px; margin: 20px 0 8px; border-bottom: 2px solid #2e7d32; padding-bottom: 4px; }
                    .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #aaa; }
                </style>
            </head>
            <body>${content}</body>
            </html>
        `);
        win.document.close();
        win.focus();
        win.print();
        win.close();
    }

    if (!session) return null;

    const hourly = data?.hourly_records || [];
    const daily  = data?.daily_records  || [];
    const totals = data?.totals         || {};

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '16px'
            }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{
                background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
                width: '100%', maxWidth: '900px', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px', borderBottom: '1px solid var(--line)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    flexShrink: 0
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '18px' }}>تفاصيل الجلسة: {session.name}</h3>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--ink-soft)' }}>
                            {new Date(session.start_date).toLocaleString('ar-EG')}
                            {session.end_date ? ` — ${new Date(session.end_date).toLocaleString('ar-EG')}` : ''}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handlePrint}>
                            طباعة التقرير
                        </button>
                        <button className="btn btn-outline" style={{ width: 'auto' }} onClick={onClose}>
                            اغلاق
                        </button>
                    </div>
                </div>

                {/* Scrollable Body */}
                <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--ink-soft)' }}>
                            جاري تحميل بيانات الجلسة...
                        </div>
                    ) : (
                        <div ref={printRef}>
                            {/* Print Header (hidden in modal, shown in print) */}
                            <h1 style={{ margin: '0 0 4px' }}>{session.name}</h1>
                            <p className="sub" style={{ color: 'var(--ink-soft)', fontSize: '13px', margin: '0 0 16px' }}>
                                مشغل ابو يوسف — تقرير الجلسة
                                &nbsp;|&nbsp;
                                {new Date(session.start_date).toLocaleString('ar-EG')}
                                {session.end_date ? ` — ${new Date(session.end_date).toLocaleString('ar-EG')}` : ''}
                            </p>

                            {/* Stats */}
                            <div className="stat-row" style={{ marginBottom: '24px' }}>
                                <div className="stat-card leaf">
                                    <div className="label">أجور عمال الأعداد</div>
                                    <div className="value">{fmt(totals.daily_pay)}</div>
                                    <div className="stat-unit">دينار أردني</div>
                                </div>
                                <div className="stat-card carrot">
                                    <div className="label">أجور عمال الساعة</div>
                                    <div className="value">{fmt(totals.hourly_pay)}</div>
                                    <div className="stat-unit">دينار أردني</div>
                                </div>
                                <div className="stat-card tomato">
                                    <div className="label">الإجمالي الكلي</div>
                                    <div className="value">{fmt(totals.grand_total)}</div>
                                    <div className="stat-unit">دينار أردني</div>
                                </div>
                            </div>

                            {/* Hourly Records Table */}
                            <h2 style={{ fontSize: '15px', margin: '0 0 8px', borderBottom: '2px solid var(--leaf)', paddingBottom: '4px' }}>
                                سجلات عمال الساعة ({hourly.length} سجل)
                            </h2>
                            {hourly.length === 0 ? (
                                <p style={{ color: 'var(--ink-soft)', fontSize: '13px', marginBottom: '24px' }}>لا توجد سجلات لعمال الساعة في هذه الجلسة.</p>
                            ) : (
                                <div className="table-wrapper" style={{ marginBottom: '24px' }}>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>الاسم</th>
                                                <th>التاريخ</th>
                                                <th>البدء</th>
                                                <th>الانتهاء</th>
                                                <th>الساعات</th>
                                                <th>سعر الساعة</th>
                                                <th>الأجر الإجمالي</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {hourly.map((r, i) => (
                                                <tr key={i}>
                                                    <td><strong>{r.worker_name}</strong></td>
                                                    <td style={{ color: 'var(--ink-soft)' }}>{r.shift_date}</td>
                                                    <td>{r.shift_start}</td>
                                                    <td>{r.shift_end || <span style={{ color: 'var(--amber)' }}>قيد العمل</span>}</td>
                                                    <td>{fmt(r.hours_worked)} س</td>
                                                    <td>{fmt(r.hourly_rate_snapshot)} د.أ</td>
                                                    <td><strong>{fmt(r.total_pay)} د.أ</strong></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ background: 'var(--surface-2)', fontWeight: 700 }}>
                                                <td colSpan={6} style={{ textAlign: 'left', paddingRight: '12px' }}>الإجمالي</td>
                                                <td>{fmt(totals.hourly_pay)} د.أ</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            {/* Daily Records Table */}
                            <h2 style={{ fontSize: '15px', margin: '0 0 8px', borderBottom: '2px solid var(--carrot)', paddingBottom: '4px' }}>
                                سجلات عمال الأعداد بالبكس ({daily.length} سجل)
                            </h2>
                            {daily.length === 0 ? (
                                <p style={{ color: 'var(--ink-soft)', fontSize: '13px' }}>لا توجد سجلات لعمال الأعداد في هذه الجلسة.</p>
                            ) : (
                                <div className="table-wrapper">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>الاسم</th>
                                                <th>التاريخ</th>
                                                <th>عدد البكسات</th>
                                                <th>أجر البكسة</th>
                                                <th>الأجر الإجمالي</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {daily.map((r, i) => (
                                                <tr key={i}>
                                                    <td><strong>{r.worker_name}</strong></td>
                                                    <td style={{ color: 'var(--ink-soft)' }}>{r.work_date}</td>
                                                    <td>{r.boxes_count} بكسة</td>
                                                    <td>{fmt(r.daily_rate)} د.أ</td>
                                                    <td><strong>{fmt(r.total_pay)} د.أ</strong></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ background: 'var(--surface-2)', fontWeight: 700 }}>
                                                <td colSpan={4} style={{ textAlign: 'left', paddingRight: '12px' }}>الإجمالي</td>
                                                <td>{fmt(totals.daily_pay)} د.أ</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            <div className="footer" style={{ marginTop: '24px', textAlign: 'center', fontSize: '11px', color: 'var(--ink-soft)' }}>
                                مشغل ابو يوسف &copy; — جميع الحقوق محفوظة
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── Main Sessions Page ────────────────────────────────────── */
export default function Sessions() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [sessions, setSessions] = useState([]);
    const [activeSess, setActiveSess] = useState(null);
    const [newSessionName, setNewSessionName] = useState('');
    const [newSessionNotes, setNewSessionNotes] = useState('');

    // Notes edit state
    const [editingSessionId, setEditingSessionId] = useState(null);
    const [editNotesText, setEditNotesText] = useState('');

    // Preview modal state
    const [previewSession, setPreviewSession] = useState(null);

    useEffect(() => {
        loadSessions();
    }, []);

    async function loadSessions() {
        try {
            const list = await api.getSessions();
            setSessions(list || []);
            const current = await api.getActiveSession();
            setActiveSess(current || null);
        } catch (e) {
            toast.error('فشل تحميل الجلسات');
        }
    }

    async function startNewSession() {
        if (!newSessionName) {
            toast.error('الرجاء كتابة اسم الجلسة الجديدة');
            return;
        }
        try {
            await api.createSession(newSessionName, newSessionNotes);
            toast.success('تم بدء جلسة عمل جديدة بنجاح وأرشفة الجلسة السابقة');
            setNewSessionName('');
            setNewSessionNotes('');
            loadSessions();
        } catch (e) {
            toast.error(e.message);
        }
    }

    async function closeCurrentSession() {
        if (!activeSess) return;
        if (!window.confirm('هل أنت متأكد من إغلاق وأرشفة الجلسة الحالية وبدء حساب جديد؟')) return;
        try {
            await api.closeSession(activeSess.id, activeSess.notes);
            toast.success('تم إغلاق وأرشفة الجلسة الحالية');
            loadSessions();
        } catch (e) {
            toast.error(e.message);
        }
    }

    async function saveSessionNotes(id) {
        try {
            await api.updateSession(id, editNotesText);
            toast.success('تم حفظ الملاحظات');
            setEditingSessionId(null);
            loadSessions();
        } catch (e) {
            toast.error(e.message);
        }
    }

    return (
        <>
            {previewSession && (
                <SessionPreviewModal
                    session={previewSession}
                    onClose={() => setPreviewSession(null)}
                />
            )}

            <div className="page-header">
                <h2 className="page-title">إدارة جلسات العمل</h2>
                <p className="page-sub">إدارة وتدشين جلسات عمل جديدة وأرشفة جلسات العمل المغلقة للمشغل</p>
            </div>

            {activeSess ? (
                <div className="section" style={{ borderRight: '4px solid var(--leaf)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <span className="badge badge-green" style={{ marginBottom: '8px' }}>جلسة نشطة حالياً</span>
                            <h3>{activeSess.name}</h3>
                            <p style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>تاريخ البدء: {new Date(activeSess.start_date).toLocaleString('ar-EG')}</p>
                        </div>
                        {isAdmin && (
                            <button className="btn btn-danger" onClick={closeCurrentSession}>
                                إغلاق وأرشفة الجلسة
                            </button>
                        )}
                    </div>
                    <div style={{ marginTop: '16px' }}>
                        <strong>ملاحظات الجلسة الحالية:</strong>
                        {editingSessionId === activeSess.id ? (
                            <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                                <textarea
                                    value={editNotesText}
                                    onChange={e => setEditNotesText(e.target.value)}
                                    className="field"
                                    rows="2"
                                    style={{ width: '100%', resize: 'vertical' }}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <button className="btn btn-primary btn-sm" onClick={() => saveSessionNotes(activeSess.id)}>حفظ</button>
                                    <button className="btn btn-outline btn-sm" onClick={() => setEditingSessionId(null)}>إلغاء</button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)', padding: '12px', borderRadius: 'var(--radius-md)', marginTop: '8px' }}>
                                <span style={{ color: 'var(--ink-soft)' }}>{activeSess.notes || 'لا توجد ملاحظات لهذه الجلسة بعد.'}</span>
                                {isAdmin && (
                                    <button className="btn-edit" onClick={() => {
                                        setEditingSessionId(activeSess.id);
                                        setEditNotesText(activeSess.notes || '');
                                    }}>تعديل الملاحظات</button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="section" style={{ borderRight: '4px solid var(--tomato)' }}>
                    <span className="badge badge-red">لا توجد جلسة نشطة</span>
                    <p style={{ marginTop: '8px' }}>يجب بدء جلسة عمل جديدة لتسجيل حركات العمال والإنتاج.</p>
                </div>
            )}

            {isAdmin && (
                <div className="section">
                    <h3>بدء جلسة عمل جديدة</h3>
                    <div className="form-row">
                        <div className="field" style={{ flex: 1 }}>
                            <label>اسم الجلسة الجديدة</label>
                            <input
                                value={newSessionName}
                                onChange={e => setNewSessionName(e.target.value)}
                                placeholder="مثال: قطاف شهر تموز، تشغيل الصيف..."
                            />
                        </div>
                        <div className="field" style={{ flex: 2 }}>
                            <label>ملاحظات البدء</label>
                            <input
                                value={newSessionNotes}
                                onChange={e => setNewSessionNotes(e.target.value)}
                                placeholder="ملاحظات المسؤولة عند بدء الجلسة"
                            />
                        </div>
                        <button className="btn btn-success" style={{ width: 'auto' }} onClick={startNewSession}>
                            بدء الجلسة وأرشفة الحالية
                        </button>
                    </div>
                </div>
            )}

            <div className="section">
                <h3>أرشيف الجلسات السابقة (المغلقة)</h3>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>اسم الجلسة</th>
                                <th>تاريخ البدء</th>
                                <th>تاريخ الانتهاء</th>
                                <th>الحالة</th>
                                <th>ملاحظات الأرشفة</th>
                                <th>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.filter(s => s.status === 'closed').length === 0 ? (
                                <tr className="empty-row">
                                    <td colSpan={6}>لا توجد جلسات مؤرشفة مسبقاً</td>
                                </tr>
                            ) : sessions.filter(s => s.status === 'closed').map(s => (
                                <tr key={s.id}>
                                    <td><strong>{s.name}</strong></td>
                                    <td style={{ color: 'var(--ink-soft)' }}>{new Date(s.start_date).toLocaleString('ar-EG')}</td>
                                    <td style={{ color: 'var(--ink-soft)' }}>{s.end_date ? new Date(s.end_date).toLocaleString('ar-EG') : 'غير محدد'}</td>
                                    <td>
                                        <span className="badge badge-grey">مؤرشفة</span>
                                    </td>
                                    <td>
                                        {editingSessionId === s.id ? (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input
                                                    value={editNotesText}
                                                    onChange={e => setEditNotesText(e.target.value)}
                                                    style={{ padding: '4px 8px', margin: 0, width: '100%' }}
                                                />
                                                <button className="btn btn-primary btn-xs" onClick={() => saveSessionNotes(s.id)}>حفظ</button>
                                                <button className="btn btn-outline btn-xs" onClick={() => setEditingSessionId(null)}>إلغاء</button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ color: 'var(--ink-soft)' }}>{s.notes || 'لا يوجد ملاحظات'}</span>
                                                {isAdmin && (
                                                    <button className="btn-edit" style={{ padding: '2px 6px', fontSize: '11px' }} onClick={() => {
                                                        setEditingSessionId(s.id);
                                                        setEditNotesText(s.notes || '');
                                                    }}>تعديل</button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                            <button
                                                className="btn btn-primary btn-xs"
                                                style={{ whiteSpace: 'nowrap' }}
                                                onClick={() => setPreviewSession(s)}
                                            >
                                                معاينة
                                            </button>
                                            <button
                                                className="btn btn-outline btn-xs"
                                                style={{ whiteSpace: 'nowrap' }}
                                                onClick={() => {
                                                    setPreviewSession(s);
                                                    // Auto-trigger print after modal loads
                                                    setTimeout(() => {
                                                        const btn = document.querySelector('[data-print-btn]');
                                                        if (btn) btn.click();
                                                    }, 800);
                                                }}
                                            >
                                                طباعة
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
