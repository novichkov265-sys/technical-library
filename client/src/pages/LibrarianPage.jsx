import { useState, useEffect } from 'react';
import { categoriesApi, documentsApi } from '../services/api';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import './LibrarianPage.css';
export default function LibrarianPage() {
  const [activeTab, setActiveTab] = useState('categories');
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: () => {},
  });
  useEffect(() => {
    if (activeTab === 'categories') {
      loadCategories();
    } else if (activeTab === 'tags') {
      loadTags();
    }
  }, [activeTab]);
  const loadCategories = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await categoriesApi.getAll();
      setCategories(response.data);
    } catch (err) {
      setError('Ошибка загрузки категорий');
    }
    setLoading(false);
  };
  const loadTags = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await categoriesApi.getAllTags();
      setTags(response.data);
    } catch (err) {
      setError('Ошибка загрузки тегов');
    }
    setLoading(false);
  };
  const handleCreateCategory = () => {
    setEditingItem({ name: '', description: '' });
    setModalType('createCategory');
    setShowModal(true);
  };
  const handleEditCategory = (category) => {
    setEditingItem(category);
    setModalType('editCategory');
    setShowModal(true);
  };
  const handleDeleteCategory = async (id) => {
    try {
      await categoriesApi.delete(id);
      loadCategories();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка удаления');
    }
  };
  const openDeleteCategoryModal = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Удалить категорию',
      message: 'Вы уверены, что хотите удалить эту категорию?',
      confirmText: 'Удалить',
      onConfirm: () => handleDeleteCategory(id),
    });
  };
  const handleCreateTag = () => {
    setEditingItem({ name: '' });
    setModalType('createTag');
    setShowModal(true);
  };
  const handleEditTag = (tag) => {
    setEditingItem(tag);
    setModalType('editTag');
    setShowModal(true);
  };
  const handleDeleteTag = async (id) => {
    try {
      await categoriesApi.deleteTag(id);
      loadTags();
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
  const handleSave = async () => {
    try {
      if (modalType === 'createCategory') {
        await categoriesApi.create(editingItem);
        loadCategories();
      } else if (modalType === 'editCategory') {
        await categoriesApi.update(editingItem.id, editingItem);
        loadCategories();
      } else if (modalType === 'createTag') {
        await categoriesApi.createTag(editingItem);
        loadTags();
      } else if (modalType === 'editTag') {
        await categoriesApi.updateTag(editingItem.id, editingItem);
        loadTags();
      }
      setShowModal(false);
      setEditingItem(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка сохранения');
    }
  };
  const handleGenerateReport = async () => {
    try {
      const response = await documentsApi.generateReport();
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Ошибка формирования отчета');
    }
  };
  return (
    <Layout>
      <h1 className="librarian-page__title">Управление библиотекой</h1>
      {/* Табы */}
      <div className="librarian-tabs">
        <button
          onClick={() => setActiveTab('categories')}
          className={`librarian-tabs__btn ${activeTab === 'categories' ? 'librarian-tabs__btn--active' : 'librarian-tabs__btn--inactive'}`}
        >
          Категории
        </button>
        <button
          onClick={() => setActiveTab('tags')}
          className={`librarian-tabs__btn ${activeTab === 'tags' ? 'librarian-tabs__btn--active' : 'librarian-tabs__btn--inactive'}`}
        >
          Теги
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`librarian-tabs__btn ${activeTab === 'reports' ? 'librarian-tabs__btn--active' : 'librarian-tabs__btn--inactive'}`}
        >
          Отчеты
        </button>
      </div>
      {error && <div className="librarian-error">{error}</div>}
      {loading && activeTab !== 'reports' && (
        <div className="librarian-loading">Загрузка...</div>
      )}
      {/* Категории */}
      {!loading && activeTab === 'categories' && (
        <div className="librarian-card">
          <div className="librarian-card__header">
            <button onClick={handleCreateCategory} className="btn btn-primary">
              Добавить категорию
            </button>
          </div>
          <div className="librarian-table-wrapper">
            <table className="librarian-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Описание</th>
                  <th>Документов</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td className="librarian-table__name">{category.name}</td>
                    <td className="librarian-table__desc">{category.description || '-'}</td>
                    <td>{category.document_count || 0}</td>
                    <td>
                      <div className="librarian-actions">
                        <button
                          onClick={() => handleEditCategory(category)}
                          className="librarian-actions__btn librarian-actions__btn--edit"
                        >
                          Изменить
                        </button>
                        <button
                          onClick={() => openDeleteCategoryModal(category.id)}
                          className="librarian-actions__btn librarian-actions__btn--delete"
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Теги */}
      {!loading && activeTab === 'tags' && (
        <div className="librarian-card">
          <div className="librarian-card__header">
            <button onClick={handleCreateTag} className="btn btn-primary">
              Добавить тег
            </button>
          </div>
          <div className="librarian-table-wrapper">
            <table className="librarian-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Документов</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((tag) => (
                  <tr key={tag.id}>
                    <td>
                      <span className="librarian-tag">{tag.name}</span>
                    </td>
                    <td>{tag.document_count || 0}</td>
                    <td>
                      <div className="librarian-actions">
                        <button
                          onClick={() => handleEditTag(tag)}
                          className="librarian-actions__btn librarian-actions__btn--edit"
                        >
                          Изменить
                        </button>
                        <button
                          onClick={() => openDeleteTagModal(tag.id)}
                          className="librarian-actions__btn librarian-actions__btn--delete"
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Отчеты */}
      {activeTab === 'reports' && (
        <div className="librarian-card">
          <h2 className="librarian-reports__title">Формирование отчетов</h2>
          <div className="librarian-reports__list">
            <div className="librarian-reports__item">
              <h3 className="librarian-reports__item-title">Отчет по документам</h3>
              <p className="librarian-reports__item-desc">
                Список всех документов в библиотеке с информацией о статусе, категории и авторе.
              </p>
              <button onClick={handleGenerateReport} className="btn btn-primary">
                Сформировать отчет (CSV)
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Модальное окно */}
      {showModal && (
        <div className="librarian-modal-overlay">
          <div className="librarian-modal">
            <h2 className="librarian-modal__title">
              {modalType === 'createCategory' && 'Новая категория'}
              {modalType === 'editCategory' && 'Редактирование категории'}
              {modalType === 'createTag' && 'Новый тег'}
              {modalType === 'editTag' && 'Редактирование тега'}
            </h2>
            {(modalType === 'createCategory' || modalType === 'editCategory') && editingItem && (
              <div className="librarian-modal__form">
                <div className="librarian-modal__field">
                  <label className="librarian-modal__label">Название</label>
                  <input
                    type="text"
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="librarian-modal__field">
                  <label className="librarian-modal__label">Описание</label>
                  <textarea
                    value={editingItem.description || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                    className="input"
                    style={{ resize: 'none', height: '6rem' }}
                  />
                </div>
              </div>
            )}
            {(modalType === 'createTag' || modalType === 'editTag') && editingItem && (
              <div className="librarian-modal__form">
                <div className="librarian-modal__field">
                  <label className="librarian-modal__label">Название тега</label>
                  <input
                    type="text"
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    className="input"
                  />
                </div>
              </div>
            )}
            <div className="librarian-modal__actions">
              <button onClick={handleSave} className="btn btn-primary">
                Сохранить
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingItem(null);
                }}
                className="btn btn-secondary"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmStyle="danger"
      />
    </Layout>
  );
}