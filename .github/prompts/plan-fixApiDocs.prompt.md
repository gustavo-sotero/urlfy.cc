# Plan: Fix API Documentation for `/me` and `/admin` Endpoints

This technical plan details the steps to fully document the currently undocumented endpoints in the `users` and `admin` modules. We will use `TypeBox` for strict schema validation and OpenAPI generation via Elysia's `swagger` plugin.

## 🎯 Objective

Ensure all endpoints under `/api/me` and `/api/admin/audit` are correctly exposed in the Swagger UI with:

1.  Proper grouping (**tags**).
2.  Clear descriptions (**summary**).
3.  Strict response typing (**schemas**).

## 🛠 Prerequisites & Context

- **Framework**: ElysiaJS + TypeBox (`t`).
- **User Module**: `src/server/api/users/me.ts`.
- **User Schemas**: `src/server/modules/users/users.schema.ts`.
- **Admin Module**: `src/server/api/admin/audit.ts`.
- **Admin Schemas**: `src/server/modules/admin/index.ts` (or dedicated schema file).

---

## 📝 Step 1: Define Precise TypeBox Schemas

We must strictly define the data structures currently returned by the services. Using `additionalProperties: false` is recommended for strictness where applicable.

### 1.1 User Module Schemas

**File:** `src/server/modules/users/users.schema.ts`

Define and export the following models:

1.  **`UserQuotaResponse`**:

    ```typescript
    t.Object({
      used: t.Number(),
      limit: t.Number(),
      remaining: t.Number(),
      percentUsed: t.Number()
    });
    ```

2.  **`UserConsentResponse`** (and Body):
    - For GDPR/LGPD consent tracking.
    - Fields: `analytics`, `marketing`, `functional` (booleans), `timestamp`.

3.  **`DataDeletionRequestResponse`**:
    - Fields matching `data_deletion_requests` table: `id`, `status`, `requestedAt`, `deadlineAt`.

4.  **`UserDataExportResponse`**:
    - This is likely a recursive or large object. Since `gdprService.exportUserData` returns it, ensure the schema roughly matches the structure (User profile + Links + Analytics summary). If it's too complex, use `t.Any()` temporarily but mark it with `TODO: Refine schema`.

### 1.2 Admin Audit Schemas

**File:** `src/server/modules/admin/index.ts` (or `admin.schema.ts` if refactoring)

Define:

1.  **`AuditStatsSummaryResponse`**:
    - Likely metrics: `totalEvents`, `eventsToday`, `actionsByType` (Record/Map).

---

## 💻 Step 2: Update User Endpoints (`/api/me`)

**File:** `src/server/api/users/me.ts`

Refactor the `userDataRoutes` chain. For **every** endpoint, add the `detail` object and `response` validator.

### required modifications:

1.  **GET `/`** (Profile)
    - **Tags**: `['User']`
    - **Summary**: "Get current user profile"
    - **Response**: `UserProfileResponse` (ensure this exists or create it matching the return object).

2.  **GET `/quota`**
    - **Tags**: `['User']`
    - **Summary**: "Get usage quota"
    - **Response**: `{ 200: t.Object({ success: t.Boolean(), data: UserQuotaResponse }) }`

3.  **GET `/export`**
    - **Tags**: `['User', 'GDPR']`
    - **Summary**: "Export all user data"
    - **Response**: `{ 200: t.Object({ success: t.Boolean(), data: UserDataExportResponse }) }`

4.  **DELETE `/data`**
    - **Tags**: `['User', 'GDPR']`
    - **Summary**: "Request account deletion"
    - **Response**: `{ 200: t.Object({ success: t.Boolean(), data: DataDeletionRequestResponse }) }`

5.  **GET `/deletion-request`**
    - **Tags**: `['User', 'GDPR']`
    - **Summary**: "Check deletion request status"
    - **Response**: `{ 200: t.Object({ success: t.Boolean(), data: t.Nullable(DataDeletionRequestResponse) }) }`

6.  **POST `/consent`** & **GET `/consent`**
    - **Tags**: `['User', 'GDPR']`
    - Define `body` validation for POST.
    - **Response**: `{ 200: t.Object({ success: t.Boolean(), data: UserConsentResponse }) }`

---

## 🛡️ Step 3: Update Admin Audit Endpoints (`/api/admin/audit`)

**File:** `src/server/api/admin/audit.ts`

Refactor `adminAuditRoutes`. Use `['Admin', 'Audit']` for tags.

### required modifications:

1.  **GET `/`** (List)
    - Ensure the main list endpoint uses strict pagination schema.

2.  **GET `/{id}`**
    - **Summary**: "Get audit log details"
    - **Params**: `t.Object({ id: t.String() })`
    - **Response**: `{ 200: t.Object({ success: t.Boolean(), data: AuditLogSchema }) }`

3.  **GET `/entity/{entityType}/{entityId}`**
    - **Summary**: "Get audit logs by entity"
    - **Params**: `t.Object({ entityType: t.String(), entityId: t.String() })`
    - **Response**: `{ 200: t.Object({ success: t.Boolean(), data: t.Array(AuditLogSchema) }) }`

4.  **GET `/user/{targetUserId}`**
    - **Summary**: "Get audit logs by user"
    - **Params**: `t.Object({ targetUserId: t.String() })`

5.  **GET `/stats/summary`**
    - **Summary**: "Get audit statistics"
    - **Response**: `{ 200: t.Object({ success: t.Boolean(), data: AuditStatsSummaryResponse }) }`

---

## ✅ Best Practices Checklist

- [ ] **Type definitions**: All `t.Object` definitions should use `as const` where possible in schemas for type inference.
- [ ] **Consistency**: Ensure `response` structure always includes `success: boolean` if that's the API standard.
- [ ] **Imports**: Clean up unused imports after refactoring.
- [ ] **Validation**: Ensure `detail: { tags: [...] }` is present on **all** routes for proper grouping in swagger.
