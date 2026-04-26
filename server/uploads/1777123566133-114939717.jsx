import { useState, useEffect, useRef } from 'react';
import { authApi, getApiUrl } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';

export default function ProfilePage() {
  const { user, logout } = useAuth();
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

  useEffect(() => {
    loadProfile();
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.new_password && formData.new_password !== formData.confirm_password) {
      setError('Пароли не совпадают');
      return;
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
    if (!confirm('Удалить фото профиля?')) return;

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
    if (!name) return 'bg-gray-400';
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
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

  const displayUser = currentUser || user;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Профиль</h1>

        {/* Карточка профиля */}
        <div className="card mb-6">
          <div className="flex items-center space-x-4">
            {/* Аватар */}
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
              
              {displayUser?.avatar_url ? (
                <img
                  src={getAvatarUrl(displayUser.avatar_url)}
                  alt="Аватар"
                  className="w-20 h-20 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={handleAvatarClick}
                />
              ) : (
                <div 
                  className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold cursor-pointer hover:opacity-80 transition-opacity ${getAvatarColor(displayUser?.full_name)}`}
                  onClick={handleAvatarClick}
                >
                  {avatarLoading ? (
                    <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    getInitials(displayUser?.full_name)
                  )}
                </div>
              )}

              {/* Кнопка удаления аватара */}
              {displayUser?.avatar_url && (
                <button
                  onClick={handleDeleteAvatar}
                  disabled={avatarLoading}
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 text-sm"
                  title="Удалить фото"
                >
                  &times;
                </button>
              )}
            </div>
            
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-800">{displayUser?.full_name}</h2>
              <p className="text-gray-600">{displayUser?.email}</p>
              <div className="flex items-center space-x-2 mt-1">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                  {roleNames[displayUser?.role]}
                </span>
                {displayUser?.position && (
                  <span className="text-gray-500 text-sm">{displayUser?.position}</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Нажмите на аватар, чтобы изменить фото
              </p>
            </div>
          </div>
        </div>

        {/* Форма редактирования */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Редактирование профиля</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ФИО
              </label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Должность
              </label>
              <input
                type="text"
                name="position"
                value={formData.position}
                onChange={handleChange}
                className="input"
              />
            </div>

            <hr className="my-6" />

            <h3 className="text-md font-medium text-gray-800">Изменение пароля</h3>
            <p className="text-sm text-gray-500 mb-4">
              Оставьте поля пустыми, если не хотите менять пароль
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Текущий пароль
              </label>
              <input
                type="password"
                name="current_password"
                value={formData.current_password}
                onChange={handleChange}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Новый пароль
              </label>
              <input
                type="password"
                name="new_password"
                value={formData.new_password}
                onChange={handleChange}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Подтверждение пароля
              </label>
              <input
                type="password"
                name="confirm_password"
                value={formData.confirm_password}
                onChange={handleChange}
                className="input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}