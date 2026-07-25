import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import toast from 'react-hot-toast';
import PrintableDatabaseTable from '../components/PrintableDatabaseTable';

function fmt(n) { return Number(n || 0).toFixed(2); }

export default function Archive() {
    const { user } = useAuth();

    const [sessions, setSessions] = useState([]);
    const [selectedSessionId, setSelectedSessionId] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

    const [hourlyRecords, setHourlyRecords] = useState([]);
    const [dailyRecords, setDailyRecords] = useState([]);
    const [usageRecords, setUsageRecords] = useState([]);
    const [inspectionRecords, setInspectionRecords] = useState([]);
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [totals, setTotals] = useState({ hourly_pay: 0, daily_pay: 0, usage_pay: 0, grand_total: 0 });
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
            console.error('Error loading sessions:', e);
            toast.error('فشل تحميل الجلسات');
        }
    }

    async function fetchArchiveData(dateVal, sessionVal) {
        setLoading(true);
        try {
            const res = await api.getArchiveDaily(dateVal, sessionVal);
            setHourlyRecords(res.hourly_records || []);
            setDailyRecords(res.daily_records || []);
            setUsageRecords(res.usage_records || []);
            setInspectionRecords(res.inspection_records || []);
            setAttendanceRecords(res.attendance_records || []);
            setTotals(res.totals || { hourly_pay: 0, daily_pay: 0, usage_pay: 0, grand_total: 0 });
        } catch (e) {
            console.error('Error fetching archive:', e);
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

    const dailyColumns = [
        { field: 'worker_name', label: 'العامل' },
        { field: 'category_name', label: 'نوع الصنف', render: r => r.category_name || 'عام / غير محدد' },
        { field: 'work_date', label: 'التاريخ' },
        { field: 'boxes_count', label: 'عدد البكس', render: r => `${r.boxes_count} بكس` },
        { field: 'unit_price', label: 'سعر البكسة', render: r => `${fmt(r.unit_price || r.daily_rate)} د.أ` },
        { field: 'total_pay', label: 'الأجر المتوقع', render: r => `${fmt(r.total_pay)} د.أ` },
        { field: 'notes', label: 'ملاحظات', render: r => r.notes || r.worker_notes || '—' }
    ];

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

    const usageColumns = [
        { field: 'worker_name', label: 'العامل' },
        { field: 'category_name', label: 'الصنف', render: r => r.category_name || 'صنف محذوف' },
        { field: 'quantity', label: 'عدد البكس', render: r => `${r.quantity} بكس` },
        { field: 'total_price', label: 'الإجمالي (د.أ)', render: r => `${fmt(r.total_price)} د.أ` },
        { field: 'entry_date', label: 'التاريخ' }
    ];

    const inspectionColumns = [
        { field: 'worker_name', label: 'عامل الفحص' },
        { field: 'boxes_count', label: 'العدد المنجز/المخصم', render: r => `${r.boxes_count} بكس` },
        { field: 'created_at', label: 'الوقت', render: r => r.created_at ? new Date(r.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—' },
        { field: 'work_date', label: 'التاريخ' }
    ];

    const attendanceColumns = [
        { field: 'worker_name', label: 'اسم العامل' },
        { field: 'status', label: 'الحالة', render: r => r.status === 'present' ? 'حاضر' : r.status === 'absent' ? 'غائب' : r.status },
        { field: 'attendance_date', label: 'تاريخ الحضور' }
    ];

    return (
        <>
            <div className="page-header">
                <h2 className="page-title">الأرشيف اليومي والجلسات</h2>
                <p className="page-sub">تتبع كافة أرشفة الصفحات والمعلومات للجلسات والتوارخ المحددة</p>
            </div>

            <div className="section no-print">
                <h3>فلترة وتصفية الأرشيف الشامل</h3>
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
                    <div className="label">أجور عمال الأعداد (البكس)</div>
                    <div className="value">{fmt(totals.daily_pay)}</div>
                    <div className="stat-unit">دينار أردني</div>
                </div>
                <div className="stat-card carrot">
                    <div className="label">أجور عمال الساعة</div>
                    <div className="value">{fmt(totals.hourly_pay)}</div>
                    <div className="stat-unit">دينار أردني</div>
                </div>
                <div className="stat-card tomato">
                    <div className="label">الإجمالي الكلي للعمالة</div>
                    <div className="value">{fmt(totals.grand_total)}</div>
                    <div className="stat-unit">دينار أردني</div>
                </div>
            </div>

            <div className="no-print" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={handlePrint}>طباعة تقرير الأرشيف الشامل</button>
            </div>

            {/* Section 1: Daily Counts Workers Table */}
            <PrintableDatabaseTable
                title="أرشيف عمال الأعداد بالأصناف والبكس"
                subtitle={selectedDate ? `تاريخ: ${selectedDate}` : `جلسة مؤرشفة`}
                columns={dailyColumns}
                rows={dailyRecords}
                loading={loading}
                noDataMessage="لا توجد سجلات عمال أعداد مؤرشفة"
            />

            <div style={{ margin: '32px 0' }}></div>

            {/* Section 2: Hourly Workers Table */}
            <PrintableDatabaseTable
                title="أرشيف عمال الساعة والورديات"
                subtitle={selectedDate ? `تاريخ: ${selectedDate}` : `جلسة مؤرشفة`}
                columns={hourlyColumns}
                rows={hourlyRecords}
                loading={loading}
                noDataMessage="لا توجد سجلات عمال ساعة مؤرشفة"
            />

            <div style={{ margin: '32px 0' }}></div>

            {/* Section 3: Category Usage Table */}
            <PrintableDatabaseTable
                title="أرشيف الأصناف والبوكسات (استخدام البكس)"
                subtitle={selectedDate ? `تاريخ: ${selectedDate}` : `جلسة مؤرشفة`}
                columns={usageColumns}
                rows={usageRecords}
                loading={loading}
                noDataMessage="لا توجد سجلات أصناف وبوكسات مؤرشفة"
            />

            <div style={{ margin: '32px 0' }}></div>

            {/* Section 4: Inspection Records Table */}
            <PrintableDatabaseTable
                title="أرشيف إنجاز وتخصيم عمال الفحص"
                subtitle={selectedDate ? `تاريخ: ${selectedDate}` : `جلسة مؤرشفة`}
                columns={inspectionColumns}
                rows={inspectionRecords}
                loading={loading}
                noDataMessage="لا توجد سجلات فحص مؤرشفة"
            />

            <div style={{ margin: '32px 0' }}></div>

            {/* Section 5: Attendance Table */}
            <PrintableDatabaseTable
                title="أرشيف سجلات الحضور والغياب"
                subtitle={selectedDate ? `تاريخ: ${selectedDate}` : `جلسة مؤرشفة`}
                columns={attendanceColumns}
                rows={attendanceRecords}
                loading={loading}
                noDataMessage="لا توجد سجلات حضور وغياب مؤرشفة"
            />
        </>
    );
}
