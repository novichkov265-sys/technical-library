import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authApi, settingsApi } from '../services/api';
const AuthContext = createContext();
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState(60); 
  const timeoutRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('sessionTimeout');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setUser(null);
  }, []);
  const updateLastActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);
  const checkInactivity = useCallback(() => {
    if (!user) return;
    const now = Date.now();
    const inactiveTime = now - lastActivityRef.current;
    const timeoutMs = sessionTimeout * 60 * 1000;
    if (inactiveTime >= timeoutMs) {
      logout();
      window.location.href = '/login?reason=timeout';
    } else {
      const remainingTime = timeoutMs - inactiveTime;
      timeoutRef.current = setTimeout(checkInactivity, Math.min(remainingTime, 60000)); 
    }
  }, [user, sessionTimeout, logout]);
  const loadSessionSettings = useCallback(async () => {
    try {
      const response = await settingsApi.getPublic();
      const timeout = parseInt(response.data.session_timeout) || 60;
      setSessionTimeout(timeout);
      localStorage.setItem('sessionTimeout', timeout.toString());
    } catch (error) {
      console.error('Ошибка загрузки настроек сессии:', error);
    }
  }, []);
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    const savedTimeout = localStorage.getItem('sessionTimeout');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      if (savedTimeout) {
        setSessionTimeout(parseInt(savedTimeout));
      }
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    if (user) {
      loadSessionSettings();
    }
  }, [user, loadSessionSettings]);
  useEffect(() => {
    if (user && sessionTimeout > 0) {
      timeoutRef.current = setTimeout(checkInactivity, 60000);
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
      events.forEach(event => {
        document.addEventListener(event, updateLastActivity, { passive: true });
      });
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        events.forEach(event => {
          document.removeEventListener(event, updateLastActivity);
        });
      };
    }
  }, [user, sessionTimeout, checkInactivity, updateLastActivity]);
  const login = async (email, password) => {
    const response = await authApi.login({ email, password });
    const { token, user, sessionTimeout: serverTimeout } = response.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    if (serverTimeout) {
      setSessionTimeout(serverTimeout);
      localStorage.setItem('sessionTimeout', serverTimeout.toString());
    }
    lastActivityRef.current = Date.now();
    setUser(user);
  };
  const register = async (data) => {
    const response = await authApi.register(data);
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    lastActivityRef.current = Date.now();
    setUser(user);
  };
  const updateUser = (updatedUser) => {
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };
  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, sessionTimeout }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}