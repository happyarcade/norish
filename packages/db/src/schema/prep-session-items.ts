import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { prepSessions } from "./prep-sessions";
import { recipes } from "./recipes";

export const prepSessionItems = pgTable(
  "prep_session_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    prepSessionId: uuid("prep_session_id")
      .notNull()
      .references(() => prepSessions.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    batchCount: integer("batch_count").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    isFreezerBatch: boolean("is_freezer_batch").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_prep_session_items_session_id").on(t.prepSessionId),
    index("idx_prep_session_items_recipe_id").on(t.recipeId),
  ]
);
