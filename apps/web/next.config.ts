import { resolve } from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import {
  getDevApiRewrites,
  getLocalApiProxyTarget
} from './src/server/config/api-rewrites';
import { getNextJSHeaders } from './src/server/config/security';

// Initialize next-intl plugin
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const monorepoRoot = resolve(__dirname, '../..');

// Security headers from centralized configuration
const securityHeaders = getNextJSHeaders();
const localApiProxyTarget = getLocalApiProxyTarget();

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // Standalone output for Docker
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,

  // Optimize for production
  poweredByHeader: false,

  // External packages that should be bundled for server-side use
  // These packages need to be explicitly included in standalone output
  serverExternalPackages: [
    // Auth & Database (used by apps/web directly: auth.ts + @urlfy/data)
    'better-auth',
    'drizzle-orm',
    // Services used by redirect hot path (@urlfy/redirect-domain + @urlfy/cache)
    '@maxmind/geoip2-node',
    'qrcode',
    'nanoid',
    'isomorphic-dompurify',
    // Email (apps/web/src/server/services/email.service.ts)
    'resend',
    '@react-email/components',
    '@react-email/render',
    // Cron
    'cron',
    // OpenTelemetry (@urlfy/telemetry)
    '@opentelemetry/api',
    '@opentelemetry/sdk-node',
    '@opentelemetry/sdk-logs',
    '@opentelemetry/sdk-metrics',
    '@opentelemetry/resources',
    '@opentelemetry/semantic-conventions',
    '@opentelemetry/exporter-trace-otlp-http',
    '@opentelemetry/exporter-metrics-otlp-http',
    '@opentelemetry/exporter-logs-otlp-http',
    '@opentelemetry/auto-instrumentations-node',
    // LogTape
    '@logtape/logtape',
    '@logtape/otel',
    '@logtape/drizzle-orm',
    '@logtape/redaction'
  ],

  // Dev-only: keep browser calls same-origin in `bun dev` / `next dev`
  // without requiring a dedicated reverse-proxy process.
  async rewrites() {
    return getDevApiRewrites(localApiProxyTarget);
  },

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
    },
    // Enable nonce-based CSP for Script components
    nextScriptWorkers: false // Keep false to ensure nonce works properly
  },

  turbopack: {
    root: monorepoRoot
  }
};

export default withNextIntl(nextConfig);
