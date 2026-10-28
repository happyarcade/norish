import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { recipes } from "./recipes";

export const recipeSourceTypeEnum = pgEnum("recipe_source_type", [
  "manual",
  "schema_org",
  "scraped",
  "url_import",
  "image_import",
  "video_import",
]);

export const recipeSources = pgTable(
  "recipe_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    sourceType: recipeSourceTypeEnum("source_type").notNull().default("manual"),
    sourceUrl: text("source_url"),
    sourceDomain: text("source_domain"),
    siteName: text("site_name"),
    author: text("author"),
    language: text("language"),
    rawPayload: jsonb("raw_payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_recipe_sources_recipe_id").on(t.recipeId),
    index("idx_recipe_sources_source_type").on(t.sourceType),
  ]
);
