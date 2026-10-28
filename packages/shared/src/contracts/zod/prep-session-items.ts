import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { prepSessionItems } from "@norish/db/schema";

export const PrepSessionItemSelectBaseSchema = createSelectSchema(prepSessionItems);
export const PrepSessionItemInsertBaseSchema = createInsertSchema(prepSessionItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const PrepSessionItemUpdateBaseSchema = createUpdateSchema(prepSessionItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
