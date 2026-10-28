import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { households } from "./households";

export const householdPersonKindEnum = pgEnum("household_person_kind", ["adult", "child"]);

export const householdPeople = pgTable(
  "household_people",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    linkedUserId: text("linked_user_id").references(() => users.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    kind: householdPersonKindEnum("kind").notNull().default("adult"),
    portionFactor: numeric("portion_factor", { precision: 6, scale: 2 }).notNull().default("1"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_household_people_household").on(t.householdId),
    index("idx_household_people_linked_user").on(t.linkedUserId),
    uniqueIndex("uq_household_people_household_linked_user").on(t.householdId, t.linkedUserId),
  ]
);
