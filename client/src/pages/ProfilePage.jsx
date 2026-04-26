import { useState, useEffect, useRef } from 'react';
import { authApi, settingsApi, getApiUrl } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import './ProfilePage.css';

export default function ProfilePage() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    full_name: '',
    position: '',
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDeleteAvatarModal, setShowDeleteAvatarModal] = useState(false);
  const [settings, setSettings] = useState([]);

  useEffect(() => {
    loadProfile();
    loadSettings();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await authApi.getProfile();
      setCurrentUser(response.data);
      setFormData((prev) => ({
        ...prev,
        full_name: response.data.full_name || '',
        position: response.data.position || '',
      }));
    } catch (err) {
      console.error('Ошибка загрузки профиля:', err);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await settingsApi.getPublic();
      const settingsObj = response.data;
      const settingsArray = Object.entries(settingsObj).map(([key, value]) => ({ key, value }));
      setSettings(settingsArray);
    } catch (err) {
      console.error('Ошибка загрузки настроек:', err);
    }
  };

  const getSettingValue = (key, defaultValue = '') => {
    const setting = settings.find(s => s.key === key);
    return setting ? setting.value : defaultValue;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.new_password) {
      const minLength = parseInt(getSettingValue('password_min_length', '6'));

      if (formData.new_password.length < minLength) {
        setError(`Пароль должен быть не менее ${minLength} символов`);
        return;
      }

      const hasUpperCase = /[A-ZА-Я]/.test(formData.new_password);
      const hasLowerCase = /[a-zа-я]/.test(formData.new_password);
      const hasNumbers = /\d/.test(formData.new_password);

      if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
        setError('Пароль должен содержать заглавные и строчные буквы, а также цифры');
        return;
      }

      if (formData.new_password !== formData.confirm_password) {
        setError('Пароли не совпадают');
        return;
      }

      if (!formData.current_password) {
        setError('Введите текущий пароль');
        return;
      }
    }

    setLoading(true);

    try {
      const updateData = {
        full_name: formData.full_name,
        position: formData.position,
      };

      if (formData.new_password) {
        updateData.current_password = formData.current_password;
        updateData.new_password = formData.new_password;
      }

      await authApi.updateProfile(updateData);
      setSuccess('Профиль успешно обновлен');
      
      setFormData((prev) => ({
        ...prev,
        current_password: '',
        new_password: '',
        confirm_password: '',
      }));

      loadProfile();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка обновления профиля');
    }

    setLoading(false);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Размер файла не должен превышать 5 МБ');
      return;
    }

    setAvatarLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await authApi.uploadAvatar(formData);
      setCurrentUser(response.data);
      setSuccess('Фото профиля обновлено');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка загрузки фото');
    }

    setAvatarLoading(false);
    e.target.value = '';
  };

  const handleDeleteAvatar = async () => {
    setAvatarLoading(true);
    setError('');

    try {
      const response = await authApi.deleteAvatar();
      setCurrentUser(response.data);
      setSuccess('Фото профиля удалено');
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка удаления фото');
    }

    setAvatarLoading(false);
    setShowDeleteAvatarModal(false);
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

  const getAvatarColorClass = (name) => {
    if (!name) return 'profile-avatar__placeholder--blue';
    const colors = ['blue', 'green', 'yellow', 'red', 'purple', 'pink', 'indigo', 'teal'];
    const index = name.charCodeAt(0) % colors.length;
    return `profile-avatar__placeholder--${colors[index]}`;
  };

  const getAvatarUrl = (avatarPath) => {
    if (!avatarPath) return null;
    const apiUrl = getApiUrl();
    const baseUrl = apiUrl.replace('/api', '');
    return `${baseUrl}${avatarPath}`;
  };

  const displayUser = currentUser || user;
  const minPasswordLength = getSettingValue('password_min_length', '6');

  return (
    <Layout>
      <div className="profile-page">
        <h1 className="profile-page__title">Профиль</h1>

        {/* Карточка профиля */}
        <div className="profile-card">
          <div className="profile-card__content">
            <div className="profile-avatar">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarChange}
                className="profile-avatar__input"
              />
              
              {displayUser?.avatar_url ? (
                <img
                  src={getAvatarUrl(displayUser.avatar_url)}
                  alt="Аватар"
                  className="profile-avatar__image"
                  onClick={handleAvatarClick}
                />
              ) : (
                <div 
                  className={`profile-avatar__placeholder ${getAvatarColorClass(displayUser?.full_name)}`}
                  onClick={handleAvatarClick}
                >
                  {avatarLoading ? (
                    <div className="profile-avatar__spinner"></div>
                  ) : (
                    getInitials(displayUser?.full_name)
                  )}
                </div>
              )}

              {displayUser?.avatar_url && (
                <button
                  onClick={() => setShowDeleteAvatarModal(true)}
                  disabled={avatarLoading}
                  className="profile-avatar__delete"
                  title="Удалить фото"
                >
                  &times;
                </button>
              )}
            </div>
            
            <div className="profile-info">
              <h2 className="profile-info__name">{displayUser?.full_name}</h2>
              <p className="profile-info__email">{displayUser?.email}</p>
              <div className="profile-info__badges">
                <span className="profile-info__role">
                  <svg className="profile-info__role-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  {roleNames[displayUser?.role]}
                </span>
                {displayUser?.position && (
                  <span className="profile-info__position">{displayUser?.position}</span>
                )}
              </div>
              <p className="profile-info__hint">Нажмите на аватар, чтобы изменить фото</p>
            </div>
          </div>
        </div>

        {/* Форма редактирования */}
        <div className="profile-form">
          <div className="profile-form__header">
            <div className="profile-form__header-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h2 className="profile-form__title">Редактирование профиля</h2>
          </div>

          <div className="profile-form__body">
            {error && (
              <div className="profile-alert profile-alert--error">
                <svg className="profile-alert__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="profile-alert__text">{error}</span>
              </div>
            )}

            {success && (
              <div className="profile-alert profile-alert--success">
                <svg className="profile-alert__icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="profile-alert__text">{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="profile-form__fields">
                <div className="profile-form__group">
                  <label className="profile-form__label">
                    <svg className="profile-form__label-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    ФИО
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    className="profile-form__input"
                    placeholder="Введите ваше полное имя"
                  />
                </div>

                <div className="profile-form__group">
                  <label className="profile-form__label">
                    <svg className="profile-form__label-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Должность
                  </label>
                  <input
                    type="text"
                    name="position"
                    value={formData.position}
                    onChange={handleChange}
                    className="profile-form__input"
                    placeholder="Введите вашу должность"
                  />
                </div>
              </div>

              <div className="profile-form__divider">
                <div className="profile-form__divider-line"></div>
                <span className="profile-form__divider-text">Безопасность</span>
                <div className="profile-form__divider-line"></div>
              </div>

              <div className="profile-form__section-header">
                <svg className="profile-form__section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <h3 className="profile-form__section-title">Изменение пароля</h3>
              </div>
              <p className="profile-form__section-desc">Оставьте поля пустыми, если не хотите менять пароль</p>

              <div className="profile-form__fields">
                <div className="profile-form__group">
                  <label className="profile-form__label">Текущий пароль</label>
                  <input
                    type="password"
                    name="current_password"
                    value={formData.current_password}
                    onChange={handleChange}
                    className="profile-form__input"
                    placeholder="Введите текущий пароль"
                  />
                </div>

                <div className="profile-form__group">
                  <label className="profile-form__label">Новый пароль</label>
                  <input
                    type="password"
                    name="new_password"
                    value={formData.new_password}
                    onChange={handleChange}
                    className="profile-form__input"
                    minLength={parseInt(minPasswordLength)}
                    placeholder="Введите новый пароль"
                  />
                  <p className="profile-form__hint">
                    <svg className="profile-form__hint-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Минимум {minPasswordLength} символов, заглавные и строчные буквы, цифры
                  </p>
                </div>

                <div className="profile-form__group">
                  <label className="profile-form__label">Подтверждение пароля</label>
                  <input
                    type="password"
                    name="confirm_password"
                    value={formData.confirm_password}
                    onChange={handleChange}
                    className="profile-form__input"
                    placeholder="Повторите новый пароль"
                  />
                </div>

                <button type="submit" disabled={loading} className="profile-form__submit">
                  {loading ? (
                    <>
                      <div className="profile-form__submit-spinner"></div>
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <svg className="profile-form__submit-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Сохранить изменения
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteAvatarModal}
        onClose={() => setShowDeleteAvatarModal(false)}
        onConfirm={handleDeleteAvatar}
        title="Удалить фото профиля"
        message="Вы уверены, что хотите удалить фото профиля?"
        confirmText="Удалить"
        confirmStyle="danger"
      />
    </Layout>
  );
}