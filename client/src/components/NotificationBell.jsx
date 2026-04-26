import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './NotificationBell.css';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const dropdownRef = useRef(null);
  const prevUnreadCount = useRef(0);
  const navigate = useNavigate();

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get('/notifications/count');
      const newCount = response.data.count;
      
      // Анимация колокольчика при новых уведомлениях
      if (newCount > prevUnreadCount.current) {
        setHasNewNotification(true);
        setTimeout(() => setHasNewNotification(false), 500);
      }
      prevUnreadCount.current = newCount;
      setUnreadCount(newCount);
    } catch (err) {
      console.error('Ошибка получения счётчика:', err);
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data);
    } catch (err) {
      console.error('Ошибка получения уведомлений:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Ошибка:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Ошибка:', err);
    }
  };

  const deleteNotification = async (id) => {
    setRemovingId(id);
    
    setTimeout(async () => {
      try {
        await api.delete(`/notifications/${id}`);
        const notification = notifications.find(n => n.id === id);
        setNotifications(prev => prev.filter(n => n.id !== id));
        if (notification && !notification.is_read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      } catch (err) {
        console.error('Ошибка:', err);
      }
      setRemovingId(null);
    }, 300);
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    setIsOpen(false);
    const link = getLink(notification);
    if (link) {
      navigate(link);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
    return date.toLocaleDateString('ru-RU');
  };

  const getNotificationIcon = (type) => {
    const icons = {
      document_updated: {
        className: 'notification-item__icon--blue',
        svg: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      },
      ticket_approved: {
        className: 'notification-item__icon--green',
        svg: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
      },
      ticket_rejected: {
        className: 'notification-item__icon--red',
        svg: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
      },
      ticket_comment: {
        className: 'notification-item__icon--yellow',
        svg: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      },
      ticket_changes_requested: {
        className: 'notification-item__icon--orange',
        svg: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      },
      ticket_new: {
        className: 'notification-item__icon--purple',
        svg: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      }
    };

    const icon = icons[type] || {
      className: 'notification-item__icon--gray',
      svg: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    };

    return (
      <div className={`notification-item__icon ${icon.className}`}>
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon.svg}
        </svg>
      </div>
    );
  };

  const getLink = (notification) => {
    if (notification.entity_type === 'document' && notification.entity_id) {
      return `/documents/${notification.entity_id}`;
    }
    if (notification.entity_type === 'ticket' && notification.entity_id) {
      return `/tickets/${notification.entity_id}`;
    }
    return null;
  };

  return (
    <div className="notification-bell" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`notification-bell__button ${hasNewNotification ? 'notification-bell__button--has-new' : ''}`}
      >
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="notification-bell__badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-dropdown__header">
            <span className="notification-dropdown__title">
              <svg className="notification-dropdown__title-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Уведомления
            </span>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="notification-dropdown__mark-all">
                Прочитать все
              </button>
            )}
          </div>

          <div className="notification-dropdown__content">
            {loading ? (
              <div className="notification-dropdown__loading">
                <div className="notification-dropdown__spinner"></div>
                <p>Загрузка...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-dropdown__empty">
                <svg className="notification-dropdown__empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="notification-dropdown__empty-text">Нет уведомлений</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`notification-item ${!notification.is_read ? 'notification-item--unread' : ''} ${removingId === notification.id ? 'notification-item--removing' : ''}`}
                >
                  {getNotificationIcon(notification.type)}
                  
                  <div className="notification-item__content">
                    <p className="notification-item__title">{notification.title}</p>
                    <p className="notification-item__message">{notification.message}</p>
                    <p className="notification-item__time">
                      <svg className="notification-item__time-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatDate(notification.created_at)}
                    </p>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                    className="notification-item__delete"
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}