import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { planSlots, planSlotStatusEnum } from "@norish/db/schema";

export const planSlotStatuses = planSlotStatusEnum.enumValues;

export const PlanSlotSelectBaseSchema = createSelectSchema(planSlots);
export const PlanSlotInsertBaseSchema = createInsertSchema(planSlots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const PlanSlotUpdateBaseSchema = createUpdateSchema(planSlots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
