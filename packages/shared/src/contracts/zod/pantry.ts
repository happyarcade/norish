import { createSelectSchema } from "drizzle-zod";
import z from "zod";

import { pantryIngredients, pantryIngredientStatuses } from "@norish/db/schema";
import { normalizeGroceryName } from "@norish/shared/lib/normalized-name";

export const PANTRY_INGREDIENT_NAME_MAX_LENGTH = 100;

export const PantryIngredientNameSchema = z
  .string()
  .trim()
  .min(1, "Pantry ingredient name is required")
  .max(PANTRY_INGREDIENT_NAME_MAX_LENGTH)
  .refine((name) => normalizeGroceryName(name) !== "", "Pantry ingredient name is required");

export const PantryIngredientSelectSchema = createSelectSchema(pantryIngredients).omit({
  createdAt: true,
  updatedAt: true,
});

export const PantryIngredientAddSchema = z.object({
  name: PantryIngredientNameSchema,
});

export const PantryIngredientStatusSchema = z.enum(pantryIngredientStatuses);

export const PantryIngredientUpdateSchema = z
  .object({
    id: z.uuid(),
    status: PantryIngredientStatusSchema.optional(),
    isStaple: z.boolean().optional(),
    confirm: z.boolean().optional(),
  })
  .refine(
    (input) => input.status !== undefined || input.isStaple !== undefined || input.confirm === true,
    "At least one pantry change is required"
  );

export const PantryIngredientRemoveSchema = z.object({
  id: z.uuid(),
});

export const PantryIngredientRemoveManySchema = z.object({
  ids: z.array(z.uuid()).min(1).max(100),
});

export const PantryIngredientReconcileSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.uuid(),
        outcome: z.enum(["on_hand", "low", "used_up"]),
      })
    )
    .min(1)
    .max(100)
    .refine(
      (items) => new Set(items.map((item) => item.id)).size === items.length,
      "Each pantry ingredient can only be reconciled once"
    ),
});
