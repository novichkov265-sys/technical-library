import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Header.css';
export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  const roleNames = {
    admin: 'Администратор',
    librarian: 'Библиотекарь',
    department_head: 'Руководитель отдела',
    technical_specialist: 'Технический специалист',
  };
  const hasRole = (roles) => {
    if (typeof roles === 'string') {
      return user?.role === roles;
    }
    return roles.includes(user?.role);
  };
  const isAdminTab = (tab) => {
    const params = new URLSearchParams(location.search);
    const currentTab = params.get('tab') || 'users';
    return location.pathname === '/admin' && currentTab === tab;
  };
  const isActivePage = (path) => {
    return location.pathname === path;
  };
  const getLinkClass = (isActive) => {
    return `header-nav-link ${isActive ? 'active' : ''}`;
  };
  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="header-logo">
          <div className="header-logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <span>Техническая Библиотека</span>
        </Link>
        <nav className="header-nav">
          {user?.role !== 'admin' && (
            <>
              <Link to="/" className={getLinkClass(isActivePage('/'))}>
                Главная
              </Link>
              <Link to="/search" className={getLinkClass(isActivePage('/search'))}>
                Поиск
              </Link>
              <Link to="/favorites" className={getLinkClass(isActivePage('/favorites'))}>
                Избранное
              </Link>
              <Link to="/categories" className={getLinkClass(isActivePage('/categories'))}>
                Категории
              </Link>
            </>
          )}
          {hasRole('librarian') && (
            <>
              <Link to="/upload" className={getLinkClass(isActivePage('/upload'))}>
                Загрузить
              </Link>
              <Link to="/tickets" className={getLinkClass(isActivePage('/tickets'))}>
                Согласование
              </Link>
            </>
          )}
          {hasRole('department_head') && (
            <Link to="/tickets" className={getLinkClass(isActivePage('/tickets'))}>
              Согласование
            </Link>
          )}
          {hasRole('admin') && (
            <>
              <Link to="/admin?tab=users" className={getLinkClass(isAdminTab('users'))}>
                Пользователи
              </Link>
              <Link to="/admin?tab=settings" className={getLinkClass(isAdminTab('settings'))}>
                Настройки
              </Link>
              <Link to="/admin?tab=backups" className={getLinkClass(isAdminTab('backups'))}>
                Резервные копии
              </Link>
              <Link to="/admin?tab=analytics" className={getLinkClass(isAdminTab('analytics'))}>
                Аналитика
              </Link>
              <Link to="/admin?tab=logs" className={getLinkClass(isAdminTab('logs'))}>
                Журнал
              </Link>
            </>
          )}
        </nav>
        <div className="header-user">
          <Link to="/profile" className="header-user-info">
            <div className="header-user-name">{user?.full_name}</div>
            <div className="header-user-role">{roleNames[user?.role]}</div>
          </Link>
          <button onClick={handleLogout} className="header-logout">
            Выйти
          </button>
        </div>
      </div>
    </header>
  );
}