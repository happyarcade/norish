import { buildPantryTransferCandidates } from "@/components/groceries/pantry/move-done-to-pantry-panel";
import { describe, expect, it } from "vitest";

import type { GroceryDto, PantryIngredientDto } from "@norish/shared/contracts";

function grocery(overrides: Partial<GroceryDto>): GroceryDto {
  return {
    id: "grocery-1",
    amount: null,
    isDone: true,
    name: "Olive oil",
    recipeIngredientId: null,
    recurringGroceryId: null,
    sortOrder: 0,
    storeId: null,
    unit: null,
    ...overrides,
  };
}

function pantryItem(overrides: Partial<PantryIngredientDto>): PantryIngredientDto {
  return {
    id: "pantry-1",
    name: "Olive oil",
    normalizedName: "olive oil",
    userId: "user-1",
    status: "on_hand",
    isStaple: false,
    lastConfirmedAt: new Date("2026-10-01T12:00:00Z"),
    ...overrides,
  };
}

describe("buildPantryTransferCandidates", () => {
  it("collapses duplicate completed groceries and keeps every grocery id", () => {
    const candidates = buildPantryTransferCandidates(
      [
        grocery({ id: "grocery-1", name: " Olive oil " }),
        grocery({ id: "grocery-2", name: "olive oil" }),
      ],
      []
    );

    expect(candidates).toEqual([
      {
        key: "olive oil",
        name: "Olive oil",
        groceryIds: ["grocery-1", "grocery-2"],
        alreadyInPantry: false,
      },
    ]);
  });

  it("marks existing pantry ingredients and excludes unfinished groceries", () => {
    const candidates = buildPantryTransferCandidates(
      [
        grocery({ id: "grocery-1", name: "Olive oil" }),
        grocery({ id: "grocery-2", isDone: false, name: "Milk" }),
      ],
      [pantryItem({})]
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      key: "olive oil",
      alreadyInPantry: true,
    });
  });

  it("does not treat a low pantry ingredient as already stocked", () => {
    const candidates = buildPantryTransferCandidates(
      [grocery({ id: "grocery-1", name: "Olive oil" })],
      [pantryItem({ status: "low" })]
    );

    expect(candidates[0]?.alreadyInPantry).toBe(false);
  });
});
