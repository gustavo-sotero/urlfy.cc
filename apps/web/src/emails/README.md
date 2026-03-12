# Email Shims — apps/web

This directory contains **thin re-export shims** that proxy to the canonical
email implementation in `@urlfy/email` (located at `packages/email/`).

## Directory Structure

```
src/emails/
├── render.ts   → re-exports renderEmail from @urlfy/email/render
├── types.ts    → re-exports type definitions from @urlfy/email/types
└── README.md   ← you are here
```

## Important

- **Do NOT add email components here.** All email templates live in
  `packages/email/src/components/`.
- These shims exist only so that app-local code can import from `@/emails/…`
  without a direct cross-workspace import.
- To add a new email template, see the `packages/email/` README.
