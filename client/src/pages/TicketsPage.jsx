import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ticketsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import './TicketsPage.css';
export default function TicketsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  useEffect(() => {
    loadTickets();
  }, []);
  const loadTickets = async () => {
    try {
      const response = await ticketsApi.getAll();
      setTickets(response.data);
    } catch (err) {
      console.error('Ошибка загрузки тикетов:', err);
    }
    setLoading(false);
  };
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
  const filteredTickets = tickets.filter((ticket) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return ticket.status === 'pending' || ticket.status === 'pending_library';
    if (filter === 'approved') return ticket.status === 'approved';
    if (filter === 'rejected') return ticket.status === 'rejected';
    if (filter === 'changes') return ticket.status === 'changes_requested';
    return true;
  });
  const counts = {
    all: tickets.length,
    pending: tickets.filter((t) => t.status === 'pending' || t.status === 'pending_library').length,
    approved: tickets.filter((t) => t.status === 'approved').length,
    rejected: tickets.filter((t) => t.status === 'rejected').length,
    changes: tickets.filter((t) => t.status === 'changes_requested').length,
  };
  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
      case 'pending_library':
        return (
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'approved':
        return (
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'rejected':
        return (
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'changes_requested':
        return (
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        );
      default:
        return null;
    }
  };
  if (loading) {
    return (
      <Layout>
        <div className="tickets-loading">
          <div className="tickets-spinner"></div>
          <p>Загрузка тикетов...</p>
        </div>
      </Layout>
    );
  }
  return (
    <Layout>
      <div className="tickets-page">
        <div className="tickets-header">
          <h1 className="tickets-title">Документы на согласование</h1>
          <p className="tickets-subtitle">Согласуйте или отклоните документы</p>
        </div>
        <div className="tickets-tabs">
          <button
            onClick={() => setFilter('all')}
            className={`tickets-tab ${filter === 'all' ? 'active' : ''}`}
          >
            Все
            <span className="tickets-tab-count">{counts.all}</span>
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`tickets-tab ${filter === 'pending' ? 'active' : ''}`}
          >
            На рассмотрении
            <span className="tickets-tab-count">{counts.pending}</span>
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`tickets-tab ${filter === 'approved' ? 'active' : ''}`}
          >
            Согласованные
            <span className="tickets-tab-count">{counts.approved}</span>
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`tickets-tab ${filter === 'rejected' ? 'active' : ''}`}
          >
            Отклонённые
            <span className="tickets-tab-count">{counts.rejected}</span>
          </button>
          <button
            onClick={() => setFilter('changes')}
            className={`tickets-tab ${filter === 'changes' ? 'active' : ''}`}
          >
            Требуют доработки
            <span className="tickets-tab-count">{counts.changes}</span>
          </button>
        </div>
        {filteredTickets.length === 0 ? (
          <div className="tickets-empty">
            <svg className="tickets-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="tickets-empty-title">Нет тикетов</h3>
            <p className="tickets-empty-text">В этой категории пока нет документов</p>
          </div>
        ) : (
          <div className="tickets-list">
            {filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="ticket-card"
                onClick={() => navigate(`/tickets/${ticket.id}`)}
              >
                <div className={`ticket-icon ${ticket.status}`}>
                  {getStatusIcon(ticket.status)}
                </div>
                <div className="ticket-content">
                  <div className="ticket-content-header">
                    <div>
                      <h3 className="ticket-name">{ticket.document_title}</h3>
                      <p className="ticket-code">{ticket.document_code}</p>
                    </div>
                  </div>
                  <div className="ticket-meta">
                    <div className="ticket-meta-item">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span>{typeNames[ticket.document_type] || ticket.document_type}</span>
                    </div>
                    <div className="ticket-meta-item">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>{ticket.created_by_name || ticket.creator_name}</span>
                    </div>
                    <div className="ticket-meta-item">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{formatDate(ticket.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="ticket-right">
                  <span className={`ticket-badge ${ticket.status}`}>
                    {statusNames[ticket.status]}
                  </span>
                  <span className="ticket-id">#{ticket.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}