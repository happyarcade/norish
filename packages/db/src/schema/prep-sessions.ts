import { date, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { households } from "./households";

export const prepSessions = pgTable(
  "prep_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    title: text("title"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_prep_sessions_household_date").on(t.householdId, t.date)]
);
