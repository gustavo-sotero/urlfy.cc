# Technical Implementation Plan: v3.0.0 Global i18n (pt-BR / en)

**Objective**: Implement internationalization for `(public)` and `(dashboard)` routes using `next-intl`.
**Strategy**: URL-prefix routing (`/en/dashboard`, `/pt-br/about`), TypeScript-based dictionaries for type safety, and hybrid middleware to support root-level Short URLs alongside localized routes.
**Default Locale**: English (`en`).

---

## 🚀 Phase 1: Core Configuration & Dependencies

### 1.1 Install Dependencies

Add `next-intl` to the project.

```bash
bun add next-intl
```

### 1.2 Shared Routing Logic (`src/i18n/routing.ts`)

Create a central definition for locales to ensure consistency across middleware and components.

```typescript
// src/i18n/routing.ts
import { defineRouting } from 'next-intl/routing';
import { createSharedPathnamesNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'pt-br'],
  // Used when no locale matches
  defaultLocale: 'en',
  // Restore the prefix for the default locale to ensure uniform URLs (Optional, user preference)
  localePrefix: 'always'
});

// Lightweight wrappers for strictly typed navigation
export const { Link, redirect, usePathname, useRouter } =
  createSharedPathnamesNavigation(routing);
```

### 1.3 Request Configuration (`src/i18n/request.ts`)

Configure how messages are loaded server-side.

```typescript
// src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // Validate that the incoming `locale` parameter is valid
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    // Import TS files directly for type-safety
    messages: (await import(`../messages/${locale}.ts`)).default
  };
});
```

### 1.4 Next.js Config Update (`next.config.ts`)

Wrap the existing configuration with the `next-intl` plugin.
_Note: Ensure `next.config.ts` preserves existing settings._

```typescript
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... existing config
};

export default withNextIntl(nextConfig);
```

---

## 📝 Phase 2: Type-Safe Dictionaries

Create translation files using TypeScript objects instead of JSON for better type inference if needed, or simply for consistency with the user request.

### 2.1 Dictionary Structure

**Path**: `src/messages/en.ts` (Default/Source of Truth)

```typescript
export default {
  Common: {
    dashboard: 'Dashboard',
    settings: 'Settings',
    language: 'Language'
  },
  Hero: {
    title: 'Shorten your links',
    cta: 'Get Started'
  }
} as const;
```

**Path**: `src/messages/pt-br.ts`

```typescript
import en from './en';

// Simple check to ensure keys match (optional but recommended)
const pt: typeof en = {
  Common: {
    dashboard: 'Painel',
    settings: 'Configurações',
    language: 'Idioma'
  },
  Hero: {
    title: 'Encurte seus links',
    cta: 'Começar'
  }
};

export default pt;
```

---

## 📂 Phase 3: Route Refactoring

Isolate localized routes from global routes (Auth/Admin/API).

### 3.1 Folder Move

Execute the following moves:

- `src/app/(public)` -> `src/app/[locale]/(public)`
- `src/app/(dashboard)` -> `src/app/[locale]/(dashboard)`

### 3.2 Localized Root Layout

Create `src/app/[locale]/layout.tsx`. This acts as the entry point for the `NextIntlClientProvider`.

```typescript
// src/app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Ensure valid locale
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();

  // Note: We might need to merge the root HTML structure here or keep it in the root src/app/layout.tsx
  // and only wrap the content. For this plan, we assume root layout handles HTML/Body
  // but provider must wrap the localized children.
  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
```

---

## 🛡️ Phase 4: Hybrid Middleware

Combine the URL Shortener Logic (Redirect Engine) with `next-intl`.

### 4.1 Create/Update `src/middleware.ts`

Logic flow:

1. Exclude static files, API, and internal Next paths.
2. Check if the path corresponds to `(auth)` or `(admin)` routes (which are UNTRANSLATED in this plan). If so, define if they need specific handling or just pass through.
3. Check if the path starts with a locale (e.g., `/en`, `/pt-br`) OR is the root `/`.
   - If YES: Use `next-intl` middleware.
4. If NO (e.g., `/abc1234`): Treat as a potential Short URL and run the Redirect Engine logic.

```typescript
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Skip internal and static requests
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.') || // files
    pathname.startsWith('/api')
  ) {
    return NextResponse.next();
  }

  // 2. Bypass i18n for Admin and Auth routes (kept at root level)
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') // Add other auth routes
  ) {
    return NextResponse.next();
  }

  // 3. Check for Locales or Root
  const isLocalePath = routing.locales.some((loc) =>
    pathname.startsWith(`/${loc}`)
  );

  if (isLocalePath || pathname === '/') {
    return intlMiddleware(req);
  }

  // 4. Fallback: Short URL Redirect Engine
  // Import logic from src/proxy.ts logic here or keep proxy logic inline
  // ... perform DB lookup / Redis check for short code ...

  // Placeholder for existing Logic:
  // if (isShortCode(pathname)) return handleRedirect(req);

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)']
};
```

---

## 🧩 Phase 5: Components

### 5.1 Language Switcher (`src/components/shared/language-switcher.tsx`)

Use the routing navigation wrapper to ensure we switch the locale part of the URL while keeping the path and query params.

```typescript
'use client';

import { usePathname, useRouter } from '@/i18n/routing';

export function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSwitch = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    // Implement Dropdown UI
    // Call handleSwitch('en') or handleSwitch('pt-br')
    <div>...</div>
  );
}
```

---

## 🔒 Phase 6: System Integrity

### 6.1 Reserved Slugs

Update the link creation validation logic to explicitly forbid `en` and `pt-br` as custom slugs to prevent routing conflicts.

**File**: `src/server/services/link.service.ts` or `src/lib/validation.ts`
**Action**: Add `['en', 'pt-br']` to the reserved list.

---

## ✅ Checklist

- [ ] Install `next-intl`.
- [ ] Configure `i18n/request.ts` and `i18n/routing.ts`.
- [ ] Create `messages/en.ts` and `messages/pt-br.ts`.
- [ ] Refactor `src/app` folder structure.
- [ ] Implement `src/middleware.ts` (Hybrid).
- [ ] Add `LanguageSwitcher` to UI.
- [ ] Verify `(auth)` and `(admin)` routes still work without prefix.
- [ ] Verify Short URLs still work at root.
