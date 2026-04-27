import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { getApiUrl } from '../services/api';
import NotificationBell from './NotificationBell';
import './Layout.css';
export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
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
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };
  const getAvatarColor = (name) => {
    if (!name) return 'layout-avatar-blue';
    const colors = [
      'layout-avatar-blue',
      'layout-avatar-green',
      'layout-avatar-yellow',
      'layout-avatar-red',
      'layout-avatar-purple',
      'layout-avatar-pink',
      'layout-avatar-indigo',
      'layout-avatar-teal',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };
  const getAvatarUrl = (avatarPath) => {
    if (!avatarPath) return null;
    const apiUrl = getApiUrl();
    const baseUrl = apiUrl.replace('/api', '');
    return `${baseUrl}${avatarPath}`;
  };
  const getMenuItems = () => {
    const items = [];
    if (user?.role !== 'admin') {
      items.push({ path: '/', label: 'Главная', icon: 'home' });
      items.push({ path: '/search', label: 'Поиск', icon: 'search' });
      items.push({ path: '/favorites', label: 'Избранное', icon: 'heart' });
    }
    if (user?.role === 'librarian') {
      items.push({ path: '/upload', label: 'Загрузить', icon: 'upload' });
      items.push({ path: '/tickets', label: 'Согласование', icon: 'clipboard' });
      items.push({ path: '/categories', label: 'Категории', icon: 'folder' });
    }
    if (user?.role === 'department_head') {
      items.push({ path: '/tickets', label: 'Согласование', icon: 'clipboard' });
    }
    if (user?.role === 'admin') {
      items.push({ path: '/admin?tab=users', label: 'Пользователи', icon: 'users' });
      items.push({ path: '/admin?tab=settings', label: 'Настройки', icon: 'settings' });
      items.push({ path: '/admin?tab=backups', label: 'Резервные копии', icon: 'database' });
      items.push({ path: '/admin?tab=analytics', label: 'Аналитика', icon: 'chart' });
      items.push({ path: '/admin?tab=logs', label: 'Журнал', icon: 'list' });
    }
    return items;
  };
  const isActive = (path) => {
    if (path.includes('?')) {
      return location.pathname + location.search === path;
    }
    return location.pathname === path;
  };
  const menuItems = getMenuItems();
  return (
    <div className="layout">
      <header className="layout-header">
        <div className="layout-header-container">
          <div className="layout-header-row">
            {/* Logo */}
            <Link to={user?.role === 'admin' ? '/admin' : '/'} className="layout-logo">
              <div className="layout-logo-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </div>
              <span>{settings.app_name || 'Техническая Библиотека'}</span>
            </Link>
            {/* Navigation */}
            <nav className="layout-nav">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`layout-nav-link ${isActive(item.path) ? 'active' : ''}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {/* User Section */}
            <div className="layout-user">
              {user?.role !== 'admin' && <NotificationBell />}
              <Link to="/profile" className="layout-user-profile">
                <div className="layout-avatar">
                  {user?.avatar_url ? (
                    <img src={getAvatarUrl(user.avatar_url)} alt="Аватар" />
                  ) : (
                    <div className={`layout-avatar-placeholder ${getAvatarColor(user?.full_name)}`}>
                      {getInitials(user?.full_name)}
                    </div>
                  )}
                </div>
                <div className="layout-user-info">
                  <div className="layout-user-name">{user?.full_name}</div>
                  <div className="layout-user-role">{roleNames[user?.role]}</div>
                </div>
              </Link>
              <button onClick={handleLogout} className="layout-logout">
                Выйти
              </button>
            </div>
          </div>
          {/* Mobile Navigation */}
          <nav className="layout-mobile-nav">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`layout-mobile-link ${isActive(item.path) ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="layout-main">{children}</main>
    </div>
  );
}