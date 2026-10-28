CREATE TYPE "public"."household_person_kind" AS ENUM('adult', 'child');--> statement-breakpoint
CREATE TABLE "household_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"linked_user_id" text,
	"display_name" text NOT NULL,
	"kind" "household_person_kind" DEFAULT 'adult' NOT NULL,
	"portion_factor" numeric(6, 2) DEFAULT '1' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_slot_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_slot_id" uuid NOT NULL,
	"household_person_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "household_people" ADD CONSTRAINT "household_people_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_people" ADD CONSTRAINT "household_people_linked_user_id_user_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_slot_people" ADD CONSTRAINT "plan_slot_people_plan_slot_id_plan_slots_id_fk" FOREIGN KEY ("plan_slot_id") REFERENCES "public"."plan_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_slot_people" ADD CONSTRAINT "plan_slot_people_household_person_id_household_people_id_fk" FOREIGN KEY ("household_person_id") REFERENCES "public"."household_people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_household_people_household" ON "household_people" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "idx_household_people_linked_user" ON "household_people" USING btree ("linked_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_household_people_household_linked_user" ON "household_people" USING btree ("household_id","linked_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_plan_slot_people_slot_person" ON "plan_slot_people" USING btree ("plan_slot_id","household_person_id");--> statement-breakpoint
CREATE INDEX "idx_plan_slot_people_slot" ON "plan_slot_people" USING btree ("plan_slot_id");--> statement-breakpoint
CREATE INDEX "idx_plan_slot_people_person" ON "plan_slot_people" USING btree ("household_person_id");