import { boolean, date, index, integer, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { households } from "./households";
import { plannerSlotDefinitions } from "./planner-slot-definitions";

export const planSlotStatusEnum = pgEnum("plan_slot_status", ["neutral", "keep", "consider", "swap"]);

export const planSlots = pgTable(
  "plan_slots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    plannerSlotDefinitionId: uuid("planner_slot_definition_id")
      .notNull()
      .references(() => plannerSlotDefinitions.id, { onDelete: "cascade" }),
    status: planSlotStatusEnum("status").notNull().default("neutral"),
    isLocked: boolean("is_locked").notNull().default(false),
    batchMultiplier: integer("batch_multiplier").notNull().default(1),
    headcountOverride: integer("headcount_override"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_plan_slots_household_date_slot_definition").on(t.householdId, t.date, t.plannerSlotDefinitionId),
    index("idx_plan_slots_household_date").on(t.householdId, t.date),
    index("idx_plan_slots_slot_definition").on(t.plannerSlotDefinitionId),
  ]
);
