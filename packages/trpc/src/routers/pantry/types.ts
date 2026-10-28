import type { PantryIngredientDto } from "@norish/shared/contracts";

export type PantrySubscriptionEvents = {
  added: { item: PantryIngredientDto };
  updated: { item: PantryIngredientDto };
  removed: { itemId: string };
};
