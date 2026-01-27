# Implementation Plan: Hybrid Contact System (DB + Telegram + Admin UI)

> 🎯 **Goal:** Replace direct email links with a persistent contact form that saves messages to the database and notifies via Telegram bot, including an Admin UI for message management and strict rate limiting.

## 1. Database & Schema

**File:** `src/db/schema/contact.ts`

- Define the `contact_messages` table using Drizzle ORM.
- **Columns:**
  - `id`: `uuid` (primary key, defaultRandom)
  - `name`: `varchar(255)` (not null)
  - `email`: `varchar(255)` (not null)
  - `subject`: `varchar(255)` (not null)
  - `message`: `text` (not null)
  - `ip_address`: `varchar(45)` (not null, anonymize if needed, but store for abuse initially)
  - `user_agent`: `text`
  - `status`: enum/varchar (`unread`, `read`, `archived`) (default: `unread`)
  - `telegram_sent`: `boolean` (default: false)
  - `telegram_error`: `text` (nullable, for debugging failures)
  - `consent_given`: `boolean` (not null, LGPD audit)
  - `created_at`: `timestamp` (defaultNow)
- **Exports:**
  - Export table definition.
  - Add export to `src/db/schema.ts`.
- **Migration:**
  - Run `bun run db:generate`.
  - Run `bun run db:migrate`.

## 2. Backend Implementation (ElysiaJS Module)

**Directory:** `src/server/modules/contact/`

### 2.1 Schema & Validation (`contact.schema.ts`)

- Define TypeBox schemas for the API.
- `ContactBody`: Object with `name`, `email` (format: email), `subject`, `message`, `consent` (boolean, true).
- Enforce strict input validation (min/max lengths).

### 2.2 Service Layer (`contact.service.ts`)

- **Class:** `ContactService` (static methods).
- **Dependencies:** `db` (Drizzle), `telegram` (internal utility).
- **Method:** `create(input: ContactBody, ip: string, ua: string)`:
  1.  Insert record into `contact_messages` with `telegram_sent: false`.
  2.  Check for `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` environment variables.
  3.  If present, attempt `fetch` to Telegram Bot API.
  4.  Update record: `telegram_sent: true` on success, or `telegram_error` on failure.
  5.  Catch errors gracefully (do **not** throw to controller if Telegram fails; the DB save is the primary success criteria).

### 2.3 Controller Layer (`contact.controller.ts`)

- **Instance:** New Elysia instance (`prefix: /contact`).
- **Endpoint:** `POST /`
- **Rate Limiting:**
  - Implement **30 requests per hour per IP**.
  - Use Redis or the existing rate limiter utility key: `contact:limit:{ip}`.
- **Handler:**
  - Call `ContactService.create`.
  - Return `{ success: true, message: "Message received" }`.

### 2.4 Environment Variables

- Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to `src/lib/env.ts` (using Zod optional strings to prevent startup crashes if missing).

## 3. Frontend Implementation (Links & Form)

### 3.1 Contact Form Component

- **File:** `src/components/forms/contact-form.tsx`
- **Tech:** `react-hook-form`, `zod` resolver, `shadcn/ui` components (Form, Input, Textarea, Checkbox, Button).
- **Fields:** Name, Email, Subject, Message.
- **Consent:** "I agree to the storing of this data for contact purposes" (Required).
- **Behavior:**
  - On submit, `POST /api/contact`.
  - Show success toast on 200 OK.
  - Show error toast on failure.

### 3.2 Public Pages

- **Contact Page:** `src/app/(public)/contact/page.tsx`
  - Render `ContactForm`.
  - Add social links component.
- **Landing Page:** Add a "Contact" section (or link to `/contact`) in `src/app/(public)/page.tsx`.

### 3.3 Cleanup & Social Links

- **Footer:** `src/components/layout/footer.tsx`
- **Action:**
  - Search workspace for `mailto:` and email regex.
  - Replace with Links: GitHub, LinkedIn, Telegram (optional), and internal `/contact`.
  - Remove any exposed personal email strings.

## 4. Admin UI (Foundation)

### 4.1 Navigation

- **File:** `src/components/admin/sidebar.tsx` (or layout config).
- **Update:** Add "Messages" item linking to `/admin/messages`.

### 4.2 Messages Page

- **File:** `src/app/(admin)/messages/page.tsx`
- **Type:** Server Component.
- **Data Fetching:** Fetch `contact_messages` via Drizzle (descending `created_at`).
- **UI:**
  - Use a Data Table component.
  - Columns: Date, Name, Email, Subject, Status, Telegram Status (Icon check/x).
  - **View Action:** A "View" button opening a Sheet/Dialog with the full message body.
  - **Status Action:** Button to toggle "Mark as Read".

## 5. Technical Requirements & Best Practices

- **Type Safety:** Strict use of TypeScript. Using TypeBox for backend validation and Zod for frontend validation.
- **Privacy (LGPD):** Explicit consent column is mandatory.
- **Resilience:** The endpoint MUST NOT fail if the Telegram API is down. The database is the source of truth.
- **Security:** Rate limits are non-negotiable (30/hour).
