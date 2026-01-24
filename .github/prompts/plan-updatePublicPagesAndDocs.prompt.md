# Implementation Plan: Project Showcase & Public Pages Refactor

## 🎯 Goal

Refactor the public-facing pages to explicitly position **urlfy.cc** as a high-quality portfolio/educational project rather than a commercial product. Create a deep-dive technical "About Project" page, remove pricing, and align legal documents with its non-commercial nature.

## 📦 Phase 1: Create "About Project" Page

**File:** `src/app/(public)/project/page.tsx`

### 1.1 Page Structure & Layout

- **Hero Section:**
  - Title: "Por trás do código: urlfy.cc"
  - Subtitle: "Uma jornada técnica sobre arquitetura, decisões e trade-offs no desenvolvimento de um encurtador de URLs moderno."
  - Badges: `Bun`, `ElysiaJS`, `Next.js 16`, `Docker`, `PostgreSQL`.
- **Architecture Section:**
  - Diagram/Explanation of the Hybrid Architecture (Next.js Frontend + Elysia API on Bun).
  - Justification for using Bun Native APIs (Password, File, Sql) vs Node.js.
- **Infrastructure & Stack:**
  - **Host:** Self-hosted approach with Docker Compose.
  - **Database:** PostgreSQL with Drizzle ORM (Type-safety focus).
  - **Cache:** Redis for rate-limiting and hot-path caching.
  - **Observability:** SigNoz/OpenTelemetry integration.
- **Technical Decisions & Trade-offs:**
  - _Decision:_ Type-safety First. _Impact:_ catch errors at build time.
  - _Decision:_ Feature-based MVC Pattern. _Impact:_ maintainability vs boilerplate.
  - _Decision:_ Event-driven Analytics (BullMQ). _Impact:_ Performance vs Complexity.
- **Business Impact (Simulated):**
  - High throughput handling.
  - Low latency SLOs (< 30ms redirects).
  - Cost efficiency (Monolith on Docker).
- **Author Section:**
  - Name: Gustavo Sotero
  - Portfolio Link: `https://gustavo-sotero.dev/`
  - GitHub Repo: `https://github.com/gustavo-sotero/urlfy.cc`
- **Call to Action:**
  - Link to `/api/docs` (Swagger).
  - Link to GitHub Repository.

### 1.2 Implementation Details

- **Metadata:** Use `Metadata` API for SEO.
- **Components:** Reuse `Card`, `Badge`, `Accordion` (for trade-offs), `Button` types from `@/components/ui`.
- **Typing:** Strict typing for any data structures used for rendering lists.

## 🛠️ Phase 2: Landing Page Refactor

**File:** `src/app/(public)/page.tsx`

### 2.1 Modifications

- **Project Disclaimer:**
  - Add a prominent `Alert` or Banner at the top: "Este projeto é um estudo de caso e portfólio. Não é um produto comercial."
- **Remove Pricing:**
  - Delete user-requested Pricing Section entirely from the DOM.
- **Add Author/Portfolio Section:**
  - New section: "Conheça o Desenvolvedor".
  - Bio: Gustavo Sotero.
  - Links: Portfolio, GitHub, LinkedIn (if available/implied).
- **Update Hero Actions:**
  - Update `HeroActions` if necessary to point to `/project` or Repo.

## 📝 Phase 3: Legal & Compliance Updates

**Files:** `src/app/(public)/terms/page.tsx`, `src/app/(public)/privacy/page.tsx`

### 3.1 Terms of Service (`terms/page.tsx`)

- **Modify Introduction:** Explicitly state the service is for **educational/demonstration purposes**.
- **Warranty Disclaimer:** Add "AS IS" clauses. No SLA guarantees. Data persistence is not guaranteed.
- **Usage Limits:** Mention fair use for testing purposes.

### 3.2 Privacy Policy (`privacy/page.tsx`)

- **Data Collection:** Clarify that collected data is for demonstration of analytics features.
- **Data Retention:** Mention that data may be wiped periodically (demo environment).
- **Compliance:** Keep LGPD/GDPR structure but contextualize for a non-commercial entity.

## 🧭 Phase 4: Navigation & Footer Updates

**Files:** `src/components/layout/navbar.tsx`, `src/components/layout/footer.tsx`

### 4.1 Navbar (`navbar.tsx`)

- **Update `NAV_LINKS`:**
  - Add: `{ href: '/project', label: 'O Projeto' }`.
  - Ensure `API Docs` link remains.

### 4.2 Footer (`footer.tsx`)

- **Remove:** "Preços" link.
- **Add/Update Columns:**
  - **Links Úteis:** Add "O Projeto", "API Docs", "Repositório".
  - **Autor:** Link to Portfolio (https://gustavo-sotero.dev/).

## ✅ Success Criteria

1.  **Landing Page:** No pricing, clear disclaimer, author info present.
2.  **Project Page:** Fully populated with architectural details and author links.
3.  **Navigation:** All links functional.
4.  **Legal:** Terms reflect non-commercial nature.
5.  **Type Safety:** No `any`, full strict mode compliance.
