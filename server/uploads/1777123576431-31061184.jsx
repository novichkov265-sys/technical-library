import { useState, useEffect } from 'react';
import { categoriesApi } from '../services/api';
import Layout from '../components/Layout';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Category form
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');

  // Tag form
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagName, setTagName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [categoriesRes, tagsRes] = await Promise.all([
        categoriesApi.getAll(),
        categoriesApi.getAllTags(),
      ]);
      setCategories(categoriesRes.data);
      setTags(tagsRes.data);
    } catch (err) {
      setError('Ошибка загрузки данных');
    }
    setLoading(false);
  };

  // Category handlers
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!categoryName.trim()) {
      setError('Введите название категории');
      return;
    }

    try {
      if (editingCategory) {
        await categoriesApi.update(editingCategory.id, {
          name: categoryName,
          description: categoryDescription,
        });
        setSuccess('Категория обновлена');
      } else {
        await categoriesApi.create({
          name: categoryName,
          description: categoryDescription,
        });
        setSuccess('Категория создана');
      }
      setShowCategoryModal(false);
      resetCategoryForm();
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryDescription(category.description || '');
    setShowCategoryModal(true);
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm('Удалить эту категорию?')) return;

    try {
      await categoriesApi.delete(id);
      setSuccess('Категория удалена');
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка удаления');
    }
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryDescription('');
  };

  // Tag handlers
  const handleTagSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!tagName.trim()) {
      setError('Введите название тега');
      return;
    }

    try {
      await categoriesApi.createTag({ name: tagName });
      setSuccess('Тег создан');
      setShowTagModal(false);
      setTagName('');
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка создания тега');
    }
  };

  const handleDeleteTag = async (id) => {
    if (!confirm('Удалить этот тег?')) return;

    try {
      await categoriesApi.deleteTag(id);
      setSuccess('Тег удален');
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка удаления');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-8">Загрузка...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Управление категориями и тегами
      </h1>

      {/* Уведомления */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
          <button onClick={() => setError('')} className="float-right">
            &times;
          </button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
          <button onClick={() => setSuccess('')} className="float-right">
            &times;
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Категории */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Категории</h2>
            <button
              onClick={() => {
                resetCategoryForm();
                setShowCategoryModal(true);
              }}
              className="btn btn-primary"
            >
              Добавить
            </button>
          </div>

          {categories.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Нет категорий</div>
          ) : (
            <div className="space-y-3">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <div className="font-medium">{category.name}</div>
                    {category.description && (
                      <div className="text-sm text-gray-500">
                        {category.description}
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditCategory(category)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Изменить
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="text-red-600 hover:underline text-sm"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Теги */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Теги</h2>
            <button
              onClick={() => setShowTagModal(true)}
              className="btn btn-primary"
            >
              Добавить
            </button>
          </div>

          {tags.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Нет тегов</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full"
                >
                  <span>{tag.name}</span>
                  <button
                    onClick={() => handleDeleteTag(tag.id)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно категории */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {editingCategory ? 'Редактирование категории' : 'Новая категория'}
            </h3>

            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название *
                </label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Описание
                </label>
                <textarea
                  value={categoryDescription}
                  onChange={(e) => setCategoryDescription(e.target.value)}
                  className="input"
                  rows={3}
                />
              </div>

              <div className="flex space-x-2 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  {editingCategory ? 'Сохранить' : 'Создать'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно тега */}
      {showTagModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Новый тег</h3>

            <form onSubmit={handleTagSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название *
                </label>
                <input
                  type="text"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div className="flex space-x-2 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  Создать
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTagModal(false);
                    setTagName('');
                  }}
                  className="btn btn-secondary flex-1"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}