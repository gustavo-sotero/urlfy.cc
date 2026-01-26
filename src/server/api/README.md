# Deprecated API Directory

This directory (`src/server/api`) contains legacy API route implementations that are being migrated to the feature-based module structure in `src/server/modules`.

## Migration Status

- New features should be implemented in `src/server/modules`.
- Existing routes in this directory are imported in `src/server/index.ts` for backward compatibility but should be refactored into modules.
- **Do not add new files here.**

## Architecture

See `docs/architecture/overview.md` for details on the target architecture.
