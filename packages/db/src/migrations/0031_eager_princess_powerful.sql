CREATE TYPE "public"."recipe_source_type" AS ENUM('manual', 'schema_org', 'scraped', 'url_import', 'image_import', 'video_import');--> statement-breakpoint
CREATE TYPE "public"."planner_slot_category" AS ENUM('primary', 'optional');--> statement-breakpoint
CREATE TYPE "public"."planner_slot_group" AS ENUM('meal', 'snack', 'workout');--> statement-breakpoint
CREATE TYPE "public"."plan_slot_status" AS ENUM('neutral', 'keep', 'consider', 'swap');--> statement-breakpoint
CREATE TYPE "public"."plan_slot_item_kind" AS ENUM('recipe', 'note');--> statement-breakpoint
CREATE TYPE "public"."plan_slot_item_role" AS ENUM('main', 'side', 'drink', 'note');--> statement-breakpoint
CREATE TABLE "recipe_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"source_type" "recipe_source_type" DEFAULT 'manual' NOT NULL,
	"source_url" text,
	"source_domain" text,
	"site_name" text,
	"author" text,
	"language" text,
	"raw_payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_planner_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"meal_types" text[] DEFAULT '{}' NOT NULL,
	"suitable_slots" text[] DEFAULT '{}' NOT NULL,
	"recipe_types" text[] DEFAULT '{}' NOT NULL,
	"dietary_flags" text[] DEFAULT '{}' NOT NULL,
	"allergen_flags" text[] DEFAULT '{}' NOT NULL,
	"cuisines" text[] DEFAULT '{}' NOT NULL,
	"heat_level" text,
	"prep_score" integer,
	"fruit_veg_count" numeric(4, 1),
	"is_divisible" boolean DEFAULT true NOT NULL,
	"is_freezer_friendly" boolean DEFAULT false NOT NULL,
	"source_yield" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_planner_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"planning_goal" text,
	"eating_pattern" text,
	"snack_count" integer DEFAULT 1 NOT NULL,
	"custom_meal_count" integer,
	"pre_workout_enabled" boolean DEFAULT false NOT NULL,
	"post_workout_enabled" boolean DEFAULT false NOT NULL,
	"shopping_window_days" integer DEFAULT 28 NOT NULL,
	"default_calorie_target" integer,
	"default_protein_target" numeric(6, 2),
	"default_carb_target" numeric(6, 2),
	"default_fat_target" numeric(6, 2),
	"default_fibre_target" numeric(6, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planner_slot_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"category" "planner_slot_category" DEFAULT 'primary' NOT NULL,
	"slot_group" "planner_slot_group" DEFAULT 'meal' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"allow_multiple" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"date" date NOT NULL,
	"planner_slot_definition_id" uuid NOT NULL,
	"status" "plan_slot_status" DEFAULT 'neutral' NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"batch_multiplier" integer DEFAULT 1 NOT NULL,
	"headcount_override" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_slot_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_slot_id" uuid NOT NULL,
	"item_kind" "plan_slot_item_kind" DEFAULT 'recipe' NOT NULL,
	"role" "plan_slot_item_role" DEFAULT 'main' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"recipe_id" uuid,
	"title" text,
	"is_consumer" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prep_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"date" date NOT NULL,
	"title" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prep_session_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prep_session_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"batch_count" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"is_freezer_batch" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD COLUMN "raw_line" text;--> statement-breakpoint
ALTER TABLE "recipe_sources" ADD CONSTRAINT "recipe_sources_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_planner_profiles" ADD CONSTRAINT "recipe_planner_profiles_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_planner_profiles" ADD CONSTRAINT "household_planner_profiles_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_slot_definitions" ADD CONSTRAINT "planner_slot_definitions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_slots" ADD CONSTRAINT "plan_slots_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_slots" ADD CONSTRAINT "plan_slots_planner_slot_definition_id_planner_slot_definitions_id_fk" FOREIGN KEY ("planner_slot_definition_id") REFERENCES "public"."planner_slot_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_slot_items" ADD CONSTRAINT "plan_slot_items_plan_slot_id_plan_slots_id_fk" FOREIGN KEY ("plan_slot_id") REFERENCES "public"."plan_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_slot_items" ADD CONSTRAINT "plan_slot_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_sessions" ADD CONSTRAINT "prep_sessions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_session_items" ADD CONSTRAINT "prep_session_items_prep_session_id_prep_sessions_id_fk" FOREIGN KEY ("prep_session_id") REFERENCES "public"."prep_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_session_items" ADD CONSTRAINT "prep_session_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_recipe_sources_recipe_id" ON "recipe_sources" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_sources_source_type" ON "recipe_sources" USING btree ("source_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_recipe_planner_profiles_recipe_id" ON "recipe_planner_profiles" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_planner_profiles_heat_level" ON "recipe_planner_profiles" USING btree ("heat_level");--> statement-breakpoint
CREATE INDEX "idx_recipe_planner_profiles_prep_score" ON "recipe_planner_profiles" USING btree ("prep_score");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_household_planner_profiles_household_id" ON "household_planner_profiles" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "idx_household_planner_profiles_goal" ON "household_planner_profiles" USING btree ("planning_goal");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_planner_slot_definitions_household_key" ON "planner_slot_definitions" USING btree ("household_id","key");--> statement-breakpoint
CREATE INDEX "idx_planner_slot_definitions_household_sort" ON "planner_slot_definitions" USING btree ("household_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_plan_slots_household_date_slot_definition" ON "plan_slots" USING btree ("household_id","date","planner_slot_definition_id");--> statement-breakpoint
CREATE INDEX "idx_plan_slots_household_date" ON "plan_slots" USING btree ("household_id","date");--> statement-breakpoint
CREATE INDEX "idx_plan_slots_slot_definition" ON "plan_slots" USING btree ("planner_slot_definition_id");--> statement-breakpoint
CREATE INDEX "idx_plan_slot_items_plan_slot_id" ON "plan_slot_items" USING btree ("plan_slot_id");--> statement-breakpoint
CREATE INDEX "idx_plan_slot_items_recipe_id" ON "plan_slot_items" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "idx_plan_slot_items_role" ON "plan_slot_items" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_prep_sessions_household_date" ON "prep_sessions" USING btree ("household_id","date");--> statement-breakpoint
CREATE INDEX "idx_prep_session_items_session_id" ON "prep_session_items" USING btree ("prep_session_id");--> statement-breakpoint
CREATE INDEX "idx_prep_session_items_recipe_id" ON "prep_session_items" USING btree ("recipe_id");