# Technical Implementation Plan: Frontend Extensions & Architecture Refactor

## 1. Context & Objectives

**Goal**: Refactor the frontend architecture to support a modular "Public" layout system, implement missing authorized pages (Footer links), and fix navigation inconsistencies.
**Stack**: Next.js 16 (App Router), React 19, TailwindCSS, Shadcn UI, Bun Runtime.
**Standards**: Strict TypeScript, Server Components (RSC) where possible, Semantic HTML5, WCAG 2.1 Accessibility.

---

## 2. Directory Structure Refactor

Currently, the landing page resides at the root `src/app/page.tsx`. To implement a shared layout for public pages (Landing, Privacy, Terms) without affecting the Dashboard or Auth flows, we will utilize Next.js Route Groups.

### 2.1. File Moves & Creation

- **Move**: `src/app/page.tsx` → `src/app/(public)/page.tsx` (Serves `/`)
- **Move**: `src/app/layout.tsx` (Keep Root Layout here for Providers/Fonts)
- **Create**: `src/app/(public)/layout.tsx` (Public shell with Navbar/Footer)
- **Create**: `src/app/(public)/terms/page.tsx`
- **Create**: `src/app/(public)/privacy/page.tsx`
- **Create**: `src/app/(public)/help/page.tsx`

---

## 3. Implementation Steps

### Phase 1: Layout & Routing Architecture

#### Step 1.1: Public Layout (`src/app/(public)/layout.tsx`)

Create a new layout that wraps all public-facing pages.

- **Imports**: `Navbar` from `@/components/layout/navbar`, `Footer` from `@/components/layout/footer`.
- **Structure**:
  ```tsx
  export default function PublicLayout({
    children
  }: {
    children: React.ReactNode;
  }) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    );
  }
  ```
- **Constraint**: Ensure `Navbar` is removed from the specific page files to avoid duplication.

#### Step 1.2: Root Layout Cleanup (`src/app/layout.tsx`)

Ensure the root layout remains "pure" – only handling:

- `<html>` and `<body>` tags.
- Font injection (`Geist` or `Inter`).
- Global Providers (`ThemeProvider`, `QueryClientProvider`, `Toaster`).
- Metadata export.

### Phase 2: Functional Component Fixes

#### Step 2.1: Navbar Refinement (`src/components/layout/navbar.tsx`)

The user reported links to non-existent sections.

- **Action**: Verify `NAV_LINKS` configuration.
- **Fix**: Ensure links behave correctly across routes.
  - Links like `/#pricing` work fine on the homepage.
  - When on `/privacy`, `/#pricing` correctly redirects to `/` followed by a hash jump.
- **Requirement**: No complex client-side scroll logic needed if native `Link` behavior is preserved.

#### Step 2.2: Homepage Section Implementation (`src/app/(public)/page.tsx`)

The Navbar links to `#pricing` and `#about`, but these sections are missing.

- **Implement Pricing Section**:
  - **ID**: `pricing`
  - **Components**: 3 Cards (Hobby, Creator, Business). Use `Card`, `CardHeader`, `CardContent`, `CardFooter` from Shadcn.
  - **Data**: Mock data for now (Free vs Pro).
- **Implement About Section**:
  - **ID**: `about`
  - **Content**: Brief mission statement ("Make the web shorter").
- **Cleanup**: Remove the direct `<Navbar />` import since it's now in the layout.

#### Step 2.3: Footer Logic (`src/components/layout/footer.tsx`)

- **Review**: Ensure `footer.tsx` exports a functional component.
- **Updates**:
  - Link "Privacidade" → `/privacy`
  - Link "Termos de Uso" → `/terms`
  - Link "Ajuda" (or Docs) → `/help`
  - Update "Copyright" year to be dynamic `new Date().getFullYear()`.
  - Ensure links use `Link` component from `next/link`.

### Phase 3: Static Content Pages

#### Step 3.1: Legal Pages (`terms/page.tsx`, `privacy/page.tsx`)

- **Type**: Server Component (`export default function Page()`).
- **Metadata**: explicit `export const metadata: Metadata` for SEO.
- **Content Structure**:
  - Container: `container mx-auto py-10`.
  - Typography: Use standard Tailwind prose classes or explicit headings (`h1`, `h2`, `p`, `ul`).
  - Content: Use industry-standard placeholders (e.g., "Privacy Policy for Urlfy.cc").
- **Styling**: Consistent with the design system (Shadcn variable fonts).

#### Step 3.2: Help/Support Page (`help/page.tsx`)

- **Objective**: Simple FAQ or contact info.
- **Content**: "How to create a link?", "How to track analytics?".

---

## 4. Technical Requirements & Quality Assurance

### 4.1. Typing

- Explicit return types for components (e.g., `JSX.Element`).
- Metadata interface imports: `import type { Metadata } from 'next'`.

### 4.2. Accessibility (a11y)

- **Landmarks**: Ensure `<header>`, `<main>`, `<footer`> are used correctly in the layouts.
- **Headings**: Ensure `h1` starts the main content of every page.
- **Contrast**: Check muted text against background colors.

### 4.3. Code Style

- Use aliases `@/components/...` instead of relative paths.
- Keep "Business Logic" out of UI components (Separation of Concerns).

## 5. Execution Order

1.  **Refactor**: Create `(public)` folder and move `page.tsx`.
2.  **Scaffold**: Create `(public)/layout.tsx` and static page files.
3.  **Implement**: Fill content for Privacy, Terms, Pricing Section.
4.  **Verify**: Click all Navbar and Footer links to ensure they route or scroll correctly.
