CREATE TABLE "contact_message" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"status" varchar(20) DEFAULT 'unread' NOT NULL,
	"telegram_sent" varchar(3) DEFAULT 'no' NOT NULL,
	"telegram_error" text,
	"consent_given" varchar(3) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "contactMessage_createdAt_idx" ON "contact_message" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "contactMessage_status_idx" ON "contact_message" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contactMessage_email_idx" ON "contact_message" USING btree ("email");