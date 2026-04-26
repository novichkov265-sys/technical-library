import { useState, useEffect } from 'react';
import { categoriesApi } from '../services/api';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import ErrorModal from '../components/ErrorModal';
import './CategoriesPage.css';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');

  const [showTagModal, setShowTagModal] = useState(false);
  const [tagName, setTagName] = useState('');

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: () => {},
  });

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
    try {
      await categoriesApi.delete(id);
      setSuccess('Категория удалена');
      loadData();
      closeConfirmModal();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка удаления');
    }
  };

  const openDeleteCategoryModal = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Удалить категорию',
      message: 'Вы уверены, что хотите удалить эту категорию? Это действие нельзя отменить.',
      confirmText: 'Удалить',
      onConfirm: () => handleDeleteCategory(id),
    });
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryDescription('');
  };

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
    try {
      await categoriesApi.deleteTag(id);
      setSuccess('Тег удален');
      loadData();
      closeConfirmModal();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка удаления');
    }
  };

  const openDeleteTagModal = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Удалить тег',
      message: 'Вы уверены, что хотите удалить этот тег?',
      confirmText: 'Удалить',
      onConfirm: () => handleDeleteTag(id),
    });
  };

  const closeConfirmModal = () => {
    setConfirmModal({ ...confirmModal, isOpen: false });
  };

  if (loading) {
    return (
      <Layout>
        <div className="categories-loading">Загрузка...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="categories-page">
        <h1 className="categories-title">Управление категориями и тегами</h1>

        {/* Success Message */}
        {success && (
          <div className="categories-success">
            <span>{success}</span>
            <button onClick={() => setSuccess('')} className="categories-success-close">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Error Modal */}
        {error && <ErrorModal message={error} onClose={() => setError('')} />}

        <div className="categories-grid">
          {/* Categories Section */}
          <div className="categories-section">
            <div className="categories-section-header">
              <h2 className="categories-section-title">Категории</h2>
              <button
                onClick={() => {
                  resetCategoryForm();
                  setShowCategoryModal(true);
                }}
                className="categories-add-btn"
              >
                Добавить
              </button>
            </div>

            {categories.length === 0 ? (
              <div className="categories-empty">Нет категорий</div>
            ) : (
              <div className="categories-list">
                {categories.map((category) => (
                  <div key={category.id} className="category-item">
                    <div className="category-info">
                      <div className="category-name">{category.name}</div>
                      {category.description && (
                        <div className="category-desc">{category.description}</div>
                      )}
                    </div>
                    <div className="category-actions">
                      <button
                        onClick={() => handleEditCategory(category)}
                        className="category-btn category-btn-edit"
                      >
                        Изменить
                      </button>
                      <button
                        onClick={() => openDeleteCategoryModal(category.id)}
                        className="category-btn category-btn-delete"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tags Section */}
          <div className="categories-section">
            <div className="categories-section-header">
              <h2 className="categories-section-title">Теги</h2>
              <button onClick={() => setShowTagModal(true)} className="categories-add-btn">
                Добавить
              </button>
            </div>

            {tags.length === 0 ? (
              <div className="categories-empty">Нет тегов</div>
            ) : (
              <div className="tags-list">
                {tags.map((tag) => (
                  <div key={tag.id} className="tag-item">
                    <span>{tag.name}</span>
                    <button
                      onClick={() => openDeleteTagModal(tag.id)}
                      className="tag-delete"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Category Modal */}
        {showCategoryModal && (
          <div className="categories-modal-overlay" onClick={() => setShowCategoryModal(false)}>
            <div className="categories-modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="categories-modal-title">
                {editingCategory ? 'Редактирование категории' : 'Новая категория'}
              </h3>

              <form onSubmit={handleCategorySubmit} className="categories-modal-form">
                <div className="categories-form-group">
                  <label className="categories-form-label">Название *</label>
                  <input
                    type="text"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    className="categories-form-input"
                    required
                  />
                </div>

                <div className="categories-form-group">
                  <label className="categories-form-label">Описание</label>
                  <textarea
                    value={categoryDescription}
                    onChange={(e) => setCategoryDescription(e.target.value)}
                    className="categories-form-textarea"
                    rows={3}
                  />
                </div>

                <div className="categories-modal-actions">
                  <button type="submit" className="categories-modal-btn categories-modal-btn-primary">
                    {editingCategory ? 'Сохранить' : 'Создать'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(false)}
                    className="categories-modal-btn categories-modal-btn-secondary"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tag Modal */}
        {showTagModal && (
          <div className="categories-modal-overlay" onClick={() => setShowTagModal(false)}>
            <div className="categories-modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="categories-modal-title">Новый тег</h3>

              <form onSubmit={handleTagSubmit} className="categories-modal-form">
                <div className="categories-form-group">
                  <label className="categories-form-label">Название *</label>
                  <input
                    type="text"
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                    className="categories-form-input"
                    required
                  />
                </div>

                <div className="categories-modal-actions">
                  <button type="submit" className="categories-modal-btn categories-modal-btn-primary">
                    Создать
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTagModal(false);
                      setTagName('');
                    }}
                    className="categories-modal-btn categories-modal-btn-secondary"
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
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          confirmStyle="danger"
        />
      </div>
    </Layout>
  );
}