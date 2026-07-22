import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const checkAuth = useCallback(async () => {
        const token = localStorage.getItem('khadraToken');
        if (!token) {
            setLoading(false);
            return;
        }
        try {
            const data = await api.me();
            setUser(data.user);
        } catch {
            localStorage.removeItem('khadraToken');
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
        setUser(data.user);
        return data.user;
    };

    const verifyTwoFactor = async (tempToken, code) => {
        const data = await api.verifyTwoFactor(tempToken, code);
        localStorage.setItem('khadraToken', data.token);
        setUser(data.user);
        return data.user;
    };

    const logout = () => {
        localStorage.removeItem('khadraToken');
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

