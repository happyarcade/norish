import type { z } from "zod";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import type {
  ShoppingProjectionItemSchema,
  ShoppingProjectionResponseSchema,
} from "@norish/shared/contracts/zod/shopping-projection";

import { pantryIngredientOnHandFor } from "./pantry";

type ShoppingProjection = z.output<typeof ShoppingProjectionResponseSchema>;
type ShoppingProjectionItem = z.output<typeof ShoppingProjectionItemSchema>;

export function partitionShoppingProjectionForPantry(
  projection: ShoppingProjection,
  pantry: readonly PantryIngredientDto[]
): ShoppingProjection {
  const pantryItems: ShoppingProjectionItem[] = [];
  const partition = (items: ShoppingProjectionItem[]) =>
    items.filter((item) => {
      if (!pantryIngredientOnHandFor(pantry, item.name)) return true;

      pantryItems.push(item);

      return false;
    });

  const stableItems = partition(projection.stableItems);
  const currentWeekItems = partition(projection.currentWeekItems);
  const upcomingWeeks = projection.upcomingWeeks
    .map((week) => ({ ...week, items: partition(week.items) }))
    .filter((week) => week.items.length > 0);

  return {
    ...projection,
    stableItems,
    currentWeekItems,
    upcomingWeeks,
    pantryItems,
    pantryItemCount: pantryItems.length,
    totalItemCount:
      stableItems.length +
      currentWeekItems.length +
      upcomingWeeks.reduce((total, week) => total + week.items.length, 0),
  };
}
