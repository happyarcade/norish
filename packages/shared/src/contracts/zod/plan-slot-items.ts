import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";

import { planSlotItemKindEnum, planSlotItemRoleEnum, planSlotItems } from "@norish/db/schema";

export const planSlotItemKinds = planSlotItemKindEnum.enumValues;
export const planSlotItemRoles = planSlotItemRoleEnum.enumValues;

export const PlanSlotIngredientOverrideSchema = z.object({
  recipeIngredientId: z.uuid(),
  originalName: z.string().trim().min(1),
  replacementName: z.string().trim().min(1).nullable(),
  action: z.enum(["replace", "omit"]),
  reason: z.string().trim().min(1),
  source: z.enum(["dairy-free", "lower-sodium", "manual"]).optional(),
});

export const PlanSlotItemSelectBaseSchema = createSelectSchema(planSlotItems).extend({
  ingredientOverrides: z.array(PlanSlotIngredientOverrideSchema),
});
export const PlanSlotItemInsertBaseSchema = createInsertSchema(planSlotItems)
  .extend({
    ingredientOverrides: z.array(PlanSlotIngredientOverrideSchema).optional(),
  })
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });
export const PlanSlotItemUpdateBaseSchema = createUpdateSchema(planSlotItems)
  .extend({
    ingredientOverrides: z.array(PlanSlotIngredientOverrideSchema).optional(),
  })
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });
