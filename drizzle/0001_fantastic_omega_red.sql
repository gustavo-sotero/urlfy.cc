DROP INDEX "apikey_key_idx";--> statement-breakpoint
DROP INDEX "apikey_keyHash_idx";--> statement-breakpoint
ALTER TABLE "apikey" ALTER COLUMN "prefix" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "apikey" ALTER COLUMN "key_hash" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "apikey_prefix_idx" ON "apikey" USING btree ("prefix");--> statement-breakpoint
CREATE INDEX "apikey_keyHash_idx" ON "apikey" USING btree ("key_hash");--> statement-breakpoint
ALTER TABLE "apikey" DROP COLUMN "start";--> statement-breakpoint
ALTER TABLE "apikey" DROP COLUMN "key_prefix";--> statement-breakpoint
ALTER TABLE "apikey" DROP COLUMN "key";--> statement-breakpoint
ALTER TABLE "apikey" ADD CONSTRAINT "apikey_key_hash_unique" UNIQUE("key_hash");