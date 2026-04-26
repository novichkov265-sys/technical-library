import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { documentsApi, categoriesApi } from '../services/api';
import Layout from '../components/Layout';
import ErrorModal from '../components/ErrorModal';
import './SearchPage.css';

export default function SearchPage() {
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    query: '',
    category_id: '',
    type: '',
    tag_id: '',
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [categoriesRes, tagsRes] = await Promise.all([
        categoriesApi.getAll(),
        categoriesApi.getAllTags(),
      ]);
      setCategories(categoriesRes.data || []);
      setTags(tagsRes.data || []);
      handleSearch();
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const params = {};
      if (filters.query) params.q = filters.query;
      if (filters.category_id) params.category = filters.category_id;
      if (filters.type) params.type = filters.type;
      if (filters.tag_id) params.tag_id = filters.tag_id;

      const response = await documentsApi.search(params);
      const data = response.data;
      setDocuments(Array.isArray(data) ? data : (data.documents || []));
    } catch (err) {
      console.error('Ошибка поиска:', err);
      setError('Ошибка поиска');
      setDocuments([]);
    }
    setLoading(false);
  };

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const handleReset = () => {
    setFilters({
      query: '',
      category_id: '',
      type: '',
      tag_id: '',
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const typeNames = {
    drawing: 'Чертеж',
    standard: 'Стандарт',
    specification: 'Спецификация',
    instruction: 'Инструкция',
    manual: 'Руководство',
    other: 'Другое',
  };

  const statusNames = {
    draft: 'Черновик',
    pending_approval: 'На согласовании',
    in_library: 'В библиотеке',
    pending_deletion: 'На удаление',
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'draft': return 'draft';
      case 'pending_approval': return 'pending';
      case 'in_library': return 'approved';
      case 'pending_deletion': return 'deletion';
      default: return 'draft';
    }
  };

  return (
    <Layout>
      <div className="search-page">
        <h1 className="search-title">Поиск документов</h1>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-form-grid">
            <div className="search-field">
              <label className="search-field-label">Поиск</label>
              <input
                type="text"
                value={filters.query}
                onChange={(e) => handleFilterChange('query', e.target.value)}
                placeholder="Название, код или описание..."
                className="search-input"
              />
            </div>

            <div className="search-field">
              <label className="search-field-label">Категория</label>
              <select
                value={filters.category_id}
                onChange={(e) => handleFilterChange('category_id', e.target.value)}
                className="search-select"
              >
                <option value="">Все категории</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="search-field">
              <label className="search-field-label">Тип документа</label>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="search-select"
              >
                <option value="">Все типы</option>
                <option value="drawing">Чертеж</option>
                <option value="standard">Стандарт</option>
                <option value="specification">Спецификация</option>
                <option value="instruction">Инструкция</option>
                <option value="manual">Руководство</option>
                <option value="other">Другое</option>
              </select>
            </div>

            <div className="search-field">
              <label className="search-field-label">Тег</label>
              <select
                value={filters.tag_id}
                onChange={(e) => handleFilterChange('tag_id', e.target.value)}
                className="search-select"
              >
                <option value="">Все теги</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>{tag.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="search-actions">
            <button type="submit" className="search-btn search-btn-primary">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Найти
            </button>
            <button type="button" onClick={handleReset} className="search-btn search-btn-secondary">
              Сбросить
            </button>
          </div>
        </form>

        {/* Error Modal */}
        {error && (
          <ErrorModal message={error} onClose={() => setError('')} />
        )}

        {/* Results */}
        {loading ? (
          <div className="search-loading">
            <div className="search-loading-spinner"></div>
            <p className="search-loading-text">Поиск документов...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="search-empty">
            <svg className="search-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="search-empty-text">Документы не найдены</p>
          </div>
        ) : (
          <div className="search-results">
            <p className="search-results-count">Найдено документов: {documents.length}</p>
            
            {documents.map((doc, index) => (
              <Link
                key={doc.id}
                to={`/documents/${doc.id}`}
                className="search-doc-card animate-fade-in-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="search-doc-header">
                  <span className="search-doc-code">{doc.code}</span>
                  <span className={`search-doc-status ${getStatusClass(doc.status)}`}>
                    {statusNames[doc.status]}
                  </span>
                </div>

                <h3 className="search-doc-title">{doc.title}</h3>

                <div className="search-doc-meta">
                  <span className="search-doc-meta-item">
                    {typeNames[doc.type] || doc.type}
                  </span>
                  {doc.category_name && (
                    <>
                      <span className="search-doc-meta-separator">|</span>
                      <span className="search-doc-meta-item">{doc.category_name}</span>
                    </>
                  )}
                  <span className="search-doc-meta-separator">|</span>
                  <span className="search-doc-meta-item">{formatDate(doc.created_at)}</span>
                </div>

                {doc.tags && doc.tags.length > 0 && (
                  <div className="search-doc-tags">
                    {doc.tags.map((tag, idx) => (
                      <span key={idx} className="search-doc-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}