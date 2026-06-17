import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import { LoginPage } from './pages/LoginPage';
import { AdminPage } from './pages/AdminPage';
import { HomePage } from './pages/HomePage';
import { NewTorrentPage } from './pages/NewTorrentPage';
import { QBittorrentPage } from './pages/QBittorrentPage';
import { MediaDetailPage } from './pages/MediaDetailPage';
import { LibraryPage } from './pages/LibraryPage';
import { RequestDetailPage } from './pages/RequestDetailPage';
import { TvShowRequestPage } from './pages/TvShowRequestPage';
import { Layout } from './components/core/Layout';

// Intercepteur global pour rediriger vers le login si la session a expiré (HTTP 401)
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (response.status === 401 && !window.location.pathname.includes('/login')) {
    console.warn('Session expirée (HTTP 401). Déconnexion...');
    useAuthStore.getState().logout();
    window.location.href = '/login';
  }
  return response;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, // Les données ne deviennent jamais périmées automatiquement
      gcTime: Infinity, // Le garbage collector ne nettoie jamais le cache automatiquement (remplace cacheTime qui est obsolète)
      retry: 3,
      refetchOnWindowFocus: false, // Pas de rechargement quand on change de fenêtre
      refetchOnMount: true, // Permettre le chargement au montage initial
      refetchOnReconnect: false // Pas de rechargement à la reconnexion internet
    }
  }
});

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  if (!token) {
    return <Navigate to="/login" />;
  }
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (!user?.is_admin) {
    return <Navigate to="/" />;
  }
  return <>{children}</>;
}

export function App() {
  const { token } = useAuthStore();

  return (
    <QueryClientProvider client={queryClient}>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Layout>
          <Routes>
            <Route
              path="/login"
              element={
                token ? <Navigate to="/" /> : <LoginPage />
              }
            />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <HomePage />
                </PrivateRoute>
              }
            />
            <Route
              path="/new-torrent"
              element={
                <PrivateRoute>
                  <NewTorrentPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/media/:type/:id"
              element={
                <PrivateRoute>
                  <MediaDetailPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              }
            />
            <Route
              path="/qbittorrent"
              element={
                <PrivateRoute>
                  <QBittorrentPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/library"
              element={
                <PrivateRoute>
                  <LibraryPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/library/:id"
              element={
                <PrivateRoute>
                  <RequestDetailPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/library/show/:mediaType/:tmdbId"
              element={
                <PrivateRoute>
                  <TvShowRequestPage />
                </PrivateRoute>
              }
            />
          </Routes>
        </Layout>
      </Router>
    </QueryClientProvider>
  );
}