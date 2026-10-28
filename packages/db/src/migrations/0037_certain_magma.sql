CREATE TABLE "pantry_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_pantry_ingredients_user_name" UNIQUE("user_id","normalized_name")
);
--> statement-breakpoint
ALTER TABLE "pantry_ingredients" ADD CONSTRAINT "pantry_ingredients_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pantry_ingredients_user_id" ON "pantry_ingredients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pantry_ingredients_normalized_name" ON "pantry_ingredients" USING btree ("normalized_name");