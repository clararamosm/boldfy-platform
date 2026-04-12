// Sentry client-side configuration
// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Performance Monitoring — sample 10% of transactions in production
  tracesSampleRate: 0.1,

  // Session Replay — capture 5% of sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      // Mask all text and block all media for privacy
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Filter noisy browser errors
  ignoreErrors: [
    // Common browser extension noise
    'ResizeObserver loop',
    'ResizeObserver loop completed with undelivered notifications',
    // Network errors from user connectivity
    'Failed to fetch',
    'NetworkError',
    'Load failed',
    // Firebase auth token refresh
    'auth/network-request-failed',
  ],

  // Add context about the environment
  environment: process.env.NODE_ENV,
});

// Instrument client-side navigations for performance monitoring
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
