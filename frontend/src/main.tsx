import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import axios from 'axios';
import './index.css';
import App from './App.tsx';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/store/auth';

function AuthInitializer() {
  const { user, accessToken, setAuth, logout } = useAuthStore();

  useEffect(() => {
    if (user && !accessToken) {
      const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
      axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true })
        .then(res => {
          setAuth(user, res.data.data.access);
        })
        .catch(() => {
          logout();
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

async function enableMocks() {
  if (import.meta.env.VITE_MOCK_API === 'true') {
    const { worker } = await import('./mocks/browser');
    return worker.start({ onUnhandledRequest: 'bypass' });
  }
}

if (import.meta.env.DEV) {
  void (async () => {
    const { default: axe } = await import('@axe-core/react');
    const React = await import('react');
    const ReactDOM = await import('react-dom');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await axe(React as any, ReactDOM as any, 1000);
  })();
}

enableMocks().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthInitializer />
        <App />
        <Toaster
          richColors
          closeButton
          expand
          theme="dark"
          position="top-right"
          duration={4000}
          toastOptions={{
            className: 'border border-white/10 bg-card text-card-foreground shadow-glow',
          }}
        />
      </QueryClientProvider>
    </StrictMode>,
  );
});
