import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import toast from 'react-hot-toast';

export default function Attendance() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [records,        setRecords]        = useState([]);
    const [workerName,     setWorkerName]     = useState('');
    const [attendanceDate, setAttendanceDate] = useState('');
    const [status,         setStatus]         = useState('hourly');
    const [hourlyRate,     setHourlyRate]     = useState('');
    const [filterDate,     setFilterDate]     = useState('');

    const load = useCallback(async () => {
        try {
            const r = await api.getAttendance();
            setRecords(r || []);
        } catch (e) {
            toast.error('فشل تحميل سجلات الحضور');
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    async function submitAttendance() {
        if (!workerName.trim() || !attendanceDate) {
            toast.error('أدخل اسم العامل والتاريخ');
            return;
        }
        try {
            await api.createAttendance(workerName.trim(), attendanceDate, status, hourlyRate);
            const label = status === 'hourly' ? 'نظام الساعة' : 'نظام الأعداد';
            toast.success(`تم تسجيل ${workerName.trim()} — ${label}`);
            setWorkerName('');
            setAttendanceDate('');
            if (status === 'hourly') setHourlyRate('');
            load();
        } catch (e) {
            toast.error(e.message);
        }
    }

    async function deleteRecord(id) {
        if (!window.confirm('تأكيد حذف سجل الحضور؟')) return;
        try {
            await api.deleteAttendance(id);
            toast.success('تم الحذف');
            load();
        } catch (e) {
            toast.error(e.message);
        }
    }

    const filteredRecords = filterDate
        ? records.filter(r => r.attendance_date?.slice(0, 10) === filterDate)
        : records;

    // Split into two lists
    const hourlyRecords = filteredRecords.filter(r => r.status === 'hourly' || r.status === 'present');
    const dailyRecords  = filteredRecords.filter(r => r.status === 'daily'  || r.status === 'count');

    function AttendanceTable({ title, rows, accentColor, emptyMsg }) {
        return (
            <div className="section" style={{ borderRight: `4px solid ${accentColor}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0 }}>{title}</h3>
                    <span style={{
                        background: accentColor + '22',
                        color: accentColor,
                        fontWeight: 700,
                        fontSize: '13px',
                        padding: '4px 14px',
                        borderRadius: '99px',
                        border: `1px solid ${accentColor}44`
                    }}>{rows.length} عامل</span>
                </div>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>اسم العامل</th>
                                <th>التاريخ</th>
                                {isAdmin && <th>الإجراءات</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr className="empty-row">
                                    <td colSpan={isAdmin ? 3 : 2}>
                                        <div className="empty-state">
                                            <div className="empty-text">{emptyMsg}</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : rows.map(r => (
                                <tr key={r.id}>
                                    <td><strong>{r.worker_name}</strong></td>
                                    <td style={{ color: 'var(--ink-soft)' }}>
                                        {new Date(r.attendance_date).toLocaleDateString('ar-EG', {
                                            weekday: 'short', year: 'numeric', month: 'long', day: 'numeric'
                                        })}
                                    </td>
                                    {isAdmin && (
                                        <td>
                                            <div className="action-btns">
                                                <button className="btn-del" onClick={() => deleteRecord(r.id)}>
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
        );
    }

    return (
        <>
            <div className="page-header">
                <h2 className="page-title">جدول الحضور اليومي</h2>
                <p className="page-sub">تسجيل العمال حسب نظام العمل — نظام ساعة أو نظام أعداد</p>
            </div>

            {/* Quick stats */}
            {filteredRecords.length > 0 && (
                <div className="stat-row" style={{ marginBottom: '20px' }}>
                    <div className="stat-card leaf">
                        <div className="label">نظام ساعة</div>
                        <div className="value">{hourlyRecords.length}</div>
                    </div>
                    <div className="stat-card carrot">
                        <div className="label">نظام أعداد</div>
                        <div className="value">{dailyRecords.length}</div>
                    </div>
                    <div className="stat-card" style={{ borderColor: 'var(--line)' }}>
                        <div className="label">الإجمالي</div>
                        <div className="value">{filteredRecords.length}</div>
                    </div>
                </div>
            )}

            {/* Registration Form */}
            <div className="section">
                <h3>تسجيل حضور جديد</h3>
                <div className="form-row">
                    <div className="field">
                        <label>النظام</label>
                        <select value={status} onChange={e => setStatus(e.target.value)}>
                            <option value="hourly">نظام ساعة</option>
                            <option value="daily">نظام أعداد</option>
                        </select>
                    </div>
                    <div className="field" style={{ flex: 2 }}>
                        <label>اسم العامل</label>
                        <input
                            value={workerName}
                            onChange={e => setWorkerName(e.target.value)}
                            placeholder="أدخل اسم العامل"
                            onKeyDown={e => e.key === 'Enter' && submitAttendance()}
                        />
                    </div>
                    {status === 'hourly' && (
                        <div className="field">
                            <label>سعر الساعة (د.أ)</label>
                            <input
                                type="number" step="0.01" min="0"
                                value={hourlyRate}
                                onChange={e => setHourlyRate(e.target.value)}
                                placeholder="مثال: 1.25"
                                onKeyDown={e => e.key === 'Enter' && submitAttendance()}
                            />
                        </div>
                    )}
                    <div className="field">
                        <label>التاريخ</label>
                        <input
                            type="date"
                            value={attendanceDate}
                            onChange={e => setAttendanceDate(e.target.value)}
                        />
                    </div>
                    <button
                        className="btn btn-success"
                        style={{ width: 'auto' }}
                        onClick={submitAttendance}
                    >
                        تسجيل
                    </button>
                </div>
            </div>

            {/* Date Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', justifyContent: 'flex-end' }}>
                <label style={{ fontSize: '13px', color: 'var(--ink-soft)', fontWeight: '600', whiteSpace: 'nowrap' }}>
                    تصفية بالتاريخ:
                </label>
                <input
                    type="date"
                    value={filterDate}
                    onChange={e => setFilterDate(e.target.value)}
                    style={{
                        padding: '7px 12px', border: '1.5px solid var(--line)',
                        borderRadius: 'var(--radius-sm)', fontSize: '13px',
                        fontFamily: 'inherit', background: 'var(--surface)',
                        color: 'var(--ink)',
                    }}
                />
                {filterDate && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setFilterDate('')}>
                        إلغاء التصفية
                    </button>
                )}
            </div>

            {/* Two separate tables */}
            <AttendanceTable
                title="سجل الحضور — نظام الساعة"
                rows={hourlyRecords}
                accentColor="var(--leaf)"
                emptyMsg={filterDate ? 'لا يوجد عمال ساعة مسجلون لهذا التاريخ' : 'لا توجد سجلات لنظام الساعة بعد'}
            />

            <AttendanceTable
                title="سجل الحضور — نظام الأعداد"
                rows={dailyRecords}
                accentColor="var(--carrot)"
                emptyMsg={filterDate ? 'لا يوجد عمال أعداد مسجلون لهذا التاريخ' : 'لا توجد سجلات لنظام الأعداد بعد'}
            />
        </>
    );
}
