import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { getNextJSHeaders } from './src/server/config/security';

// Initialize next-intl plugin
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Security headers from centralized configuration
const securityHeaders = getNextJSHeaders();

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // Standalone output for Docker
  output: 'standalone',

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

  // Explicitly include server-only packages in output file tracing for standalone
  outputFileTracingIncludes: {
    '/r/**/*': [
      './node_modules/@maxmind/**/*',
      './node_modules/drizzle-orm/**/*',
      './node_modules/@opentelemetry/**/*',
      './node_modules/@logtape/**/*'
    ]
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
  }
};

export default withNextIntl(nextConfig);
