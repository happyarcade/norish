import { boolean, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { recipes } from "./recipes";

export const recipePlannerProfiles = pgTable(
  "recipe_planner_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    mealTypes: text("meal_types").array().notNull().default([]),
    suitableSlots: text("suitable_slots").array().notNull().default([]),
    recipeTypes: text("recipe_types").array().notNull().default([]),
    dietaryFlags: text("dietary_flags").array().notNull().default([]),
    allergenFlags: text("allergen_flags").array().notNull().default([]),
    cuisines: text("cuisines").array().notNull().default([]),
    heatLevel: text("heat_level"),
    prepScore: integer("prep_score"),
    fruitVegCount: numeric("fruit_veg_count", { precision: 4, scale: 1 }),
    isDivisible: boolean("is_divisible").notNull().default(true),
    isFreezerFriendly: boolean("is_freezer_friendly").notNull().default(false),
    sourceYield: text("source_yield"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_recipe_planner_profiles_recipe_id").on(t.recipeId),
    index("idx_recipe_planner_profiles_heat_level").on(t.heatLevel),
    index("idx_recipe_planner_profiles_prep_score").on(t.prepScore),
  ]
);
