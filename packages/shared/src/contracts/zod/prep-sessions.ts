import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { prepSessions } from "@norish/db/schema";

export const PrepSessionSelectBaseSchema = createSelectSchema(prepSessions);
export const PrepSessionInsertBaseSchema = createInsertSchema(prepSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const PrepSessionUpdateBaseSchema = createUpdateSchema(prepSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
