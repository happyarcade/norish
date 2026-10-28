import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { recipePlannerProfiles } from "@norish/db/schema";

export const RecipePlannerProfileSelectBaseSchema = createSelectSchema(recipePlannerProfiles).extend({
  fruitVegCount: z.coerce.number().nullable(),
});

export const RecipePlannerProfileInsertBaseSchema = createInsertSchema(recipePlannerProfiles)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    fruitVegCount: z.coerce.number().nullable().optional(),
  });

export const RecipePlannerProfileUpdateBaseSchema = createUpdateSchema(recipePlannerProfiles)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    fruitVegCount: z.coerce.number().nullable().optional(),
  });
