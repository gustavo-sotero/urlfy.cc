// scripts/validate-module-07.ts
/**
 * Validation script for Module 7 (UI) implementation
 * Checks if all required components, pages, and features are implemented
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface ValidationResult {
  passed: boolean;
  message: string;
  details?: string;
}

interface ValidationReport {
  totalChecks: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
}

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  bold: "\x1b[1m",
};

function checkFileExists(path: string, description: string): ValidationResult {
  const fullPath = join(process.cwd(), path);
  const exists = existsSync(fullPath);

  return {
    passed: exists,
    message: description,
    details: exists ? `✓ ${path}` : `✗ Missing: ${path}`,
  };
}

function checkFileContains(
  path: string,
  searchString: string | RegExp,
  description: string,
): ValidationResult {
  const fullPath = join(process.cwd(), path);

  if (!existsSync(fullPath)) {
    return {
      passed: false,
      message: description,
      details: `✗ File not found: ${path}`,
    };
  }

  try {
    const content = readFileSync(fullPath, "utf-8");
    const found =
      typeof searchString === "string"
        ? content.includes(searchString)
        : searchString.test(content);

    return {
      passed: found,
      message: description,
      details: found
        ? `✓ Found in ${path}`
        : `✗ Not found in ${path}: ${searchString}`,
    };
  } catch (error) {
    return {
      passed: false,
      message: description,
      details: `✗ Error reading ${path}: ${error}`,
    };
  }
}

async function validateModule07(): Promise<ValidationReport> {
  const checks: ValidationResult[] = [];

  console.log(
    `${colors.blue}${colors.bold}╔════════════════════════════════════════════╗${colors.reset}`,
  );
  console.log(
    `${colors.blue}${colors.bold}║  Module 7 (UI) Validation Script          ║${colors.reset}`,
  );
  console.log(
    `${colors.blue}${colors.bold}╚════════════════════════════════════════════╝${colors.reset}\n`,
  );

  // ═══════════════════════════════════════════════════════════════════
  // 1. CORE PAGES
  // ═══════════════════════════════════════════════════════════════════
  console.log(`${colors.bold}📄 Checking Core Pages...${colors.reset}`);

  checks.push(
    checkFileExists("src/app/page.tsx", "Landing page exists"),
    checkFileExists(
      "src/app/(dashboard)/dashboard/page.tsx",
      "Dashboard home page exists",
    ),
    checkFileExists(
      "src/app/(dashboard)/links/page.tsx",
      "Links list page exists",
    ),
    checkFileExists(
      "src/app/(dashboard)/links/new/page.tsx",
      "Create link page exists",
    ),
    checkFileExists(
      "src/app/(dashboard)/settings/page.tsx",
      "Settings page exists",
    ),
    checkFileExists(
      "src/app/(public)/unlock/[code]/page.tsx",
      "Unlock page exists",
    ),
    checkFileExists(
      "src/app/(public)/preview/[code]/page.tsx",
      "Preview page exists",
    ),
    checkFileExists("src/app/(admin)/admin/page.tsx", "Admin dashboard exists"),
    checkFileExists(
      "src/app/(admin)/admin/links/page.tsx",
      "Admin links management page exists",
    ),
    checkFileExists(
      "src/app/(admin)/admin/users/page.tsx",
      "Admin users management page exists",
    ),
    checkFileExists(
      "src/app/(admin)/admin/audit/page.tsx",
      "Admin audit logs page exists",
    ),
  );

  // ═══════════════════════════════════════════════════════════════════
  // 2. CUSTOM HOOKS (TanStack Query)
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${colors.bold}🪝 Checking Custom Hooks...${colors.reset}`);

  checks.push(
    checkFileExists("src/lib/hooks/use-links.ts", "useLinks hook exists"),
    checkFileContains(
      "src/lib/hooks/use-links.ts",
      "export function useLinks",
      "useLinks hook is exported",
    ),
    checkFileContains(
      "src/lib/hooks/use-links.ts",
      "export function useLink",
      "useLink hook is exported",
    ),
    checkFileContains(
      "src/lib/hooks/use-links.ts",
      "export function useCreateLink",
      "useCreateLink mutation hook is exported",
    ),
    checkFileContains(
      "src/lib/hooks/use-links.ts",
      "export function useUpdateLink",
      "useUpdateLink mutation hook is exported",
    ),
    checkFileContains(
      "src/lib/hooks/use-links.ts",
      "export function useDeleteLink",
      "useDeleteLink mutation hook is exported",
    ),
    checkFileExists(
      "src/lib/hooks/use-analytics.ts",
      "useAnalytics hook exists",
    ),
    checkFileContains(
      "src/lib/hooks/use-analytics.ts",
      "export function useDailyStats",
      "useDailyStats hook is exported",
    ),
    checkFileContains(
      "src/lib/hooks/use-analytics.ts",
      "export function useLinkAnalytics",
      "useLinkAnalytics combined hook is exported",
    ),
  );

  // ═══════════════════════════════════════════════════════════════════
  // 3. SKELETON LOADING COMPONENTS
  // ═══════════════════════════════════════════════════════════════════
  console.log(
    `\n${colors.bold}💀 Checking Skeleton Components...${colors.reset}`,
  );

  checks.push(
    checkFileExists(
      "src/components/ui/skeleton.tsx",
      "Base Skeleton component exists",
    ),
    checkFileExists(
      "src/components/shared/link-card-skeleton.tsx",
      "LinkCardSkeleton component exists",
    ),
    checkFileExists(
      "src/components/charts/analytics-skeleton.tsx",
      "Analytics skeleton components exist",
    ),
    checkFileExists(
      "src/components/layout/dashboard-skeleton.tsx",
      "Dashboard skeleton component exists",
    ),
  );

  // ═══════════════════════════════════════════════════════════════════
  // 4. ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${colors.bold}⚠️  Checking Error Handling...${colors.reset}`);

  checks.push(
    checkFileExists(
      "src/components/error-boundary.tsx",
      "ErrorBoundary component exists",
    ),
    checkFileContains(
      "src/components/error-boundary.tsx",
      "export class ErrorBoundary",
      "ErrorBoundary is exported as class component",
    ),
    checkFileExists(
      "src/components/query-error.tsx",
      "QueryError component exists",
    ),
    checkFileContains(
      "src/components/query-error.tsx",
      "export function QueryError",
      "QueryError is exported",
    ),
  );

  // ═══════════════════════════════════════════════════════════════════
  // 5. ACCESSIBILITY FEATURES
  // ═══════════════════════════════════════════════════════════════════
  console.log(
    `\n${colors.bold}♿ Checking Accessibility Features...${colors.reset}`,
  );

  checks.push(
    checkFileExists(
      "src/components/layout/skip-link.tsx",
      "SkipLink component exists",
    ),
    checkFileExists(
      "src/components/ui/accessible-button.tsx",
      "AccessibleButton component exists",
    ),
    checkFileContains(
      "src/components/ui/accessible-button.tsx",
      "aria-busy",
      "AccessibleButton has aria-busy attribute",
    ),
    checkFileExists(
      "src/components/forms/accessible-form-field.tsx",
      "AccessibleFormField component exists",
    ),
    checkFileExists(
      "src/components/ui/announcer.tsx",
      "Announcer provider exists for screen readers",
    ),
    checkFileContains(
      "src/components/ui/announcer.tsx",
      "aria-live",
      "Announcer has ARIA live regions",
    ),
    checkFileContains(
      "src/components/ui/announcer.tsx",
      "export function useAnnouncer",
      "useAnnouncer hook is exported",
    ),
  );

  // ═══════════════════════════════════════════════════════════════════
  // 6. CHARTS & VISUALIZATIONS
  // ═══════════════════════════════════════════════════════════════════
  console.log(
    `\n${colors.bold}📊 Checking Charts & Visualizations...${colors.reset}`,
  );

  checks.push(
    checkFileExists(
      "src/components/charts/clicks-chart.tsx",
      "ClicksChart component exists",
    ),
    checkFileExists(
      "src/components/charts/countries-chart.tsx",
      "CountriesChart component exists",
    ),
    checkFileExists(
      "src/components/charts/devices-chart.tsx",
      "DevicesChart component exists",
    ),
    checkFileExists(
      "src/components/charts/referrers-chart.tsx",
      "ReferrersChart component exists",
    ),
  );

  // ═══════════════════════════════════════════════════════════════════
  // 7. FORMS
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${colors.bold}📝 Checking Forms...${colors.reset}`);

  checks.push(
    checkFileExists(
      "src/components/forms/link-form.tsx",
      "LinkForm component exists",
    ),
    checkFileExists(
      "src/components/forms/unlock-form.tsx",
      "UnlockForm component exists",
    ),
  );

  // ═══════════════════════════════════════════════════════════════════
  // 8. SHARED COMPONENTS
  // ═══════════════════════════════════════════════════════════════════
  console.log(
    `\n${colors.bold}🔧 Checking Shared Components...${colors.reset}`,
  );

  checks.push(
    checkFileExists(
      "src/components/shared/link-card.tsx",
      "LinkCard component exists",
    ),
    checkFileExists(
      "src/components/shared/copy-button.tsx",
      "CopyButton component exists",
    ),
    checkFileExists(
      "src/components/shared/qr-code-button.tsx",
      "QRCodeButton component exists",
    ),
  );

  // ═══════════════════════════════════════════════════════════════════
  // 9. LAYOUT COMPONENTS
  // ═══════════════════════════════════════════════════════════════════
  console.log(
    `\n${colors.bold}🏗️  Checking Layout Components...${colors.reset}`,
  );

  checks.push(
    checkFileExists(
      "src/components/layout/header.tsx",
      "Header component exists",
    ),
    checkFileExists(
      "src/components/layout/sidebar.tsx",
      "Sidebar component exists",
    ),
  );

  // ═══════════════════════════════════════════════════════════════════
  // 10. API CLIENT
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${colors.bold}🌐 Checking API Client...${colors.reset}`);

  checks.push(
    checkFileExists("src/lib/api-client.ts", "API client exists"),
    checkFileContains(
      "src/lib/api-client.ts",
      /export async function createLink/,
      "createLink function is exported",
    ),
    checkFileContains(
      "src/lib/api-client.ts",
      /export async function getLinks/,
      "getLinks function is exported",
    ),
    checkFileContains(
      "src/lib/api-client.ts",
      /export async function getLink/,
      "getLink function is exported",
    ),
    checkFileContains(
      "src/lib/api-client.ts",
      /export async function deleteLink/,
      "deleteLink function is exported",
    ),
  );

  // ═══════════════════════════════════════════════════════════════════
  // 11. E2E TESTS
  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${colors.bold}🧪 Checking E2E Tests...${colors.reset}`);

  checks.push(
    checkFileExists("tests/e2e/ui.spec.ts", "UI E2E tests exist"),
    checkFileContains(
      "tests/e2e/ui.spec.ts",
      "Landing Page",
      "Landing page tests exist",
    ),
    checkFileContains(
      "tests/e2e/ui.spec.ts",
      "Dashboard",
      "Dashboard tests exist",
    ),
    checkFileContains(
      "tests/e2e/ui.spec.ts",
      "Accessibility",
      "Accessibility tests exist",
    ),
    checkFileExists("tests/e2e/helpers.ts", "E2E test helpers exist"),
    checkFileContains(
      "tests/e2e/helpers.ts",
      "export async function login",
      "login helper function exists",
    ),
  );

  // ═══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed).length;

  console.log(
    `\n${colors.blue}${colors.bold}═══════════════════════════════════════════════${colors.reset}`,
  );
  console.log(`${colors.bold}VALIDATION SUMMARY${colors.reset}`);
  console.log(
    `${colors.blue}${colors.bold}═══════════════════════════════════════════════${colors.reset}\n`,
  );

  console.log(`Total checks: ${checks.length}`);
  console.log(`${colors.green}✓ Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}✗ Failed: ${failed}${colors.reset}\n`);

  if (failed > 0) {
    console.log(`${colors.yellow}${colors.bold}Failed Checks:${colors.reset}`);
    checks
      .filter((c) => !c.passed)
      .forEach((c) => {
        console.log(`  ${colors.red}✗${colors.reset} ${c.message}`);
        if (c.details) {
          console.log(`    ${colors.yellow}${c.details}${colors.reset}`);
        }
      });
  }

  console.log(
    `\n${colors.blue}${colors.bold}═══════════════════════════════════════════════${colors.reset}\n`,
  );

  const passRate = ((passed / checks.length) * 100).toFixed(1);
  if (failed === 0) {
    console.log(
      `${colors.green}${colors.bold}✓ All checks passed! (${passRate}%)${colors.reset}`,
    );
    console.log(
      `${colors.green}Module 7 (UI) is fully implemented!${colors.reset}\n`,
    );
  } else {
    console.log(
      `${colors.yellow}${colors.bold}⚠ Some checks failed (${passRate}% passed)${colors.reset}`,
    );
    console.log(
      `${colors.yellow}Please review the failed checks above.${colors.reset}\n`,
    );
  }

  return {
    totalChecks: checks.length,
    passed,
    failed,
    results: checks,
  };
}

// Run validation
validateModule07()
  .then((report) => {
    process.exit(report.failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error(`${colors.red}Validation error:${colors.reset}`, error);
    process.exit(1);
  });
