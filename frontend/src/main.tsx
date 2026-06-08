import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import './index.css';
import App from './App.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

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
