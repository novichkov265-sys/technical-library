import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { documentsApi, categoriesApi, usersApi } from '../services/api';
import Layout from '../components/Layout';
import ErrorModal from '../components/ErrorModal';
import './UploadPage.css';
export default function UploadPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    code: '',
    type: 'drawing',
    category_id: '',
    description: '',
    tags: [],
    approver_ids: [],
  });
  const [file, setFile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [approvers, setApprovers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => {
    loadData();
  }, []);
  const loadData = async () => {
    try {
      const [categoriesRes, tagsRes, approversRes] = await Promise.all([
        categoriesApi.getAll(),
        categoriesApi.getAllTags(),
        usersApi.getApprovers(),
      ]);
      setCategories(categoriesRes.data);
      setTags(tagsRes.data);
      setApprovers(approversRes.data);
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
    }
  };
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };
  const handleTagToggle = (tagId) => {
    const newTags = formData.tags.includes(tagId)
      ? formData.tags.filter((id) => id !== tagId)
      : [...formData.tags, tagId];
    setFormData({ ...formData, tags: newTags });
  };
  const handleApproverToggle = (approverId) => {
    const newApprovers = formData.approver_ids.includes(approverId)
      ? formData.approver_ids.filter((id) => id !== approverId)
      : [...formData.approver_ids, approverId];
    setFormData({ ...formData, approver_ids: newApprovers });
  };
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.title || !formData.code || !formData.type) {
      setError('Заполните обязательные поля: Название, Код и Тип');
      return;
    }
    if (formData.approver_ids.length === 0) {
      setError('Выберите хотя бы одного руководителя для согласования');
      return;
    }
    if (!file) {
      setError('Выберите файл для загрузки');
      return;
    }
    setLoading(true);
    try {
      const data = new FormData();
      data.append('title', formData.title);
      data.append('code', formData.code);
      data.append('type', formData.type);
      data.append('category_id', formData.category_id);
      data.append('description', formData.description);
      data.append('tags', JSON.stringify(formData.tags));
      data.append('approver_ids', JSON.stringify(formData.approver_ids));
      data.append('file', file);
      await documentsApi.upload(data);
      setSuccess('Документ загружен и отправлен на согласование');
      setLoading(false);
      setTimeout(() => {
        navigate('/tickets');
      }, 2000);
      return;
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка загрузки документа');
    }
    setLoading(false);
  };
  const typeOptions = [
    { value: 'drawing', label: 'Чертеж' },
    { value: 'standard', label: 'Стандарт' },
    { value: 'specification', label: 'Спецификация' },
    { value: 'instruction', label: 'Инструкция' },
    { value: 'manual', label: 'Руководство' },
    { value: 'other', label: 'Другое' },
  ];
  return (
    <Layout>
      <div className="upload-page">
        <h1 className="upload-title">Загрузка нового документа</h1>
        {error && <ErrorModal message={error} onClose={() => setError('')} />}
        {success && (
          <div className="upload-success">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{success}</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="upload-form">
          {/* Основная информация */}
          <div className="upload-section">
            <h2 className="upload-section-title">Основная информация</h2>
            <div className="upload-grid">
              <div className="upload-field">
                <label className="upload-label">Название документа <span>*</span></label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="upload-input"
                  placeholder="Введите название"
                  required
                />
              </div>
              <div className="upload-field">
                <label className="upload-label">Код документа <span>*</span></label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  className="upload-input"
                  placeholder="Например: DOC-001"
                  required
                />
              </div>
              <div className="upload-field">
                <label className="upload-label">Тип документа <span>*</span></label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="upload-select"
                  required
                >
                  {typeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="upload-field">
                <label className="upload-label">Категория</label>
                <select
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleChange}
                  className="upload-select"
                >
                  <option value="">Без категории</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="upload-field full">
                <label className="upload-label">Описание документа</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="upload-textarea"
                  placeholder="Введите описание документа..."
                />
              </div>
            </div>
          </div>
          {/* Теги */}
          {tags.length > 0 && (
            <div className="upload-section">
              <h2 className="upload-section-title">Теги</h2>
              <div className="upload-tags">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleTagToggle(tag.id)}
                    className={`upload-tag ${formData.tags.includes(tag.id) ? 'active' : ''}`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Файл */}
          <div className="upload-section">
            <h2 className="upload-section-title">Файл документа</h2>
            <div className="upload-field">
              <label className="upload-label">Выберите файл <span>*</span></label>
              <input
                type="file"
                onChange={handleFileChange}
                className="upload-input"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf"
              />
              {file && (
                <div className="upload-file-info">
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} МБ)</span>
                </div>
              )}
            </div>
          </div>
          {/* Согласующие */}
          <div className="upload-section">
            <h2 className="upload-section-title">Согласующие руководители</h2>
            <p className="upload-approvers-hint">
              Выберите руководителей, которые должны согласовать документ
            </p>
            {approvers.length === 0 ? (
              <div className="upload-approvers-empty">
                Нет доступных руководителей. Обратитесь к администратору.
              </div>
            ) : (
              <div className="upload-approvers">
                {approvers.map((approver) => (
                  <label
                    key={approver.id}
                    className={`upload-approver ${formData.approver_ids.includes(approver.id) ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.approver_ids.includes(approver.id)}
                      onChange={() => handleApproverToggle(approver.id)}
                      className="upload-approver-checkbox"
                    />
                    <div className="upload-approver-info">
                      <div className="upload-approver-name">{approver.full_name}</div>
                      {approver.position && (
                        <div className="upload-approver-position">{approver.position}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
          {/* Кнопки */}
          <div className="upload-actions">
            <button type="submit" disabled={loading} className="upload-btn upload-btn-primary">
              {loading ? 'Загрузка...' : 'Отправить на согласование'}
            </button>
            <button type="button" onClick={() => navigate(-1)} className="upload-btn upload-btn-secondary">
              Отмена
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}