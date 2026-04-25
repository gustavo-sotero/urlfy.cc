## Plan: Localized Error Surfaces for Next.js App Router + next-intl

### Goal

Introduce correct locale-aware error handling for the App Router portion of the web app by localizing error surfaces inside the `[locale]` segment while preserving global fallbacks for requests that are outside the next-intl routing boundary.

This plan explicitly does **not** start implementation. It defines the technical target state, file-level impact, sequencing, validation strategy, and rollback path.

### Decision Summary

Adopt a hybrid error-handling model:

1. Add a localized `error.tsx` inside `apps/web/src/app/[locale]/` for runtime errors that occur within the localized route tree.
2. Add a localized `not-found.tsx` inside `apps/web/src/app/[locale]/` for `notFound()` calls and unknown localized routes.
3. Add a localized catch-all route inside `apps/web/src/app/[locale]/[...rest]/page.tsx` that calls `notFound()`.
4. Preserve the existing root-level `app/error.tsx`, `app/not-found.tsx`, and `app/global-error.tsx` as global fallbacks for non-localized and root-level failures.
5. Reuse the existing `Errors` message namespace and expand it only where the new localized UI needs additional labels.

This is the most technically coherent option for the current repository because locale context is only established below `apps/web/src/app/[locale]/layout.tsx`, and the proxy intentionally keeps part of the app outside the i18n flow.

### Current State

#### Routing and locale boundary

- `apps/web/src/proxy.ts` initializes `next-intl` middleware with `createMiddleware(routing)`.
- The proxy only routes the request through `next-intl` when the path is `/` or already has a locale prefix.
- `apps/web/src/proxy.ts` also defines explicit system-route bypasses such as `/auth`, `/admin`, `/api`, `/ops`, and internal paths. These are intentionally outside the localized route tree.
- `apps/web/src/i18n/routing.ts` defines locales `en` and `pt-br`, with `defaultLocale: 'en'` and `localePrefix: 'always'`.
- `apps/web/src/i18n/request.ts` resolves the request locale and falls back to the default locale when the incoming locale is missing or invalid.

#### Locale provider placement

- `apps/web/src/app/[locale]/layout.tsx` is the only layout that validates the locale param, loads messages via `getMessages()`, and provides `NextIntlClientProvider`.
- As a consequence, only routes rendered below this layout have direct access to translated messages via `next-intl` hooks/components.

#### Current error surfaces

- `apps/web/src/app/not-found.tsx` is a root 404 page with hardcoded bilingual copy.
- `apps/web/src/app/error.tsx` is a root route-segment error boundary with hardcoded bilingual copy and browser error logging.
- `apps/web/src/app/global-error.tsx` is a root global error fallback that replaces the root layout when active and therefore cannot rely on the normal app tree.
- There is currently no localized `error.tsx` or localized `not-found.tsx` below `[locale]`.
- There is currently no localized catch-all route for unknown locale-prefixed URLs.

#### Test coverage state

- `apps/web/tests/unit/error-pages.test.ts` only asserts root-level error-page existence and hardcoded content assumptions.
- `apps/web/tests/integration/i18n-routing.test.ts` verifies locale configuration, slug reservation, and locale-prefix detection, but does not validate localized 404/error surfaces.

### Target State

After implementation, the app should behave as follows:

1. Requests to valid localized paths continue to work unchanged.
2. Requests to unknown localized paths such as `/en/unknown` or `/pt-br/unknown` render a localized 404 page from within the `[locale]` segment.
3. Runtime errors thrown inside localized pages/layout descendants render a localized error boundary inside the `[locale]` segment.
4. Requests outside the localized boundary continue to use the global fallback pages.
5. Invalid locale params continue to call `notFound()` in `apps/web/src/app/[locale]/layout.tsx`, and localized 404 rendering will still be possible because `apps/web/src/i18n/request.ts` falls back to the default locale when the locale is invalid.
6. The root-level `global-error.tsx` remains standalone and outside the normal next-intl provider chain.

### Non-Goals

The following items are explicitly out of scope for the first implementation phase:

- Localizing `apps/web/src/app/global-error.tsx` through the same provider-driven mechanism used by the localized app tree.
- Moving system routes such as `/auth` or `/admin` into the localized route tree.
- Refactoring the proxy to make auth/admin localized.
- Replacing the root fallback pages with locale-dependent root behavior.
- Broad redesign of the visual treatment of error screens.
- Adding experimental `global-not-found` support.

### Affected Files

