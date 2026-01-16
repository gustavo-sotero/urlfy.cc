/**
 * ═════════════════════════════════════════════════════════════════════
 * SECURITY COMPLIANCE REPORT GENERATOR
 * ═════════════════════════════════════════════════════════════════════
 * Generates a comprehensive security report for the urlfy.cc application.
 *
 * Usage: bun run scripts/security-report.ts [--output <path>] [--base-url <url>]
 *
 * Module: Security & Compliance (Module 6)
 * ═════════════════════════════════════════════════════════════════════
 */

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

interface SecurityCheck {
  category: string;
  check: string;
  status: 'pass' | 'fail' | 'warning' | 'skipped';
  details: string;
}

interface SecurityReport {
  generatedAt: string;
  baseUrl: string;
  environment: string;
  checks: SecurityCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
}

// Parse command line arguments
const { values } = parseArgs({
  options: {
    output: {
      type: 'string',
      short: 'o',
      default: 'security-report.json'
    },
    'base-url': {
      type: 'string',
      short: 'u',
      default: 'http://localhost:3000'
    }
  }
});

const BASE_URL = values['base-url'] as string;
const OUTPUT_FILE = values.output as string;

async function checkServerAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/health`, {
      signal: AbortSignal.timeout(5000)
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function checkSecurityHeaders(): Promise<SecurityCheck[]> {
  const checks: SecurityCheck[] = [];

  try {
    const res = await fetch(`${BASE_URL}/api/v1/health`);
    const headers = res.headers;

    // Content-Security-Policy
    const csp = headers.get('Content-Security-Policy');
    checks.push({
      category: 'Headers',
      check: 'Content-Security-Policy',
      status: csp ? 'pass' : 'fail',
      details: csp || 'Missing CSP header'
    });

    // Strict-Transport-Security
    const hsts = headers.get('Strict-Transport-Security');
    checks.push({
      category: 'Headers',
      check: 'Strict-Transport-Security',
      status: hsts ? 'pass' : 'fail',
      details: hsts || 'Missing HSTS header'
    });

    // X-Frame-Options
    const xfo = headers.get('X-Frame-Options');
    checks.push({
      category: 'Headers',
      check: 'X-Frame-Options',
      status: xfo === 'DENY' ? 'pass' : xfo ? 'warning' : 'fail',
      details: xfo || 'Missing X-Frame-Options header'
    });

    // X-Content-Type-Options
    const xcto = headers.get('X-Content-Type-Options');
    checks.push({
      category: 'Headers',
      check: 'X-Content-Type-Options',
      status: xcto === 'nosniff' ? 'pass' : 'fail',
      details: xcto || 'Missing X-Content-Type-Options header'
    });

    // Referrer-Policy
    const rp = headers.get('Referrer-Policy');
    checks.push({
      category: 'Headers',
      check: 'Referrer-Policy',
      status: rp ? 'pass' : 'warning',
      details: rp || 'Missing Referrer-Policy header'
    });

    // Permissions-Policy
    const pp = headers.get('Permissions-Policy');
    checks.push({
      category: 'Headers',
      check: 'Permissions-Policy',
      status: pp ? 'pass' : 'warning',
      details: pp || 'Missing Permissions-Policy header'
    });

    // X-Powered-By should NOT be present
    const xpb = headers.get('X-Powered-By');
    checks.push({
      category: 'Headers',
      check: 'X-Powered-By (should be absent)',
      status: xpb ? 'fail' : 'pass',
      details: xpb ? `Exposed: ${xpb}` : 'Not exposed (good)'
    });

    // Server header should not reveal version
    const server = headers.get('Server');
    checks.push({
      category: 'Headers',
      check: 'Server Header',
      status: !server || !server.includes('/') ? 'pass' : 'warning',
      details: server || 'Not present (good)'
    });
  } catch (error) {
    checks.push({
      category: 'Headers',
      check: 'Server Connection',
      status: 'fail',
      details: `Failed to connect: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  return checks;
}

