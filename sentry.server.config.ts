// Sentry server-side configuration
// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Performance Monitoring — sample 10% of server transactions
  tracesSampleRate: 0.1,

  // Filter known operational errors (not bugs)
  ignoreErrors: [
    // Auth guard rejections (expected behavior, not bugs)
    'Acesso negado',
    'Token ausente',
    'Sessao invalida',
    // Rate limiter rejections
    'Muitas tentativas',
  ],

  environment: process.env.NODE_ENV,
});
