ALTER TABLE "data_deletion_request" ADD COLUMN IF NOT EXISTS "processing_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "data_deletion_request" ADD COLUMN IF NOT EXISTS "processing_lease_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "data_deletion_request" ADD COLUMN IF NOT EXISTS "processing_owner" text;--> statement-breakpoint
ALTER TABLE "data_deletion_request" ADD COLUMN IF NOT EXISTS "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dataDeletionRequest_processingLease_idx" ON "data_deletion_request" USING btree ("status","processing_lease_expires_at");
