import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { householdPlannerProfiles } from "@norish/db/schema";

export const HouseholdPlannerProfileSelectBaseSchema = createSelectSchema(householdPlannerProfiles).extend({
  defaultProteinTarget: z.coerce.number().nullable(),
  defaultCarbTarget: z.coerce.number().nullable(),
  defaultFatTarget: z.coerce.number().nullable(),
  defaultFibreTarget: z.coerce.number().nullable(),
});

export const HouseholdPlannerProfileInsertBaseSchema = createInsertSchema(householdPlannerProfiles)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    defaultProteinTarget: z.coerce.number().nullable().optional(),
    defaultCarbTarget: z.coerce.number().nullable().optional(),
    defaultFatTarget: z.coerce.number().nullable().optional(),
    defaultFibreTarget: z.coerce.number().nullable().optional(),
  });

export const HouseholdPlannerProfileUpdateBaseSchema = createUpdateSchema(householdPlannerProfiles)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    defaultProteinTarget: z.coerce.number().nullable().optional(),
    defaultCarbTarget: z.coerce.number().nullable().optional(),
    defaultFatTarget: z.coerce.number().nullable().optional(),
    defaultFibreTarget: z.coerce.number().nullable().optional(),
  });
