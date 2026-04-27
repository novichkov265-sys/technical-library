import axios from 'axios';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const getApiUrl = () => API_URL.replace('/api', '');
const api = axios.create({
  baseURL: API_URL,
});
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
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
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  me: () => api.get('/auth/me'),
};
export const documentsApi = {
  getAll: (params) => api.get('/documents', { params }),
  getById: (id) => api.get(`/documents/${id}`),
  create: (formData) => api.post('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  update: (id, formData) => api.put(`/documents/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  delete: (id) => api.delete(`/documents/${id}`),
  download: (id) => api.get(`/documents/${id}/download`, { responseType: 'blob' }),
  getVersions: (id) => api.get(`/documents/${id}/versions`),
  downloadVersion: (documentId, versionId) => api.get(`/documents/${documentId}/versions/${versionId}/download`, {
    responseType: 'blob'
  }),
  getComments: (id) => api.get(`/documents/${id}/comments`),
  addComment: (id, content) => api.post(`/documents/${id}/comments`, { content }),
  deleteComment: (documentId, commentId) => api.delete(`/documents/${documentId}/comments/${commentId}`),
  getFavorites: () => api.get('/documents/favorites'),
  addToFavorites: (id) => api.post(`/documents/favorites/${id}`),
  removeFromFavorites: (id) => api.delete(`/documents/favorites/${id}`),
  getPending: () => api.get('/documents', { params: { status: 'pending_approval' } }),
  approve: (id) => api.post(`/approval/${id}/approve`),
  reject: (id, reason) => api.post(`/approval/${id}/reject`, { reason }),
};
export const categoriesApi = {
  getAll: () => api.get('/categories'),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
};
export const usersApi = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};
export default api;