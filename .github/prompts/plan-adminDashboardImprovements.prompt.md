# Implementation Plan: Admin Dashboard Overhaul

> **Goal**: Enhance the Admin Dashboard by improving navigation structure, fixing data listing visibility, and introducing comprehensive analytics visualization.

## 📦 Phase 1: Navigation & Layout Architecture

**Objective**: Establish a robust navigation structure that allows seamless transition between Admin and User contexts.

### 1.1 New Component: `AdminSidebar`

- **File**: `src/components/admin/layout/admin-sidebar.tsx` (Create if not exists)
- **Tech Stack**: `lucide-react` for icons, `next/link`.
- **Items to Include**:
  - `Overview` (`/admin`) - Icon: `LayoutDashboard`
  - `Links Management` (`/admin/links`) - Icon: `Link`
  - `Users Management` (`/admin/users`) - Icon: `Users`
  - `Settings` (`/admin/settings`) - Icon: `Settings`
  - **Separator**
  - `Back to App` (`/dashboard`) - Icon: `ExternalLink` (Critical for UX)
- **Styling**: Sidebar should use `shadcn/ui` patterns (cn, active states).

### 1.2 Layout Restructuring

- **File**: `src/app/(admin)/layout.tsx`
- **Action**: Refactor existing layout to support a permanent sidebar structure.
- **Structure**:
  ```tsx
  <div className="flex min-h-screen">
    <AdminSidebar className="w-64 hidden md:block border-r" />
    <div className="flex-1 flex flex-col">
      <AdminHeader /> {/* Simplified header for mobile trigger & user menu */}
      <main className="flex-1 p-6 overflow-y-auto">{children}</main>
    </div>
  </div>
  ```

---

## 🔗 Phase 2: Links Management Fixes

**Objective**: Ensure the links management page displays a full paginated list by default, rather than waiting for search input.

### 2.1 Backend Query Adjustment

- **File**: `src/server/modules/links/links.service.ts` (or `src/server/services/admin.service.ts`)
- **Action**: Review `findAll` or `search` method.
- **Fix**: Ensure that if `searchQuery` is `null` or `undefined`, the query returns the latest created links (paginated) instead of an empty array.
- **Typing**: Ensure return type matches `PaginatedResponse<Link>`.

### 2.2 Frontend List Implementation

- **File**: `src/app/(admin)/admin/links/page.tsx`
- **Action**:
  - Implementation of `useQuery` or Server Component fetching to load initial data.
  - Separate "Search State" from "Initial State".
  - Ensure pagination controls are visible and functional when no search is active.

---

## 📊 Phase 3: Analytics & Visualization

**Objective**: Provide visual insights into platform growth (Users & Clicks) using charts.

### 3.1 Backend: Analytics Aggregation

- **File**: `src/server/services/analytics.service.ts` (or new `src/server/services/admin-analytics.service.ts`)
- **New Method**: `getGrowthStats(range: '7d' | '30d')`
- **Logic**:
  - Aggregate `analytics_events` by date (count clicks).
  - Aggregate `users` table by `created_at` (count new users).
  - Return combined strict typed object:
    ```typescript
    interface GrowthStats {
      date: string; // ISO Date
      clicks: number;
      newUsers: number;
    }
    [];
    ```

### 3.2 Frontend: Chart Components

- **File**: `src/components/admin/charts/growth-chart.tsx`
- **Tech Stack**: `recharts` (ResponsiveContainer, AreaChart, XAxis, YAxis, Tooltip).
- **Features**:
  - Dual axis support or switchable view (Clicks vs Users).
  - `Skeleton` loading state support.
  - Proper formatting of dates on X-Axis.

### 3.3 Dashboard Integration

- **File**: `src/app/(admin)/admin/page.tsx`
- **Action**:
  - Fetch `growthStats` server-side.
  - Render `GrowthChart` section below `StatsCards`.
  - Add comparison indicators (e.g., "↑ 12% vs last period").

---

## 📝 Standards & Best Practices

- **Type Safety**: strict TypeScript interfaces for all API responses and Component props. No `any`.
- **Component Composition**: Keep the `Sidebar`, `Charts`, and `Tables` as pure components where possible.
- **Error Handling**: Wrap new Dashboard sections in `ErrorBoundary` components to prevent total page crash if analytics fail.
- **Performance**: Use specific SQL `COUNT` queries for stats, avoid fetching full rows. Use caching for heavy analytics queries if possible.
