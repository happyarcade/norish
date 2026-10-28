import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { households } from "./households";
import { planSlotItems } from "./plan-slot-items";
import { prepSessionItems } from "./prep-session-items";
import { recipes } from "./recipes";

export const recipeCookEventSourceEnum = pgEnum("recipe_cook_event_source", [
  "recipe_detail",
  "planner",
  "prep",
  "manual",
]);

export const recipeCookEvents = pgTable(
  "recipe_cook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    cookedAt: timestamp("cooked_at", { withTimezone: true }).notNull().defaultNow(),
    source: recipeCookEventSourceEnum("source").notNull().default("manual"),
    planSlotItemId: uuid("plan_slot_item_id").references(() => planSlotItems.id, {
      onDelete: "set null",
    }),
    prepSessionItemId: uuid("prep_session_item_id").references(() => prepSessionItems.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_recipe_cook_events_household_id").on(t.householdId),
    index("idx_recipe_cook_events_recipe_id").on(t.recipeId),
    index("idx_recipe_cook_events_user_id").on(t.userId),
    index("idx_recipe_cook_events_cooked_at").on(t.cookedAt),
    index("idx_recipe_cook_events_plan_slot_item_id").on(t.planSlotItemId),
    index("idx_recipe_cook_events_prep_session_item_id").on(t.prepSessionItemId),
  ]
);