| File | Change Type | Reason | Dependencies / Notes |
|------|-------------|--------|----------------------|
| `apps/web/src/app/[locale]/not-found.tsx` | Create | Localized 404 surface for the locale segment | Uses `next-intl`; should use localized navigation |
| `apps/web/src/app/[locale]/error.tsx` | Create | Localized runtime error boundary | Must be a Client Component; can reuse browser logging pattern |
| `apps/web/src/app/[locale]/[...rest]/page.tsx` | Create | Catch unknown localized routes and forward them to `notFound()` | Must not overshadow existing explicit routes |
| `apps/web/src/messages/en/errors.ts` | Modify | Add any missing labels needed by localized 404/error UI | Prefer extending existing `Errors` namespace |
| `apps/web/src/messages/pt-br/errors.ts` | Modify | Mirror English error message expansion | Keep key parity with English |
| `apps/web/tests/unit/error-pages.test.ts` | Modify | Cover localized error surfaces and stop assuming only root hardcoded content | Existing assertions are coupled to current root-only behavior |
| `apps/web/tests/integration/i18n-routing.test.ts` | Optional modify | Add contract checks for localized catch-all or preserved route precedence | Only if lightweight and valuable |
| `apps/web/src/app/not-found.tsx` | No change in phase 1 | Preserve root fallback | Optional later cleanup only |
| `apps/web/src/app/error.tsx` | No change in phase 1 | Preserve root fallback and logging | Optional later cleanup only |
| `apps/web/src/app/global-error.tsx` | No change | Must remain independent of normal provider tree | Keep standalone behavior |

### Reference Patterns to Reuse

| File | Pattern to Follow |
|------|-------------------|
| `apps/web/src/app/[locale]/layout.tsx` | Locale validation, provider boundary, message loading |
| `apps/web/src/app/[locale]/(public)/email-verification/page.tsx` | Localized page composition, `getTranslations`, localized `Link` usage |
| `apps/web/src/app/error.tsx` | Browser error logging, digest display, development-only detail block |
| `apps/web/src/components/error-boundary.tsx` | Existing translated error-boundary messaging model |
| `apps/web/src/messages/en/errors.ts` | Error-related namespace organization |
| `apps/web/src/messages/pt-br/errors.ts` | Portuguese key parity for errors |

### Technical Design Decisions

#### 1. Use segment-localized error files instead of root-level locale inference

The key architectural constraint is that `NextIntlClientProvider` only exists below `apps/web/src/app/[locale]/layout.tsx`. Therefore the correct integration point for translated error UI is **inside** that segment. Root-level error surfaces should remain generic fallbacks.

#### 2. Reuse the `Errors` namespace

The repository already centralizes error-facing copy in:

- `apps/web/src/messages/en/errors.ts`
- `apps/web/src/messages/pt-br/errors.ts`

The localized error surfaces should prefer this namespace to avoid creating a second, parallel error message schema.

Proposed message structure target:

- `Errors.notFound.title`
- `Errors.notFound.description`
- `Errors.notFound.backHome`
- `Errors.notFound.helpCenter` or equivalent additional CTA label if a secondary help button is retained
- `Errors.serverError.title`
- `Errors.serverError.description`
- `Errors.serverError.retry`
- `Errors.serverError.backHome` if the localized error page includes a home CTA
- `Errors.serverError.errorIdLabel` if digest display remains user-visible
- `Errors.serverError.detailsLabel` if the development details disclosure needs a translated label

If existing `Common` keys are a better fit for one or two labels such as `retry`, the implementation can still mix namespaces, but the primary copy should stay under `Errors`.

#### 3. Keep root fallbacks intact in phase 1

The current root pages remain necessary because the app includes intentionally non-localized routes. Preserving them avoids entangling the fix with unrelated routing changes.

#### 4. Use localized navigation within localized error surfaces

When linking back to home or help from localized error screens, use the i18n-aware navigation utilities from `@/i18n/routing` rather than root `next/link` when the link target is part of the localized app tree.

#### 5. Preserve existing error logging behavior

The new localized `apps/web/src/app/[locale]/error.tsx` should keep the same essential operational behavior already present in the root `apps/web/src/app/error.tsx`:

- report browser-visible errors through the existing logging utility
- surface `digest` when available
- show stack/details only in development

### Execution Plan

## Phase 0: Baseline and Invariants

### Step 0.1: Lock in behavior assumptions before editing

Document the invariants that must remain true after the change:

