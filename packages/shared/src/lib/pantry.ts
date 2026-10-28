import type { PantryIngredientDto } from "@norish/shared/contracts";

import { normalizeGroceryName } from "./normalized-name";

export function pantryIngredientFor(
  items: readonly PantryIngredientDto[],
  name: string | null | undefined
): PantryIngredientDto | null {
  const normalized = normalizeGroceryName(name);

  if (!normalized) return null;

  return items.find((item) => item.normalizedName === normalized) ?? null;
}

export function pantryIngredientOnHandFor(
  items: readonly PantryIngredientDto[],
  name: string | null | undefined
): PantryIngredientDto | null {
  const item = pantryIngredientFor(items, name);

  return item?.status === "on_hand" ? item : null;
}

export function isPantryIngredientStale(
  item: Pick<PantryIngredientDto, "lastConfirmedAt" | "isStaple" | "status">,
  now = new Date(),
  staleAfterDays = 45
): boolean {
  if (item.isStaple || item.status !== "on_hand") return false;

  return now.getTime() - item.lastConfirmedAt.getTime() > staleAfterDays * 86_400_000;
}

export function sortPantryIngredients<T extends Pick<PantryIngredientDto, "name">>(
  items: readonly T[],
  locale: string
): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, locale, { sensitivity: "base" }));
}
