import type {NextConfig} from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
  serverExternalPackages: [
    '@opentelemetry/exporter-jaeger',
    '@opentelemetry/winston-transport',
    'genkit',
    '@genkit-ai/core',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'media.licdn.com',
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Suppresses all Sentry source map upload logs during build
  silent: true,

  // Upload source maps for better stack traces
  // Requires SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT env vars
  // If not set, source maps won't be uploaded (still works, just less detailed traces)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers
  tunnelRoute: '/monitoring',

  // Hides source maps from generated client bundles
  sourcemaps: { deleteSourcemapsAfterUpload: true },

  // Webpack-specific Sentry settings
  webpack: {
    // Tree-shake Sentry logger statements to reduce bundle size
    treeshake: { removeDebugLogging: true },
    // Automatically instrument Next.js data-fetching and API routes
    autoInstrumentServerFunctions: true,
    autoInstrumentMiddleware: true,
    autoInstrumentAppDirectory: true,
  },
});
