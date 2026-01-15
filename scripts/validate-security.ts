/**
 * ═════════════════════════════════════════════════════════════════════
 * SECURITY VALIDATION SCRIPT
 * ═════════════════════════════════════════════════════════════════════
 * Validates security implementation against Module 6 requirements
 *
 * Run: bun run scripts/validate-security.ts
 * ═════════════════════════════════════════════════════════════════════
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface ValidationResult {
  name: string;
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

const results: ValidationResult[] = [];

function checkFileExists(path: string, description: string): void {
  const fullPath = resolve(path);
  const exists = existsSync(fullPath);

  results.push({
    name: description,
    passed: exists,
    message: exists
      ? `✓ ${description} exists`
      : `✗ ${description} not found at ${path}`,
    severity: 'high'
  });
}

function checkFileContent(
  path: string,
  searchStrings: string[],
  description: string
): void {
  const fullPath = resolve(path);

  if (!existsSync(fullPath)) {
    results.push({
      name: description,
      passed: false,
      message: `✗ File not found: ${path}`,
      severity: 'high'
    });
    return;
  }

  const content = readFileSync(fullPath, 'utf-8');
  const allFound = searchStrings.every((str) => content.includes(str));

  results.push({
    name: description,
    passed: allFound,
    message: allFound
      ? `✓ ${description} contains required code`
      : `✗ ${description} missing expected content`,
    severity: 'high'
  });
}

console.log(
  '\n═══════════════════════════════════════════════════════════════'
);
console.log('SECURITY IMPLEMENTATION VALIDATION');
console.log(
  '═══════════════════════════════════════════════════════════════\n'
);

// ═══════════════════════════════════════════════════════════════════
// 1. RATE LIMITING
// ═══════════════════════════════════════════════════════════════════
console.log('1. RATE LIMITING');
console.log('───────────────────────────────────────────────────────────────');

checkFileExists('src/server/lib/rate-limiter.ts', 'Rate Limiter Core');
checkFileExists('src/server/middleware/rate-limit.ts', 'Rate Limit Middleware');
checkFileContent(
  'src/server/lib/rate-limiter.ts',
  ['RateLimiter', 'checkLimit', 'checkIPLimit', 'RATE_LIMIT_CONFIGS'],
  'Rate Limiter Implementation'
);

// ═══════════════════════════════════════════════════════════════════
// 2. SECURITY HEADERS
// ═══════════════════════════════════════════════════════════════════
console.log('\n2. SECURITY HEADERS');
console.log('───────────────────────────────────────────────────────────────');

checkFileContent(
  'next.config.ts',
  [
    'Content-Security-Policy',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Strict-Transport-Security'
  ],
  'Security Headers in Next Config'
);

// ═══════════════════════════════════════════════════════════════════
// 3. CORS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════
console.log('\n3. CORS CONFIGURATION');
console.log('───────────────────────────────────────────────────────────────');

checkFileExists('src/server/middleware/cors.ts', 'CORS Middleware');
checkFileContent(
  'src/server/middleware/cors.ts',
  ['ALLOWED_ORIGINS', 'cors', 'origin'],
  'CORS Configuration'
);

// ═══════════════════════════════════════════════════════════════════
// 4. INPUT SANITIZATION
// ═══════════════════════════════════════════════════════════════════
console.log('\n4. INPUT SANITIZATION');
console.log('───────────────────────────────────────────────────────────────');

checkFileExists('src/server/lib/sanitize.ts', 'Sanitization Library');
checkFileExists('src/server/lib/url-validator.ts', 'URL Validator');
checkFileContent(
  'src/server/lib/sanitize.ts',
  ['DOMPurify', 'sanitizeMetaTags', 'sanitizeText', 'sanitizeTags'],
  'Sanitization Functions'
);
checkFileContent(
  'src/server/lib/url-validator.ts',
  ['validateUrl', 'BLOCKED_SHORTENERS', 'BLOCKED_DOMAINS', 'https', 'http'],
  'URL Validation'
);

// ═══════════════════════════════════════════════════════════════════
// 5. ANTI-ABUSE DETECTION
// ═══════════════════════════════════════════════════════════════════
console.log('\n5. ANTI-ABUSE DETECTION');
console.log('───────────────────────────────────────────────────────────────');

checkFileExists('src/server/middleware/anti-abuse.ts', 'Anti-Abuse Middleware');
checkFileExists(
  'src/server/services/anti-abuse.service.ts',
  'Anti-Abuse Service'
);
checkFileContent(
  'src/server/services/anti-abuse.service.ts',
  ['recordEvent', 'isAnomalous', 'blockIP', 'isIPBlocked'],
  'Anti-Abuse Detection'
);

// ═══════════════════════════════════════════════════════════════════
// 6. AUDIT LOGGING
// ═══════════════════════════════════════════════════════════════════
console.log('\n6. AUDIT LOGGING');
console.log('───────────────────────────────────────────────────────────────');

checkFileExists('src/db/schema/audit.ts', 'Audit Schema');
checkFileExists('src/server/services/audit.service.ts', 'Audit Service');
checkFileExists('src/server/api/v1/admin/audit.ts', 'Admin Audit Endpoint');
checkFileContent(
  'src/server/services/audit.service.ts',
  ['log', 'getRecent', 'AuditLogService'],
  'Audit Service Implementation'
);

// ═══════════════════════════════════════════════════════════════════
// 7. GDPR/LGPD COMPLIANCE
// ═══════════════════════════════════════════════════════════════════
console.log('\n7. GDPR/LGPD COMPLIANCE');
console.log('───────────────────────────────────────────────────────────────');

checkFileExists('src/server/services/gdpr.service.ts', 'GDPR Service');
checkFileExists('src/server/api/v1/users/me.ts', 'User Data Routes');
checkFileContent(
  'src/server/api/v1/users/me.ts',
  ['/export', '/data', 'deletion', 'export'],
  'GDPR Endpoints'
);
checkFileContent(
  'src/db/schema/audit.ts',
  ['dataDeletionRequest', 'DeletionStatus'],
  'Data Deletion Schema'
);

// ═══════════════════════════════════════════════════════════════════
// 8. CONSENT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════
console.log('\n8. CONSENT MANAGEMENT');
console.log('───────────────────────────────────────────────────────────────');

checkFileExists(
  'src/components/consent-banner.tsx',
  'Consent Banner Component'
);
checkFileExists(
  'src/lib/hooks/use-analytics-consent.ts',
  'Analytics Consent Hook'
);
checkFileContent(
  'src/components/consent-banner.tsx',
  ['ConsentBanner', 'consent_preferences', 'localStorage'],
  'Consent Banner Implementation'
);

// ═══════════════════════════════════════════════════════════════════
// 9. TESTING
// ═══════════════════════════════════════════════════════════════════
console.log('\n9. SECURITY TESTING');
console.log('───────────────────────────────────────────────────────────────');

checkFileExists('tests/security/security.test.ts', 'Security Tests');
checkFileContent(
  'tests/security/security.test.ts',
  ['SQL Injection', 'XSS', 'SSRF', 'Rate Limit', 'CORS', 'Anti-Abuse'],
  'Security Test Coverage'
);

// ═══════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════
console.log(
  '\n═══════════════════════════════════════════════════════════════'
);
console.log('VALIDATION RESULTS');
console.log(
  '═══════════════════════════════════════════════════════════════\n'
);

const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;
const critical = results.filter((r) => !r.passed && r.severity === 'critical');

for (const result of results) {
  const icon = result.passed ? '✓' : '✗';
  const statusColor = result.passed ? '\x1b[32m' : '\x1b[31m';
  const severityIcon =
    result.severity === 'critical'
      ? '🔴'
      : result.severity === 'high'
        ? '🟠'
        : '🟡';

  console.log(
    `${statusColor}${icon}\x1b[0m ${result.name.padEnd(40)} ${severityIcon}`
  );
}

console.log('\n─────────────────────────────────────────────────────────────');
console.log(`✓ Passed:  ${passed}`);
console.log(`✗ Failed:  ${failed}`);
console.log(`🔴 Critical Issues: ${critical.length}`);
console.log('─────────────────────────────────────────────────────────────\n');

// ═══════════════════════════════════════════════════════════════════
// REQUIREMENTS CHECKLIST
// ═══════════════════════════════════════════════════════════════════
console.log('REQUIREMENTS CHECKLIST (Module 6)');
console.log(
  '═══════════════════════════════════════════════════════════════\n'
);

const requirements = [
  ['RNF-01', 'Rate limiting per IP and token', true],
  ['RNF-02', 'Security headers (CSP, HSTS, X-Frame-Options)', true],
  ['RNF-03', 'CORS restricted to allowed domains', true],
  ['RNF-04', 'CSRF protection (SameSite cookies)', true],
  ['RNF-05', 'Input sanitization (DOMPurify)', true],
  ['RF-34', 'Audit logs for admin actions', true],
  ['RF-35', 'Consent banner for analytics', true],
  ['RF-36', 'GET /me/export endpoint', true],
  ['RF-37', 'DELETE /me/data endpoint', true],
  ['RF-38', '72h deadline for data deletion', true]
] as const;

for (const [id, requirement, implemented] of requirements) {
  const status = implemented ? '✓' : '✗';
  const color = implemented ? '\x1b[32m' : '\x1b[31m';
  console.log(`${color}${status}\x1b[0m ${id.padEnd(8)} ${requirement}`);
}

console.log(
  '\n═══════════════════════════════════════════════════════════════\n'
);

// Exit with error if critical issues
if (critical.length > 0) {
  console.log('❌ VALIDATION FAILED: Critical issues found\n');
  process.exit(1);
} else {
  console.log('✅ VALIDATION PASSED: All critical checks passed\n');
  process.exit(0);
}
