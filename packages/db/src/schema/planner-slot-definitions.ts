import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { households } from "./households";

export const plannerSlotCategoryEnum = pgEnum("planner_slot_category", ["primary", "optional"]);
export const plannerSlotGroupEnum = pgEnum("planner_slot_group", ["meal", "snack", "workout"]);

export const plannerSlotDefinitions = pgTable(
  "planner_slot_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    category: plannerSlotCategoryEnum("category").notNull().default("primary"),
    slotGroup: plannerSlotGroupEnum("slot_group").notNull().default("meal"),
    sortOrder: integer("sort_order").notNull().default(0),
    isEnabled: boolean("is_enabled").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    allowMultiple: boolean("allow_multiple").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_planner_slot_definitions_household_key").on(t.householdId, t.key),
    index("idx_planner_slot_definitions_household_sort").on(t.householdId, t.sortOrder),
  ]
);
