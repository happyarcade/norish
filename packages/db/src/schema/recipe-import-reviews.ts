import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { recipes } from "./recipes";

type RecipeImportReviewData = Record<string, unknown>;
type RecipeImportReviewConfidence = Record<string, number>;

export const recipeImportReviews = pgTable(
  "recipe_import_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    sourceFingerprint: text("source_fingerprint"),
    needsReview: boolean("needs_review").notNull().default(false),
    issues: text("issues").array().notNull().default([]),
    confidenceByField: jsonb("confidence_by_field")
      .$type<RecipeImportReviewConfidence>()
      .notNull()
      .default({}),
    inferredData: jsonb("inferred_data").$type<RecipeImportReviewData>().notNull().default({}),
    reviewOverrides: jsonb("review_overrides").$type<RecipeImportReviewData>().notNull().default({}),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_recipe_import_reviews_recipe_id").on(t.recipeId),
    index("idx_recipe_import_reviews_needs_review").on(t.needsReview),
    index("idx_recipe_import_reviews_reviewed_at").on(t.reviewedAt),
  ]
);
