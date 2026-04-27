import { createContext, useContext, useState, useEffect } from 'react';
import { settingsApi } from '../services/api';
import { useAuth } from './AuthContext';
const SettingsContext = createContext();
export function SettingsProvider({ children }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    app_name: 'Электронная библиотека',
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);
  const loadSettings = async () => {
    try {
      const response = await settingsApi.getPublic();
      setSettings(response.data);
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error);
    }
    setLoading(false);
  };
  const refreshSettings = () => {
    loadSettings();
  };
  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}
export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}