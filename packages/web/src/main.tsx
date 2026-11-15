import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { Shell } from './components/Shell';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { RequestsPage } from './pages/Requests';
import { RequestDetailPage } from './pages/RequestDetail';
import { QueuePage } from './pages/Queue';
import { IntegrationsPage } from './pages/Integrations';
import { ReportsPage } from './pages/Reports';
import { SettingsPage } from './pages/Settings';
import './styles.css';

function Private({ children }: { children: React.ReactNode }) {
  const { authenticated } = useAuth();
  return authenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <Private>
                <Shell>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/solicitacoes" element={<RequestsPage />} />
                    <Route path="/solicitacoes/:id" element={<RequestDetailPage />} />
                    <Route path="/fila" element={<QueuePage />} />
                    <Route path="/integracoes" element={<IntegrationsPage />} />
                    <Route path="/relatorios" element={<ReportsPage />} />
                    <Route path="/configuracoes" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Shell>
              </Private>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
