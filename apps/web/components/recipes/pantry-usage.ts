import type { PantryIngredientDto } from "@norish/shared/contracts";
import { normalizeGroceryName } from "@norish/shared/lib/normalized-name";

export type PantryUsageOutcome = "on_hand" | "low" | "used_up";

export function buildPantryUsageCandidates(
  ingredientNames: readonly string[],
  pantryItems: readonly PantryIngredientDto[]
): PantryIngredientDto[] {
  const normalizedIngredientNames = new Set(
    ingredientNames.map(normalizeGroceryName).filter(Boolean)
  );

  return pantryItems
    .filter((item) => normalizedIngredientNames.has(item.normalizedName))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function buildPantryReconciliation(
  pantryItems: readonly PantryIngredientDto[],
  outcomes: ReadonlyMap<string, PantryUsageOutcome>
): { id: string; outcome: PantryUsageOutcome }[] {
  return pantryItems.map((item) => ({
    id: item.id,
    outcome: outcomes.get(item.id) ?? item.status,
  }));
}
