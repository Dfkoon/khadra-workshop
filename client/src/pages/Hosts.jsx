import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import toast from 'react-hot-toast';

/* ─── QR Code via Google Charts (no extra dependency) ─── */
function buildOtpAuthUrl(secret, username, issuer = 'مشغل أبو يوسف') {
    const label  = encodeURIComponent(`${issuer}:${username}`);
    const iss    = encodeURIComponent(issuer);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${iss}&algorithm=SHA1&digits=6&period=30`;
}

function QRCodeDisplay({ secret, username }) {
    const otpUrl  = buildOtpAuthUrl(secret, username);
    const qrUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(otpUrl)}&bgcolor=ffffff&color=1A2E1C&margin=10`;

    return (
        <div style={{
            marginTop: '16px',
            padding: '20px',
            background: 'var(--leaf-xlight)',
            border: '1.5px dashed var(--leaf)',
            borderRadius: 'var(--radius-lg)',
        }}>
            <div style={{
                fontWeight: 700, fontSize: '14px', color: 'var(--leaf-dark)',
                marginBottom: '4px',
            }}>
                امسح رمز QR بتطبيق المصادقة
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginBottom: '16px' }}>
                Google Authenticator أو Authy أو أي تطبيق TOTP آخر — هذا الرمز يُعرض مرة واحدة فقط
            </div>

            {/* QR Code Image */}
            <div style={{
                display: 'flex', justifyContent: 'center', marginBottom: '16px',
            }}>
                <div style={{
                    background: '#fff',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-md)',
                    display: 'inline-block',
                }}>
                    <img
                        src={qrUrl}
                        alt="QR Code للمصادقة الثنائية"
                        width={220}
                        height={220}
                        style={{ display: 'block' }}
                        onError={e => { e.target.style.display='none'; }}
                    />
                </div>
            </div>

            {/* Manual entry fallback */}
            <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--leaf-light)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
            }}>
                <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginBottom: '4px' }}>
                    أو أدخل الرمز يدوياً في التطبيق:
                </div>
                <code style={{
                    fontSize: '15px', letterSpacing: '3px', fontWeight: 700,
                    color: 'var(--leaf-dark)', direction: 'ltr', display: 'block',
                    wordBreak: 'break-all',
                }}>
                    {secret}
                </code>
            </div>

            <div style={{
                marginTop: '12px', fontSize: '12px', color: 'var(--carrot-dark)',
                background: 'var(--carrot-xlight)', padding: '8px 12px',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--carrot-light)',
            }}>
                بعد المسح، احفظ التطبيق — لن يُعرض هذا الرمز مجدداً عند تسجيل الدخول
            </div>
        </div>
    );
}

