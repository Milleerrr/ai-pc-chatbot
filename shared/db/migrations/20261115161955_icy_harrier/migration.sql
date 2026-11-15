CREATE TYPE "thinking_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "message_role" AS ENUM('system', 'user', 'assistant');--> statement-breakpoint
CREATE TYPE "message_status" AS ENUM('complete', 'stopped');--> statement-breakpoint
CREATE TABLE "build" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "build" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"build_id" uuid NOT NULL,
	"title" text,
	"title_is_manual" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp(6) with time zone,
	"deleted_at" timestamp(6) with time zone,
	"continued_from_id" uuid,
	"continuation_summary" text,
	"thinking_level" "thinking_level",
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"chat_id" uuid NOT NULL,
	"sequence" bigint GENERATED ALWAYS AS IDENTITY (sequence name "message_sequence_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"role" "message_role" NOT NULL,
	"parts" jsonb NOT NULL,
	"metadata" jsonb,
	"status" "message_status" DEFAULT 'complete'::"message_status" NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "build_userId_idx" ON "build" ("user_id");--> statement-breakpoint
CREATE INDEX "chat_userId_idx" ON "chat" ("user_id");--> statement-breakpoint
CREATE INDEX "chat_buildId_idx" ON "chat" ("build_id");--> statement-breakpoint
CREATE INDEX "message_userId_idx" ON "message" ("user_id");--> statement-breakpoint
CREATE INDEX "message_chatId_sequence_idx" ON "message" ("chat_id","sequence");--> statement-breakpoint
ALTER TABLE "build" ADD CONSTRAINT "build_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_build_id_build_id_fkey" FOREIGN KEY ("build_id") REFERENCES "build"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_continued_from_id_chat_id_fkey" FOREIGN KEY ("continued_from_id") REFERENCES "chat"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_chat_id_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chat"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "owner_isolation" ON "build" AS PERMISSIVE FOR ALL TO public USING ("build"."user_id" = (select nullif(current_setting('app.user_id', true), '')::uuid)) WITH CHECK ("build"."user_id" = (select nullif(current_setting('app.user_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "owner_isolation" ON "chat" AS PERMISSIVE FOR ALL TO public USING ("chat"."user_id" = (select nullif(current_setting('app.user_id', true), '')::uuid)) WITH CHECK ("chat"."user_id" = (select nullif(current_setting('app.user_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "owner_isolation" ON "message" AS PERMISSIVE FOR ALL TO public USING ("message"."user_id" = (select nullif(current_setting('app.user_id', true), '')::uuid)) WITH CHECK ("message"."user_id" = (select nullif(current_setting('app.user_id', true), '')::uuid));