- localized routes still require valid locale prefixes according to `apps/web/src/i18n/routing.ts`
- invalid locales still trigger `notFound()` in `apps/web/src/app/[locale]/layout.tsx`
- system routes still bypass i18n in `apps/web/src/proxy.ts`
- root error surfaces remain available when rendering is outside the localized subtree

### Step 0.2: Confirm the message namespace strategy

Decide whether the localized error pages will use only `Errors` or combine `Errors` with `Common`. The default recommendation is:

- 404 page: use `Errors.notFound`
- localized error boundary: use `Errors.serverError` for title/description/retry and add `backHome`, `errorIdLabel`, and `detailsLabel` if needed

### Step 0.3: Confirm UI parity expectations

Decide whether the localized pages should visually mirror the current root pages or intentionally be simpler. The recommended first-phase choice is visual parity with minimal structural differences, because it reduces review complexity and limits churn.

## Phase 1: Localized Not Found Surface

### Step 1.1: Create `apps/web/src/app/[locale]/not-found.tsx`

Implementation intent:

- Make it a Server Component by default.
- Resolve translations from the active request locale using `next-intl`.
- Render locale-aware navigation back to home and optionally to help.
- Reuse existing visual primitives: `Button`, iconography, and layout classes similar to the root 404.

Technical details:

- Prefer using `getTranslations()` in the Server Component for deterministic server-side rendering.
- Use `Link` from `@/i18n/routing` for localized routes.
- Do not depend on a `params` prop, because `not-found.tsx` does not receive route params.
- Expect locale resolution to come from the request configuration in `apps/web/src/i18n/request.ts`.

### Step 1.2: Expand `Errors.notFound` if necessary

Add missing keys to both language files if the localized 404 UI needs:

- a help-center CTA label
- a richer description
- alternate labels for different 404 contexts

Keep key parity strict across English and Portuguese.

### Step 1.3: Decide metadata behavior for localized 404

Because the root `not-found.tsx` already exports metadata, the first implementation should not rely on adding locale-specific metadata to the segment-localized `not-found.tsx` unless the team explicitly wants that and verifies support in the current framework version.

Recommended phase-1 position:

- Leave metadata ownership with the root 404 for now.
- Focus the localized page on UI and locale-correct copy.

Verification for Phase 1:

- Static verification: file exists and imports are correct.
- Runtime expectation: `notFound()` thrown from within a localized route renders translated copy.

## Phase 2: Localized Error Boundary

### Step 2.1: Create `apps/web/src/app/[locale]/error.tsx`

Implementation intent:

- Mark as `'use client'`.
- Use `useTranslations` because it is a Client Component and will render under `NextIntlClientProvider` from `apps/web/src/app/[locale]/layout.tsx`.
- Mirror the core operational behavior of the root `apps/web/src/app/error.tsx`.

Technical details:

- Accept `error: Error & { digest?: string }`.
- Accept retry callback consistent with the current Next.js version in use. If the codebase stays with `reset`, preserve that pattern for consistency. If the team wants to adopt `unstable_retry`, treat that as a separate follow-up and not part of this first pass.
- Call `reportBrowserError(error, { context: { digest: error.digest ?? null } })` or the current equivalent used by the root error page.
- Keep development-only stack/details rendering gated by `process.env.NODE_ENV === 'development'`.
- Use translated labels for title, description, retry CTA, and any digest/details labels.
- Use localized navigation back to home via `@/i18n/routing` if a home button is included.

### Step 2.2: Expand `Errors.serverError` if necessary

Potential additional keys:

- `backHome`
- `errorIdLabel`
- `detailsLabel`

Only add the keys actually required by the UI. Avoid speculative message expansion.

### Step 2.3: Preserve root error page behavior

Do not delete or refactor `apps/web/src/app/error.tsx` in this phase. The localized error page supplements it for the localized subtree.

Verification for Phase 2:

- Static verification: localized error file exists and contains `useTranslations`.
- Runtime expectation: an error thrown inside a localized route renders translated text, not the root bilingual fallback.

## Phase 3: Localized Unknown Route Catch-All

### Step 3.1: Create `apps/web/src/app/[locale]/[...rest]/page.tsx`

Implementation intent:

- Make the page minimal.
- Immediately call `notFound()`.

Purpose:

- Convert unmatched locale-prefixed URLs into localized 404 rendering.
- Ensure `/en/unknown` and `/pt-br/unknown` render through the localized 404 instead of falling through to a root/global fallback.

### Step 3.2: Validate route precedence assumptions