async function checkRateLimiting(): Promise<SecurityCheck[]> {
  const checks: SecurityCheck[] = [];

  try {
    const res = await fetch(`${BASE_URL}/api/v1/health`);

    const limitHeader =
      res.headers.get('X-RateLimit-Limit') ||
      res.headers.get('RateLimit-Limit');
    const remainingHeader =
      res.headers.get('X-RateLimit-Remaining') ||
      res.headers.get('RateLimit-Remaining');

    checks.push({
      category: 'Rate Limiting',
      check: 'Rate limit headers present',
      status: limitHeader ? 'pass' : 'warning',
      details: limitHeader
        ? `Limit: ${limitHeader}, Remaining: ${remainingHeader}`
        : 'Rate limit headers not found'
    });
  } catch (error) {
    checks.push({
      category: 'Rate Limiting',
      check: 'Rate limit check',
      status: 'fail',
      details: `Failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  return checks;
}

async function checkCORS(): Promise<SecurityCheck[]> {
  const checks: SecurityCheck[] = [];

  try {
    // Test with unauthorized origin
    const res = await fetch(`${BASE_URL}/api/v1/health`, {
      headers: {
        Origin: 'https://evil-site.com'
      }
    });

    const corsHeader = res.headers.get('Access-Control-Allow-Origin');
    checks.push({
      category: 'CORS',
      check: 'Block unauthorized origins',
      status:
        corsHeader !== 'https://evil-site.com' && corsHeader !== '*'
          ? 'pass'
          : 'fail',
      details: corsHeader
        ? `CORS header: ${corsHeader}`
        : 'No CORS header (good for unauthorized origins)'
    });

    // Test preflight
    const preflight = await fetch(`${BASE_URL}/api/v1/links`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST'
      }
    });

    checks.push({
      category: 'CORS',
      check: 'Preflight requests handled',
      status: preflight.status === 204 ? 'pass' : 'warning',
      details: `Preflight status: ${preflight.status}`
    });
  } catch (error) {
    checks.push({
      category: 'CORS',
      check: 'CORS check',
      status: 'fail',
      details: `Failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  return checks;
}

async function checkAuthentication(): Promise<SecurityCheck[]> {
  const checks: SecurityCheck[] = [];

  const protectedEndpoints = [
    '/api/v1/me',
    '/api/v1/me/export',
    '/api/v1/admin/audit'
  ];

  for (const endpoint of protectedEndpoints) {
    try {
      const res = await fetch(`${BASE_URL}${endpoint}`);
      checks.push({
        category: 'Authentication',
        check: `Protected: ${endpoint}`,
        status: res.status === 401 ? 'pass' : 'fail',
        details: `Status: ${res.status} (expected 401)`
      });
    } catch (error) {
      checks.push({
        category: 'Authentication',
        check: `Protected: ${endpoint}`,
        status: 'fail',
        details: `Failed: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  // Test invalid token
  try {
    const res = await fetch(`${BASE_URL}/api/v1/me`, {
      headers: {
        Authorization: 'Bearer invalid_token'
      }
    });
    checks.push({
      category: 'Authentication',
      check: 'Reject invalid tokens',
      status: res.status === 401 ? 'pass' : 'fail',
      details: `Status: ${res.status} (expected 401)`
    });
  } catch (error) {
    checks.push({
      category: 'Authentication',
      check: 'Reject invalid tokens',
      status: 'fail',
      details: `Failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  return checks;
}

async function checkInputValidation(): Promise<SecurityCheck[]> {
  const checks: SecurityCheck[] = [];

  const maliciousUrls = [
    { url: 'javascript:alert(1)', name: 'JavaScript URL' },
    { url: 'http://localhost:5432', name: 'Internal URL' },
    { url: 'https://bit.ly/test', name: 'Shortener URL' }
  ];

  for (const { url, name } of maliciousUrls) {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      });

      checks.push({
        category: 'Input Validation',
        check: `Block ${name}`,
        status: res.status === 400 ? 'pass' : 'fail',
        details: `Status: ${res.status} (expected 400)`
      });
    } catch (error) {
      checks.push({
        category: 'Input Validation',
        check: `Block ${name}`,
        status: 'fail',
        details: `Failed: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  return checks;
}

async function generateSecurityReport(): Promise<void> {
  console.log('Security Compliance Report Generator');
  console.log('====================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');

  // Check server availability
  const serverAvailable = await checkServerAvailable();

  if (!serverAvailable) {
    console.error(`Server not available at ${BASE_URL}`);
    console.log('Please start the server with: bun dev');
    process.exit(1);
  }

  console.log('Server is available. Running security checks...');
  console.log('');

  const allChecks: SecurityCheck[] = [];

  // Run all checks
  console.log('Checking security headers...');
  allChecks.push(...(await checkSecurityHeaders()));

  console.log('Checking rate limiting...');
  allChecks.push(...(await checkRateLimiting()));

  console.log('Checking CORS...');
  allChecks.push(...(await checkCORS()));

  console.log('Checking authentication...');
  allChecks.push(...(await checkAuthentication()));

  console.log('Checking input validation...');
  allChecks.push(...(await checkInputValidation()));

  // Generate report
  const report: SecurityReport = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    environment: process.env.NODE_ENV || 'development',
    checks: allChecks,
    summary: {
      total: allChecks.length,
      passed: allChecks.filter((c) => c.status === 'pass').length,
      failed: allChecks.filter((c) => c.status === 'fail').length,
      warnings: allChecks.filter((c) => c.status === 'warning').length,
      skipped: allChecks.filter((c) => c.status === 'skipped').length
    }
  };

  // Write report
  writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
  console.log('');
  console.log(`Report written to: ${OUTPUT_FILE}`);

  // Print summary
  console.log('');
  console.log('Summary');
  console.log('-------');
  console.log(`Total checks: ${report.summary.total}`);
  console.log(`Passed: ${report.summary.passed}`);
  console.log(`Failed: ${report.summary.failed}`);
  console.log(`Warnings: ${report.summary.warnings}`);
  console.log(`Skipped: ${report.summary.skipped}`);

  // Exit with error if there are failures
  if (report.summary.failed > 0) {
    console.log('');
    console.log('Failed checks:');
    allChecks
      .filter((c) => c.status === 'fail')
      .forEach((c) => {
        console.log(`  - [${c.category}] ${c.check}: ${c.details}`);
      });
    process.exit(1);
  }

  console.log('');
  console.log('All security checks passed!');
}

// Run the report
generateSecurityReport().catch(console.error);
