When a task is completed:
- Run bun run lint and bun run type-check if TypeScript changes were made.
- Run relevant tests (bun run test:unit, test:integration, or targeted tests).
- Update docs if behavior changes.
- Ensure Docker-related changes are reflected in docker-compose and README if needed.