import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { recipeCookEvents } from "@norish/db/schema";

export const RecipeCookEventSelectBaseSchema = createSelectSchema(recipeCookEvents);
export const RecipeCookEventInsertBaseSchema = createInsertSchema(recipeCookEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const RecipeCookEventUpdateBaseSchema = createUpdateSchema(recipeCookEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
