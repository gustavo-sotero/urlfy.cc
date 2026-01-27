# Technical Plan: Help Page Repair & Standard Error Handling

## 1. Context & Objectives

The goal is to rectify the reported "missing" Help page and implement missing standard Next.js error pages to improve user experience and system robustness. The implementation must adhere to the project's high-performance architecture (Bun + Next.js 16) and UI standards (TailwindCSS + Shadcn).

## 2. Technical Standards

- **Framework:** Next.js 16+ (App Router).
- **Styling:** TailwindCSS with `cn` utility for class merging.
- **Components:** Reuse atomic components from `@/components/ui`.
- **Typing:** Strict TypeScript (no `any`).
- **Icons:** `lucide-react`.

## 3. Implementation Plan

### 3.1. Implement Global 404 Page (Not Found)

**File:** `src/app/not-found.tsx`

This file is critical for handling unknown routes gracefully. It replaces the default Next.js 404 page with a branded version.

**Specifications:**

- **Layout:** Centered flex/grid layout matching the application theme.
- **Content:**
  - Icon: `FileQuestion` or `SearchX` from `lucide-react`.
  - Title: "Página não encontrada".
  - Description: "O conteúdo que você procura não existe ou foi movido."
  - Action: Button linking to `/` (Home).
- **Code Structure:**

```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 text-center">
      {/* Implementation details */}
    </div>
  );
}
```

### 3.2. Implement Root Error Boundary

**File:** `src/app/error.tsx`

This client-side component catches runtime errors occurring in Route Handlers or Server Components below the root layout.

**Specifications:**

- **Directive:** Must use `'use client'`.
- **Props Interface:**
  ```typescript
  interface ErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
  }
  ```
- **Behavior:**
  - Log the error to `console.error` inside a `useEffect`.
  - Render a user-friendly error message (avoid exposing stack traces to users).
  - Provide a "Tentar novamente" button that calls `reset()`.
- **UI:** Similar centered layout to `not-found.tsx` but with an `AlertTriangle` icon.

### 3.3. Refine Help Page

**File:** `src/app/(public)/help/page.tsx`

Although the file exists, the user reported it as broken. We must ensure it strictly follows the design system and Next.js page conventions.

**Specifications:**

- **Route:** Ensure it is default exported as a React Functional Component.
- **Metadata:** Define proper metadata title/description.
- **Content Structure:**
  - Hero Section: Title and subtitle.
  - FAQ Section: Use `@/components/ui/accordion`.
  - Support Section (Optional): Simple `mailto` CTA using `@/components/ui/card`.
- **Validation:** Check that `src/components/ui/accordion` is correctly imported and used.

**Example FAQ Structure:**

```tsx
<Accordion type="single" collapsible className="w-full max-w-2xl mx-auto">
  <AccordionItem value="item-1">
    <AccordionTrigger>Questão 1?</AccordionTrigger>
    <AccordionContent>Resposta...</AccordionContent>
  </AccordionItem>
</Accordion>
```

## 4. Verification Steps

1. **404:** Visit a random URL (`/random-uuid`) and verify the explicit 404 UI.
2. **500:** Temporarily throw an error in a page component to verify `error.tsx` catches it and the Reset button works.
3. **Help:** Navigate to `/help` via the footer link and verify the Accordion interactivity and layout containment.
