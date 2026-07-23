import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Categories from './pages/Categories';
import Workers from './pages/Workers';
import Boxes from './pages/Boxes';
import Hosts from './pages/Hosts';
import Attendance from './pages/Attendance';
import Sessions from './pages/Sessions';
import Archive from './pages/Archive';

/* ─── SVG Icons (No Emojis) ─── */
const Icons = {
    dashboard: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
    ),
    attendance: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
    ),
    categories: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
    ),
    workers: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
    ),

    boxes: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
    ),
    sessions: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    ),
    archive: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="21 8 21 21 3 21 3 8" />
            <rect x="1" y="3" width="22" height="5" />
            <line x1="10" y1="12" x2="14" y2="12" />
        </svg>
    ),
    hosts: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
    ),
    logout: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
        </svg>
    ),
    menu: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
    ),
    shop: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
    )
};

function AppLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    if (!user) return <Navigate to="/login" replace />;

    const isAdmin = user.role === 'admin';
    const isHost  = user.role === 'host';

    const navItems = [
        { path: '/',              label: 'لوحة التحكم',    roles: ['admin'],                      icon: Icons.dashboard  },
        { path: '/attendance',    label: 'الحضور',          roles: ['admin', 'coordinator', 'host'], icon: Icons.attendance },
        { path: '/categories',    label: 'الأصناف والبكس', roles: ['admin', 'coordinator', 'host'], icon: Icons.categories },
        { path: '/workers',       label: 'عمال الساعة',     roles: ['admin'],                         icon: Icons.workers    },
        { path: '/boxes',         label: 'تسجيل أعداد',     roles: ['admin', 'coordinator', 'host', 'inspection_coordinator'], icon: Icons.boxes      },
        { path: '/sessions',      label: 'إدارة الجلسات',   roles: ['admin'],                      icon: Icons.sessions   },
        { path: '/archive',       label: 'الأرشيف اليومي',  roles: ['admin'],                      icon: Icons.archive    },
        { path: '/hosts',         label: 'إدارة الحسابات',  roles: ['admin'],                      icon: Icons.hosts      },
    ];

    const visibleItems = navItems.filter(n => n.roles.includes(user.role));

    function handleLogout() { logout(); navigate('/login'); }

    function roleLabel(r) {
        if (r === 'admin') return 'مسؤولة';
        if (r === 'coordinator') return 'منسق';
        if (r === 'inspection_coordinator') return 'منسق فحص';
        return 'مضيف';
    }
    function roleClass(r) {
        if (r === 'admin') return 'role-admin';
        if (r === 'coordinator') return 'role-coordinator';
        if (r === 'inspection_coordinator') return 'role-inspection';
        return 'role-host';
    }

    const currentPage = visibleItems.find(i => i.path === location.pathname)?.label || 'مشغل أبو يوسف';
    const initials = (user.full_name || user.username || 'U').slice(0, 2);

    return (
        <div className="app-layout">
            {/* Drawer backdrop */}
            {isSidebarOpen && (
                <div className="drawer-backdrop" onClick={() => setIsSidebarOpen(false)} />
            )}

            {/* ── Sidebar ── */}
            <div className={`sidebar ${isSidebarOpen ? 'mobile-open' : ''}`}>
                <div className="sidebar-inner">
                    {/* Brand */}
                    <div className="brand">
                        <div className="brand-icon" style={{ color: '#fff' }}>{Icons.shop}</div>
                        <div className="brand-text">
                            <span className="brand-name">مشغل أبو يوسف</span>
                            <span className="brand-sub">نظام الإدارة</span>
                        </div>
                    </div>

                    {/* Nav */}
                    <div className="nav-items">
                        {visibleItems.map(item => (
                            <div
                                key={item.path}
                                className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                                onClick={() => { navigate(item.path); setIsSidebarOpen(false); }}
                            >
                                <span className="nav-icon">{item.icon}</span>
                                <span className="nav-label">{item.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* User box */}
                    <div className="userbox">
                        <div className="user-info">
                            <div className="user-avatar">{initials}</div>
                            <div className="user-details">
                                <span className="user-name">{user.full_name || user.username}</span>
                                <span className={`role-badge ${roleClass(user.role)}`}>
                                    {roleLabel(user.role)}
                                </span>
                            </div>
                        </div>
                        <button className="logout-btn" onClick={handleLogout}>
                            {Icons.logout}
                            تسجيل الخروج
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Main content ── */}
            <div className="main-content">
                {/* Mobile topbar */}
                <div className="mobile-topbar">
                    <button className="hamburger" onClick={() => setIsSidebarOpen(s => !s)} aria-label="Toggle menu">
                        {Icons.menu}
                    </button>
                    <div className="mobile-brand">مشغل أبو يوسف</div>
                    <div className="mobile-page-name">{currentPage}</div>
                </div>

                <Routes>
                    <Route path="/"              element={isAdmin ? <Dashboard /> : <Navigate to={user?.role === 'inspection_coordinator' ? '/boxes' : '/categories'} replace />} />
                    {(isAdmin || isHost) && <Route path="/attendance"    element={<Attendance />} />}
                    <Route path="/categories"    element={user?.role === 'inspection_coordinator' ? <Navigate to="/boxes" replace /> : <Categories />} />
                    {isAdmin  && <Route path="/workers"       element={<Workers />}    />}
                    {!isHost  && <Route path="/boxes"         element={<Boxes />}      />}
                    {isAdmin  && <Route path="/sessions"      element={<Sessions />}   />}
                    {isAdmin  && <Route path="/archive"       element={<Archive />}    />}
                    {isAdmin  && <Route path="/hosts"         element={<Hosts />}      />}
                    <Route path="*" element={<Navigate to={user?.role === 'inspection_coordinator' ? '/boxes' : '/'} replace />} />
                </Routes>

                <div className="app-footer no-print">
                    حقوق الملكية الفكرية © مشغل أبو يوسف · جميع الحقوق محفوظة
                </div>
            </div>
        </div>
    );
}

function App() {
    return (
        <AuthProvider>
            <Toaster
                position="top-center"
                toastOptions={{
                    className: 'toast-custom',
                    style: {
                        fontFamily: "'Tajawal', inherit",
                        direction: 'rtl',
                        borderRadius: '12px',
                        padding: '12px 18px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    },
                    success: { iconTheme: { primary: '#27AE60', secondary: '#fff' } },
                    error:   { iconTheme: { primary: '#C0392B', secondary: '#fff' } },
                }}
            />
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/*"     element={<AppLayout />} />
            </Routes>
        </AuthProvider>
    );
}

export default App;
