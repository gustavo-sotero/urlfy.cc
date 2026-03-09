ALTER TABLE "audit_log" DROP CONSTRAINT IF EXISTS "audit_log_user_id_user_id_fk";
ALTER TABLE "audit_log" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "audit_log"
  ADD CONSTRAINT "audit_log_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
  ON DELETE set null ON UPDATE no action;

ALTER TABLE "data_deletion_request" DROP CONSTRAINT IF EXISTS "data_deletion_request_user_id_user_id_fk";
ALTER TABLE "data_deletion_request" ADD COLUMN IF NOT EXISTS "user_id_snapshot" text;
UPDATE "data_deletion_request"
SET "user_id_snapshot" = COALESCE("user_id_snapshot", "user_id")
WHERE "user_id_snapshot" IS NULL;
ALTER TABLE "data_deletion_request" ALTER COLUMN "user_id_snapshot" SET NOT NULL;
ALTER TABLE "data_deletion_request" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "data_deletion_request"
  ADD CONSTRAINT "data_deletion_request_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
  ON DELETE set null ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "dataDeletionRequest_userIdSnapshot_idx"
  ON "data_deletion_request" USING btree ("user_id_snapshot");