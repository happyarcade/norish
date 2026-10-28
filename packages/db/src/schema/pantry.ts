import { boolean, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

export const pantryIngredientStatuses = ["on_hand", "low"] as const;

export const pantryIngredients = pgTable(
  "pantry_ingredients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    status: text("status")
      .$type<(typeof pantryIngredientStatuses)[number]>()
      .notNull()
      .default("on_hand"),
    isStaple: boolean("is_staple").notNull().default(false),
    lastConfirmedAt: timestamp("last_confirmed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_pantry_ingredients_user_id").on(t.userId),
    index("idx_pantry_ingredients_normalized_name").on(t.normalizedName),
    unique("uq_pantry_ingredients_user_name").on(t.userId, t.normalizedName),
  ]
);
