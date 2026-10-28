import type { z } from "zod";

import type {
  PantryIngredientAddSchema,
  PantryIngredientReconcileSchema,
  PantryIngredientRemoveSchema,
  PantryIngredientSelectSchema,
  PantryIngredientUpdateSchema,
} from "@norish/shared/contracts/zod";

export type PantryIngredientDto = z.output<typeof PantryIngredientSelectSchema>;
export type PantryIngredientAddInput = z.infer<typeof PantryIngredientAddSchema>;
export type PantryIngredientReconcileInput = z.infer<typeof PantryIngredientReconcileSchema>;
export type PantryIngredientRemoveInput = z.infer<typeof PantryIngredientRemoveSchema>;
export type PantryIngredientUpdateInput = z.infer<typeof PantryIngredientUpdateSchema>;
