import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { recipeImportReviews } from "@norish/db/schema";

import { recipeCategorySchema } from "./recipe";

export const RecipeImportReviewSelectBaseSchema = createSelectSchema(recipeImportReviews).extend({
  issues: z.array(z.string()).default([]),
  confidenceByField: z.record(z.string(), z.number()).default({}),
  inferredData: z.record(z.string(), z.unknown()).default({}),
  reviewOverrides: z.record(z.string(), z.unknown()).default({}),
});

export const RecipeImportReviewInsertBaseSchema = createInsertSchema(recipeImportReviews)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    issues: z.array(z.string()).default([]),
    confidenceByField: z.record(z.string(), z.number()).default({}),
    inferredData: z.record(z.string(), z.unknown()).default({}),
    reviewOverrides: z.record(z.string(), z.unknown()).default({}),
  });

export const RecipeImportReviewUpdateBaseSchema = createUpdateSchema(recipeImportReviews)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    issues: z.array(z.string()).optional(),
    confidenceByField: z.record(z.string(), z.number()).optional(),
    inferredData: z.record(z.string(), z.unknown()).optional(),
    reviewOverrides: z.record(z.string(), z.unknown()).optional(),
  });

export const RecipeMetadataReviewItemSchema = z.object({
  recipeId: z.uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  categories: z.array(recipeCategorySchema).default([]),
  recipeTypes: z.array(z.string()).default([]),
  suitableSlots: z.array(z.string()).default([]),
  inferredRecipeTypes: z.array(z.string()).default([]),
  inferredSuitableSlots: z.array(z.string()).default([]),
  issues: z.array(z.string()).default([]),
  confidenceByField: z.record(z.string(), z.number()).default({}),
  needsReview: z.boolean().default(false),
  reviewedAt: z.coerce.date().nullable().optional(),
});

export const RecipeMetadataReviewListInputSchema = z.object({
  limit: z.number().int().min(1).max(200).default(100),
  includeAll: z.boolean().default(false),
  search: z.string().trim().min(1).max(120).optional(),
});

export const RecipeMetadataReviewSaveInputSchema = z.object({
  recipeId: z.uuid(),
  recipeTypes: z.array(z.string()).default([]),
  suitableSlots: z.array(z.string()).default([]),
});

export const NutritionAuditIssueCodeSchema = z.enum([
  "missing_nutrition",
  "invalid_value",
  "macro_calorie_mismatch",
  "high_calories",
  "high_sodium",
  "high_cholesterol",
  "high_saturated_fat",
  "high_trans_fat",
  "high_sugar",
  "implausible_macro",
  "unexpected_unit",
  "likely_whole_recipe",
]);

export const NutritionAuditIssueSchema = z.object({
  code: NutritionAuditIssueCodeSchema,
  severity: z.enum(["info", "warning", "critical"]),
  message: z.string(),
  metric: z.string().optional(),
  value: z.number().optional(),
});

export const NutritionAuditValuesSchema = z.object({
  calories: z.number().nullable(),
  fat: z.number().nullable(),
  carbs: z.number().nullable(),
  protein: z.number().nullable(),
  sodium: z.number().nullable(),
  cholesterol: z.number().nullable(),
  saturatedFat: z.number().nullable(),
  transFat: z.number().nullable(),
  fiber: z.number().nullable(),
  sugar: z.number().nullable(),
});

export const RecipeNutritionReviewItemSchema = z.object({
  recipeId: z.uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  servings: z.number().int().positive(),
  nutrition: NutritionAuditValuesSchema,
  suggestedNutrition: NutritionAuditValuesSchema.nullable(),
  audit: z.object({
    status: z.enum(["missing", "credible", "review"]),
    confidence: z.enum(["missing", "basic", "extended", "rich"]),
    confidenceScore: z.number().min(0).max(1),
    issues: z.array(NutritionAuditIssueSchema),
    suggestedAction: z.enum(["none", "review", "divideByServings"]),
  }),
  reviewed: z.boolean(),
});

export const RecipeNutritionReviewListInputSchema = z.object({
  limit: z.number().int().min(1).max(200).default(100),
  includeMissing: z.boolean().default(false),
  includeReviewed: z.boolean().default(false),
  search: z.string().trim().min(1).max(120).optional(),
});

export const RecipeNutritionReviewResponseSchema = z.object({
  items: z.array(RecipeNutritionReviewItemSchema),
  summary: z.object({
    total: z.number().int().nonnegative(),
    credible: z.number().int().nonnegative(),
    needsReview: z.number().int().nonnegative(),
    missing: z.number().int().nonnegative(),
    reviewed: z.number().int().nonnegative(),
  }),
});

export const RecipeNutritionReviewSaveInputSchema = z.object({
  recipeId: z.uuid(),
  action: z.enum(["confirm", "divideByServings"]),
});
