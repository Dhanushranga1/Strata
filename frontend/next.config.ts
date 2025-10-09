import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Temporarily disable ESLint during builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Temporarily disable TypeScript errors during builds
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
