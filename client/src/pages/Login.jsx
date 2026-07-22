import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [code, setCode] = useState('');
    const [step, setStep] = useState('login');
    const [pendingUser, setPendingUser] = useState(null);
    const [pendingToken, setPendingToken] = useState('');
    const [busy, setBusy] = useState(false);
    const { login, verifyTwoFactor } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setBusy(true);
        try {
            if (step === 'login') {
                const result = await login(username, password);
                if (result.requires2fa) {
                    setPendingUser(result.user);
                    setPendingToken(result.tempToken);
                    setStep('verify');
                    toast.success('أدخل رمز المصادقة الثنائية من تطبيق المصادقة');
                } else {
                    toast.success(`مرحباً ${result.full_name}`);
                    navigate('/');
                }
            } else {
                const user = await verifyTwoFactor(pendingToken, code);
                toast.success(`تم تسجيل الدخول، مرحباً ${user.full_name}`);
                navigate('/');
            }
        } catch (err) {
            toast.error(err.message || 'فشل تسجيل الدخول');
        }
        setBusy(false);
    }

    function resetFlow() {
        setStep('login');
        setPendingUser(null);
        setPendingToken('');
        setCode('');
        setPassword('');
    }

    return (
        <div className="login-screen">
            <div className="login-card">
                {/* Logo */}
                <div className="login-stamp" style={{ fontSize: '16px', fontWeight: 'bold' }}>دخول</div>
                <h1>مشغل أبو يوسف</h1>
                <p>
                    {step === 'login'
                        ? 'سجّلي دخولك لإدارة المشغل والإنتاج والعمال'
                        : 'أدخل رمز المصادقة الثنائية'}
                </p>

                <form onSubmit={handleSubmit} style={{ textAlign: 'right' }}>
                    {step === 'login' ? (
                        <>
                            <div className="field">
                                <label htmlFor="login-username">اسم المستخدم</label>
                                <input
                                    id="login-username"
                                    autoComplete="username"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    placeholder="أدخل اسم المستخدم"
                                    required
                                />
                            </div>
                            <div className="field">
                                <label htmlFor="login-password">كلمة المرور</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        id="login-password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        style={{ paddingLeft: '60px' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(s => !s)}
                                        style={{
                                            position: 'absolute', left: '12px', top: '50%',
                                            transform: 'translateY(-50%)', background: 'none',
                                            border: 'none', cursor: 'pointer', color: 'var(--ink-soft)',
                                            fontSize: '12px', padding: '4px', fontWeight: 'bold'
                                        }}
                                        aria-label="إظهار/إخفاء كلمة المرور"
                                    >
                                        {showPassword ? 'إخفاء' : 'إظهار'}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {pendingUser && (
                                <div style={{
                                    padding: '10px 14px',
                                    background: 'var(--leaf-xlight)',
                                    border: '1px solid var(--leaf-light)',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '13px',
                                    color: 'var(--leaf-dark)',
                                    marginBottom: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                }}>
                                    <span>المستخدم:</span>
                                    <span><strong>{pendingUser.full_name || pendingUser.username}</strong></span>
                                </div>
                            )}
                            <div className="field">
                                <label htmlFor="login-2fa">رمز المصادقة الثنائية</label>
                                <input
                                    id="login-2fa"
                                    value={code}
                                    onChange={e => setCode(e.target.value)}
                                    placeholder="123456"
                                    required
                                    style={{ letterSpacing: '4px', fontSize: '18px', textAlign: 'center' }}
                                />
                            </div>
                        </>
                    )}

                    <button
                        className="btn btn-primary btn-full"
                        style={{ marginTop: '8px', padding: '13px 20px', fontSize: '15px' }}
                        disabled={busy}
                        type="submit"
                    >
                        {busy
                            ? <><span className="loading-spinner" /> جاري التحقق...</>
                            : step === 'login' ? 'تسجيل الدخول' : 'تأكيد الرمز'}
                    </button>

                    {step === 'verify' && (
                        <button
                            className="btn btn-outline btn-full"
                            type="button"
                            onClick={resetFlow}
                            disabled={busy}
                            style={{ marginTop: '8px' }}
                        >
                            الرجوع لتسجيل الدخول
                        </button>
                    )}
                </form>


            </div>
        </div>
    );
}
