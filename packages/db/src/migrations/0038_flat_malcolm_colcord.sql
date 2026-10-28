ALTER TABLE "pantry_ingredients" ADD COLUMN "status" text DEFAULT 'on_hand' NOT NULL;--> statement-breakpoint
ALTER TABLE "pantry_ingredients" ADD COLUMN "is_staple" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pantry_ingredients" ADD COLUMN "last_confirmed_at" timestamp with time zone DEFAULT now() NOT NULL;