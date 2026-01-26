import type { NextConfig } from 'next';
import { getNextJSHeaders } from './src/server/config/security';

// Security headers from centralized configuration
const securityHeaders = getNextJSHeaders();

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // Standalone output for Docker
  output: 'standalone',

  // Optimize for production
  poweredByHeader: false,

  // Security headers via Next.js response headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ];
  },

  // Experimental features
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  }
};

export default nextConfig;
