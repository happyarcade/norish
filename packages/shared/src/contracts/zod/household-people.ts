import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { householdPeople } from "@norish/db/schema";

export const HouseholdPersonSelectBaseSchema = createSelectSchema(householdPeople).extend({
  portionFactor: z.coerce.number(),
});

export const HouseholdPersonInsertBaseSchema = createInsertSchema(householdPeople)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    portionFactor: z.coerce.number().positive().optional(),
  });

export const HouseholdPersonUpdateBaseSchema = createUpdateSchema(householdPeople)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    portionFactor: z.coerce.number().positive().optional(),
  });
