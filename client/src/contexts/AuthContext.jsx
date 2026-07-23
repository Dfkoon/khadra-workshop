import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('khadraUser');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });
    const [loading, setLoading] = useState(true);

    const checkAuth = useCallback(async () => {
        const token = localStorage.getItem('khadraToken');
        if (!token) {
            setUser(null);
            localStorage.removeItem('khadraUser');
            setLoading(false);
            return;
        }
        try {
            const data = await api.me();
            setUser(data.user);
            localStorage.setItem('khadraUser', JSON.stringify(data.user));
        } catch (err) {
            // Only clear token if explicit 401 or 403 authorization error
            if (err?.status === 401 || err?.status === 403) {
                localStorage.removeItem('khadraToken');
                localStorage.removeItem('khadraUser');
                setUser(null);
            }
        }
        setLoading(false);
    }, []);

    useEffect(() => { checkAuth(); }, [checkAuth]);

    const login = async (username, password) => {
        const data = await api.login(username, password);
        if (data.requires2fa) {
            return data;
        }
        localStorage.setItem('khadraToken', data.token);
        localStorage.setItem('khadraUser', JSON.stringify(data.user));
        setUser(data.user);
        return data.user;
    };

    const verifyTwoFactor = async (tempToken, code) => {
        const data = await api.verifyTwoFactor(tempToken, code);
        localStorage.setItem('khadraToken', data.token);
        localStorage.setItem('khadraUser', JSON.stringify(data.user));
        setUser(data.user);
        return data.user;
    };

    const logout = () => {
        localStorage.removeItem('khadraToken');
        localStorage.removeItem('khadraUser');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, verifyTwoFactor, checkAuth }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
