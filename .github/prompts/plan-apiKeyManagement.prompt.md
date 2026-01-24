# Implementation Plan: API Key Management & Public API Documentation

This plan outlines the implementation of the API Key generation system and the integration of the public API documentation link in the user settings dashboard.

## 1. API Client Extensions (`src/lib/api-client.ts`)

We need to add type-safe methods to interact with the `/api/keys` endpoints provided by the backend. The client is already set up using Elysia Eden Treaty.

**Task:** Add the following exported functions to `src/lib/api-client.ts`:

- `getApiKeys()`: Fetches the list of API keys for the authenticated user.
  - **Method:** `GET /api/keys`
  - **Return Type:** `Promise<{ keys: ApiKeyPublic[], total: number }>`
  - **Implementation:** Use `client.api.keys.get()` and `handleEden`.
- `createApiKey(input: CreateApiKeyInput)`: Creates a new API key.
  - **Method:** `POST /api/keys`
  - **Input Type:** `CreateApiKeyInput` (name, scopes, etc.)
  - **Return Type:** `Promise<ApiKeyCreated>` (Includes the raw `key` string - critical!)
  - **Implementation:** Use `client.api.keys.post(input)` and `handleEden`.
- `revokeApiKey(id: string)`: Revokes/Deletes an existing API key.
  - **Method:** `POST /api/keys/:id/revoke`
  - **Return Type:** `Promise<{ message: string }>`
  - **Implementation:** Use `client.api.keys({ id }).revoke.post()` and `handleEden`.

**Reference Types:** Ensure `ApiKeyPublic`, `ApiKeyCreated`, and `CreateApiKeyInput` are imported from `@/types/api-keys.types`.

## 2. React Query Hooks (`src/lib/hooks/use-api-keys.ts`)

Create a new hook file to manage the server state for API keys, ensuring strong typing and cache management.

**File:** `src/lib/hooks/use-api-keys.ts`

**Exposed Hooks:**

- `useApiKeys()`:
  - **Query Key:** `['api-keys', 'list']`
  - **Query Fn:** Calls `api.getApiKeys()`
  - **Returns:** `useQuery` result containing the list of keys.
- `useCreateApiKey()`:
  - **Mutation Fn:** Calls `api.createApiKey`
  - **On Success:**
    - Invalidate `['api-keys', 'list']`.
    - **Crucial:** Do _not_ automatically clear the result data immediately, as the UI needs to display the raw key to the user one-time.
- `useRevokeApiKey()`:
  - **Mutation Fn:** Calls `api.revokeApiKey`
  - **On Success:**
    - Invalidate `['api-keys', 'list']`.
    - Show a toast notification (success).

## 3. UI Implementation (`src/components/dashboard/settings/api-keys-manager.tsx`)

Create a comprehensive component to manage API keys.

**File:** `src/components/dashboard/settings/api-keys-manager.tsx`

**Components & Structure:**

1.  **Header Section:**
    - Title: "Chaves de API"
    - Description: Explanation of API keys usage.
    - **Documentation Link:** A prominent button/link pointing to `/api/docs` (Public API Docs) with an `ExternalLink` icon.
      - _Note:_ Ensure `target="_blank"` and `rel="noopener noreferrer"`.

2.  **Key List (`ApiKeyList`):**
    - Table or Card list of existing keys from `useApiKeys`.
    - **Columns:** Name, Prefix (e.g., `urlfy_sk_...****`), Created At, Last Used, Status.
    - **Actions:** "Revoke" button (uses `useRevokeApiKey`) with a confirmation dialog (AlertDialog).

3.  **Create Key Dialog (`CreateApiKeyDialog`):**
    - Trigger: "Gerar nova chave" button.
    - **Form:**
      - Input: `name` (required).
      - _Future:_ Scope selection (hidden/default for now if backend sets defaults).
      - _Future:_ Expiration date picker.
    - **Submission:** Calls `useCreateApiKey`.

4.  **New Key Display (Post-Creation Success State):**
    - When mutation succeeds, creating the dialog must switch to a "Success" view.
    - **Display:** The raw API key (`data.key`) in a `<code>` block or Input field.
    - **Actions:** "Copy to Clipboard" button (with feedback) and a "Done" button.
    - **Warning:** Explicit text stating "This key will only be shown once. Copy it now."

## 4. Integration (`src/app/(dashboard)/dashboard/settings/page.tsx`)

Replace the static/placeholder API Keys card with the new component.

**Changes:**

- Import `ApiKeysManager` from `@/components/dashboard/settings/api-keys-manager`.
- Replace the existing `<Card>...<CardTitle>Chaves de API</CardTitle>...</Card>` block with `<ApiKeysManager />`.

## 5. Verification & Testing

- **Type Check:** Run `bun type-check` to ensure no mismatches between the Eden Treaty inference and our manual hook types.
- **Functional Test:**
  1.  Generate a key.
  2.  Verify the raw key is shown.
  3.  Close dialog.
  4.  Verify key appears in the list (masked).
  5.  Click the simplified "Docs" link to ensure it opens `/api/docs`.
  6.  Revoke the key and ensure it disappears or updates status.

## Technical Constraints & Best Practices

- **Typing:** Use strictly defined interfaces from `@/types` and `api-client.ts`. Avoid `any`.
- **UX:** Use `sonner` for toast notifications (success/error). Use `lucide-react` for icons.
- **Security:** Never log the raw API key in the frontend console.
- **Routing:** Ensure the documentation link is strictly `/api/docs`.
