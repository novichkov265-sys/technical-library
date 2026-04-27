import axios from 'axios';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  uploadAvatar: (formData) => api.post('/auth/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteAvatar: () => api.delete('/auth/avatar'),
};
export const documentsApi = {
  getAll: (params) => api.get('/documents', { params }),
  search: (params) => api.get('/documents/search', { params }),
  getById: (id) => api.get(`/documents/${id}`),
  create: (data) => api.post('/documents', data),
  update: (id, data) => api.put(`/documents/${id}`, data),
  delete: (id) => api.delete(`/documents/${id}`),
  upload: (formData) => api.post('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  download: (id) => api.get(`/documents/${id}/download`, { responseType: 'blob' }),
  getVersions: (id) => api.get(`/documents/${id}/versions`),
  uploadVersion: (id, formData) => api.post(`/documents/${id}/versions`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  uploadNewVersion: (id, formData) => api.post(`/documents/${id}/versions`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  downloadVersion: (id, versionId) => api.get(`/documents/${id}/versions/${versionId}/download`, { responseType: 'blob' }),
  getAuditLog: (id) => api.get(`/documents/${id}/audit`),
  getNotes: (id) => api.get(`/documents/${id}/notes`),
  addNote: (id, content) => api.post(`/documents/${id}/notes`, { content }),
  deleteNote: (id, noteId) => api.delete(`/documents/${id}/notes/${noteId}`),
  getComments: (id) => api.get(`/documents/${id}/comments`),
  addComment: (id, content) => api.post(`/documents/${id}/comments`, { content }),
  deleteComment: (id, commentId) => api.delete(`/documents/${id}/comments/${commentId}`),
  addToFavorites: (id) => api.post(`/documents/favorites/${id}`),
  removeFromFavorites: (id) => api.delete(`/documents/favorites/${id}`),
  getFavorites: () => api.get('/documents/favorites'),
  getPendingApprovals: () => api.get('/documents/approvals/pending'),
  approve: (id, data) => api.post(`/documents/${id}/approve`, data),
  reject: (id, data) => api.post(`/documents/${id}/reject`, data),
  getApprovalHistory: (id) => api.get(`/documents/${id}/approval-history`),
  getArchived: (params) => api.get('/documents/archived/list', { params }),
  archive: (id) => api.put(`/documents/${id}/archive`),
  restore: (id) => api.put(`/documents/${id}/restore`),
  permanentDelete: (id) => api.delete(`/documents/${id}/permanent`),
};
export const categoriesApi = {
  getAll: () => api.get('/categories'),
  getTree: () => api.get('/categories/tree'),
  getById: (id) => api.get(`/categories/${id}`),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
  getAllTags: () => api.get('/categories/tags'),
  createTag: (data) => api.post('/categories/tags', data),
  updateTag: (id, data) => api.put(`/categories/tags/${id}`, data),
  deleteTag: (id) => api.delete(`/categories/tags/${id}`),
};
export const usersApi = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  getApprovers: () => api.get('/users/approvers'),
  getAnalytics: () => api.get('/users/analytics'),
  getAuditLogs: () => api.get('/users/audit'),
};
export const notificationsApi = {
  getAll: () => api.get('/notifications'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
};
export const settingsApi = {
  getAll: () => api.get('/settings'),
  getPublic: () => api.get('/settings/public'),
  update: (key, value) => api.put('/settings', { key, value }),
};
export const ticketsApi = {
  getAll: (params) => api.get('/tickets', { params }),
  getById: (id) => api.get(`/tickets/${id}`),
  create: (data) => api.post('/tickets', data),
  update: (id, data) => api.put(`/tickets/${id}`, data),
  addMessage: (id, message) => api.post(`/tickets/${id}/message`, { message }),
  approve: (id, comment) => api.post(`/tickets/${id}/approve`, { comment }),
  reject: (id, comment) => api.post(`/tickets/${id}/reject`, { comment }),
  requestChanges: (id, comment) => api.post(`/tickets/${id}/request-changes`, { comment }),
  getStats: () => api.get('/tickets/stats/summary'),
  updateDocument: (id, file, comment) => {
    const formData = new FormData();
    formData.append('file', file);
    if (comment) formData.append('comment', comment);
    return api.put(`/tickets/${id}/document`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
};
export const backupApi = {
  getAll: () => api.get('/backup'),
  getList: () => api.get('/backup'),
  create: () => api.post('/backup'),
  restore: (filename) => api.post(`/backup/restore/${filename}`),
  download: (filename) => api.get(`/backup/download/${filename}`, { responseType: 'blob' }),
  delete: (id) => api.delete(`/backup/${id}`),
};
export const getApiUrl = () => {
  return API_URL.replace(/\/api\/?$/, '');
};
export default api;