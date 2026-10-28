import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { recipeSources, recipeSourceTypeEnum } from "@norish/db/schema";

export const recipeSourceTypes = recipeSourceTypeEnum.enumValues;

export const RecipeSourceSelectBaseSchema = createSelectSchema(recipeSources).extend({
  rawPayload: z.unknown(),
});

export const RecipeSourceInsertBaseSchema = createInsertSchema(recipeSources)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    rawPayload: z.unknown(),
  });

export const RecipeSourceUpdateBaseSchema = createUpdateSchema(recipeSources)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    rawPayload: z.unknown().optional(),
  });
