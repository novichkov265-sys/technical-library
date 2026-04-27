import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ticketsApi } from '../services/api';
import Layout from '../components/Layout';
import './ApprovalsPage.css';
export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState('approval');
  const [pendingApproval, setPendingApproval] = useState([]);
  const [pendingDeletion, setPendingDeletion] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    loadDocuments();
  }, []);
  const loadDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await ticketsApi.getAll();
const tickets = response.data || [];
console.log('[v0] Tickets received:', tickets);
setPendingApproval(tickets.filter(t => t.status === 'pending'));
setPendingDeletion([]);
    } catch (err) {
      setError('Ошибка загрузки тикетов');
    }
    setLoading(false);
  };
  const handleApprove = async (id) => {
    const comment = prompt('Комментарий (необязательно):');
    try {
      await ticketsApi.approve(id, comment || '');
      loadDocuments();
    } catch (err) {
      alert('Ошибка при утверждении');
    }
  };
  const handleReject = async (id) => {
    const comment = prompt('Причина отклонения:');
    if (!comment) {
      alert('Укажите причину отклонения');
      return;
    }
    try {
      await ticketsApi.reject(id, comment);
      loadDocuments();
    } catch (err) {
      alert('Ошибка при отклонении');
    }
  };
  const handleApproveDeletion = async (id) => {
    if (!confirm('Подтвердить удаление документа?')) return;
    try {
      await ticketsApi.approve(id, 'Удаление подтверждено');
      loadDocuments();
    } catch (err) {
      alert('Ошибка при удалении');
    }
  };
  const handleRejectDeletion = async (id) => {
    try {
      await ticketsApi.reject(id, 'Удаление отклонено');
      loadDocuments();
    } catch (err) {
      alert('Ошибка');
    }
  };
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };
  const typeNames = {
    drawing: 'Чертеж',
    standard: 'Стандарт',
    specification: 'Спецификация',
    instruction: 'Инструкция',
    manual: 'Руководство',
    other: 'Другое',
  };
  return (
    <Layout>
      <div className="approvals-page">
        <div className="approvals-header">
          <h1 className="approvals-title">Согласование документов</h1>
        </div>
        {/* Табы */}
        <div className="approvals-tabs">
          <button
            onClick={() => setActiveTab('approval')}
            className={`approvals-tab ${activeTab === 'approval' ? 'active' : 'inactive'}`}
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            На утверждение
            <span className="approvals-tab-count">{pendingApproval.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('deletion')}
            className={`approvals-tab ${activeTab === 'deletion' ? 'active' : 'inactive'}`}
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            На удаление
            <span className="approvals-tab-count">{pendingDeletion.length}</span>
          </button>
        </div>
        {/* Loading */}
        {loading && (
          <div className="approvals-loading">
            <div className="approvals-spinner"></div>
            <p>Загрузка документов...</p>
          </div>
        )}
        {/* Error */}
        {error && (
          <div className="approvals-error">
            <svg className="approvals-error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}
        {/* Документы на утверждение */}
        {!loading && activeTab === 'approval' && (
          <div className="approvals-card">
            {pendingApproval.length === 0 ? (
              <div className="approvals-empty">
                <svg className="approvals-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="approvals-empty-text">Нет документов на утверждение</p>
              </div>
            ) : (
              <div className="approvals-table-wrapper">
                <table className="approvals-table">
                  <thead>
                    <tr>
                      <th>Код</th>
                      <th>Название</th>
                      <th>Тип</th>
                      <th>Автор</th>
                      <th>Дата</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingApproval.map((ticket) => (
                      <tr key={ticket.id}>
                        <td>
                          <span className="approvals-code">{ticket.document_code}</span>
                        </td>
                        <td>
                          <Link to={`/documents/${ticket.document_id}`} className="approvals-title-link">
                            {ticket.document_title}
                          </Link>
                        </td>
                        <td>
                          <span className="approvals-type">{typeNames[ticket.document_type]}</span>
                        </td>
                        <td className="approvals-author">{ticket.created_by_name}</td>
                        <td className="approvals-date">{formatDate(ticket.created_at)}</td>
                        <td>
                          <div className="approvals-actions">
                            <button
                              onClick={() => handleApprove(ticket.id)}
                              className="approvals-btn approvals-btn-approve"
                            >
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Утвердить
                            </button>
                            <button
                              onClick={() => handleReject(ticket.id)}
                              className="approvals-btn approvals-btn-reject"
                            >
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Отклонить
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {/* Документы на удаление */}
        {!loading && activeTab === 'deletion' && (
          <div className="approvals-card">
            {pendingDeletion.length === 0 ? (
              <div className="approvals-empty">
                <svg className="approvals-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <p className="approvals-empty-text">Нет документов на удаление</p>
              </div>
            ) : (
              <div className="approvals-table-wrapper">
                <table className="approvals-table">
                  <thead>
                    <tr>
                      <th>Код</th>
                      <th>Название</th>
                      <th>Тип</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingDeletion.map((ticket) => (
                      <tr key={ticket.id}>
                        <td>
                          <span className="approvals-code">{ticket.document_code}</span>
                        </td>
                        <td>
                          <Link to={`/documents/${ticket.document_id}`} className="approvals-title-link">
                            {ticket.document_title}
                          </Link>
                        </td>
                        <td>
                          <span className="approvals-type">{typeNames[ticket.document_type]}</span>
                        </td>
                        <td>
                          <div className="approvals-actions">
                            <button
                              onClick={() => handleApproveDeletion(ticket.id)}
                              className="approvals-btn approvals-btn-delete"
                            >
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Удалить
                            </button>
                            <button
                              onClick={() => handleRejectDeletion(ticket.id)}
                              className="approvals-btn approvals-btn-cancel"
                            >
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Отменить
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
