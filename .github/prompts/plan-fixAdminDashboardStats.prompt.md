# Plan: Fix Admin Dashboard Stats & Navigation

## Problem Summary

The Admin Dashboard at `/admin` has three issues:

1. **Broken Navigation Link**: The sidebar includes a "Settings" link (`/admin/settings`) that points to a non-existent page.
2. **Zeroed Performance Metric**: The `requestsPerSecond` stat is always `0` because the Redis key `metrics:rps` is never populated.
3. **Zeroed Growth Charts**: The "Crescimento da Plataforma" charts show no data because:
   - The `analytics_events` table may be empty (no redirect traffic recorded).
   - The root `src/middleware.ts` file is **missing**, so the Redirect Engine never activates.

---

## Technical Analysis

### 1. Settings Link (Navigation)

**File**: `src/components/admin/layout/admin-sidebar.tsx`  
**Lines**: 26-49

The `navItems` array contains:

```typescript
const navItems: NavItem[] = [
  { title: 'Overview', href: '/admin', icon: LayoutDashboard, ... },
  { title: 'Links Management', href: '/admin/links', icon: LinkIcon, ... },
  { title: 'Users Management', href: '/admin/users', icon: Users, ... },
  { title: 'Settings', href: '/admin/settings', icon: Settings, ... }, // ❌ Page doesn't exist
];
```

**Solution**: Remove the "Settings" item from the array.

---

### 2. Performance Metric (`requestsPerSecond`)

**File**: `src/server/modules/admin/admin.service.ts`  
**Lines**: 85-92

```typescript
let requestsPerSecond = 0;
try {
  const rpsKey = 'metrics:rps';
  const rpsValue = await redis.get(rpsKey);
  requestsPerSecond = rpsValue ? Number.parseFloat(rpsValue) : 0;
} catch (error) {
  logger.warn('Failed to fetch RPS from Redis', { error });
}
```

**Root Cause**: No component in the system writes to `metrics:rps`.

**Solution**: Implement a `MetricsService` that:

1. Tracks each request by incrementing a Redis counter.
2. Periodically (every minute) calculates RPS and writes to `metrics:rps`.

---

### 3. Growth Charts (Analytics Data)

**Endpoint**: `GET /api/admin/growth`  
**Service**: `AdminService.getGrowthStats()` (queries `analytics_events` and `user` tables)

**Root Cause**: The `analytics_events` table may be empty because no redirect traffic has been recorded yet.

**Note**: The project uses `src/proxy.ts` (Next.js 16 standard) instead of `src/middleware.ts`. The redirect engine is already properly configured.

---

## Implementation Plan

### Step 1: Remove Settings Link from Navigation

**File**: `src/components/admin/layout/admin-sidebar.tsx`

**Action**: Remove the Settings `NavItem` from the `navItems` array.

**Before**:

```typescript
const navItems: NavItem[] = [
  {
    title: 'Overview',
    href: '/admin',
    icon: LayoutDashboard,
    description: 'Dashboard and statistics'
  },
  {
    title: 'Links Management',
    href: '/admin/links',
    icon: LinkIcon,
    description: 'Search and manage links'
  },
  {
    title: 'Users Management',
    href: '/admin/users',
    icon: Users,
    description: 'User administration'
  },
  {
    title: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    description: 'Admin settings'
  }
];
```

**After**:

```typescript
const navItems: NavItem[] = [
  {
    title: 'Overview',
    href: '/admin',
    icon: LayoutDashboard,
    description: 'Dashboard and statistics'
  },
  {
    title: 'Links Management',
    href: '/admin/links',
    icon: LinkIcon,
    description: 'Search and manage links'
  },
  {
    title: 'Users Management',
    href: '/admin/users',
    icon: Users,
    description: 'User administration'
  }
];
```

**Also**: Remove unused `Settings` import from `lucide-react`.

---

### Step 2: Create Metrics Service

**File**: `src/server/services/metrics.service.ts` (NEW)

**Purpose**: Track request counts and calculate RPS for the admin dashboard.

