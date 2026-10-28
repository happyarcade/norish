import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { plannerSlotCategoryEnum, plannerSlotDefinitions, plannerSlotGroupEnum } from "@norish/db/schema";

export const plannerSlotCategories = plannerSlotCategoryEnum.enumValues;
export const plannerSlotGroups = plannerSlotGroupEnum.enumValues;

export const PlannerSlotDefinitionSelectBaseSchema = createSelectSchema(plannerSlotDefinitions);
export const PlannerSlotDefinitionInsertBaseSchema = createInsertSchema(plannerSlotDefinitions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const PlannerSlotDefinitionUpdateBaseSchema = createUpdateSchema(plannerSlotDefinitions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
