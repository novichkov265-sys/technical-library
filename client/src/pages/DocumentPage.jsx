import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { documentsApi, getApiUrl } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import mammoth from 'mammoth';
import ConfirmModal from '../components/ConfirmModal';
import './DocumentPage.css';
const getToken = () => localStorage.getItem('token');
export default function DocumentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [document, setDocument] = useState(null);
  const [versions, setVersions] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [activeTab, setActiveTab] = useState('preview');
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateFile, setUpdateFile] = useState(null);
  const [updateComment, setUpdateComment] = useState('');
  const [updating, setUpdating] = useState(false);
  const [docxHtml, setDocxHtml] = useState('');
  const [docxLoading, setDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, noteId: null });
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  useEffect(() => {
    loadDocument();
  }, [id]);
  useEffect(() => {
    setDocxHtml('');
    setDocxError('');
  }, [document?.id]);
  const loadDocument = async () => {
    setLoading(true);
    try {
      const [docRes, versionsRes, notesRes, favoritesRes] = await Promise.all([
        documentsApi.getById(id),
        documentsApi.getVersions(id),
        documentsApi.getNotes(id),
        documentsApi.getFavorites(),
      ]);
      setDocument(docRes.data);
      setVersions(versionsRes.data);
      setNotes(notesRes.data);
      setIsFavorite(favoritesRes.data.some(f => f.id === parseInt(id)));
    } catch (err) {
      setError('Ошибка загрузки документа');
    }
    setLoading(false);
  };
  const handleDownload = async () => {
    try {
      const response = await documentsApi.download(id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.file_name || `${document.code}.${document.file_path?.split('.').pop()}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Ошибка скачивания');
    }
  };
  const handleDownloadVersion = async (versionId) => {
    try {
      const response = await documentsApi.downloadVersion(id, versionId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = window.document.createElement('a');
      link.href = url;
      const version = versions.find(v => v.id === versionId);
      const fileName = version?.file_name || `${document.code}_v${version?.version}.${version?.file_path?.split('.').pop()}`;
      link.download = fileName;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Ошибка скачивания версии');
    }
  };
  const handleToggleFavorite = async () => {
    try {
      if (isFavorite) {
        await documentsApi.removeFromFavorites(id);
      } else {
        await documentsApi.addToFavorites(id);
      }
      setIsFavorite(!isFavorite);
    } catch (err) {
      setError('Ошибка обновления избранного');
    }
  };
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    try {
      await documentsApi.addNote(id, newNote);
      setNewNote('');
      const notesRes = await documentsApi.getNotes(id);
      setNotes(notesRes.data);
    } catch (err) {
      setError('Ошибка добавления заметки');
    }
  };
  const handleDeleteNote = async (noteId) => {
    try {
      await documentsApi.deleteNote(id, noteId);
      setNotes(notes.filter(n => n.id !== noteId));
    } catch (err) {
      setError('Ошибка удаления заметки');
    }
  };
  const openDeleteNoteModal = (noteId) => {
    setConfirmModal({ isOpen: true, noteId });
  };
  const closeConfirmModal = () => {
    setConfirmModal({ isOpen: false, noteId: null });
  };
  const confirmDeleteNote = () => {
    if (confirmModal.noteId) {
      handleDeleteNote(confirmModal.noteId);
    }
  };
  const handleUpdateDocument = async (e) => {
    e.preventDefault();
    if (!updateFile) {
      setError('Выберите файл для обновления');
      return;
    }
    setUpdating(true);
    try {
      const formData = new FormData();
      formData.append('file', updateFile);
      if (updateComment) {
        formData.append('comment', updateComment);
      }
      await documentsApi.uploadVersion(id, formData);
      setShowUpdateModal(false);
      setUpdateFile(null);
      setUpdateComment('');
      setDocxHtml('');
      setDocxError('');
      loadDocument();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка обновления документа');
    }
    setUpdating(false);
  };
  const handleArchive = async () => {
    try {
      await documentsApi.archive(id);
      setShowArchiveModal(false);
      loadDocument();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка архивации');
      setShowArchiveModal(false);
    }
  };
  const handleRestore = async () => {
    try {
      await documentsApi.restore(id);
      loadDocument();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка восстановления');
    }
  };
  const loadDocxPreview = async () => {
    if (!document?.id || docxLoading) return;
    setDocxLoading(true);
    setDocxError('');
    try {
      const token = getToken();
      const response = await fetch(
        `${getApiUrl()}/api/documents/${id}/preview?token=${encodeURIComponent(token || '')}`,
        { headers: { 'Accept': 'application/octet-stream' } }
      );
      if (!response.ok) throw new Error('Ошибка загрузки файла');
      const arrayBuffer = await response.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      setDocxHtml(result.value);
    } catch (err) {
      setDocxError('Не удалось загрузить предпросмотр документа');
    }
    setDocxLoading(false);
  };
  const formatDate = (dateString) => new Date(dateString).toLocaleString('ru-RU');
  const formatFileSize = (bytes) => {
    if (!bytes) return '-';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
    pending_approval: 'На согласовании',
    in_library: 'В библиотеке',
    archived: 'В архиве',
    withdrawn: 'Изъят',
  };
  const getStatusClass = (status) => {
    const classes = {
      pending_approval: 'document-status--pending',
      in_library: 'document-status--active',
      archived: 'document-status--archived',
      withdrawn: 'document-status--withdrawn',
    };
    return classes[status] || '';
  };
  const canUpdate = user && 
    (user.role === 'librarian' || user.role === 'admin') && 
    (document?.status === 'in_library' || document?.status === 'pending_approval');
  const getFileExtension = () => {
    if (!document?.file_path && !document?.file_name) return '';
    const fileName = document.file_name || document.file_path || '';
    return fileName.split('.').pop()?.toLowerCase() || '';
  };
  const renderPreview = () => {
    if (!document) return null;
    const token = getToken();
    const previewUrl = `${getApiUrl()}/api/documents/${id}/preview?token=${encodeURIComponent(token || '')}`;
    const ext = getFileExtension();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif', 'avif'].includes(ext)) {
      return (
        <div className="document-preview__image-wrapper">
          <img src={previewUrl} alt={document.title} className="document-preview__image" />
        </div>
      );
    }
    if (ext === 'pdf') {
      return <iframe src={previewUrl} className="document-preview__iframe" title={document.title} />;
    }
    if (ext === 'docx') {
      if (!docxHtml && !docxLoading && !docxError) {
        loadDocxPreview();
      }
      if (docxLoading) {
        return (
          <div className="document-preview__loading">
            <div className="document-preview__spinner"></div>
            <p className="document-preview__loading-text">Загрузка документа...</p>
          </div>
        );
      }
      if (docxError) {
        return (
          <div className="document-preview__fallback">
            <div className="document-preview__fallback-icon document-preview__fallback-icon--red">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="document-preview__fallback-hint">{docxError}</p>
            <button onClick={handleDownload} className="btn btn-primary btn-sm">Скачать документ</button>
          </div>
        );
      }
      if (docxHtml) {
        return (
          <div className="document-preview__docx">
            <div className="document-preview__docx-content prose prose-sm" dangerouslySetInnerHTML={{ __html: docxHtml }} />
          </div>
        );
      }
    }
    if (['mp4', 'webm', 'ogg', 'ogv', 'mov', 'avi', 'mkv', 'm4v'].includes(ext)) {
      return (
        <video controls className="document-preview__video" src={previewUrl}>
          Ваш браузер не поддерживает воспроизведение видео.
        </video>
      );
    }
    if (['mp3', 'wav', 'oga', 'm4a', 'aac', 'flac', 'wma', 'ogg', 'opus'].includes(ext)) {
      return (
        <div className="document-preview__audio-wrapper">
          <div className="document-preview__audio-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <p className="document-preview__audio-name">{document.file_name}</p>
          </div>
          <audio controls className="document-preview__audio">
            <source src={previewUrl} />
            Ваш браузер не поддерживает воспроизведение аудио.
          </audio>
        </div>
      );
    }
    if (['txt', 'md', 'markdown', 'json', 'xml', 'csv', 'log', 'ini', 'cfg', 'yaml', 'yml', 'toml', 'env', 'js', 'ts', 'jsx', 'tsx', 'html', 'htm', 'css', 'scss', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs', 'rb', 'php', 'sql', 'sh', 'bat'].includes(ext)) {
      return <iframe src={previewUrl} className="document-preview__iframe document-preview__iframe--text" title={document.title} />;
    }
    if (['doc', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf'].includes(ext)) {
      return (
        <div className="document-preview__fallback">
          <div className="document-preview__fallback-icon document-preview__fallback-icon--blue">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="document-preview__fallback-name">{document.file_name}</p>
          <p className="document-preview__fallback-hint">Предпросмотр для .{ext} недоступен</p>
          <button onClick={handleDownload} className="btn btn-primary">Скачать документ</button>
        </div>
      );
    }
    if (['dwg', 'dxf', 'dwf', 'step', 'stp', 'iges', 'igs', 'stl'].includes(ext)) {
      return (
        <div className="document-preview__fallback">
          <div className="document-preview__fallback-icon document-preview__fallback-icon--orange">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          </div>
          <p className="document-preview__fallback-name">{document.file_name}</p>
          <p className="document-preview__fallback-hint">CAD файлы требуют специализированного ПО</p>
          <button onClick={handleDownload} className="btn btn-primary">Скачать документ</button>
        </div>
      );
    }
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
      return (
        <div className="document-preview__fallback">
          <div className="document-preview__fallback-icon document-preview__fallback-icon--yellow">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
          <p className="document-preview__fallback-name">{document.file_name}</p>
          <p className="document-preview__fallback-hint">Архивы нужно скачать и распаковать</p>
          <button onClick={handleDownload} className="btn btn-primary">Скачать архив</button>
        </div>
      );
    }
    return (
      <div className="document-preview__fallback">
        <div className="document-preview__fallback-icon document-preview__fallback-icon--gray">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="document-preview__fallback-name">{document.file_name}</p>
        <p className="document-preview__fallback-hint">Предпросмотр для .{ext} не поддерживается</p>
        <button onClick={handleDownload} className="btn btn-primary">Скачать документ</button>
      </div>
    );
  };
  if (loading) {
    return <Layout><div className="document-loading">Загрузка...</div></Layout>;
  }
  if (!document) {
    return <Layout><div className="document-error-page">{error || 'Документ не найден'}</div></Layout>;
  }
  return (
    <Layout>
      {error && (
        <div className="document-error-overlay">
          <div className="document-error-modal">
            <div className="document-error-modal__header">
              <div className="document-error-modal__icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="document-error-modal__title">Ошибка</h3>
            </div>
            <p className="document-error-modal__message">{error}</p>
            <div className="document-error-modal__actions">
              <button onClick={() => setError('')} className="btn btn-primary">Понятно</button>
            </div>
          </div>
        </div>
      )}
      <div className="document-header">
        <div className="document-header__top">
          <div>
            <div className="document-header__meta">
              <span className={`document-status ${getStatusClass(document.status)}`}>
                {statusNames[document.status]}
              </span>
              <span className="document-header__version">v{document.version}</span>
            </div>
            <h1 className="document-header__title">{document.title}</h1>
            <p className="document-header__code">{document.code}</p>
          </div>
          <div className="document-header__actions">
            <button
              onClick={handleToggleFavorite}
              className={`document-favorite-btn ${isFavorite ? 'document-favorite-btn--active' : 'document-favorite-btn--inactive'}`}
              title={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
            >
              <svg fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
            {canUpdate && (
              <button onClick={() => setShowUpdateModal(true)} className="btn btn-secondary">
                Обновить документ
              </button>
            )}
            {user?.role === 'librarian' && document.status === 'in_library' && (
              <button onClick={() => setShowArchiveModal(true)} className="btn btn-warning">
                В архив
              </button>
            )}
            {user?.role === 'librarian' && document.status === 'archived' && (
              <button onClick={handleRestore} className="btn btn-success">
                Восстановить
              </button>
            )}
            <button onClick={handleDownload} className="btn btn-primary">Скачать</button>
          </div>
        </div>
      </div>
      <div className="document-tabs">
        {[
          { id: 'preview', label: 'Просмотр' },
          { id: 'versions', label: `Версии (${versions.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`document-tabs__btn ${activeTab === tab.id ? 'document-tabs__btn--active' : 'document-tabs__btn--inactive'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'preview' && (
        <div className="document-content">
          <div className="document-preview">{renderPreview()}</div>
          <div className="document-info-grid">
            <div className="document-info-card">
              <h3 className="document-info-card__title">Основная информация</h3>
              <dl className="document-info-card__list">
                <div className="document-info-card__row">
                  <dt className="document-info-card__label">Тип:</dt>
                  <dd className="document-info-card__value">{typeNames[document.type]}</dd>
                </div>
                <div className="document-info-card__row">
                  <dt className="document-info-card__label">Категория:</dt>
                  <dd className="document-info-card__value">{document.category_name || '-'}</dd>
                </div>
                <div className="document-info-card__row">
                  <dt className="document-info-card__label">Размер файла:</dt>
                  <dd className="document-info-card__value">{formatFileSize(document.file_size)}</dd>
                </div>
                <div className="document-info-card__row">
                  <dt className="document-info-card__label">Формат:</dt>
                  <dd className="document-info-card__value document-info-card__value--uppercase">{getFileExtension()}</dd>
                </div>
                <div className="document-info-card__row">
                  <dt className="document-info-card__label">Создан:</dt>
                  <dd className="document-info-card__value">{formatDate(document.created_at)}</dd>
                </div>
                <div className="document-info-card__row">
                  <dt className="document-info-card__label">Обновлен:</dt>
                  <dd className="document-info-card__value">{formatDate(document.updated_at)}</dd>
                </div>
                <div className="document-info-card__row">
                  <dt className="document-info-card__label">Автор:</dt>
                  <dd className="document-info-card__value">{document.created_by_name || '-'}</dd>
                </div>
              </dl>
            </div>
            <div className="document-info-card">
              <h3 className="document-info-card__title">Описание</h3>
              <p className={`document-description ${!document.description ? 'document-description--empty' : ''}`}>
                {document.description || 'Описание отсутствует'}
              </p>
              {document.tags && document.tags.length > 0 && (
                <div className="document-tags">
                  <h4 className="document-tags__title">Теги:</h4>
                  <div className="document-tags__list">
                    {document.tags.map((tag, index) => (
                      <span key={tag.id || index} className="document-tags__item">
                        {typeof tag === 'object' ? tag.name : tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="document-notes">
            <h3 className="document-notes__title">Мои заметки</h3>
            <p className="document-notes__subtitle">Заметки видны только вам</p>
            <form onSubmit={handleAddNote} className="document-notes__form">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Добавить заметку..."
                className="input document-notes__textarea"
                rows={3}
              />
              <button type="submit" className="btn btn-primary">Добавить заметку</button>
            </form>
            {notes.length === 0 ? (
              <p className="document-notes__empty">У вас пока нет заметок к этому документу</p>
            ) : (
              <div className="document-notes__list">
                {notes.map((note) => (
                  <div key={note.id} className="document-notes__item">
                    <div className="document-notes__item-header">
                      <span className="document-notes__item-date">{formatDate(note.created_at)}</span>
                      <button onClick={() => openDeleteNoteModal(note.id)} className="document-notes__item-delete">
                        Удалить
                      </button>
                    </div>
                    <p className="document-notes__item-content">{note.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {activeTab === 'versions' && (
        <div className="document-versions">
          {versions.length === 0 ? (
            <p className="document-versions__empty">История версий пуста</p>
          ) : (
            <div className="document-versions__list">
              {versions.map((version) => (
                <div key={version.id} className="document-versions__item">
                  <div>
                    <div className="document-versions__item-title">
                      Версия {version.version}
                      {version.version === Math.max(...versions.map(v => v.version)) && (
                        <span className="document-versions__item-badge">Текущая</span>
                      )}
                    </div>
                    <div className="document-versions__item-meta">
                      {formatDate(version.created_at)} | {version.created_by_name || 'Неизвестно'}
                    </div>
                    {version.change_description && (
                      <div className="document-versions__item-comment">{version.change_description}</div>
                    )}
                  </div>
                  <div className="document-versions__item-right">
                    <span className="document-versions__item-size">{formatFileSize(version.file_size)}</span>
                    <button onClick={() => handleDownloadVersion(version.id)} className="document-versions__item-download">
                      Скачать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {showUpdateModal && (
        <div className="document-modal-overlay">
          <div className="document-modal">
            <h3 className="document-modal__title">
              {document.status === 'pending_approval' ? 'Заменить файл' : 'Загрузить новую версию'}
            </h3>
            {document.status === 'pending_approval' && (
              <p className="document-modal__warning">
                Документ на согласовании. Файл будет заменён без создания новой версии.
              </p>
            )}
            <form onSubmit={handleUpdateDocument}>
              <div className="document-modal__field">
                <label className="document-modal__label">
                  Файл <span className="document-modal__required">*</span>
                </label>
                <input type="file" onChange={(e) => setUpdateFile(e.target.files[0])} className="input" required />
                {updateFile && (
                  <p className="document-modal__file-info">
                    Выбран: {updateFile.name} ({formatFileSize(updateFile.size)})
                  </p>
                )}
              </div>
              <div className="document-modal__field">
                <label className="document-modal__label">Комментарий к изменению</label>
                <textarea
                  value={updateComment}
                  onChange={(e) => setUpdateComment(e.target.value)}
                  className="input"
                  rows={2}
                  placeholder="Опишите изменения..."
                />
              </div>
              <div className="document-modal__actions">
                <button
                  type="button"
                  onClick={() => { setShowUpdateModal(false); setUpdateFile(null); setUpdateComment(''); }}
                  className="btn btn-secondary"
                  disabled={updating}
                >
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary" disabled={updating}>
                  {updating ? 'Загрузка...' : 'Загрузить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmDeleteNote}
        title="Удалить заметку"
        message="Вы уверены, что хотите удалить эту заметку? Это действие нельзя отменить."
        confirmText="Удалить"
        cancelText="Отмена"
        confirmStyle="danger"
      />
      <ConfirmModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        onConfirm={handleArchive}
        title="Архивация документа"
        message="Вы уверены, что хотите переместить документ в архив? Документ будет доступен только библиотекарям."
        confirmText="В архив"
        confirmStyle="warning"
      />
    </Layout>
  );
}