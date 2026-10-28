import { z } from "zod";

export const shoppingProjectionDayCountOptions = [7, 14, 28] as const;

const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD date");

export const ShoppingProjectionDayCountSchema = z.union([
  z.literal(7),
  z.literal(14),
  z.literal(28),
]);

export const ShoppingProjectionAisleSchema = z.enum([
  "Produce",
  "Protein",
  "Dairy",
  "Pantry",
  "Bakery",
  "General",
]);

export const ShoppingProjectionLifecycleSchema = z.enum(["stable", "perishable"]);

export const ShoppingProjectionSourceKindSchema = z.enum(["planner", "prep"]);

export const ShoppingProjectionSourceSchema = z.object({
  id: z.string(),
  sourceKind: ShoppingProjectionSourceKindSchema,
  recipeId: z.string(),
  recipeName: z.string(),
  contextLabel: z.string(),
  itemName: z.string(),
  qty: z.number(),
  unit: z.string(),
  date: DateStringSchema,
  weekIndex: z.number().int().min(0),
  role: z.string().optional(),
});

export const ShoppingProjectionItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  qty: z.number(),
  unit: z.string(),
  aisle: ShoppingProjectionAisleSchema,
  lifecycle: ShoppingProjectionLifecycleSchema,
  weekIndex: z.number().int().min(0),
  coversUntil: DateStringSchema.optional(),
  sources: z.array(ShoppingProjectionSourceSchema).default([]),
});

export const ShoppingProjectionWeekSchema = z.object({
  weekIndex: z.number().int().min(1),
  weekStart: DateStringSchema,
  weekEnd: DateStringSchema,
  items: z.array(ShoppingProjectionItemSchema),
});

export const ShoppingProjectionInputSchema = z.object({
  dayCount: ShoppingProjectionDayCountSchema.default(28),
  windowStart: DateStringSchema.optional(),
});

export const ShoppingProjectionResponseSchema = z.object({
  hasHousehold: z.boolean(),
  householdId: z.string().nullable(),
  householdPortionUnits: z.number().nonnegative(),
  activePeopleCount: z.number().int().min(0),
  dayCount: ShoppingProjectionDayCountSchema,
  windowStart: DateStringSchema,
  windowEnd: DateStringSchema,
  stableItems: z.array(ShoppingProjectionItemSchema),
  currentWeekItems: z.array(ShoppingProjectionItemSchema),
  upcomingWeeks: z.array(ShoppingProjectionWeekSchema),
  pantryItems: z.array(ShoppingProjectionItemSchema).default([]),
  pantryItemCount: z.number().int().min(0).default(0),
  totalItemCount: z.number().int().min(0),
});
