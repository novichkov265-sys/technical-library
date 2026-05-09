import { useState, useEffect } from 'react';
import { reportsApi } from '../services/api';
import Layout from '../components/Layout';
import './ReportsPage.css';

export default function ReportsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const typeNames = {
    drawing: 'Чертежи',
    standard: 'Стандарты',
    specification: 'Спецификации',
    instruction: 'Инструкции',
    manual: 'Руководства',
    other: 'Другое'
  };

  const roleNames = {
    admin: 'Администратор',
    librarian: 'Библиотекарь',
    department_head: 'Руководитель',
    technical_specialist: 'Специалист'
  };

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      
      const response = await reportsApi.getStats(params);
      setStats(response.data);
    } catch (err) {
      console.error('Ошибка загрузки статистики:', err);
      setError('Ошибка загрузки данных');
    }
    setLoading(false);
  };

  const handleFilter = () => {
    loadStats();
  };

  const handleResetFilter = () => {
    setDateFrom('');
    setDateTo('');
    setTimeout(loadStats, 0);
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      
      const response = await reportsApi.exportExcel(params);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `report_${Date.now()}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Ошибка экспорта в Excel');
    }
    setExporting(false);
  };

  return (
    <Layout>
      <div className="reports-page">
        <div className="reports-header">
          <div>
            <h1>Отчеты и аналитика</h1>
            <p className="reports-subtitle">Статистика по документам технической библиотеки</p>
          </div>
          <div className="reports-export-buttons">
            <button 
              className="btn btn-primary" 
              onClick={handleExportExcel}
              disabled={exporting || loading}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <path d="M12 18v-6"/>
                <path d="M9 15l3 3 3-3"/>
              </svg>
              {exporting ? 'Экспорт...' : 'Экспорт в Excel'}
            </button>
          </div>
        </div>

        <div className="reports-filters card">
          <div className="filters-row">
            <div className="filter-group">
              <label>Дата с</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input"
              />
            </div>
            <div className="filter-group">
              <label>Дата по</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input"
              />
            </div>
            <div className="filter-actions">
              <button className="btn btn-primary" onClick={handleFilter}>Применить</button>
              <button className="btn btn-secondary" onClick={handleResetFilter}>Сбросить</button>
            </div>
          </div>
        </div>

        {error && (
          <div className="reports-error">
            {error}
            <button onClick={() => setError('')}>&times;</button>
          </div>
        )}

        {loading ? (
          <div className="reports-loading">
            <div className="reports-spinner"></div>
            <p>Загрузка статистики...</p>
          </div>
        ) : stats && (
          <>
            <div className="stats-cards">
              <div className="stat-card stat-card-primary">
                <div className="stat-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <div className="stat-content">
                  <div className="stat-value">{stats.summary.total}</div>
                  <div className="stat-label">Всего документов</div>
                </div>
              </div>

              <div className="stat-card stat-card-success">
                <div className="stat-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </div>
                <div className="stat-content">
                  <div className="stat-value">{stats.summary.in_library}</div>
                  <div className="stat-label">В библиотеке</div>
                </div>
              </div>

              <div className="stat-card stat-card-info">
                <div className="stat-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </div>
                <div className="stat-content">
                  <div className="stat-value">{stats.summary.total_views}</div>
                  <div className="stat-label">Просмотров</div>
                </div>
              </div>

              <div className="stat-card stat-card-warning">
                <div className="stat-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </div>
                <div className="stat-content">
                  <div className="stat-value">{stats.summary.total_downloads}</div>
                  <div className="stat-label">Скачиваний</div>
                </div>
              </div>
            </div>

            <div className="reports-row">
              <div className="card reports-card">
                <h3>Документы по статусам</h3>
                <div className="status-bars">
                  <div className="status-bar-item">
                    <div className="status-bar-header">
                      <span>В библиотеке</span>
                      <span>{stats.summary.in_library}</span>
                    </div>
                    <div className="status-bar">
                      <div className="status-bar-fill status-bar-success" style={{ width: `${(stats.summary.in_library / stats.summary.total) * 100 || 0}%` }} />
                    </div>
                  </div>
                  <div className="status-bar-item">
                    <div className="status-bar-header">
                      <span>Черновики</span>
                      <span>{stats.summary.draft}</span>
                    </div>
                    <div className="status-bar">
                      <div className="status-bar-fill status-bar-gray" style={{ width: `${(stats.summary.draft / stats.summary.total) * 100 || 0}%` }} />
                    </div>
                  </div>
                  <div className="status-bar-item">
                    <div className="status-bar-header">
                      <span>На согласовании</span>
                      <span>{stats.summary.pending}</span>
                    </div>
                    <div className="status-bar">
                      <div className="status-bar-fill status-bar-warning" style={{ width: `${(stats.summary.pending / stats.summary.total) * 100 || 0}%` }} />
                    </div>
                  </div>
                  <div className="status-bar-item">
                    <div className="status-bar-header">
                      <span>В архиве</span>
                      <span>{stats.summary.archived}</span>
                    </div>
                    <div className="status-bar">
                      <div className="status-bar-fill status-bar-danger" style={{ width: `${(stats.summary.archived / stats.summary.total) * 100 || 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="card reports-card">
                <h3>По типам документов</h3>
                <div className="type-list">
                  {stats.byType.map((item, index) => (
  <div key={index} className="type-item">
    <div className="type-info">
      <span className="type-name">{typeNames[item.type] || item.type}</span>
      <span className="type-count">{item.count} док.</span>
    </div>
    <div className="type-stats">
      <span className="type-stat">
        <EyeIcon size={14} />
        {item.views || 0}
      </span>
      <span className="type-stat">
        <DownloadIcon size={14} />
        {item.downloads || 0}
      </span>
    </div>
  </div>
))}
                </div>
              </div>
            </div>

            {stats.approvalStats && (
              <div className="card reports-card">
                <h3>Статистика согласований</h3>
                <div className="approval-stats">
                  <div className="approval-stat">
                    <div className="approval-stat-value">{stats.approvalStats.total}</div>
                    <div className="approval-stat-label">Всего заявок</div>
                  </div>
                  <div className="approval-stat approval-stat-success">
                    <div className="approval-stat-value">{stats.approvalStats.approved}</div>
                    <div className="approval-stat-label">Одобрено</div>
                  </div>
                  <div className="approval-stat approval-stat-danger">
                    <div className="approval-stat-value">{stats.approvalStats.rejected}</div>
                    <div className="approval-stat-label">Отклонено</div>
                  </div>
                  <div className="approval-stat approval-stat-warning">
                    <div className="approval-stat-value">{stats.approvalStats.pending}</div>
                    <div className="approval-stat-label">Ожидает</div>
                  </div>
                </div>
              </div>
            )}

            <div className="reports-row">
              <div className="card reports-card">
                <h3>Топ-10 популярных документов</h3>
                <div className="table-wrapper">
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Документ</th>
                        <th>Просмотры</th>
                        <th>Скачивания</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topDocuments.length === 0 ? (
                        <tr><td colSpan="4" className="empty-cell">Нет данных</td></tr>
                      ) : (
                        stats.topDocuments.map((doc, index) => (
                          <tr key={doc.id}>
                            <td>{index + 1}</td>
                            <td>
                              <div className="doc-title">{doc.title}</div>
                              <div className="doc-code">{doc.code}</div>
                            </td>
                            <td>{doc.views}</td>
                            <td>{doc.downloads}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card reports-card">
                <h3>Активность пользователей</h3>
                <div className="table-wrapper">
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th>Пользователь</th>
                        <th>Просм.</th>
                        <th>Скач.</th>
                        <th>Создано</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.userActivity.length === 0 ? (
                        <tr><td colSpan="4" className="empty-cell">Нет данных</td></tr>
                      ) : (
                        stats.userActivity.map((user, index) => (
                          <tr key={index}>
                            <td>
                              <div className="user-name">{user.full_name}</div>
                              <div className="user-role">{roleNames[user.role]}</div>
                            </td>
                            <td>{user.views}</td>
                            <td>{user.downloads}</td>
                            <td>{user.created}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="card reports-card">
              <h3>Документы по категориям</h3>
              <div className="categories-grid">
                {stats.byCategory.map((cat, index) => (
                  <div key={index} className="category-card">
                    <div className="category-name">{cat.category}</div>
                    <div className="category-count">{cat.count} документов</div>
                    <div className="category-stats">
                      <span>{cat.views} просм.</span>
                      <span>{cat.downloads} скач.</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}