function LiveOTP({ userId, enabled }) {
    const [otp, setOtp] = useState('');
    const [remaining, setRemaining] = useState(0);

    const fetchOtp = useCallback(async () => {
        if (!enabled) return;
        try {
            const data = await api.getUserOTP(userId);
            setOtp(data.code);
            setRemaining(data.remaining);
        } catch (err) {
            console.error('Failed to fetch OTP:', err);
        }
    }, [userId, enabled]);

    useEffect(() => {
        if (enabled) {
            fetchOtp();
        }
    }, [enabled, fetchOtp]);

    useEffect(() => {
        if (!enabled || !otp) return;
        const timer = setInterval(() => {
            setRemaining(prev => {
                if (prev <= 1) {
                    fetchOtp();
                    return 30;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [otp, enabled, fetchOtp]);

    if (!enabled) return <span className="badge badge-grey">غير مفعّلة</span>;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className="badge badge-green">مفعّلة</span>
            <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--surface-3)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                direction: 'ltr'
            }}>
                <span style={{
                    fontFamily: 'monospace',
                    fontWeight: '800',
                    fontSize: '14px',
                    color: 'var(--leaf-dark)',
                    letterSpacing: '1px'
                }}>
                    {otp || '------'}
                </span>
                <span style={{
                    fontSize: '10px',
                    fontWeight: 'bold',
                    color: remaining < 10 ? 'var(--tomato)' : 'var(--ink-soft)',
                    background: 'var(--surface-2)',
                    padding: '1px 5px',
                    borderRadius: '3px',
                    minWidth: '22px',
                    textAlign: 'center'
                }}>
                    {remaining}s
                </span>
            </div>
        </div>
    );
}

export default function Hosts() {
    const [users,             setUsers]             = useState([]);
    const [name,              setName]              = useState('');
    const [username,          setUsername]          = useState('');
    const [password,          setPassword]          = useState('');
    const [role,              setRole]              = useState('coordinator');
    const [editingId,         setEditingId]         = useState(null);
    const [editingUsername,   setEditingUsername]   = useState('');
    const [twoFactorEnabled,  setTwoFactorEnabled]  = useState(false);
    const [twoFactorSecret,   setTwoFactorSecret]   = useState('');
    const [twoFactorLoading,  setTwoFactorLoading]  = useState(false);
    const [showPassword,      setShowPassword]      = useState(false);

    const load = useCallback(async () => {
        try {
            const u = await api.getUsers();
            setUsers(u || []);
        } catch (e) { toast.error('فشل تحميل البيانات'); }
    }, []);

    useEffect(() => { load(); }, [load]);

    async function addUser() {
        if (!name || !username || (!password && !editingId)) {
            toast.error('أدخل الاسم واسم المستخدم وكلمة المرور');
            return;
        }
        try {
            if (editingId) {
                await api.updateUser(editingId, {
                    full_name: name, username,
                    password: password || undefined, role,
                });
                toast.success('تم تحديث المستخدم بنجاح');
            } else {
                await api.createUser(name, username, password, role);
                const roleLabel = role === 'coordinator' ? 'المنسق' : role === 'admin' ? 'المسؤولة' : 'المضيف';
                toast.success(`تمت إضافة ${roleLabel} بنجاح`);
            }
            resetForm();
            load();
        } catch (e) { toast.error(e.message); }
    }

    async function removeUser(uname) {
        if (!window.confirm(`تأكيد حذف المستخدم "${uname}"؟`)) return;
        try {
            await api.deleteUser(uname);
            toast.success('تم حذف المستخدم');
            load();
        } catch (e) { toast.error(e.message); }
    }

    async function enableTwoFactor() {
        if (!editingId) return;
        setTwoFactorLoading(true);
        try {
            const result = await api.enableTwoFactor(editingId);
            setTwoFactorEnabled(true);
            setTwoFactorSecret(result.two_factor_secret);
            toast.success('تم تفعيل المصادقة الثنائية — امسح رمز QR الآن');
            load();
        } catch (e) {
            toast.error(e.message || 'فشل تفعيل المصادقة الثنائية');
        } finally { setTwoFactorLoading(false); }
    }

    async function disableTwoFactor() {
        if (!editingId) return;
        if (!window.confirm('تأكيد تعطيل المصادقة الثنائية لهذا المستخدم؟')) return;
        setTwoFactorLoading(true);
        try {
            await api.disableTwoFactor(editingId);
            setTwoFactorEnabled(false);
            setTwoFactorSecret('');
            toast.success('تم تعطيل المصادقة الثنائية');
            load();
        } catch (e) {
            toast.error(e.message || 'فشل تعطيل المصادقة الثنائية');
        } finally { setTwoFactorLoading(false); }
    }

    function startEdit(u) {
        setEditingId(u.id);
        setEditingUsername(u.username);
        setName(u.full_name);
        setUsername(u.username);
        setRole(u.role);
        setPassword('');
        setTwoFactorEnabled(Boolean(u.two_factor_enabled));
        setTwoFactorSecret('');   // ← QR لا يُعرض إلا عند التفعيل من جديد
        setShowPassword(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function resetForm() {
        setEditingId(null);
        setEditingUsername('');
        setName(''); setUsername(''); setPassword('');
        setRole('coordinator');
        setTwoFactorEnabled(false);
        setTwoFactorSecret('');
        setShowPassword(false);
    }

    function roleLabel(r) {
        if (r === 'admin') return 'مسؤولة';
        if (r === 'coordinator') return 'منسق';
        if (r === 'inspection_coordinator') return 'منسق الفحص';
        return 'مضيف';
    }
    function roleBadgeClass(r) {
        if (r === 'admin') return 'badge-red';
        if (r === 'coordinator') return 'badge-amber';
        if (r === 'inspection_coordinator') return 'badge-green';
        return 'badge-grey';
    }

    const isEditing         = Boolean(editingId);
    const adminCount        = users.filter(u => u.role === 'admin').length;
    const coordinatorCount  = users.filter(u => u.role === 'coordinator').length;
    const inspectionCount   = users.filter(u => u.role === 'inspection_coordinator').length;
    const hostCount         = users.filter(u => u.role === 'host').length;

    return (
        <>
            <div className="page-header">
                <h2 className="page-title">إدارة الحسابات</h2>
                <p className="page-sub">
                    إضافة وتعديل حسابات المسؤول والمنسق والمضيف، مع دعم المصادقة الثنائية
                </p>
            </div>

            {/* Summary */}
            {users.length > 0 && (
                <div className="stat-row" style={{ marginBottom: '20px' }}>
                    <div className="stat-card tomato">
                        <div className="label">مسؤولون</div>
                        <div className="value">{adminCount}</div>
                    </div>
                    <div className="stat-card carrot">
                        <div className="label">منسقون</div>
                        <div className="value">{coordinatorCount}</div>
                    </div>
                    <div className="stat-card leaf">
                        <div className="label">منسقو الفحص</div>
                        <div className="value">{inspectionCount}</div>
                    </div>
                    <div className="stat-card" style={{ borderColor: 'var(--line)' }}>
                        <div className="label">مضيفون</div>
                        <div className="value">{hostCount}</div>
                    </div>
                </div>
            )}

            {/* Form Section */}
            <div className="section">
                <h3>{isEditing ? 'تعديل مستخدم' : 'إضافة حساب جديد'}</h3>

                {isEditing && (
                    <div style={{
                        padding: '10px 14px', background: 'var(--carrot-xlight)',
                        border: '1px solid var(--carrot-light)', borderRadius: 'var(--radius-md)',
                        fontSize: '13px', color: 'var(--carrot-dark)', marginBottom: '16px',
                        display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                        وضع التعديل — عدّل البيانات ثم اضغط حفظ التعديل
                    </div>
                )}

                <div className="form-row">
                    <div className="field">
                        <label>الاسم الكامل</label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="الاسم الكامل"
                        />
                    </div>
                    <div className="field">
                        <label>اسم المستخدم</label>
                        <input
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="username"
                            dir="ltr"
                            style={{ textAlign: 'left' }}
                        />
                    </div>
                    <div className="field">
                        <label>
                            كلمة المرور
                            {isEditing && <span style={{ color: 'var(--ink-muted)', fontWeight: 400 }}> (للتغيير فقط)</span>}
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder={isEditing ? 'اتركه فارغًا إذا لم يتغير' : 'كلمة المرور'}
                                style={{ paddingLeft: '60px' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(s => !s)}
                                style={{
                                    position: 'absolute', left: '10px', top: '50%',
                                    transform: 'translateY(-50%)', background: 'none',
                                    border: 'none', cursor: 'pointer', fontSize: '12px',
                                    color: 'var(--ink-soft)', padding: '4px', fontWeight: 'bold'
                                }}
                            >
                                {showPassword ? 'إخفاء' : 'إظهار'}
                            </button>
                        </div>
                    </div>
                    <div className="field">
                        <label>الدور</label>
                        <select value={role} onChange={e => setRole(e.target.value)}>
                            <option value="admin">مسؤولة</option>
                            <option value="coordinator">منسق (إضافة بكس فقط)</option>
                            <option value="inspection_coordinator">منسق الفحص (إدخال أعداد الفحص)</option>
                            <option value="host">مضيف (اطلاع فقط)</option>
                        </select>
                    </div>
                </div>

                {/* ─── 2FA Section ─── */}
                {isEditing && (
                    <div className="field" style={{ marginBottom: '16px' }}>
                        <label>المصادقة الثنائية (2FA)</label>
                        <div className="two-factor-actions">
                            {twoFactorEnabled ? (
                                <>
                                    <span className="badge badge-green">مفعّلة</span>
                                    <button
                                        className="btn btn-danger btn-sm"
                                        type="button"
                                        onClick={disableTwoFactor}
                                        disabled={twoFactorLoading}
                                    >
                                        {twoFactorLoading ? '...' : 'تعطيل 2FA'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span className="badge badge-grey">غير مفعّلة</span>
                                    <button
                                        className="btn btn-outline btn-sm"
                                        type="button"
                                        onClick={enableTwoFactor}
                                        disabled={twoFactorLoading}
                                    >
                                        {twoFactorLoading ? '...' : 'تفعيل 2FA وعرض QR'}
                                    </button>
                                </>
                            )}
                        </div>

                        {/* QR Code — يظهر فقط بعد تفعيل 2FA مباشرة */}
                        {twoFactorSecret && (
                            <QRCodeDisplay
                                secret={twoFactorSecret}
                                username={editingUsername || username}
                            />
                        )}
                    </div>
                )}

                <div className="field-actions">
                    <button
                        className="btn btn-primary"
                        style={{ width: 'auto' }}
                        onClick={addUser}
                    >
                        {isEditing ? 'حفظ التعديل' : 'إضافة'}
                    </button>
                    {isEditing && (
                        <button
                            className="btn btn-outline"
                            style={{ width: 'auto' }}
                            onClick={resetForm}
                        >
                            إلغاء
                        </button>
                    )}
                </div>
            </div>

            {/* Users Table */}
            <div className="section">
                <h3>
                    <span>الحسابات الحالية</span>
                    <span className="badge badge-grey" style={{ marginRight: '8px' }}>{users.length} حساب</span>
                </h3>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>الاسم</th>
                                <th>اسم المستخدم</th>
                                <th>الدور</th>
                                <th>2FA</th>
                                <th>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.length === 0 ? (
                                <tr className="empty-row">
                                    <td colSpan={5}>
                                        <div className="empty-state">
                                            <div className="empty-text">لا توجد حسابات</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : users.map(u => (
                                <tr
                                    key={u.id}
                                    style={editingId === u.id
                                        ? { background: 'var(--carrot-xlight)' }
                                        : {}}
                                >
                                    <td>
                                        <strong>{u.full_name}</strong>
                                    </td>
                                    <td>
                                        <code style={{
                                            background: 'var(--surface-2)',
                                            padding: '3px 8px',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: '12px',
                                            direction: 'ltr',
                                            display: 'inline-block',
                                        }}>
                                            {u.username}
                                        </code>
                                    </td>
                                    <td>
                                        <span className={`badge ${roleBadgeClass(u.role)}`}>
                                            {roleLabel(u.role)}
                                        </span>
                                    </td>
                                    <td>
                                        <LiveOTP userId={u.id} enabled={Boolean(u.two_factor_enabled)} />
                                    </td>
                                    <td>
                                        <div className="action-btns">
                                            <button
                                                className="btn-edit"
                                                onClick={() => startEdit(u)}
                                            >
                                                تعديل
                                            </button>
                                            {u.role !== 'admin' && (
                                                <button
                                                    className="btn-del"
                                                    onClick={() => removeUser(u.username)}
                                                >
                                                    حذف
                                                </button>
                                            )}
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
