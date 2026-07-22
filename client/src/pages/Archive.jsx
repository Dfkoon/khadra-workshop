import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import toast from 'react-hot-toast';
import PrintableDatabaseTable from '../components/PrintableDatabaseTable';

function fmt(n) { return Number(n || 0).toFixed(2); }

export default function Archive() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [sessions, setSessions] = useState([]);
    const [selectedSessionId, setSelectedSessionId] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

    const [hourlyRecords, setHourlyRecords] = useState([]);
    const [dailyRecords, setDailyRecords] = useState([]);
    const [totals, setTotals] = useState({ hourly_pay: 0, daily_pay: 0, grand_total: 0 });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadSessions();
        // Load initial data for today's date
        fetchArchiveData(selectedDate, '');
    }, []);

    async function loadSessions() {
        try {
            const list = await api.getSessions();
            setSessions(list || []);
        } catch (e) {
            toast.error('فشل تحميل الجلسات');
        }
    }

    async function fetchArchiveData(dateVal, sessionVal) {
        setLoading(true);
        try {
            const res = await api.getArchiveDaily(dateVal, sessionVal);
            setHourlyRecords(res.hourly_records || []);
            setDailyRecords(res.daily_records || []);
            setTotals(res.totals || { hourly_pay: 0, daily_pay: 0, grand_total: 0 });
        } catch (e) {
            toast.error('فشل تحميل بيانات الأرشيف');
        } finally {
            setLoading(false);
        }
    }

    function handleDateFilter() {
        setSelectedSessionId('');
        fetchArchiveData(selectedDate, '');
    }

    function handleSessionFilter(e) {
        const sessId = e.target.value;
        setSelectedSessionId(sessId);
        setSelectedDate('');
        fetchArchiveData('', sessId);
    }

    function handlePrint() {
        window.print();
    }

    const hourlyColumns = [
        { field: 'worker_name', label: 'الاسم' },
        { field: 'shift_date', label: 'التاريخ' },
        { field: 'shift_start', label: 'البدء' },
        { field: 'shift_end', label: 'الانتهاء' },
        { field: 'hours_worked', label: 'الساعات', render: r => `${fmt(r.hours_worked)} س` },
        { field: 'hourly_rate_snapshot', label: 'سعر الساعة', render: r => `${fmt(r.hourly_rate_snapshot)} د.أ` },
        { field: 'total_pay', label: 'إجمالي الأجر', render: r => `${fmt(r.total_pay)} د.أ` },
        { field: 'worker_notes', label: 'الملاحظات' }
    ];

    const dailyColumns = [
        { field: 'worker_name', label: 'الاسم' },
        { field: 'work_date', label: 'التاريخ' },
        { field: 'boxes_count', label: 'عدد البكسات', render: r => `${r.boxes_count} بكسة` },
        { field: 'daily_rate', label: 'أجر اليوم', render: r => `${fmt(r.daily_rate)} د.أ` },
        { field: 'total_pay', label: 'إجمالي الأجر', render: r => `${fmt(r.total_pay)} د.أ` },
        { field: 'notes', label: 'ملاحظات اليوم', render: r => r.notes || r.worker_notes || 'لا يوجد' }
    ];

    return (
        <>
            <div className="page-header">
                <h2 className="page-title">الأرشيف اليومي</h2>
                <p className="page-sub">تتبع إنتاجية العمال والأجور اليومية لعمال الأعداد وعمال الساعة بشكل مستقل</p>
            </div>

            <div className="section no-print">
                <h3>فلترة وتصفية السجلات</h3>
                <div className="form-row">
                    <div className="field">
                        <label>تصفية بحسب التاريخ اليومي</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => {
                                setSelectedDate(e.target.value);
                            }}
                        />
                    </div>
                    <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleDateFilter}>
                        تصفية بالتاريخ
                    </button>

                    <div style={{ width: '2px', background: 'var(--line)', alignSelf: 'stretch', margin: '0 12px' }}></div>

                    <div className="field">
                        <label>أو تصفية بحسب جلسة العمل</label>
                        <select value={selectedSessionId} onChange={handleSessionFilter}>
                            <option value="">اختر الجلسة...</option>
                            {sessions.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.name} ({s.status === 'active' ? 'نشطة حالياً' : 'مؤرشفة'})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Totals Summary */}
            <div className="stat-row">
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
                    <div className="label">الإجمالي الكلي للأجور</div>
                    <div className="value">{fmt(totals.grand_total)}</div>
                    <div className="stat-unit">دينار أردني</div>
                </div>
            </div>

            <div className="no-print" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={handlePrint}>طباعة التقرير الكامل للأرشيف</button>
            </div>

            {/* Daily Workers Table */}
            <PrintableDatabaseTable
                title="أرشيف عمال الأعداد بالبكس"
                subtitle={selectedDate ? `التقرير اليومي لتاريخ: ${selectedDate}` : `تقرير الجلسة المحددة`}
                columns={dailyColumns}
                rows={dailyRecords}
                loading={loading}
                noDataMessage="لا توجد سجلات عمال أعداد مؤرشفة للفلتر المحدد"
            />

            <div style={{ margin: '32px 0' }}></div>

            {/* Hourly Workers Table */}
            <PrintableDatabaseTable
                title="أرشيف عمال الساعة"
                subtitle={selectedDate ? `التقرير اليومي لتاريخ: ${selectedDate}` : `تقرير الجلسة المحددة`}
                columns={hourlyColumns}
                rows={hourlyRecords}
                loading={loading}
                noDataMessage="لا توجد سجلات عمال ساعة مؤرشفة للفلتر المحدد"
            />
        </>
    );
}
