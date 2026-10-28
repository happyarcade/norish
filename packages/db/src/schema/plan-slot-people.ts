import { index, integer, pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { householdPeople } from "./household-people";
import { planSlots } from "./plan-slots";

export const planSlotPeople = pgTable(
  "plan_slot_people",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planSlotId: uuid("plan_slot_id")
      .notNull()
      .references(() => planSlots.id, { onDelete: "cascade" }),
    householdPersonId: uuid("household_person_id")
      .notNull()
      .references(() => householdPeople.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("uq_plan_slot_people_slot_person").on(t.planSlotId, t.householdPersonId),
    index("idx_plan_slot_people_slot").on(t.planSlotId),
    index("idx_plan_slot_people_person").on(t.householdPersonId),
  ]
);
