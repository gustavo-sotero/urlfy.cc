# Implementation Plan: Responsive Navbar & Adaptive Landing Page

## 1. Objective

Enhance the `urlfy.cc` landing page by adding a responsive navigation bar and making the hero section adaptive to the user's authentication state. Authenticated users should see "Go to Dashboard" instead of generic sign-up calls to action.

## 2. Architecture & Components

### 2.1 New Component: `src/components/layout/navbar.tsx`

- **Type**: Client Component (`'use client'`).
- **Purpose**: Global navigation for public pages.
- **State**: Tracks authentication status using `useSession`.
- **Responsive Strategy**:
  - **Desktop**: Horizontal links + Auth buttons.
  - **Mobile**: Hamburger menu using `Sheet` component.

### 2.2 New Component: `src/components/home/hero-actions.tsx`

- **Type**: Client Component (`'use client'`).
- **Purpose**: Displays the primary Call to Action (CTA) in the hero section.
- **Logic**:
  - If `isLoading`: Show skeleton or loading spinner.
  - If `session`: Show "Go to Dashboard" (Link to `/dashboard`).
  - If `!session`: Show "Start for free" (Link to `/signup`).

### 2.3 Modified File: `src/app/page.tsx`

- **Update**: Import and render `<Navbar />` at the top of the layout.
- **Update**: Replace static CTA buttons with `<HeroActions />`.

## 3. Implementation Details

### Step 1: `src/components/layout/navbar.tsx`

**Features:**

- **Logo**: Link to `/`.
- **Nav Links**: "Features", "Pricing", "About" (Hash links or placeholders).
- **Auth Section**:
  - **Guest**: `Login` (Ghost Button) + `Sign up` (Primary Button).
  - **User**: `Dashboard` (Outline Button) + `UserDropdown` (Reuse strictly necessary parts or create simplified version).
- **Mobile Menu**: Use `Sheet` from `@/components/ui/sheet` to render a side drawer on small screens.

**Technical Specs:**

- Import `useSession` from `@/lib/auth.client`.
- Import UI primitives: `Button`, `Sheet`, `SheetTrigger`, `SheetContent`, `DropdownMenu` (if needed for user avatar).
- Ensure transparent background on top, solid on scroll (optional polish).

```tsx
// Draft Signature
'use client';
import { useSession } from '@/lib/auth.client';
// ... imports

export function Navbar() {
  const { data: session } = useSession();
  // ... implementation
}
```

### Step 2: `src/components/home/hero-actions.tsx`

**Features:**

- Adaptive button that redirects correctly based on auth state.

**Technical Specs:**

- **Props**: None required initially.
- **Loading State**: Render a `Button` with opacity/spinner to prevent layout shift (CLS).
- **Button Variant**: `size="lg"`, `className="w-full sm:w-auto"`.

```tsx
// Draft Signature
'use client';
import { useSession } from '@/lib/auth.client';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';

export function HeroActions() {
  // ... implementation
}
```

### Step 3: Update `src/app/page.tsx`

- Remove existing static navigation (if any).
- Wrap the main content or place `Navbar` inside the main `flex-col` container.
- Ensure strict type safety and cleaner imports.

## 4. Coding Standards & Best Practices

1.  **Type Safety**: No `any`. Define interfaces for all props if they arise.
2.  **Client/Server Split**: Keep `page.tsx` as a Server Component. Only valid logic (Navbar, HeroActions) moves to client components.
3.  **Imports**: Use `@/` alias for all imports.
4.  **Tailwind**: Use standard utility classes matching the project's design system (spacing, colors from `globals.css`).
5.  **Shadcn UI**: Reuse existing components from `src/components/ui` without modifying them unless necessary.
