Code style and conventions:
- TypeScript strict enabled.
- Formatting via Biome: 2-space indentation, format-on-write.
- Prefer Bun native APIs (Bun.password, Bun.file, Bun SQL/Redis) over Node APIs.
- API implemented with Elysia; avoid Next.js pages/api routes unless explicitly needed.
- DB access via Drizzle and db.query.* helpers.
- Server-side resource init guarded with typeof window === "undefined" where needed.
- Keep business logic in src/server or src/lib, not UI components.
- TailwindCSS + Shadcn UI for UI components.

