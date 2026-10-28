CREATE TYPE "public"."recipe_cook_event_source" AS ENUM('recipe_detail', 'planner', 'prep', 'manual');--> statement-breakpoint
CREATE TABLE "recipe_cook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"user_id" text,
	"cooked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "recipe_cook_event_source" DEFAULT 'manual' NOT NULL,
	"plan_slot_item_id" uuid,
	"prep_session_item_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe_cook_events" ADD CONSTRAINT "recipe_cook_events_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_cook_events" ADD CONSTRAINT "recipe_cook_events_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_cook_events" ADD CONSTRAINT "recipe_cook_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_cook_events" ADD CONSTRAINT "recipe_cook_events_plan_slot_item_id_plan_slot_items_id_fk" FOREIGN KEY ("plan_slot_item_id") REFERENCES "public"."plan_slot_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_cook_events" ADD CONSTRAINT "recipe_cook_events_prep_session_item_id_prep_session_items_id_fk" FOREIGN KEY ("prep_session_item_id") REFERENCES "public"."prep_session_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_recipe_cook_events_household_id" ON "recipe_cook_events" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_cook_events_recipe_id" ON "recipe_cook_events" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_cook_events_user_id" ON "recipe_cook_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_cook_events_cooked_at" ON "recipe_cook_events" USING btree ("cooked_at");--> statement-breakpoint
CREATE INDEX "idx_recipe_cook_events_plan_slot_item_id" ON "recipe_cook_events" USING btree ("plan_slot_item_id");--> statement-breakpoint
CREATE INDEX "idx_recipe_cook_events_prep_session_item_id" ON "recipe_cook_events" USING btree ("prep_session_item_id");
