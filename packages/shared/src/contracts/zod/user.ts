import z from "zod";

export const NutritionFocusMetricSchema = z.enum([
  "sodium",
  "cholesterol",
  "saturatedFat",
  "transFat",
  "fiber",
  "sugar",
]);

export const NutritionMetricTargetSchema = z.object({
  min: z.number().nullable().optional(),
  max: z.number().nullable().optional(),
});

export const NutritionMetricTargetsSchema = z
  .object({
    sodium: NutritionMetricTargetSchema.optional(),
    cholesterol: NutritionMetricTargetSchema.optional(),
    saturatedFat: NutritionMetricTargetSchema.optional(),
    transFat: NutritionMetricTargetSchema.optional(),
    fiber: NutritionMetricTargetSchema.optional(),
    sugar: NutritionMetricTargetSchema.optional(),
  })
  .partial();

export const UserPreferencesSchema = z.object({
  timersEnabled: z.boolean().optional(),
  showConversionButton: z.boolean().optional(),
  showRatings: z.boolean().optional(),
  showFavorites: z.boolean().optional(),
  locale: z.string().nullable().optional(),
  focusNutritionMetrics: z.array(NutritionFocusMetricSchema).optional(),
  nutritionTargets: NutritionMetricTargetsSchema.optional(),
});

export type UserPreferencesDto = z.infer<typeof UserPreferencesSchema>;
export type NutritionFocusMetricKey = z.infer<typeof NutritionFocusMetricSchema>;
export type NutritionMetricTargetDto = z.infer<typeof NutritionMetricTargetSchema>;
export type NutritionMetricTargetsDto = z.infer<typeof NutritionMetricTargetsSchema>;

// Not using createSelectSchema as we use encrypted fields and want to expose only decrypted ones
// Placed in db zod schemas as this is related to the user table and for ease of finding.
export const UserDtoSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  image: z.string().nullable().optional(),
  isServerAdmin: z.boolean().optional(),
  preferences: UserPreferencesSchema.optional(),
});
