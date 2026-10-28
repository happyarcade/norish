ALTER TABLE "recipes" ADD COLUMN "ingredient_groups" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE TABLE "recipe_import_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"source_fingerprint" text,
	"needs_review" boolean DEFAULT false NOT NULL,
	"issues" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"confidence_by_field" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"inferred_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"review_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe_import_reviews" ADD CONSTRAINT "recipe_import_reviews_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_import_reviews" ADD CONSTRAINT "recipe_import_reviews_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_recipe_import_reviews_recipe_id" ON "recipe_import_reviews" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_import_reviews_needs_review" ON "recipe_import_reviews" USING btree ("needs_review");--> statement-breakpoint
CREATE INDEX "idx_recipe_import_reviews_reviewed_at" ON "recipe_import_reviews" USING btree ("reviewed_at");
