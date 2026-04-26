import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { usersApi, settingsApi, backupApi } from '../services/api';
import { useSettings } from '../contexts/SettingsContext';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import './AdminPage.css';

export default function AdminPage() {
  const { refreshSettings } = useSettings();
  const location = useLocation();
  
  // Синхронизация с URL
  const searchParams = new URLSearchParams(location.search);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'users');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab') || 'users';
    setActiveTab(tab);
  }, [location.search]);
  
  // Users
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [modalError, setModalError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    full_name: '',
    position: '',
    role: 'technical_specialist',
  });

  // Settings
  const [settings, setSettings] = useState([]);
  
  // Backups
  const [backups, setBackups] = useState([]);
  
  // Analytics
  const [analytics, setAnalytics] = useState(null);
  
  // Audit
  const [auditLogs, setAuditLogs] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    confirmStyle: 'danger',
    onConfirm: () => {},
  });

  const typeNames = {
    drawing: 'Чертеж',
    standard: 'Стандарт',
    specification: 'Спецификация',
    instruction: 'Инструкция',
    manual: 'Руководство',
    other: 'Другое',
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    
    try {
      if (activeTab === 'users') {
        const response = await usersApi.getAll();
        setUsers(response.data);
      } else if (activeTab === 'settings') {
        const response = await settingsApi.getAll();
        setSettings(response.data);
      } else if (activeTab === 'backups') {
        const response = await backupApi.getAll();
        setBackups(response.data);
      } else if (activeTab === 'analytics') {
        const response = await usersApi.getAnalytics();
        setAnalytics(response.data);
      } else if (activeTab === 'logs') {
        const response = await usersApi.getAuditLogs();
        setAuditLogs(response.data);
      }
    } catch (err) {
      console.error('Ошибка загрузки:', err);
      setError('Ошибка загрузки данных: ' + (err.response?.data?.error || err.message));
    }
    
    setLoading(false);
  };

  // Фильтрация пользователей
  const filteredUsers = users.filter(user => {
    if (!userSearch.trim()) return true;
    const search = userSearch.toLowerCase();
    return (
      user.full_name?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search) ||
      user.position?.toLowerCase().includes(search)
    );
  });

  // User handlers
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    
    // Валидация пароля
    const minLength = parseInt(getSettingValue('password_min_length', '6'));
    
    if (!editingUser && userForm.password.length < minLength) {
      setModalError(`Пароль должен быть не менее ${minLength} символов`);
      return;
    }
    
    if (editingUser && userForm.password && userForm.password.length < minLength) {
      setModalError(`Пароль должен быть не менее ${minLength} символов`);
      return;
    }
    
    // Проверка на сложность пароля
    if (userForm.password && userForm.password.length > 0) {
      const hasUpperCase = /[A-ZА-Я]/.test(userForm.password);
      const hasLowerCase = /[a-zа-я]/.test(userForm.password);
      const hasNumbers = /\d/.test(userForm.password);
      
      if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
        setModalError('Пароль должен содержать заглавные и строчные буквы, а также цифры');
        return;
      }
    }
    
    try {
      if (editingUser) {
        await usersApi.update(editingUser.id, userForm);
        setSuccess('Пользователь обновлен');
      } else {
        await usersApi.create(userForm);
        setSuccess('Пользователь создан');
      }
      setShowUserModal(false);
      setModalError('');
      resetUserForm();
      loadData();
    } catch (err) {
      setModalError(err.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setUserForm({
      email: user.email,
      password: '',
      full_name: user.full_name,
      position: user.position || '',
      role: user.role,
    });
    setModalError('');
    setShowUserModal(true);
  };

  const handleDeleteUser = async (userId) => {
    try {
      await usersApi.delete(userId);
      setSuccess('Пользователь удален');
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка удаления');
    }
  };

  const openDeleteUserModal = (userId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Удалить пользователя',
      message: 'Вы уверены, что хотите удалить этого пользователя? Это действие нельзя отменить.',
      confirmText: 'Удалить',
      confirmStyle: 'danger',
      onConfirm: () => handleDeleteUser(userId),
    });
  };

  const resetUserForm = () => {
    setEditingUser(null);
    setUserForm({
      email: '',
      password: '',
      full_name: '',
      position: '',
      role: 'technical_specialist',
    });
  };

  // Settings handlers
  const handleSettingChange = async (key, value) => {
    try {
      await settingsApi.update(key, value);
      setSuccess('Настройка сохранена');
      refreshSettings();
      loadData();
    } catch (err) {
      setError('Ошибка сохранения настройки');
    }
  };

  // Получение значения настройки
  const getSettingValue = (key, defaultValue = '') => {
    const setting = settings.find(s => s.key === key);
    return setting?.value || defaultValue;
  };

  // Backup handlers
  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      await backupApi.create();
      setSuccess('Резервная копия создана');
      loadData();
    } catch (err) {
      setError('Ошибка создания резервной копии');
    }
    setLoading(false);
  };

  const handleRestoreBackup = async (filename) => {
    setLoading(true);
    try {
      await backupApi.restore(filename);
      setSuccess('Данные восстановлены из резервной копии');
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка восстановления');
    }
    setLoading(false);
  };

  const openRestoreBackupModal = (filename) => {
    setConfirmModal({
      isOpen: true,
      title: 'Восстановить резервную копию',
      message: 'Восстановить данные из этой резервной копии? Текущие данные будут перезаписаны!',
      confirmText: 'Восстановить',
      confirmStyle: 'warning',
      onConfirm: () => handleRestoreBackup(filename),
    });
  };

  const handleDownloadBackup = async (filename) => {
    try {
      const response = await backupApi.download(filename);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Ошибка скачивания');
    }
  };

  const handleDeleteBackup = async (id) => {
    try {
      await backupApi.delete(id);
      setSuccess('Резервная копия удалена');
      loadData();
    } catch (err) {
      setError('Ошибка удаления');
    }
  };

  const openDeleteBackupModal = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Удалить резервную копию',
      message: 'Вы уверены, что хотите удалить эту резервную копию?',
      confirmText: 'Удалить',
      confirmStyle: 'danger',
      onConfirm: () => handleDeleteBackup(id),
    });
  };

  const closeConfirmModal = () => {
    setConfirmModal({ ...confirmModal, isOpen: false });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const roleNames = {
    admin: 'Администратор',
    librarian: 'Библиотекарь',
    department_head: 'Руководитель отдела',
    technical_specialist: 'Технический специалист',
  };

  const actionNames = {
    user_login: 'Вход в систему',
    user_logout: 'Выход из системы',
    user_register: 'Регистрация',
    user_create: 'Создание пользователя',
    user_update: 'Изменение пользователя',
    user_delete: 'Удаление пользователя',
    document_create: 'Создание документа',
    document_update: 'Изменение документа',
    document_delete: 'Удаление документа',
    document_view: 'Просмотр документа',
    document_download: 'Скачивание документа',
    document_archive: 'Архивация документа',
    document_restore: 'Восстановление документа',
    document_approve: 'Согласование документа',
    document_reject: 'Отклонение документа',
    settings_update: 'Изменение настроек',
    backup_create: 'Создание резервной копии',
    backup_restore: 'Восстановление из копии',
    backup_delete: 'Удаление резервной копии',
  };

  // Автоскрытие уведомлений
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  return (
    <Layout>
      {/* Error Modal */}
      {error && (
        <div className="admin-error-overlay">
          <div className="admin-error-modal">
            <div className="admin-error-header">
              <div className="admin-error-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="admin-error-title">Ошибка</h3>
            </div>
            <p className="admin-error-message">{error}</p>
            <div className="admin-error-actions">
              <button onClick={() => setError('')} className="btn btn-primary">
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {success && (
        <div className="admin-success-toast">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="admin-success-close">&times;</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="admin-loading">
          <div className="admin-spinner"></div>
          <p>Загрузка...</p>
        </div>
      )}

      {/* Пользователи */}
      {activeTab === 'users' && !loading && (
        <div className="card admin-page">
          <div className="admin-section-header">
            <div className="admin-search">
              <svg className="admin-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Поиск по имени, email или должности..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="input"
              />
            </div>
            
            <button
              onClick={() => {
                resetUserForm();
                setModalError('');
                setShowUserModal(true);
              }}
              className="btn btn-primary"
            >
              Добавить пользователя
            </button>
          </div>
          
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th>Email</th>
                  <th>Роль</th>
                  <th>Должность</th>
                  <th className="text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="admin-table-empty">
                      {userSearch ? 'Пользователи не найдены' : 'Нет пользователей'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="admin-table-name">{user.full_name}</td>
                      <td>{user.email}</td>
                      <td>{roleNames[user.role]}</td>
                      <td>{user.position || '-'}</td>
                      <td>
                        <div className="admin-table-actions">
                          <span onClick={() => handleEditUser(user)} className="admin-link admin-link-edit">
                            Изменить
                          </span>
                          <span onClick={() => openDeleteUserModal(user.id)} className="admin-link admin-link-delete">
                            Удалить
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {userSearch && (
            <p className="admin-results-count">
              Найдено: {filteredUsers.length} из {users.length}
            </p>
          )}
        </div>
      )}

      {/* Настройки */}
      {activeTab === 'settings' && !loading && (
        <div className="admin-settings-container admin-page">
          {/* Основные настройки */}
          <div className="admin-settings-card">
            <h3 className="admin-settings-title">Основные настройки</h3>
            <div className="admin-settings-list">
              <div className="admin-setting-item">
                <label className="admin-setting-label">Название приложения</label>
                <input
                  type="text"
                  key={`app_name_${getSettingValue('app_name', 'Техническая Библиотека')}`}
                  defaultValue={getSettingValue('app_name', 'Техническая Библиотека')}
                  className="input"
                  onBlur={(e) => {
                    if (e.target.value !== getSettingValue('app_name')) {
                      handleSettingChange('app_name', e.target.value);
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Настройки файлов */}
          <div className="admin-settings-card">
            <h3 className="admin-settings-title">Настройки файлов</h3>
            <div className="admin-settings-list">
              <div className="admin-setting-item">
                <label className="admin-setting-label">Максимальный размер файла</label>
                <div className="admin-setting-row">
                  <input
                    type="number"
                    key={`max_file_size_${getSettingValue('max_file_size', '52428800')}`}
                    defaultValue={Math.round(parseInt(getSettingValue('max_file_size', '52428800')) / 1024 / 1024)}
                    className="input"
                    min="1"
                    max="500"
                    onBlur={(e) => {
                      const bytes = parseInt(e.target.value) * 1024 * 1024;
                      handleSettingChange('max_file_size', bytes.toString());
                    }}
                  />
                  <span>МБ</span>
                </div>
              </div>
              
              <div className="admin-setting-item">
                <label className="admin-setting-label">Разрешенные расширения файлов</label>
                <input
                  type="text"
                  key={`allowed_extensions_${getSettingValue('allowed_extensions', 'pdf,doc,docx,xls,xlsx,dwg,dxf')}`}
                  defaultValue={getSettingValue('allowed_extensions', 'pdf,doc,docx,xls,xlsx,dwg,dxf')}
                  className="input"
                  placeholder="pdf,doc,docx,xls,xlsx"
                  onBlur={(e) => {
                    handleSettingChange('allowed_extensions', e.target.value);
                  }}
                />
                <p className="admin-setting-hint">Введите расширения через запятую без пробелов</p>
              </div>
              
              <div className="admin-setting-item">
                <label className="admin-setting-label">Предпросмотр документов</label>
                <label className="admin-checkbox-wrapper">
                  <input
                    type="checkbox"
                    checked={getSettingValue('preview_enabled', 'true') === 'true'}
                    onChange={(e) => handleSettingChange('preview_enabled', e.target.checked.toString())}
                    className="admin-checkbox"
                  />
                  <span className="admin-checkbox-label">
                    {getSettingValue('preview_enabled', 'true') === 'true' ? 'Включен' : 'Выключен'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Настройки безопасности */}
          <div className="admin-settings-card">
            <h3 className="admin-settings-title">Безопасность</h3>
            <div className="admin-settings-list">
              <div className="admin-setting-item">
                <label className="admin-setting-label">Время сессии (минуты)</label>
                <div className="admin-setting-row">
                  <input
                    type="number"
                    key={`session_timeout_${getSettingValue('session_timeout', '60')}`}
                    defaultValue={parseInt(getSettingValue('session_timeout', '60'))}
                    className="input"
                    min="5"
                    max="1440"
                    onBlur={(e) => {
                      handleSettingChange('session_timeout', e.target.value);
                    }}
                  />
                  <span>минут</span>
                </div>
                <p className="admin-setting-hint">Через сколько минут неактивности выходить из системы</p>
              </div>
              
              <div className="admin-setting-item">
                <label className="admin-setting-label">Максимум неудачных попыток входа</label>
                <input
                  type="number"
                  key={`max_login_attempts_${getSettingValue('max_login_attempts', '5')}`}
                  defaultValue={parseInt(getSettingValue('max_login_attempts', '5'))}
                  className="input"
                  style={{ width: '120px' }}
                  min="3"
                  max="10"
                  onBlur={(e) => {
                    handleSettingChange('max_login_attempts', e.target.value);
                  }}
                />
                <p className="admin-setting-hint">После превышения аккаунт будет временно заблокирован</p>
              </div>
              
              <div className="admin-setting-item">
                <label className="admin-setting-label">Минимальная длина пароля</label>
                <input
                  type="number"
                  key={`password_min_length_${getSettingValue('password_min_length', '6')}`}
                  defaultValue={parseInt(getSettingValue('password_min_length', '6'))}
                  className="input"
                  style={{ width: '120px' }}
                  min="4"
                  max="32"
                  onBlur={(e) => {
                    handleSettingChange('password_min_length', e.target.value);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Настройки архива */}
          <div className="admin-settings-card">
            <h3 className="admin-settings-title">Архив</h3>
            <div className="admin-settings-list">
              <div className="admin-setting-item">
                <label className="admin-setting-label">Срок хранения архивных документов</label>
                <div className="admin-setting-row">
                  <input
                    type="number"
                    key={`archive_retention_${getSettingValue('archive_retention_days', '365')}`}
                    defaultValue={parseInt(getSettingValue('archive_retention_days', '365'))}
                    className="input"
                    min="0"
                    max="3650"
                    onBlur={(e) => {
                      handleSettingChange('archive_retention_days', e.target.value);
                    }}
                  />
                  <span>дней</span>
                </div>
                <p className="admin-setting-hint">0 - хранить бессрочно. После истечения срока документы удаляются автоматически.</p>
              </div>
              
              <div className="admin-setting-item">
                <label className="admin-setting-label">Хранить версии документов</label>
                <label className="admin-checkbox-wrapper">
                  <input
                    type="checkbox"
                    checked={getSettingValue('keep_versions', 'true') === 'true'}
                    onChange={(e) => handleSettingChange('keep_versions', e.target.checked.toString())}
                    className="admin-checkbox"
                  />
                  <span className="admin-checkbox-label">
                    {getSettingValue('keep_versions', 'true') === 'true' ? 'Да' : 'Нет'}
                  </span>
                </label>
              </div>
              
              {getSettingValue('keep_versions', 'true') === 'true' && (
                <div className="admin-setting-item">
                  <label className="admin-setting-label">Максимум версий на документ</label>
                  <input
                    type="number"
                    key={`max_versions_${getSettingValue('max_versions', '10')}`}
                    defaultValue={parseInt(getSettingValue('max_versions', '10'))}
                    className="input"
                    style={{ width: '120px' }}
                    min="1"
                    max="100"
                    onBlur={(e) => {
                      handleSettingChange('max_versions', e.target.value);
                    }}
                  />
                  <p className="admin-setting-hint">Старые версии будут удаляться автоматически</p>
                </div>
              )}
              
              <div className="admin-setting-item">
                <label className="admin-setting-label">Автоудаление закрытых тикетов</label>
                <div className="admin-setting-row">
                  <input
                    type="number"
                    key={`ticket_retention_days_${getSettingValue('ticket_retention_days', '30')}`}
                    defaultValue={parseInt(getSettingValue('ticket_retention_days', '30'))}
                    className="input"
                    min="0"
                    max="365"
                    onBlur={(e) => {
                      handleSettingChange('ticket_retention_days', e.target.value);
                    }}
                  />
                  <span>дней</span>
                </div>
                <p className="admin-setting-hint">0 - не удалять. Отклоненные и закрытые тикеты удаляются автоматически.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Резервные копии */}
      {activeTab === 'backups' && !loading && (
        <div className="card admin-page">
          <div className="admin-section-header">
            <h3 className="admin-settings-title" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>Резервные копии</h3>
            <button onClick={handleCreateBackup} className="btn btn-primary">
              Создать копию
            </button>
          </div>
          
          {backups.length === 0 ? (
            <div className="admin-empty">Резервных копий нет</div>
          ) : (
            <div className="admin-backup-list">
                            {backups.map((backup) => {
                const summary = backup.summary 
                  ? (typeof backup.summary === 'string' ? JSON.parse(backup.summary) : backup.summary)
                  : null;
                
                return (
                  <div key={backup.id} className="admin-backup-item">
                    <div className="admin-backup-info">
                      <h4>{backup.filename}</h4>
                      <p className="admin-backup-meta">
                        <span>{formatDate(backup.created_at)}</span>
                        <span className="admin-backup-meta-separator"></span>
                        <span>{formatFileSize(backup.size_bytes)}</span>
                        <span className="admin-backup-meta-separator"></span>
                        <span>{backup.created_by_name || 'Система'}</span>
                      </p>
                      {summary && (
                        <div className="admin-backup-summary">
                          {summary.documents > 0 && (
                            <span className="admin-backup-summary-item admin-backup-summary-item--docs">
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {summary.documents} док.
                            </span>
                          )}
                          {summary.users > 0 && (
                            <span className="admin-backup-summary-item admin-backup-summary-item--users">
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                              </svg>
                              {summary.users} польз.
                            </span>
                          )}
                          {summary.categories > 0 && (
                            <span className="admin-backup-summary-item admin-backup-summary-item--categories">
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                              </svg>
                              {summary.categories} кат.
                            </span>
                          )}
                          {summary.tags > 0 && (
                            <span className="admin-backup-summary-item admin-backup-summary-item--tags">
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                              </svg>
                              {summary.tags} тегов
                            </span>
                          )}
                          {summary.approval_tickets > 0 && (
                            <span className="admin-backup-summary-item admin-backup-summary-item--tickets">
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                              </svg>
                              {summary.approval_tickets} тикетов
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="admin-backup-actions">
                      <button onClick={() => openRestoreBackupModal(backup.filename)} className="admin-backup-btn admin-backup-btn--restore">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Восстановить
                      </button>
                      <button onClick={() => handleDownloadBackup(backup.filename)} className="admin-backup-btn admin-backup-btn--download">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Скачать
                      </button>
                      <button onClick={() => openDeleteBackupModal(backup.id)} className="admin-backup-btn admin-backup-btn--delete">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Аналитика */}
      {activeTab === 'analytics' && !loading && (
        <div className="admin-analytics admin-page">
          {/* Основные метрики */}
          <div className="admin-metrics-grid">
            <div className="admin-metric-card">
              <div className="admin-metric-value blue">{analytics?.totalDocuments || 0}</div>
              <div className="admin-metric-label">Всего документов</div>
            </div>
            <div className="admin-metric-card">
              <div className="admin-metric-value green">{analytics?.totalUsers || 0}</div>
              <div className="admin-metric-label">Пользователей</div>
            </div>
            <div className="admin-metric-card">
              <div className="admin-metric-value purple">{analytics?.totalDownloads || 0}</div>
              <div className="admin-metric-label">Скачиваний</div>
            </div>
            <div className="admin-metric-card">
              <div className="admin-metric-value orange">{analytics?.totalViews || 0}</div>
              <div className="admin-metric-label">Просмотров</div>
            </div>
          </div>

          <div className="admin-charts-grid">
            {/* Документы по типам */}
            <div className="admin-chart-card">
              <h3 className="admin-chart-title">Документы по типам</h3>
              {analytics?.documentsByType && analytics.documentsByType.length > 0 ? (
                <div className="admin-progress-list">
                  {analytics.documentsByType.map((item, index) => {
                    const colors = ['blue', 'green', 'purple', 'yellow', 'red', 'gray'];
                    const color = colors[index % colors.length];
                    const total = analytics.totalDocuments || 1;
                    const percent = Math.round((item.count / total) * 100);
                    return (
                      <div key={item.type} className="admin-progress-item">
                        <div className="admin-progress-header">
                          <span className="admin-progress-label">{typeNames[item.type] || item.type}</span>
                          <span className="admin-progress-value">{item.count} ({percent}%)</span>
                        </div>
                        <div className="admin-progress-bar">
                          <div className={`admin-progress-fill ${color}`} style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="admin-empty">Нет данных о документах</div>
              )}
            </div>

            {/* Документы по статусам */}
            <div className="admin-chart-card">
              <h3 className="admin-chart-title">Документы по статусам</h3>
              {analytics?.documentsByStatus && analytics.documentsByStatus.length > 0 ? (
                <div className="admin-progress-list">
                  {analytics.documentsByStatus.map((item) => {
                    const statusNames = {
                      'in_library': 'В библиотеке',
                      'pending_approval': 'На согласовании',
                      'archived': 'В архиве',
                      'rejected': 'Отклонено'
                    };
                    const statusColors = {
                      'in_library': 'green',
                      'pending_approval': 'yellow',
                      'archived': 'gray',
                      'rejected': 'red'
                    };
                    const total = analytics.totalDocuments || 1;
                    const percent = Math.round((item.count / total) * 100);
                    return (
                      <div key={item.status} className="admin-progress-item">
                        <div className="admin-progress-header">
                          <span className="admin-progress-label">{statusNames[item.status] || item.status}</span>
                          <span className="admin-progress-value">{item.count} ({percent}%)</span>
                        </div>
                        <div className="admin-progress-bar">
                          <div className={`admin-progress-fill ${statusColors[item.status] || 'blue'}`} style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="admin-empty">Нет данных о статусах</div>
              )}
            </div>

            {/* Пользователи по ролям */}
            <div className="admin-chart-card">
              <h3 className="admin-chart-title">Пользователи по ролям</h3>
              {analytics?.usersByRole && analytics.usersByRole.length > 0 ? (
                <div className="admin-progress-list">
                  {analytics.usersByRole.map((item, index) => {
                    const colors = ['blue', 'green', 'purple', 'yellow'];
                    const color = colors[index % colors.length];
                    const total = analytics.totalUsers || 1;
                    const percent = Math.round((item.count / total) * 100);
                    return (
                      <div key={item.role} className="admin-progress-item">
                        <div className="admin-progress-header">
                          <span className="admin-progress-label">{roleNames[item.role] || item.role}</span>
                          <span className="admin-progress-value">{item.count} ({percent}%)</span>
                        </div>
                        <div className="admin-progress-bar">
                          <div className={`admin-progress-fill ${color}`} style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="admin-empty">Нет данных о пользователях</div>
              )}
            </div>

            {/* Документы по категориям */}
            <div className="admin-chart-card">
              <h3 className="admin-chart-title">Документы по категориям</h3>
              {analytics?.documentsByCategory && analytics.documentsByCategory.length > 0 ? (
                <div className="admin-progress-list">
                  {analytics.documentsByCategory.map((item, index) => {
                    const colors = ['purple', 'blue', 'green', 'yellow', 'red', 'gray'];
                    const color = colors[index % colors.length];
                    const total = analytics.totalDocuments || 1;
                    const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;
                    return (
                      <div key={item.category} className="admin-progress-item">
                        <div className="admin-progress-header">
                          <span className="admin-progress-label">{item.category || 'Без категории'}</span>
                          <span className="admin-progress-value">{item.count} ({percent}%)</span>
                        </div>
                        <div className="admin-progress-bar">
                          <div className={`admin-progress-fill ${color}`} style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="admin-empty">Нет данных о категориях</div>
              )}
            </div>
          </div>

          {/* Популярные документы */}
          {analytics?.popularDocuments && analytics.popularDocuments.length > 0 && (
            <div className="admin-chart-card">
              <h3 className="admin-chart-title">Популярные документы</h3>
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Тип</th>
                      <th className="text-right">Просмотров</th>
                      <th className="text-right">Скачиваний</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.popularDocuments.map((doc) => (
                      <tr key={doc.id}>
                        <td className="admin-table-name">{doc.title}</td>
                        <td>{typeNames[doc.type] || doc.type}</td>
                        <td style={{ textAlign: 'right' }}>{doc.views || 0}</td>
                        <td style={{ textAlign: 'right' }}>{doc.downloads || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Журнал действий */}
      {activeTab === 'logs' && !loading && (
        <div className="card admin-page">
          <div className="admin-logs-header">
            <h3 className="admin-logs-title">Журнал действий</h3>
            <span className="admin-logs-count">Всего записей: {auditLogs.length}</span>
          </div>
          
          {auditLogs.length === 0 ? (
            <div className="admin-empty">Записей пока нет</div>
          ) : (
            <div>
              {(() => {
                // Группируем по датам
                const grouped = auditLogs.reduce((acc, log) => {
                  const date = new Date(log.created_at).toLocaleDateString('ru-RU', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  });
                  if (!acc[date]) acc[date] = [];
                  acc[date].push(log);
                  return acc;
                }, {});

                return Object.entries(grouped).map(([date, logs]) => (
                  <div key={date} className="admin-logs-group">
                    <div className="admin-logs-date">{date}</div>
                    <div className="admin-table-wrapper">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Время</th>
                            <th>Пользователь</th>
                            <th>Действие</th>
                            <th>Объект</th>
                            <th>IP адрес</th>
                          </tr>
                        </thead>
                        <tbody>
                          {logs.map((log) => {
                            const getActionClass = (action) => {
                              if (action === 'user_login') return 'login';
                              if (action === 'user_logout') return 'logout';
                              if (action?.includes('create')) return 'create';
                              if (action?.includes('update')) return 'update';
                              if (action?.includes('delete')) return 'delete';
                              if (action?.includes('download')) return 'download';
                              if (action?.includes('view')) return 'view';
                              return 'default';
                            };
                            return (
                              <tr key={log.id}>
                                <td className="admin-log-time">
                                  {new Date(log.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td>{log.user_name || 'Система'}</td>
                                <td>
                                  <span className={`admin-action-badge ${getActionClass(log.action)}`}>
                                    {actionNames[log.action] || log.action}
                                  </span>
                                </td>
                                <td className="admin-log-details">
                                  {log.entity_type ? `${log.entity_type}${log.entity_id ? ` #${log.entity_id}` : ''}` : '-'}
                                </td>
                                <td className="admin-log-details">{log.ip_address || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}

      {/* Модалка создания/редактирования пользователя */}
      {showUserModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <h3 className="admin-modal-title">
              {editingUser ? 'Редактирование пользователя' : 'Новый пользователь'}
            </h3>
            <form onSubmit={handleUserSubmit}>
              {modalError && (
                <div className="admin-modal-error">{modalError}</div>
              )}
              
              <div className="admin-form-group">
                <label className="admin-form-label">ФИО *</label>
                <input
                  type="text"
                  value={userForm.full_name}
                  onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                  className="input"
                  required
                />
              </div>
              
              <div className="admin-form-group">
                <label className="admin-form-label">Email *</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="input"
                  required
                />
              </div>
              
              <div className="admin-form-group">
                <label className="admin-form-label">
                  Пароль {editingUser ? '(оставьте пустым, чтобы не менять)' : '*'}
                </label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="input"
                  required={!editingUser}
                  minLength={parseInt(getSettingValue('password_min_length', '6'))}
                />
                <p className="admin-form-hint">
                  Минимум {getSettingValue('password_min_length', '6')} символов, заглавные и строчные буквы, цифры
                </p>
              </div>
              
              <div className="admin-form-group">
                <label className="admin-form-label">Должность</label>
                <input
                  type="text"
                  value={userForm.position}
                  onChange={(e) => setUserForm({ ...userForm, position: e.target.value })}
                  className="input"
                />
              </div>
              
              <div className="admin-form-group">
                <label className="admin-form-label">Роль *</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  className="input"
                >
                  <option value="technical_specialist">Технический специалист</option>
                  <option value="librarian">Библиотекарь</option>
                  <option value="department_head">Руководитель отдела</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>
              
              <div className="admin-modal-actions">
                <button type="submit" className="btn btn-primary">
                  {editingUser ? 'Сохранить' : 'Создать'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUserModal(false);
                    setModalError('');
                    resetUserForm();
                  }}
                  className="btn btn-secondary"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={() => {
          confirmModal.onConfirm();
          closeConfirmModal();
        }}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmStyle={confirmModal.confirmStyle}
      />
    </Layout>
  );
}
