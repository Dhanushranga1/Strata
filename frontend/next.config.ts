import type { NextConfig } from 'next';
import path from 'path';

import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Required to prevent @heroui/react bundling its own framer-motion copy,
  // which causes a ChunkLoadError for dom-animation in Next.js 15.
  transpilePackages: ['@heroui/react', '@heroui/theme'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    optimizePackageImports: ['@heroui/react'],
  },
  webpack: config => {
    config.resolve.alias['@'] = path.join(process.cwd(), 'src');
    return config;
  },
};

export default nextConfig;