Critical invariant:

- Explicit routes under `[locale]` must continue to win over the catch-all route.

Routes that must remain unaffected include at least:

- `apps/web/src/app/[locale]/(public)/page.tsx`
- `apps/web/src/app/[locale]/(public)/help/page.tsx`
- `apps/web/src/app/[locale]/(public)/email-verification/page.tsx`
- `apps/web/src/app/[locale]/(public)/preview/[code]/page.tsx`
- `apps/web/src/app/[locale]/(public)/unlock/[code]/page.tsx`
- `apps/web/src/app/[locale]/(auth)/login/page.tsx`
- `apps/web/src/app/[locale]/(auth)/signup/page.tsx`
- `apps/web/src/app/[locale]/(dashboard)/...`

This should be safe because App Router gives precedence to explicit routes over a generic catch-all, but it must still be validated.

### Step 3.3: Consider invalid locale behavior explicitly

When an invalid locale such as `/es/unknown` is requested:

- `apps/web/src/app/[locale]/layout.tsx` will call `notFound()` because the locale is not in the routing config.
- `apps/web/src/i18n/request.ts` falls back to `routing.defaultLocale` when the request locale is invalid.

This means the localized 404 may still render using the default locale for invalid locale params. That behavior is acceptable for phase 1 and should be documented as intentional.

Verification for Phase 3:

- `/en/unknown` renders localized 404 in English.
- `/pt-br/unknown` renders localized 404 in Portuguese.
- Valid localized routes continue to render normally.
- Invalid locale requests remain consistent and do not crash the provider tree.

## Phase 4: Test Plan Updates

### Step 4.1: Update `apps/web/tests/unit/error-pages.test.ts`

Current issue:

- The test file is coupled to root-only pages and hardcoded bilingual strings.

Update strategy:

- Keep assertions that root-level fallback files still exist.
- Add assertions that localized files now exist:
  - `src/app/[locale]/not-found.tsx`
  - `src/app/[locale]/error.tsx`
  - `src/app/[locale]/[...rest]/page.tsx`
- Replace content assertions that assume root-only hardcoded Portuguese/English text with assertions appropriate to the new architecture.
- Add assertions that the localized pages use translation APIs (`getTranslations` or `useTranslations`).
- Add assertions that the localized pages use i18n-aware links if applicable.

Recommended new test categories:

1. existence of root fallback error files
2. existence of localized error files
3. localized 404 uses translation-driven content
4. localized runtime error page is a client component and logs errors
5. catch-all route exists and calls `notFound()`

### Step 4.2: Add or adjust integration coverage only if justified

Candidate update to `apps/web/tests/integration/i18n-routing.test.ts`:

- Add a small contract test or file-structure assertion for the catch-all route if desired.

However, avoid overloading this test with rendering concerns if the current test suite structure is intentionally file-based and lightweight.

### Step 4.3: Prefer behavior-focused validation over brittle snapshot checks

The new tests should verify routing and localization behavior, not exact decorative class strings beyond what is needed to protect critical UI structure.

Verification for Phase 4:

- Unit tests pass after updating expectations.
- No unrelated routing tests regress.

## Phase 5: Manual Validation Matrix

### Localized 404 cases

- Visit `/en/unknown-route`
- Expected result: localized 404 in English

- Visit `/pt-br/unknown-route`
- Expected result: localized 404 in Portuguese

- Visit `/es/unknown-route`
- Expected result: no crash; fallback locale behavior remains coherent and renders a 404 path safely

### Localized error-boundary case

Temporarily force a runtime error in a localized page during development:

- use a reversible throw in a known localized route
- verify that the localized error boundary renders translated copy
- verify that digest/details behavior matches expectations
- verify browser logging still fires

### Regression checks for explicit route precedence

Verify that these continue to render their intended screens and are not swallowed by the catch-all:

- `/en`
- `/en/help`
- `/en/email-verification`
- `/en/preview/test123`
- `/en/unlock/test123`
- `/en/login`
- `/en/signup`
- `/en/dashboard`

### Non-localized/system route checks

Verify that the following remain outside the localized tree and still use global behavior as appropriate:

- `/auth/...`
- `/admin/...`
- `/api/...`
- `/ops/...`

## Validation Commands

All commands below are planned verification steps after implementation.

From `apps/web`:

- `bun run type-check`
- `bun test tests/unit/error-pages.test.ts`
- `bun test tests/integration/i18n-routing.test.ts`

Optional broader validation if the localized pages reuse components or message-loading paths that affect more UI:

- `bun test tests/unit/email-verification-page.test.tsx`
- `bun test tests/unit/login-page.test.tsx`
- `bun test tests/unit/signup-page.test.tsx`

### Complexity Assessment

#### Overall complexity

- Engineering complexity: Medium
- Risk of breaking unrelated routes: Low to Medium
- Risk of routing regressions if catch-all is misplaced: Medium
- Operational risk: Low

#### Why complexity is not low

The change is structurally simple but touches App Router special files, route precedence, locale fallback semantics, and tests that are currently coupled to root-only error pages.

#### Why complexity is not high

The change does not require proxy refactoring, auth/admin restructuring, or provider redesign. It adds the correct localized surfaces without removing the existing global fallback behavior.

### Risks and Mitigations

#### Risk 1: Catch-all route masks existing localized routes

Mitigation:

- Place the catch-all directly under `[locale]` only.
- Validate explicit route precedence manually and via tests.
- Do not add other broad dynamic routes during the same change set.

#### Risk 2: Invalid locale requests render with default-locale copy

Mitigation:

- Accept this as intentional for phase 1 because `apps/web/src/i18n/request.ts` already defines this fallback.
- Document it in the PR and plan.
- Revisit only if product requirements explicitly demand locale-sensitive invalid-locale handling.

#### Risk 3: Test suite remains coupled to root hardcoded strings

Mitigation:

- Update `apps/web/tests/unit/error-pages.test.ts` to assert architecture and translation usage rather than exact root-page copy only.

#### Risk 4: Localized `error.tsx` diverges operationally from root `error.tsx`

Mitigation:

- Reuse the same logging pattern and development-only details behavior.
- Keep the localized page focused on translation and navigation differences.

#### Risk 5: Team later expects auth/admin to be localized too

Mitigation:

- Explicitly state that this plan only localizes the `[locale]` subtree.
- Treat auth/admin localization as a separate architectural effort requiring proxy and route-layout decisions.

### Rollback Plan

If the localized error-surface rollout fails or introduces route regressions:

1. Remove `apps/web/src/app/[locale]/not-found.tsx`.
2. Remove `apps/web/src/app/[locale]/error.tsx`.
3. Remove `apps/web/src/app/[locale]/[...rest]/page.tsx`.
4. Revert message-key additions in `apps/web/src/messages/en/errors.ts`.
5. Revert message-key additions in `apps/web/src/messages/pt-br/errors.ts`.
6. Revert test updates in `apps/web/tests/unit/error-pages.test.ts`.
7. Revert any optional integration test changes.

Rollback safety is high because the existing global fallback pages remain intact throughout the entire implementation.

### Deliverable Breakdown for the Future Implementation PR

#### Required deliverables

- localized `apps/web/src/app/[locale]/not-found.tsx`
- localized `apps/web/src/app/[locale]/error.tsx`
- localized `apps/web/src/app/[locale]/[...rest]/page.tsx`
- updated English error messages
- updated Portuguese error messages
- updated unit coverage for error pages

#### Optional deliverables

- lightweight integration coverage for localized unknown-route behavior
- minor cleanup of root fallback copy once the localized path is stable

### Acceptance Criteria

The future implementation will be considered complete when all of the following are true:

1. Unknown localized URLs render a localized 404 page.
2. Runtime errors thrown inside localized routes render a localized error page.
3. Root/global fallback pages remain intact for non-localized or root-level failures.
4. No explicit localized routes are masked by the catch-all route.
5. Message keys remain in parity across English and Portuguese.
6. The updated error-page tests pass.
7. Type-check passes for the web app.
8. Manual validation confirms the localized surfaces behave correctly in both `en` and `pt-br`.

### Suggested Implementation Order

When implementation starts later, follow this exact order:

1. Update message files first.
2. Create localized `not-found.tsx`.
3. Create localized `error.tsx`.
4. Create localized catch-all route.
5. Update unit tests.
6. Run type-check and focused tests.
7. Perform manual route validation.
8. Only after successful validation, consider any optional cleanup of root fallback copy.

### Notes for Future Refinement

Potential follow-up questions to settle before coding:

- Should the localized 404 include a secondary help CTA, or just a home CTA?
- Should the localized error page mirror the root visual structure exactly, or can it be simplified?
- Should invalid locale segments always render in the default locale, or should they use a neutral global fallback instead?
- Should the root fallback pages remain bilingual, or become neutral once localized segment handling is added?

These questions do not block the core implementation.