**Interface Design**:

```typescript
// src/server/services/metrics.service.ts

import { redis } from '@/server/lib/redis';
import { createLogger } from '@/server/lib/telemetry';

const logger = createLogger('metrics-service');

// Redis key constants (centralized for maintainability)
const REDIS_KEYS = {
  /** Counter for requests in current window */
  REQUEST_COUNT: 'metrics:req:count',
  /** Timestamp of last RPS calculation */
  LAST_CALC_TIME: 'metrics:req:last_calc',
  /** Calculated RPS value (read by AdminService) */
  RPS: 'metrics:rps'
} as const;

/** Default calculation interval in seconds */
const CALC_INTERVAL_SECONDS = 60;

/**
 * MetricsService - Tracks request metrics for observability
 *
 * Pattern: Abstract class with static methods (non-request dependent)
 * Per ElysiaJS best practices for stateless services.
 */
export abstract class MetricsService {
  /**
   * Increment the request counter.
   * Call this on every tracked request (e.g., redirects, API calls).
   *
   * Uses Redis INCR for atomic, lock-free counting.
   * Time Complexity: O(1)
   */
  static async trackRequest(): Promise<void> {
    try {
      await redis.incr(REDIS_KEYS.REQUEST_COUNT);
    } catch (error) {
      // Non-blocking: metrics should never break the request flow
      logger.warn('Failed to track request metric', { error });
    }
  }

  /**
   * Calculate and store the requests-per-second metric.
   * Should be called by a scheduled job (e.g., every 60 seconds).
   *
   * Algorithm:
   * 1. GETSET the counter to atomically read and reset it.
   * 2. Read the last calculation timestamp.
   * 3. Calculate RPS = count / elapsed_seconds.
   * 4. Store the new RPS value and update the timestamp.
   *
   * @returns The calculated RPS value, or null on error.
   */
  static async calculateRPS(): Promise<number | null> {
    try {
      const now = Date.now();

      // Atomically get current count and reset to 0
      const countStr = await redis.getset(REDIS_KEYS.REQUEST_COUNT, '0');
      const count = countStr ? Number.parseInt(countStr, 10) : 0;

      // Get last calculation time
      const lastCalcStr = await redis.get(REDIS_KEYS.LAST_CALC_TIME);
      const lastCalcTime = lastCalcStr
        ? Number.parseInt(lastCalcStr, 10)
        : now - CALC_INTERVAL_SECONDS * 1000;

      // Calculate elapsed time in seconds (minimum 1 to avoid division by zero)
      const elapsedMs = Math.max(now - lastCalcTime, 1000);
      const elapsedSeconds = elapsedMs / 1000;

      // Calculate RPS (rounded to 2 decimal places)
      const rps = Math.round((count / elapsedSeconds) * 100) / 100;

      // Store new RPS value with TTL (2 minutes, so stale data expires)
      await redis.set(REDIS_KEYS.RPS, rps.toString(), 'EX', 120);

      // Update last calculation timestamp
      await redis.set(REDIS_KEYS.LAST_CALC_TIME, now.toString());

      logger.debug('RPS calculated', { count, elapsedSeconds, rps });

      return rps;
    } catch (error) {
      logger.error('Failed to calculate RPS', { error });
      return null;
    }
  }
}
```

**Key Design Decisions**:

| Decision                    | Rationale                                      |
| --------------------------- | ---------------------------------------------- |
| `GETSET` for counter        | Atomic read-and-reset prevents race conditions |
| TTL on `metrics:rps`        | Stale data auto-expires if scheduler stops     |
| Non-blocking `trackRequest` | Metrics failures must not impact user requests |
| Abstract class + static     | Matches project's ElysiaJS service pattern     |

---

### Step 3: Schedule RPS Calculation Job

**File**: `src/server/jobs/scheduler.ts`

**Action**: Add a new cron job that runs every minute to calculate RPS.

**Code to Add** (after existing job definitions):

```typescript
import { MetricsService } from '@/server/services/metrics.service';

// ═══════════════════════════════════════════════════════════════════
// MÉTRICAS DE PERFORMANCE
// ═══════════════════════════════════════════════════════════════════

/**
 * Executes every minute
 * Calculates requests-per-second for admin dashboard
 */
export const rpsCalculationJob = new CronJob(
  '* * * * *', // Every minute
  async () => {
    try {
      const rps = await MetricsService.calculateRPS();
      logger.debug('[Scheduler] RPS calculation completed', { rps });
    } catch (error) {
      logger.error('[Scheduler] Error calculating RPS', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  },
  null, // onComplete
  false, // start (controlled by workers/index.ts)
  'UTC' // timezone
);
```

**File**: `src/server/workers/index.ts`

**Action**: Import and start the new job.

**Code to Add**:

```typescript
import { rpsCalculationJob } from '@/server/jobs/scheduler';

// Inside initializeWorkers():
rpsCalculationJob.start();
logger.info(
  '[WorkersInit] ✅ RPS calculation scheduler started (every minute)'
);
```

---

### Step 4: Track Requests in Redirect Resolution

**File**: `src/app/api/internal/resolve/[code]/route.ts`

**Purpose**: Increment the request counter on each link resolution (the "hot path").

**Action**: Import `MetricsService` and call `trackRequest()` at the start of the POST handler.

**Code to Add** (at top of file):

```typescript
import { MetricsService } from '@/server/services/metrics.service';
```

**Code to Add** (inside `POST` handler, after auth check):

```typescript
// Track request for RPS metrics (non-blocking)
MetricsService.trackRequest().catch(() => {
  // Intentionally ignored - metrics should never block requests
});
```

**Placement**: After the `verifyInternalRequest` check, before rate limiting.

---

## Testing Strategy

### Unit Tests

1. **MetricsService**:
   - `trackRequest()` increments counter correctly.
   - `calculateRPS()` returns correct value for known inputs.
   - `calculateRPS()` handles empty counter gracefully.
   - `calculateRPS()` handles Redis errors without throwing.

### Integration Tests

1. **RPS Flow**:
   - Make N requests to `/api/internal/resolve/:code`.
   - Wait for scheduler tick.
   - Verify `metrics:rps` in Redis is approximately N/60.

2. **Admin Dashboard**:
   - After RPS calculation, `GET /api/admin/stats` returns non-zero `requestsPerSecond`.

### E2E Tests

1. **Redirect Flow** (using existing `src/proxy.ts`):
   - Create a link via API.
   - Navigate to `/:shortCode` in browser.
   - Verify redirect occurs.
   - Verify `analytics_events` table has new row.

---

## File Changes Summary

| File                                            | Action | Description                        |
| ----------------------------------------------- | ------ | ---------------------------------- |
| `src/components/admin/layout/admin-sidebar.tsx` | EDIT   | Remove Settings nav item           |
| `src/server/services/metrics.service.ts`        | CREATE | New service for RPS tracking       |
| `src/server/jobs/scheduler.ts`                  | EDIT   | Add rpsCalculationJob              |
| `src/server/workers/index.ts`                   | EDIT   | Start rpsCalculationJob            |
| `src/app/api/internal/resolve/[code]/route.ts`  | EDIT   | Call MetricsService.trackRequest() |

**Note**: No changes needed to `src/proxy.ts` - it already implements the redirect engine correctly.

---

## Post-Implementation Notes

1. **Data Population Delay**: Growth charts will remain empty until real traffic flows through the system. After deploying these changes, generate test traffic by clicking short links.

2. **RPS Metric Behavior**: The metric updates every 60 seconds. Expect a 1-minute delay before seeing non-zero values on the dashboard.

3. **Monitoring**: Consider adding SigNoz alerts for:
   - `metrics:rps` drops to 0 unexpectedly.
   - `analytics_events` insert failures.

4. **Future Enhancements**:
   - Add `/admin/settings` page with system configuration.
   - Implement real-time RPS using WebSocket or Server-Sent Events.
   - Add cache hit rate metric alongside RPS.
