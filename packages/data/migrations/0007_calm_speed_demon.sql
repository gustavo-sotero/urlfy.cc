-- Better Auth 1.7 account identity (issuer) migration.
--
-- Better Auth 1.7 keys account rows by the compound identity
-- (issuer, accountId) and requires a unique index across both columns.
-- Existing 1.6 rows have no issuer value, so a plain ADD COLUMN NOT NULL
-- would fail. Follows the expand-and-contract sequencing prescribed by the
-- 1.7 upgrade guide ("provider-id" strategy):
--   1. Add `issuer` as nullable
--   2. Backfill deterministic provider-scoped namespaces
--   3. Make `issuer` NOT NULL
--   4. Create the unique compound index
--
-- Backfill rules ("provider-id" identity strategy, matching Better Auth's
-- createLocalAccountIssuer / createOAuthAccountIssuer and
-- @urlfy/auth-shared resolveAccountIssuer):
--   - provider_id = 'credential'  -> local:credential
--   - all other providers (github, google) -> local:oauth:<providerId>
--
-- NOTE: local:oauth names are built by string concatenation assuming the
-- provider IDs stored in this database are URI-safe (credential, github,
-- google are the only configured ones). If a custom provider ID containing
-- non-URI-safe characters is ever introduced, backfill it explicitly with
-- its percent-encoded namespace (encodeURIComponent semantics) BEFORE this
-- migration runs on any database.
--
-- Identity collision check (must return 0 rows before applying — duplicated
-- (issuer, accountId) rows will make the unique index fail):
--   SELECT issuer, account_id, COUNT(*) FROM account
--   GROUP BY issuer, account_id HAVING COUNT(*) > 1;

-- 1. Add the column as nullable so the backfill can populate it.
ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint
-- 2. Backfill: local credential namespace.
UPDATE "account"
SET "issuer" = 'local:credential'
WHERE "provider_id" = 'credential'
  AND "issuer" IS NULL;--> statement-breakpoint
-- 3. Backfill: deterministic OAuth provider namespaces.
UPDATE "account"
SET "issuer" = 'local:oauth:' || "provider_id"
WHERE "provider_id" <> 'credential'
  AND "issuer" IS NULL;--> statement-breakpoint
-- 4. Enforce the required constraint after every row is populated.
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
-- 5. Unique compound identity index required by Better Auth 1.7.
CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON "account" USING btree ("issuer","account_id");