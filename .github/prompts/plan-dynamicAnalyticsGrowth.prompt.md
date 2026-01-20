# Implementation Plan: Dynamic Analytics Growth Stats

## Objective

Enable dynamic calculation and display of period-over-period growth percentages for "Total Clicks" and "Unique Visitors" on the Analytics Dashboard. Currently, these values are hardcoded placeholders (+12%, +8%).

## Technical Context

- **Architecture**: Bun + ElysiaJS (Backend), Next.js 16 (Frontend).
- **Database**: PostgreSQL with Drizzle ORM.
- **Table**: `analytics_events` (Partitioned).
- **Pattern**: `AnalyticsService` (Stateless Abstract Class).

## Detailed Implementation Steps

### 1. Type & Schema Definitions

**Goal**: Update the data contract between Backend and Frontend to support growth metrics.

- **File**: `src/types/analytics.types.ts`
  - Update `AnalyticsSummary` interface:
    ```typescript
    export interface AnalyticsSummary {
      // ... existing fields
      totalClicksGrowth: number; // Percentage (e.g., 12 for 12%, -5 for -5%)
      uniqueVisitorsGrowth: number; // Percentage
    }
    ```

- **File**: `src/server/modules/analytics/analytics.schema.ts`
  - Update `AnalyticsSummary` TypeBox schema:
    ```typescript
    export const AnalyticsSummary = t.Object({
      // ... existing fields
      totalClicksGrowth: t.Number(),
      uniqueVisitorsGrowth: t.Number()
    });
    ```
  - Ensure `AnalyticsModel` registry picks up the change automatically via reference.

### 2. Backend Service Logic

**Goal**: Implement period-over-period calculations in `AnalyticsService`.

- **File**: `src/server/modules/analytics/analytics.service.ts`
  1.  **Helper Function**: Add a private static or helper function `calculateGrowth`:
      ```typescript
      function calculateGrowth(current: number, previous: number): number {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      }
      ```
  2.  **Date Logic**:
      - `currentStart`: `now - days`
      - `previousStart`: `now - (2 * days)`
      - `previousEnd`: `now - days`

  3.  **Update `getSummary(linkId, days)`**:
      - Current Query: Maintains existing logic (`gte(createdAt, currentStart)`).
      - Previous Period Query: Add parallel query for `totalClicks` and `uniqueVisitors` where `createdAt` is between `previousStart` and `previousEnd`.
      - Use `Promise.all` to fetch current stats, previous stats, and top metrics concurrently.
      - Calculate `totalClicksGrowth` and `uniqueVisitorsGrowth`.
      - Return extended object.

  4.  **Update `getAllLinksSummary(userId, days)`**:
      - Replicate calculation logic from `getSummary` but applied to the user-level aggregation query (joining `links` table).
      - Ensure previous period query also respects `userId` scope.

### 3. Frontend Integration

**Goal**: Display dynamic values in the UI.

- **File**: `src/app/(dashboard)/dashboard/analytics/page.tsx`
  - Locate the "Stats Cards" section.
  - Replace hardcoded "+12%" and "+8%" with `summaryData?.totalClicksGrowth` and `summaryData?.uniqueVisitorsGrowth`.
  - Implement formatting logic:
    - If `growth > 0`: Text Green, Prefix "+"
    - If `growth < 0`: Text Red, Prefix "" (negative number has minus already)
    - If `growth === 0`: Text Muted, "0%"
  - Example Component Logic:
    ```tsx
    const formatGrowth = (value: number) => {
      const isPositive = value > 0;
      const isNegative = value < 0;
      return (
        <span
          className={cn(
            'text-xs',
            isPositive && 'text-green-500',
            isNegative && 'text-red-500',
            !isPositive && !isNegative && 'text-muted-foreground'
          )}
        >
          {value > 0 ? '+' : ''}
          {value}% em relação ao período anterior
        </span>
      );
    };
    ```

### 4. Database Considerations

- Ensure queries leverage existing indices on `(link_id, created_at)` and `(created_at)`.
- Use Drizzle's `and`, `eq`, `gte`, `lt` operators for precise time ranges.
- Import `lt` (less than) from `drizzle-orm` for the previous period range boundary (`previousStart <= date < previousEnd`).

## Verification Plan

1.  **Unit Test**: Verify `calculateGrowth` logic (e.g., 0->100, 100->110, 100->50).
2.  **Integration**: Check `GET /api/analytics/all/summary?days=30` returns new fields.
3.  **UI**: Verify Dashboard shows correct percentages for a link with known history.
