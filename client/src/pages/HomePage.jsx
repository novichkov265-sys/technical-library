import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { documentsApi, ticketsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import Layout from '../components/Layout';
import './HomePage.css';

export default function HomePage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [pendingTickets, setPendingTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  if (user?.role === 'admin') {
    return <Navigate to="/admin" />;
  }

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const promises = [
        documentsApi.search({ status: 'in_library' }),
        documentsApi.getFavorites(),
      ];
      
      if (user?.role === 'librarian' || user?.role === 'department_head') {
        promises.push(ticketsApi.getAll());
      }
      
      const results = await Promise.all(promises);
      
      const docs = results[0].data.documents || results[0].data || [];
      setRecentDocuments(Array.isArray(docs) ? docs.slice(0, 5) : []);
      setFavorites(results[1].data?.slice(0, 5) || []);
      
      if (results[2]) {
        const openTickets = results[2].data.filter(t => ['open', 'in_progress'].includes(t.status));
        setPendingTickets(openTickets.slice(0, 5));
      }
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
    }
    setLoading(false);
  };

  const typeNames = {
    drawing: 'Чертеж',
    standard: 'Стандарт',
    specification: 'Спецификация',
    instruction: 'Инструкция',
    manual: 'Руководство',
    other: 'Другое',
  };

  const roleNames = {
    admin: 'Администратор',
    librarian: 'Библиотекарь',
    department_head: 'Руководитель отдела',
    technical_specialist: 'Технический специалист',
  };

  const statusNames = {
    open: 'Открыт',
    in_progress: 'В работе',
  };

  return (
    <Layout>
      <div className="home-page">
        {/* Welcome Section */}
        <div className="home-welcome">
          <h1 className="home-welcome-title">
            Добро пожаловать, {user?.full_name}!
          </h1>
          <p className="home-welcome-subtitle">
            {settings.app_name || 'Электронная библиотека НТД'} | {roleNames[user?.role]}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="home-actions">
          <Link to="/search" className="home-action-card">
            <div className="home-action-icon blue">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="home-action-content">
              <h3 className="home-action-title">Поиск документов</h3>
              <p className="home-action-desc">Найти нужный документ</p>
            </div>
          </Link>

          {user?.role === 'librarian' && (
            <Link to="/upload" className="home-action-card">
              <div className="home-action-icon green">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="home-action-content">
                <h3 className="home-action-title">Загрузить документ</h3>
                <p className="home-action-desc">Добавить новый документ</p>
              </div>
            </Link>
          )}

          {(user?.role === 'librarian' || user?.role === 'department_head') && (
            <Link to="/tickets" className="home-action-card">
              <div className="home-action-icon yellow">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="home-action-content">
                <h3 className="home-action-title">Согласование</h3>
                <p className="home-action-desc">
                  {pendingTickets.length > 0 ? `${pendingTickets.length} на рассмотрении` : 'Документы на рассмотрении'}
                </p>
              </div>
            </Link>
          )}

          <Link to="/favorites" className="home-action-card">
            <div className="home-action-icon purple">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div className="home-action-content">
              <h3 className="home-action-title">Избранное</h3>
              <p className="home-action-desc">{favorites.length} документов</p>
            </div>
          </Link>
        </div>

        {loading ? (
          <div className="home-loading">
            <div className="home-loading-spinner"></div>
            <p>Загрузка данных...</p>
          </div>
        ) : (
          <div className="home-sections">
            {/* Favorites Section */}
            <div className="home-section">
              <div className="home-section-header">
                <h2 className="home-section-title">Избранное</h2>
                <Link to="/favorites" className="home-section-link">Все избранное</Link>
              </div>
              <div className="home-section-body">
                {favorites.length === 0 ? (
                  <div className="home-empty">
                    <svg className="home-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <p>У вас пока нет избранных документов</p>
                  </div>
                ) : (
                  <div className="home-doc-list">
                    {favorites.map((doc) => (
                      <Link key={doc.id} to={`/documents/${doc.id}`} className="home-doc-item">
                        <div className="home-doc-title">{doc.title}</div>
                        <div className="home-doc-meta">
                          <span className="home-doc-code">{doc.code}</span>
                          <span className="home-doc-separator">•</span>
                          <span>{typeNames[doc.type]}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tickets or Recent Documents */}
            {(user?.role === 'librarian' || user?.role === 'department_head') && pendingTickets.length > 0 ? (
              <div className="home-section">
                <div className="home-section-header">
                  <h2 className="home-section-title">На согласовании</h2>
                  <Link to="/tickets" className="home-section-link">Все заявки</Link>
                </div>
                <div className="home-section-body">
                  <div className="home-doc-list">
                    {pendingTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        onClick={() => window.location.href = `/tickets/${ticket.id}`}
                        className="home-ticket-item"
                      >
                        <div className="home-ticket-header">
                          <span className="home-ticket-title">{ticket.document_title}</span>
                          <span className="home-ticket-badge">{statusNames[ticket.status]}</span>
                        </div>
                        <div className="home-ticket-meta">
                          {ticket.document_code} • От: {ticket.created_by_name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="home-section">
                <div className="home-section-header">
                  <h2 className="home-section-title">Последние документы</h2>
                  <Link to="/search" className="home-section-link">Все документы</Link>
                </div>
                <div className="home-section-body">
                  {recentDocuments.length === 0 ? (
                    <div className="home-empty">
                      <svg className="home-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p>В библиотеке пока нет документов</p>
                    </div>
                  ) : (
                    <div className="home-doc-list">
                      {recentDocuments.map((doc) => (
                        <Link key={doc.id} to={`/documents/${doc.id}`} className="home-doc-item">
                          <div className="home-doc-title">{doc.title}</div>
                          <div className="home-doc-meta">
                            <span className="home-doc-code">{doc.code}</span>
                            <span className="home-doc-separator">•</span>
                            <span>{typeNames[doc.type]}</span>
                            {doc.category_name && (
                              <>
                                <span className="home-doc-separator">•</span>
                                <span>{doc.category_name}</span>
                              </>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}