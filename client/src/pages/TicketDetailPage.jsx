import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ticketsApi, documentsApi, getApiUrl } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import mammoth from 'mammoth';
import './TicketDetailPage.css';
export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [actionComment, setActionComment] = useState('');
  const [showActionModal, setShowActionModal] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadComment, setUploadComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [docxHtml, setDocxHtml] = useState('');
  const [docxLoading, setDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState('');
  useEffect(() => {
    loadTicket();
  }, [id]);
  useEffect(() => {
    setDocxHtml('');
    setDocxError('');
  }, [ticket?.document_id]);
  const loadTicket = async () => {
    setLoading(true);
    try {
      const response = await ticketsApi.getById(id);
      setTicket(response.data.ticket);
      setMessages(response.data.messages || []);
    } catch (err) {
      setError('Ошибка загрузки тикета');
    }
    setLoading(false);
  };
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      await ticketsApi.addMessage(id, newMessage);
      setNewMessage('');
      loadTicket();
    } catch (err) {
      setError('Ошибка отправки сообщения');
    }
  };
  const handleAction = async (action) => {
    setProcessing(true);
    try {
      if (action === 'approve') {
        await ticketsApi.approve(id, actionComment);
      } else if (action === 'reject') {
        await ticketsApi.reject(id, actionComment);
      } else if (action === 'request_changes') {
        await ticketsApi.requestChanges(id, actionComment);
      }
      setShowActionModal(null);
      setActionComment('');
      loadTicket();
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка выполнения действия');
    }
    setProcessing(false);
  };
  const handleDownload = async () => {
    try {
      const response = await documentsApi.download(ticket.document_id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = window.document.createElement('a');
      link.href = url;
      link.download = ticket.file_name || ticket.document_title || 'document';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Ошибка скачивания');
    }
  };
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadFile(file);
      setShowUploadModal(true);
    }
  };
  const handleUploadNewVersion = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      await ticketsApi.updateDocument(id, uploadFile, uploadComment);
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadComment('');
      setDocxHtml('');
      setDocxError('');
      loadTicket();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка загрузки файла');
    }
    setUploading(false);
  };
  const loadDocxPreview = async () => {
    if (!ticket?.document_id || docxLoading) return;
    setDocxLoading(true);
    setDocxError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getApiUrl()}/api/documents/${ticket.document_id}/preview?token=${encodeURIComponent(token || '')}`,
        { headers: { 'Accept': 'application/octet-stream' } }
      );
      if (!response.ok) {
        throw new Error('Ошибка загрузки файла');
      }
      const arrayBuffer = await response.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      setDocxHtml(result.value);
    } catch (err) {
      console.error('Ошибка загрузки DOCX:', err);
      setDocxError('Не удалось загрузить предпросмотр документа');
    }
    setDocxLoading(false);
  };
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };
  const formatFileSize = (bytes) => {
    if (!bytes) return '-';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  const statusNames = {
    pending: 'На рассмотрении',
    pending_library: 'Ожидает библиотекаря',
    approved: 'Согласован',
    rejected: 'Отклонён',
    changes_requested: 'Требует доработки',
  };
  const typeNames = {
    drawing: 'Чертеж',
    standard: 'Стандарт',
    specification: 'Спецификация',
    instruction: 'Инструкция',
    manual: 'Руководство',
    other: 'Другое',
  };
  const canApprove = (user?.role === 'department_head' || user?.role === 'admin') && 
    ['pending', 'pending_library', 'changes_requested'].includes(ticket?.status);
  const canUploadNewVersion = ticket?.created_by === user?.id && 
    ['pending', 'changes_requested'].includes(ticket?.status);
  const getFileExtension = () => {
    if (!ticket?.file_path && !ticket?.file_name) return '';
    const fileName = ticket.file_name || ticket.file_path || '';
    return fileName.split('.').pop()?.toLowerCase() || '';
  };
  const getMessageTypeLabel = (msgType) => {
    switch (msgType) {
      case 'approve':
        return { text: 'Согласовано', className: 'td-msg-label-approved' };
      case 'reject':
        return { text: 'Отклонено', className: 'td-msg-label-rejected' };
      case 'request_changes':
        return { text: 'Запрос на доработку', className: 'td-msg-label-changes' };
      case 'update':
        return { text: 'Документ обновлен', className: 'td-msg-label-update' };
      default:
        return null;
    }
  };
  const getMessageCardClass = (msgType) => {
    switch (msgType) {
      case 'approve': return 'td-message-approved';
      case 'reject': return 'td-message-rejected';
      case 'request_changes': return 'td-message-changes';
      case 'update': return 'td-message-update';
      default: return 'td-message-default';
    }
  };
  const renderPreview = () => {
    if (!ticket?.document_id) {
      return (
        <div className="td-preview-empty">
          <p>Документ не найден</p>
        </div>
      );
    }
    const token = localStorage.getItem('token');
    const previewUrl = `${getApiUrl()}/api/documents/${ticket.document_id}/preview?token=${encodeURIComponent(token || '')}`;
    const ext = getFileExtension();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif', 'avif'].includes(ext)) {
      return (
        <div className="td-preview-image-container">
          <img 
            src={previewUrl}
            alt={ticket.document_title}
            className="td-preview-image"
          />
        </div>
      );
    }
    if (ext === 'pdf') {
      return (
        <iframe
          src={previewUrl}
          className="td-preview-pdf"
          title={ticket.document_title}
        />
      );
    }
    if (ext === 'docx') {
      if (!docxHtml && !docxLoading && !docxError) {
        loadDocxPreview();
      }
      if (docxLoading) {
        return (
          <div className="td-preview-loading">
            <div className="td-spinner"></div>
            <p>Загрузка документа...</p>
          </div>
        );
      }
      if (docxError) {
        return (
          <div className="td-preview-error">
            <svg className="td-preview-error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>{docxError}</p>
            <button onClick={handleDownload} className="btn btn-primary btn-sm">
              Скачать документ
            </button>
          </div>
        );
      }
      if (docxHtml) {
        return (
          <div className="td-preview-docx">
            <div 
              className="td-docx-content"
              dangerouslySetInnerHTML={{ __html: docxHtml }} 
            />
          </div>
        );
      }
    }
    if (['mp4', 'webm', 'ogg', 'ogv', 'mov', 'avi', 'mkv', 'm4v'].includes(ext)) {
      return (
        <video controls className="td-preview-video" src={previewUrl}>
          Ваш браузер не поддерживает воспроизведение видео.
        </video>
      );
    }
    if (['mp3', 'wav', 'oga', 'm4a', 'aac', 'flac', 'wma', 'ogg', 'opus'].includes(ext)) {
      return (
        <div className="td-preview-audio">
          <svg className="td-preview-audio-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <p className="td-preview-filename">{ticket.file_name}</p>
          <audio controls className="td-audio-player">
            <source src={previewUrl} />
            Ваш браузер не поддерживает воспроизведение аудио.
          </audio>
        </div>
      );
    }
    if (['txt', 'md', 'markdown', 'json', 'xml', 'csv', 'log', 'ini', 'cfg', 'yaml', 'yml', 'toml', 'env', 'js', 'ts', 'jsx', 'tsx', 'html', 'htm', 'css', 'scss', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs', 'rb', 'php', 'sql', 'sh', 'bat'].includes(ext)) {
      return (
        <iframe
          src={previewUrl}
          className="td-preview-text"
          title={ticket.document_title}
        />
      );
    }
    if (['doc', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf'].includes(ext)) {
      return (
        <div className="td-preview-unsupported">
          <svg className="td-preview-unsupported-icon blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="td-preview-filename">{ticket.file_name}</p>
          <p className="td-preview-hint">Предпросмотр для .{ext} недоступен</p>
          <button onClick={handleDownload} className="btn btn-primary btn-sm">
            Скачать документ
          </button>
        </div>
      );
    }
    if (['dwg', 'dxf', 'dwf', 'step', 'stp', 'iges', 'igs', 'stl'].includes(ext)) {
      return (
        <div className="td-preview-unsupported">
          <svg className="td-preview-unsupported-icon orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          <p className="td-preview-filename">{ticket.file_name}</p>
          <p className="td-preview-hint">CAD файлы требуют специализированного ПО</p>
          <button onClick={handleDownload} className="btn btn-primary btn-sm">
            Скачать документ
          </button>
        </div>
      );
    }
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
      return (
        <div className="td-preview-unsupported">
          <svg className="td-preview-unsupported-icon yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <p className="td-preview-filename">{ticket.file_name}</p>
          <p className="td-preview-hint">Архивы нужно скачать и распаковать</p>
          <button onClick={handleDownload} className="btn btn-primary btn-sm">
            Скачать архив
          </button>
        </div>
      );
    }
    return (
      <div className="td-preview-unsupported">
        <svg className="td-preview-unsupported-icon gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="td-preview-filename">{ticket.file_name}</p>
        <p className="td-preview-hint">Предпросмотр для .{ext} не поддерживается</p>
        <button onClick={handleDownload} className="btn btn-primary btn-sm">
          Скачать документ
        </button>
      </div>
    );
  };
  if (loading) {
    return (
      <Layout>
        <div className="td-loading">
          <div className="td-spinner"></div>
          <p>Загрузка...</p>
        </div>
      </Layout>
    );
  }
  if (!ticket) {
    return (
      <Layout>
        <div className="td-error-page">{error || 'Тикет не найден'}</div>
      </Layout>
    );
  }
  return (
    <Layout>
      {error && (
        <div className="td-modal-overlay">
          <div className="td-modal td-modal-sm">
            <div className="td-modal-header">
              <div className="td-modal-icon td-modal-icon-error">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="td-modal-title">Ошибка</h3>
            </div>
            <p className="td-modal-message">{error}</p>
            <div className="td-modal-actions">
              <button onClick={() => setError('')} className="btn btn-primary">
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="td-hidden"
      />
      <div className="td-header-section">
        <button onClick={() => navigate('/tickets')} className="td-back-btn">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Назад к списку
        </button>
        <div className="td-header-row">
          <div className="td-header-info">
            <div className="td-badges">
              <span className={`td-badge td-badge-${ticket.status}`}>
                {statusNames[ticket.status]}
              </span>
              <span className="td-badge td-badge-id">Тикет #{ticket.id}</span>
            </div>
            <h1 className="td-title">{ticket.document_title}</h1>
            <p className="td-code">{ticket.document_code}</p>
          </div>
          <div className="td-actions">
            {canUploadNewVersion && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-primary"
              >
                Загрузить новую версию
              </button>
            )}
            {canApprove && (
              <>
                <button
                  onClick={() => setShowActionModal('approve')}
                  className="btn td-btn-approve"
                >
                  Согласовать
                </button>
                <button
                  onClick={() => setShowActionModal('request_changes')}
                  className="btn td-btn-changes"
                >
                  На доработку
                </button>
                <button
                  onClick={() => setShowActionModal('reject')}
                  className="btn td-btn-reject"
                >
                  Отклонить
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="td-layout">
        <div className="td-sidebar">
          <div className="card">
            <h3 className="td-section-title">Информация о документе</h3>
            <dl className="td-info-list">
              <div className="td-info-item">
                <dt>Тип документа</dt>
                <dd>{typeNames[ticket.document_type] || ticket.document_type}</dd>
              </div>
              <div className="td-info-item">
                <dt>Формат</dt>
                <dd className="td-info-format">{getFileExtension()}</dd>
              </div>
              {ticket.file_size && (
                <div className="td-info-item">
                  <dt>Размер</dt>
                  <dd>{formatFileSize(ticket.file_size)}</dd>
                </div>
              )}
              <div className="td-info-item">
                <dt>Автор заявки</dt>
                <dd>{ticket.created_by_name || ticket.creator_name}</dd>
              </div>
              <div className="td-info-item">
                <dt>Создан</dt>
                <dd>{formatDate(ticket.created_at)}</dd>
              </div>
              <div className="td-info-item">
                <dt>Обновлен</dt>
                <dd>{formatDate(ticket.updated_at)}</dd>
              </div>
            </dl>
            {ticket.document_description && (
              <div className="td-description">
                <dt>Описание</dt>
                <dd>{ticket.document_description}</dd>
              </div>
            )}
            <div className="td-download-section">
              <button onClick={handleDownload} className="btn btn-primary td-download-btn">
                Скачать документ
              </button>
            </div>
          </div>
        </div>
        <div className="td-main">
          {/* Preview */}
          <div className="card">
            <h3 className="td-section-title">Предпросмотр документа</h3>
            {renderPreview()}
          </div>
          <div className="card">
            <h3 className="td-section-title">
              Обсуждение 
              <span className="td-message-count">({messages.length})</span>
            </h3>
            <div className="td-messages">
              {messages.length === 0 ? (
                <p className="td-messages-empty">Сообщений пока нет</p>
              ) : (
                messages.map((msg) => {
                  const msgType = msg.message_type || msg.type || 'message';
                  const typeLabel = getMessageTypeLabel(msgType);
                  const cardClass = getMessageCardClass(msgType);
                  return (
                    <div key={msg.id} className={`td-message ${cardClass}`}>
                      <div className="td-message-header">
                        <div className="td-message-author-row">
                          <span className="td-message-author">
                            {msg.author_name || msg.full_name || 'Неизвестный пользователь'}
                          </span>
                          {typeLabel && (
                            <span className={`td-msg-label ${typeLabel.className}`}>
                              {typeLabel.text}
                            </span>
                          )}
                        </div>
                        <span className="td-message-date">
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                      <p className="td-message-text">
                        {msg.message || msg.content}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
            {['pending', 'pending_library', 'changes_requested'].includes(ticket.status) && (
              <form onSubmit={handleSendMessage} className="td-message-form">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Написать сообщение..."
                  className="input"
                />
                <button type="submit" className="btn btn-primary">
                  Отправить
                </button>
              </form>
            )}
            {['approved', 'rejected', 'resolved', 'closed'].includes(ticket.status) && (
              <div className="td-messages-closed">
                Тикет закрыт. Новые сообщения недоступны.
              </div>
            )}
          </div>
        </div>
      </div>
      {showActionModal && (
        <div className="td-modal-overlay">
          <div className="td-modal">
            <h3 className="td-modal-title">
              {showActionModal === 'approve' && 'Согласование документа'}
              {showActionModal === 'reject' && 'Отклонение документа'}
              {showActionModal === 'request_changes' && 'Запрос на доработку'}
            </h3>
            <div className="td-modal-field">
              <label className="td-modal-label">
                Комментарий {showActionModal !== 'approve' && <span className="td-required">*</span>}
              </label>
              <textarea
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
                className="input"
                rows={4}
                placeholder={
                  showActionModal === 'approve'
                    ? 'Необязательный комментарий...'
                    : showActionModal === 'request_changes'
                    ? 'Опишите, что нужно исправить...'
                    : 'Укажите причину отклонения...'
                }
                required={showActionModal !== 'approve'}
              />
            </div>
            <div className="td-modal-buttons">
              <button
                onClick={() => handleAction(showActionModal)}
                disabled={processing || (showActionModal !== 'approve' && !actionComment.trim())}
                className={`btn td-btn-${showActionModal === 'approve' ? 'approve' : showActionModal === 'reject' ? 'reject' : 'changes'}`}
              >
                {processing ? 'Обработка...' : 'Подтвердить'}
              </button>
              <button
                onClick={() => {
                  setShowActionModal(null);
                  setActionComment('');
                }}
                className="btn btn-secondary"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
      {showUploadModal && (
        <div className="td-modal-overlay">
          <div className="td-modal">
            <h3 className="td-modal-title">Загрузка новой версии</h3>
            <div className="td-upload-info">
              <p className="td-upload-label">Выбранный файл:</p>
              <p className="td-upload-filename">{uploadFile?.name}</p>
              <p className="td-upload-size">{formatFileSize(uploadFile?.size)}</p>
            </div>
            <div className="td-modal-field">
              <label className="td-modal-label">Комментарий к изменениям</label>
              <textarea
                value={uploadComment}
                onChange={(e) => setUploadComment(e.target.value)}
                className="input"
                rows={3}
                placeholder="Опишите внесенные изменения..."
              />
            </div>
            <div className="td-modal-buttons">
              <button
                onClick={handleUploadNewVersion}
                disabled={uploading}
                className="btn btn-primary"
              >
                {uploading ? 'Загрузка...' : 'Загрузить'}
              </button>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                  setUploadComment('');
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="btn btn-secondary"
                disabled={uploading}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}