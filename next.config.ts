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
    ],
  },
};

export default nextConfig;
