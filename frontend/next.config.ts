import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  eslint: {
    // Temporarily disable ESLint during builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Temporarily disable TypeScript errors during builds
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias['@'] = path.join(process.cwd(), 'src');
    return config;
  },
};

export default nextConfig;
