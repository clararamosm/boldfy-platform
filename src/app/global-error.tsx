// src/app/global-error.tsx
// Global error boundary — catches errors in the root layout itself.
// NOTE: global-error must define its own <html> and <body> tags
// because it replaces the root layout when active.
'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '1rem',
            backgroundColor: '#fafafa',
          }}
        >
          <div
            style={{
              maxWidth: '28rem',
              width: '100%',
              backgroundColor: '#fff',
              borderRadius: '0.75rem',
              border: '1px solid #e5e5e5',
              padding: '2rem',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                margin: '0 auto 1rem',
                width: '3rem',
                height: '3rem',
                borderRadius: '50%',
                backgroundColor: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
              }}
            >
              ⚠️
            </div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
              Algo deu errado
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#737373', margin: '0 0 1.5rem' }}>
              Ocorreu um erro inesperado. Tente novamente ou entre em contato com o suporte.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <pre
                style={{
                  fontSize: '0.75rem',
                  textAlign: 'left',
                  backgroundColor: '#f5f5f5',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  overflow: 'auto',
                  maxHeight: '8rem',
                  marginBottom: '1.5rem',
                }}
              >
                {error.message}
              </pre>
            )}
            <button
              onClick={reset}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#fff',
                backgroundColor: '#18181b',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
              }}
            >
              ↻ Tentar novamente
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
