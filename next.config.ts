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
    // Elysia ecosystem
    'elysia',
    '@elysiajs/bearer',
    '@elysiajs/cors',
    '@elysiajs/jwt',
    '@elysiajs/openapi',
    // Auth & Database
    'better-auth',
    'drizzle-orm',
    // Services
    '@maxmind/geoip2-node',
    'qrcode',
    'nanoid',
    'isomorphic-dompurify',
    'ua-parser-js',
    // Email
    'resend',
    '@react-email/components',
    '@react-email/render',
    // Cron
    'cron',
    // OpenTelemetry
    '@opentelemetry/api',
    '@opentelemetry/sdk-node',
    '@opentelemetry/sdk-logs',
    '@opentelemetry/sdk-metrics',
    '@opentelemetry/resources',
    '@opentelemetry/semantic-conventions',
    '@opentelemetry/exporter-trace-otlp-http',
    '@opentelemetry/exporter-metrics-otlp-http',
    '@opentelemetry/exporter-logs-otlp-http',
    '@opentelemetry/auto-instrumentations-node'
  ],

  // Explicitly include server-only packages in output file tracing for standalone
  outputFileTracingIncludes: {
    '/api/**/*': [
      './node_modules/elysia/**/*',
      './node_modules/@elysiajs/**/*',
      './node_modules/better-auth/**/*',
      './node_modules/drizzle-orm/**/*',
      './node_modules/qrcode/**/*',
      './node_modules/@maxmind/**/*',
      './node_modules/nanoid/**/*',
      './node_modules/isomorphic-dompurify/**/*',
      './node_modules/dompurify/**/*',
      './node_modules/ua-parser-js/**/*',
      './node_modules/resend/**/*',
      './node_modules/@react-email/**/*',
      './node_modules/cron/**/*',
      './node_modules/@opentelemetry/**/*'
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
