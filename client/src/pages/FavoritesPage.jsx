import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { documentsApi } from '../services/api';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import './FavoritesPage.css';
export default function FavoritesPage() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    docId: null,
    docTitle: '',
  });
  useEffect(() => {
    loadFavorites();
  }, []);
  const loadFavorites = async () => {
    try {
      const response = await documentsApi.getFavorites();
      setFavorites(response.data);
    } catch (err) {
      setError('Ошибка загрузки избранного');
    }
    setLoading(false);
  };
  const handleRemoveFromFavorites = async (docId) => {
    try {
      await documentsApi.removeFromFavorites(docId);
      setFavorites(favorites.filter(f => f.id !== docId));
    } catch (err) {
      setError('Ошибка удаления из избранного');
    }
  };
  const openRemoveModal = (docId, docTitle) => {
    setConfirmModal({ isOpen: true, docId, docTitle });
  };
  const closeConfirmModal = () => {
    setConfirmModal({ isOpen: false, docId: null, docTitle: '' });
  };
  const confirmRemove = () => {
    if (confirmModal.docId) {
      handleRemoveFromFavorites(confirmModal.docId);
    }
    closeConfirmModal();
  };
  const typeNames = {
    drawing: 'Чертеж',
    standard: 'Стандарт',
    specification: 'Спецификация',
    instruction: 'Инструкция',
    manual: 'Руководство',
    other: 'Другое',
  };
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };
  if (loading) {
    return (
      <Layout>
        <div className="favorites-loading">
          <div className="favorites-loading-spinner"></div>
        </div>
      </Layout>
    );
  }
  return (
    <Layout>
      <div className="favorites-page">
        {/* Header */}
        <div className="favorites-header">
          <div className="favorites-header-icon">
            <svg fill="currentColor" viewBox="0 0 24 24">
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <div>
            <h1 className="favorites-title">Избранное</h1>
            <p className="favorites-subtitle">Сохраненные документы</p>
          </div>
        </div>
        {/* Error */}
        {error && (
          <div className="favorites-alert">
            <div className="favorites-alert-content">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="favorites-alert-close">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {/* Empty State */}
        {favorites.length === 0 ? (
          <div className="favorites-empty">
            <div className="favorites-empty-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h3 className="favorites-empty-title">Нет избранных документов</h3>
            <p className="favorites-empty-text">
              Добавляйте документы в избранное, нажимая на иконку сердца, чтобы быстро находить их здесь
            </p>
            <Link to="/search" className="favorites-empty-btn">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Найти документы</span>
            </Link>
          </div>
        ) : (
          <>
            <p className="favorites-count">Всего документов: {favorites.length}</p>
            <div className="favorites-grid">
              {favorites.map((doc, index) => (
                <div 
                  key={doc.id} 
                  className="favorite-card animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Card Header */}
                  <div className={`favorite-card-header ${doc.type || 'other'}`}>
                    <div className="favorite-card-type">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>{typeNames[doc.type] || 'Документ'}</span>
                    </div>
                    <span className="favorite-card-version">v{doc.version || 1}</span>
                  </div>
                  {/* Card Body */}
                  <div className="favorite-card-body">
                    <div className="favorite-card-title-row">
                      <Link to={`/documents/${doc.id}`} className="favorite-card-title">
                        {doc.title}
                      </Link>
                      <button
                        onClick={() => openRemoveModal(doc.id, doc.title)}
                        className="favorite-card-remove"
                        title="Удалить из избранного"
                      >
                        <svg fill="currentColor" viewBox="0 0 24 24">
                          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                    </div>
                    <code className="favorite-card-code">{doc.code}</code>
                    {doc.description && (
                      <p className="favorite-card-desc">{doc.description}</p>
                    )}
                    {/* Footer */}
                    <div className="favorite-card-footer">
                      {doc.category_name ? (
                        <span className="favorite-card-category">
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                          {doc.category_name}
                        </span>
                      ) : (
                        <span></span>
                      )}
                      {doc.created_at && (
                        <span className="favorite-card-date">{formatDate(doc.created_at)}</span>
                      )}
                    </div>
                  </div>
                  {/* Hover Action */}
                  <div className="favorite-card-action">
                    <Link to={`/documents/${doc.id}`} className="favorite-card-action-btn">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Открыть документ
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {/* Confirm Modal */}
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          onClose={closeConfirmModal}
          onConfirm={confirmRemove}
          title="Удалить из избранного"
          message={`Удалить документ "${confirmModal.docTitle}" из избранного?`}
          confirmText="Удалить"
          confirmStyle="danger"
        />
      </div>
    </Layout>
  );
}