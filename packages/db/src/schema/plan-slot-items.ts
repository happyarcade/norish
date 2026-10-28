import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { planSlots } from "./plan-slots";
import { recipes } from "./recipes";

export const planSlotItemKindEnum = pgEnum("plan_slot_item_kind", ["recipe", "note"]);
export const planSlotItemRoleEnum = pgEnum("plan_slot_item_role", [
  "main",
  "side",
  "drink",
  "note",
]);

export type PlanSlotIngredientOverride = {
  recipeIngredientId: string;
  originalName: string;
  replacementName: string | null;
  action: "replace" | "omit";
  reason: string;
  source?: "dairy-free" | "lower-sodium" | "manual";
};

export const planSlotItems = pgTable(
  "plan_slot_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planSlotId: uuid("plan_slot_id")
      .notNull()
      .references(() => planSlots.id, { onDelete: "cascade" }),
    itemKind: planSlotItemKindEnum("item_kind").notNull().default("recipe"),
    role: planSlotItemRoleEnum("role").notNull().default("main"),
    sortOrder: integer("sort_order").notNull().default(0),
    recipeId: uuid("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
    title: text("title"),
    isConsumer: boolean("is_consumer").notNull().default(false),
    dairyFree: boolean("dairy_free").notNull().default(false),
    ingredientOverrides: jsonb("ingredient_overrides")
      .$type<PlanSlotIngredientOverride[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_plan_slot_items_plan_slot_id").on(t.planSlotId),
    index("idx_plan_slot_items_recipe_id").on(t.recipeId),
    index("idx_plan_slot_items_role").on(t.role),
  ]
);
