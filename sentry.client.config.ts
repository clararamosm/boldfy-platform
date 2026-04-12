// Sentry client-side configuration
// This file configures the initialization of Sentry in the browser.
// The config you add here will be used whenever a user loads a page.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Performance Monitoring — sample 10% of browser transactions
  tracesSampleRate: 0.1,

  // Session Replay — capture 0% by default, 100% on error
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  // Filter known operational errors (not bugs)
  ignoreErrors: [
    // Firebase Auth errors (expected when token expires)
    'auth/network-request-failed',
    'auth/popup-closed-by-user',
    'auth/cancelled-popup-request',
    // Network errors
    'Failed to fetch',
    'Load failed',
    'NetworkError',
    // User navigation
    'AbortError',
    'ResizeObserver loop',
  ],

  environment: process.env.NODE_ENV,
});
