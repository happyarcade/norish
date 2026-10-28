import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { planSlotPeople } from "@norish/db/schema";

export const PlanSlotPersonSelectBaseSchema = createSelectSchema(planSlotPeople);
export const PlanSlotPersonInsertBaseSchema = createInsertSchema(planSlotPeople).omit({
  id: true,
});
export const PlanSlotPersonUpdateBaseSchema = createUpdateSchema(planSlotPeople).omit({
  id: true,
});
