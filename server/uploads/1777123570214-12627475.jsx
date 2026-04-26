import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ticketsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';

export default function TicketsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const response = await ticketsApi.getAll();
      setTickets(response.data);
    } catch (err) {
      setError('Ошибка загрузки тикетов');
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
    open: 'Открыт',
    in_progress: 'В работе',
    resolved: 'Согласован',
    closed: 'Закрыт',
  };

  const statusColors = {
    open: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
  };

  const typeNames = {
    drawing: 'Чертеж',
    standard: 'Стандарт',
    specification: 'Спецификация',
    instruction: 'Инструкция',
    manual: 'Руководство',
    other: 'Другое',
  };

  const filteredTickets = tickets.filter(ticket => {
    if (filter === 'all') return true;
    return ticket.status === filter;
  });

  const counts = {
    all: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  };

  const handleTicketClick = (ticketId) => {
    navigate(`/tickets/${ticketId}`);
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {user?.role === 'librarian' ? 'Мои документы на согласовании' : 'Документы на согласование'}
        </h1>
        <p className="text-gray-600 mt-1">
          {user?.role === 'librarian' 
            ? 'Отслеживайте статус своих документов'
            : 'Согласуйте или отклоните документы'
          }
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Фильтры */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { id: 'all', label: 'Все' },
          { id: 'open', label: 'Открытые' },
          { id: 'in_progress', label: 'В работе' },
          { id: 'resolved', label: 'Согласованы' },
          { id: 'closed', label: 'Закрыты' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setFilter(item.id)}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === item.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {item.label} ({counts[item.id]})
          </button>
        ))}
      </div>

      {/* Список тикетов */}
      {filteredTickets.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          {filter === 'all' ? 'Нет документов на согласовании' : 'Нет документов с таким статусом'}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => handleTicketClick(ticket.id)}
              className="card hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className={`px-2 py-1 rounded text-sm ${statusColors[ticket.status]}`}>
                      {statusNames[ticket.status]}
                    </span>
                    <span className="text-sm text-gray-500">
                      #{ticket.id}
                    </span>
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">
                    {ticket.document_title}
                  </h3>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                    <span className="font-mono">{ticket.document_code}</span>
                    <span>{typeNames[ticket.document_type]}</span>
                    <span>От: {ticket.created_by_name}</span>
                  </div>
                  
                  {ticket.document_description && (
                    <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                      {ticket.document_description}
                    </p>
                  )}
                </div>
                
                <div className="text-right text-sm text-gray-500 ml-4">
                  <div>Создан: {formatDate(ticket.created_at)}</div>
                  <div>Обновлен: {formatDate(ticket.updated_at)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}