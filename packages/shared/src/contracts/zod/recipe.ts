import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { measurementSystemEnum, recipes } from "@norish/db/schema";

import { RecipeImagesArraySchema, RecipeImageSchema } from "./recipe-images";
import {
  RecipeIngredientInputBaseSchema,
  RecipeIngredientInputSchema,
  RecipeIngredientsWithIdSchema,
} from "./recipe-ingredients";
import { RecipePlannerProfileSelectBaseSchema } from "./recipe-planner-profiles";
import { RecipeVideosArraySchema, RecipeVideoSchema } from "./recipe-videos";
import { StepStepSchema } from "./steps";
import { TagNameSchema } from "./tag";

export const recipeCategorySchema = z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]);

export const RecipeNutritionMetricSchema = z.object({
  label: z.string().nullable().optional(),
  value: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  raw: z.string().nullable().optional(),
});

export const RecipeNutritionDetailsSchema = z.object({
  servingSize: z.string().nullable().optional(),
  nutrients: z.record(z.string(), RecipeNutritionMetricSchema).default({}),
});

export const RecipeIngredientGroupSchema = z.object({
  purpose: z.string().nullable().optional(),
  ingredients: z.array(z.string()).default([]),
});

const NutritionDetailFilterSchema = z.preprocess((value) => {
  if (value === "extended") return "core";
  if (value === "missingExtended") return "missingCore";

  return value;
}, z.enum(["core", "complete", "missingCore"]));

export const RecipeSourceSummarySchema = z.object({
  siteName: z.string().nullable().optional(),
  sourceDomain: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
});

export const EmbeddedRecipePlannerProfileSchema = RecipePlannerProfileSelectBaseSchema.omit({
  id: true,
  recipeId: true,
  createdAt: true,
  updatedAt: true,
});

export const RecipeSelectBaseSchema = createSelectSchema(recipes).extend({
  userId: z.string().nullable(),
  nutritionDetails: RecipeNutritionDetailsSchema.nullable().optional(),
  ingredientGroups: z.array(RecipeIngredientGroupSchema).default([]),
});
export const RecipeInsertBaseSchema = createInsertSchema(recipes).omit({
  id: true,
  updatedAt: true,
  createdAt: true,
  userId: true, // set from session server-side
}).extend({
  nutritionDetails: RecipeNutritionDetailsSchema.nullable().optional(),
  ingredientGroups: z.array(RecipeIngredientGroupSchema).default([]),
});
export const RecipeUpdateBaseSchema = createUpdateSchema(recipes).extend({
  nutritionDetails: RecipeNutritionDetailsSchema.nullable().optional(),
  ingredientGroups: z.array(RecipeIngredientGroupSchema).optional(),
});

export const AuthorSchema = z
  .object({
    id: z.string(),
    name: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
  })
  .optional();

export const RecipeDashboardSchema = RecipeSelectBaseSchema.omit({
  systemUsed: true,
}).extend({
  fat: z.coerce.number().nullable().optional(),
  carbs: z.coerce.number().nullable().optional(),
  protein: z.coerce.number().nullable().optional(),
  recipeTypes: z.array(z.string()).default([]),
  tags: z.array(TagNameSchema).default([]),
  categories: z.array(recipeCategorySchema).default([]),
  author: AuthorSchema,
  averageRating: z.number().nullable().optional(),
  ratingCount: z.number().optional(),
  lastCookedAt: z.coerce.date().nullable().optional(),
  cookCount: z.number().optional(),
  source: RecipeSourceSummarySchema.nullable().optional(),
});

export const FullRecipeSchema = RecipeSelectBaseSchema.extend({
  recipeIngredients: z.array(RecipeIngredientsWithIdSchema),
  steps: z.array(StepStepSchema).default([]),
  tags: z.array(TagNameSchema).default([]),
  categories: z.array(recipeCategorySchema).default([]),
  plannerProfile: EmbeddedRecipePlannerProfileSchema.nullable().optional(),
  author: AuthorSchema,
  images: RecipeImagesArraySchema.default([]),
  videos: RecipeVideosArraySchema.default([]),
  lastCookedAt: z.coerce.date().nullable().optional(),
  cookCount: z.number().optional(),
  source: RecipeSourceSummarySchema.nullable().optional(),
});

export const FullRecipeInsertSchema = RecipeInsertBaseSchema.extend({
  id: z.uuid().optional(),
  recipeIngredients: z.array(RecipeIngredientInputSchema).default([]),
  tags: z.array(TagNameSchema).default([]),
  categories: z.array(recipeCategorySchema).default([]),
  plannerProfile: EmbeddedRecipePlannerProfileSchema.optional(),
  steps: z.array(StepStepSchema).default([]),
  images: z.array(RecipeImageSchema).max(10).default([]),
  videos: z.array(RecipeVideoSchema).default([]),
});

export const FullRecipeUpdateSchema = RecipeUpdateBaseSchema.extend({
  recipeIngredients: z.array(RecipeIngredientInputBaseSchema.partial()).optional(),
  tags: z.array(TagNameSchema).optional(),
  plannerProfile: EmbeddedRecipePlannerProfileSchema.optional(),
  steps: z.array(StepStepSchema).optional(),
  images: z.array(RecipeImageSchema).max(10).optional(),
  videos: z.array(RecipeVideoSchema).optional(),
});

export const measurementSystems = measurementSystemEnum.enumValues;

// tRPC input schemas
export const RecipeListInputSchema = z.object({
  cursor: z.number().int().nonnegative().default(0),
  limit: z.number().int().min(1).max(200).default(50),
  search: z.string().optional(),
  searchFields: z
    .array(z.enum(["title", "description", "ingredients", "steps", "tags"]))
    .default(["title", "ingredients"]),
  tags: z.array(z.string()).optional(),
  categories: z.array(z.enum(["Breakfast", "Lunch", "Dinner", "Snack"])).optional(),
  recipeTypes: z.array(z.string()).optional(),
  suitableSlots: z.array(z.string()).optional(),
  filterMode: z.enum(["AND", "OR"]).default("OR"),
  sortMode: z.enum(["titleAsc", "titleDesc", "dateAsc", "dateDesc", "none"]).default("dateDesc"),
  minRating: z.number().min(1).max(5).optional(),
  maxCookingTime: z.number().int().min(1).optional(),
  maxSodium: z.number().nonnegative().optional(),
  maxCholesterol: z.number().nonnegative().optional(),
  minFiber: z.number().nonnegative().optional(),
  sourceDomains: z.array(z.string()).optional(),
  nutritionDetail: NutritionDetailFilterSchema.optional(),
});

export const RecipeGetInputSchema = z.object({
  id: z.uuid(),
});

export const RecipeDeleteInputSchema = z.object({
  id: z.uuid(),
});

export const RecipeImportInputSchema = z.object({
  url: z.url(),
});

export const RecipeConvertInputSchema = z.object({
  recipeId: z.uuid(),
  targetSystem: z.enum(["metric", "us"]),
});

export const RecipeUpdateInputSchema = z.object({
  id: z.uuid(),
  data: FullRecipeUpdateSchema,
});

// Image import schemas
export const OcrImportFileSchema = z.object({
  data: z.string(), // base64 encoded
  mimeType: z.string(),
  filename: z.string(),
});

export const RecipeImageImportInputSchema = z.object({
  files: z.array(OcrImportFileSchema).min(1).max(10),
});
