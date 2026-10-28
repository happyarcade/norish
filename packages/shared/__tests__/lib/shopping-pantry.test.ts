import { describe, expect, it } from "vitest";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import { ShoppingProjectionResponseSchema } from "@norish/shared/contracts/zod/shopping-projection";
import { partitionShoppingProjectionForPantry } from "@norish/shared/lib/shopping-pantry";

function pantryItem(name: string, normalizedName: string): PantryIngredientDto {
  return {
    id: crypto.randomUUID(),
    userId: "user",
    name,
    normalizedName,
    status: "on_hand",
    isStaple: false,
    lastConfirmedAt: new Date("2026-10-01T12:00:00Z"),
  };
}

function shoppingItem(id: string, name: string, weekIndex: number) {
  return {
    id,
    name,
    qty: 1,
    unit: "tbsp",
    aisle: "Pantry" as const,
    lifecycle: "stable" as const,
    weekIndex,
    sources: [
      {
        id: `${id}-source`,
        sourceKind: "planner" as const,
        recipeId: "recipe",
        recipeName: "Test recipe",
        contextLabel: "Dinner",
        itemName: name,
        qty: 1,
        unit: "tbsp",
        date: weekIndex === 0 ? "2026-10-05" : "2026-10-12",
        weekIndex,
      },
    ],
  };
}

function projection() {
  return ShoppingProjectionResponseSchema.parse({
    hasHousehold: true,
    householdId: "household",
    householdPortionUnits: 4,
    activePeopleCount: 2,
    dayCount: 28,
    windowStart: "2026-10-05",
    windowEnd: "2026-11-01",
    stableItems: [shoppingItem("stable-oil", "olive oil", 0)],
    currentWeekItems: [shoppingItem("current-milk", "milk", 0)],
    upcomingWeeks: [
      {
        weekIndex: 1,
        weekStart: "2026-10-12",
        weekEnd: "2026-10-18",
        items: [
          shoppingItem("future-oil", "Olive Oil", 1),
          shoppingItem("future-carrots", "carrots", 1),
        ],
      },
    ],
    totalItemCount: 4,
  });
}

describe("partitionShoppingProjectionForPantry", () => {
  it("moves exact Pantry matches out of every buy-list section", () => {
    const source = projection();
    const result = partitionShoppingProjectionForPantry(source, [
      pantryItem("Olive Oil", "olive oil"),
    ]);

    expect(result.stableItems).toEqual([]);
    expect(result.currentWeekItems.map((item) => item.name)).toEqual(["milk"]);
    expect(result.upcomingWeeks[0]?.items.map((item) => item.name)).toEqual(["carrots"]);
    expect(result.pantryItems.map((item) => item.id)).toEqual(["stable-oil", "future-oil"]);
    expect(result.pantryItemCount).toBe(2);
    expect(result.totalItemCount).toBe(2);
    expect(source.totalItemCount).toBe(4);
  });

  it("keeps related but non-exact names on the buy list", () => {
    const source = projection();
    source.stableItems = [shoppingItem("extra-virgin-oil", "extra virgin olive oil", 0)];
    source.currentWeekItems = [];
    source.upcomingWeeks = [];
    source.totalItemCount = 1;

    const result = partitionShoppingProjectionForPantry(source, [
      pantryItem("Olive Oil", "olive oil"),
    ]);

    expect(result.stableItems).toHaveLength(1);
    expect(result.pantryItems).toEqual([]);
    expect(result.totalItemCount).toBe(1);
  });

  it("keeps low pantry items on the buy list", () => {
    const source = projection();
    const lowOil = { ...pantryItem("Olive Oil", "olive oil"), status: "low" as const };
    const result = partitionShoppingProjectionForPantry(source, [lowOil]);

    expect(result.stableItems.map((item) => item.name)).toEqual(["olive oil"]);
    expect(result.upcomingWeeks[0]?.items.map((item) => item.name)).toEqual([
      "Olive Oil",
      "carrots",
    ]);
    expect(result.pantryItems).toEqual([]);
  });
});
