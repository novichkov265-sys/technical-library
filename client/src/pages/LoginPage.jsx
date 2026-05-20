import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason === 'timeout') {
      setError('Сессия истекла из-за бездействия. Пожалуйста, войдите снова.');
    }
  }, [searchParams]);
  useEffect(() => {
    if (lockTimer > 0) {
      const interval = setInterval(() => {
        setLockTimer(prev => {
          if (prev <= 1) {
            setIsLocked(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lockTimer]);
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLocked) return;
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      const response = err.response;
      
      if (response?.status === 423) {
        // Аккаунт заблокирован
        setIsLocked(true);
        const minutes = response.data?.remainingMinutes || 15;
        setLockTimer(minutes * 60);
        setError(response.data?.error || 'Аккаунт временно заблокирован');
      } else if (response?.data?.remainingAttempts !== undefined) {
        // Неверный пароль с указанием оставшихся попыток
        setError(response.data.error);
      } else {
        setError(response?.data?.error || 'Ошибка входа');
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            <h1 className="login-title">Техническая Библиотека</h1>
            <p className="login-subtitle">Войдите в систему для продолжения</p>
          </div>
          <div className="login-body">
            <form className="login-form" onSubmit={handleSubmit}>
              {error && (
                <div className={`login-error ${isLocked ? 'login-error-locked' : ''}`}>
                  <svg className="login-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {isLocked ? (
                      <>
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </>
                    ) : (
                      <>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </>
                    )}
                  </svg>
                  <span>{error}</span>
                  {isLocked && lockTimer > 0 && (
                    <div className="login-lock-timer">
                      Разблокировка через: {formatTime(lockTimer)}
                    </div>
                  )}
                </div>
              )}
              <div className="login-field">
                <span className="login-field-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                <input
                  type="email"
                  className="login-input"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={isLocked}
                />
              </div>
              <div className="login-field">
                <span className="login-field-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  type="password"
                  className="login-input"
                  placeholder="Пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={isLocked}
                />
              </div>
              <button 
                type="submit" 
                className="login-submit" 
                disabled={loading || isLocked}
              >
                {loading ? (
                  <span className="login-submit-loading">
                    <span className="spinner spinner-sm"></span>
                    <span>Вход...</span>
                  </span>
                ) : isLocked ? (
                  'Аккаунт заблокирован'
                ) : (
                  'Войти'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}