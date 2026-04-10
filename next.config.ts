import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
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
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
