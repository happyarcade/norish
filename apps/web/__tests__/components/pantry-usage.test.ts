import {
  buildPantryReconciliation,
  buildPantryUsageCandidates,
} from "@/components/recipes/pantry-usage";
import { describe, expect, it } from "vitest";

import type { PantryIngredientDto } from "@norish/shared/contracts";

function pantryItem(overrides: Partial<PantryIngredientDto>): PantryIngredientDto {
  return {
    id: crypto.randomUUID(),
    name: "Olive oil",
    normalizedName: "olive oil",
    userId: "user-1",
    status: "on_hand",
    isStaple: false,
    lastConfirmedAt: new Date("2026-10-01T12:00:00Z"),
    ...overrides,
  };
}

describe("buildPantryUsageCandidates", () => {
  it("offers only exact normalized recipe ingredient matches", () => {
    const candidates = buildPantryUsageCandidates(
      ["  OLIVE  OIL! ", "Greek yoghurt"],
      [
        pantryItem({ name: "Olive Oil" }),
        pantryItem({
          name: "Extra virgin olive oil",
          normalizedName: "extra virgin olive oil",
        }),
        pantryItem({ name: "Salt", normalizedName: "salt" }),
      ]
    );

    expect(candidates.map((candidate) => candidate.name)).toEqual(["Olive Oil"]);
  });

  it("does not duplicate matches and returns them in name order", () => {
    const candidates = buildPantryUsageCandidates(
      ["Tomatoes", "tomatoes", "Basil"],
      [
        pantryItem({ id: "tomatoes", name: "Tomatoes", normalizedName: "tomatoes" }),
        pantryItem({ id: "basil", name: "basil", normalizedName: "basil" }),
      ]
    );

    expect(candidates.map((candidate) => candidate.id)).toEqual(["basil", "tomatoes"]);
  });
});

describe("buildPantryReconciliation", () => {
  it("preserves current statuses and applies explicit cooking outcomes", () => {
    const oliveOil = pantryItem({ id: "olive-oil" });
    const salt = pantryItem({ id: "salt", name: "Salt", normalizedName: "salt", status: "low" });
    const outcomes = new Map([
      ["olive-oil", "used_up" as const],
      ["salt", "on_hand" as const],
    ]);

    expect(buildPantryReconciliation([oliveOil, salt], outcomes)).toEqual([
      { id: "olive-oil", outcome: "used_up" },
      { id: "salt", outcome: "on_hand" },
    ]);
  });

  it("uses an item's current state when it was not changed during review", () => {
    const lowItem = pantryItem({ id: "salt", status: "low" });

    expect(buildPantryReconciliation([lowItem], new Map())).toEqual([
      { id: "salt", outcome: "low" },
    ]);
  });
});
