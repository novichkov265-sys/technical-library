import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import FavoritesPage from './pages/FavoritesPage';
import DocumentPage from './pages/DocumentPage';
import UploadPage from './pages/UploadPage';
import TicketsPage from './pages/TicketsPage';
import TicketDetailPage from './pages/TicketDetailPage';
import CategoriesPage from './pages/CategoriesPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Загрузка...</div>;
  }
  if (!user) {
    return <Navigate to="/login" />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" />;
  }
  return children;
}
function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        <PrivateRoute>
          {user?.role === 'admin' ? <Navigate to="/admin" /> : <HomePage />}
        </PrivateRoute>
      } />
      <Route path="/search" element={
        <PrivateRoute>
          <SearchPage />
        </PrivateRoute>
      } />
      <Route path="/favorites" element={
        <PrivateRoute>
          <FavoritesPage />
        </PrivateRoute>
      } />
      <Route path="/documents/:id" element={
        <PrivateRoute>
          <DocumentPage />
        </PrivateRoute>
      } />
      <Route path="/upload" element={
        <PrivateRoute roles={['librarian', 'admin']}>
          <UploadPage />
        </PrivateRoute>
      } />
      <Route path="/tickets" element={
        <PrivateRoute roles={['librarian', 'department_head', 'admin']}>
          <TicketsPage />
        </PrivateRoute>
      } />
      <Route path="/tickets/:id" element={
        <PrivateRoute roles={['librarian', 'department_head', 'admin']}>
          <TicketDetailPage />
        </PrivateRoute>
      } />
      <Route path="/categories" element={
        <PrivateRoute roles={['librarian', 'admin']}>
          <CategoriesPage />
        </PrivateRoute>
      } />
      <Route path="/profile" element={
        <PrivateRoute>
          <ProfilePage />
        </PrivateRoute>
      } />
      <Route path="/admin" element={
        <PrivateRoute roles={['admin']}>
          <AdminPage />
        </PrivateRoute>
      } />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <AppRoutes />
      </SettingsProvider>
    </AuthProvider>
  );
}