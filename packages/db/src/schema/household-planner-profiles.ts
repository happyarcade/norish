import { boolean, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { households } from "./households";

export const householdPlannerProfiles = pgTable(
  "household_planner_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    planningGoal: text("planning_goal"),
    eatingPattern: text("eating_pattern"),
    snackCount: integer("snack_count").notNull().default(1),
    customMealCount: integer("custom_meal_count"),
    preWorkoutEnabled: boolean("pre_workout_enabled").notNull().default(false),
    postWorkoutEnabled: boolean("post_workout_enabled").notNull().default(false),
    shoppingWindowDays: integer("shopping_window_days").notNull().default(28),
    defaultCalorieTarget: integer("default_calorie_target"),
    defaultProteinTarget: numeric("default_protein_target", { precision: 6, scale: 2 }),
    defaultCarbTarget: numeric("default_carb_target", { precision: 6, scale: 2 }),
    defaultFatTarget: numeric("default_fat_target", { precision: 6, scale: 2 }),
    defaultFibreTarget: numeric("default_fibre_target", { precision: 6, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_household_planner_profiles_household_id").on(t.householdId),
    index("idx_household_planner_profiles_goal").on(t.planningGoal),
  ]
);
