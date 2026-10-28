import {
  groupPantryItems,
  isPantryIngredientQueued,
} from "@/components/groceries/pantry/pantry-content";
import { describe, expect, it } from "vitest";

import type { PantryIngredientDto } from "@norish/shared/contracts";

function pantryItem(
  name: string,
  overrides: Partial<PantryIngredientDto> = {}
): PantryIngredientDto {
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    name,
    normalizedName: name.toLowerCase(),
    status: "on_hand",
    isStaple: false,
    lastConfirmedAt: new Date("2026-10-01T12:00:00Z"),
    ...overrides,
  };
}

describe("groupPantryItems", () => {
  const now = new Date("2026-10-21T12:00:00Z");

  it("puts every item in one actionable group", () => {
    const groups = groupPantryItems(
      [
        pantryItem("Milk", { status: "low" }),
        pantryItem("Coriander", { lastConfirmedAt: new Date("2026-08-01T12:00:00Z") }),
        pantryItem("Olive oil", { isStaple: true }),
        pantryItem("Carrots"),
      ],
      "en",
      "",
      now
    );

    expect(groups.low.map((item) => item.name)).toEqual(["Milk"]);
    expect(groups.check.map((item) => item.name)).toEqual(["Coriander"]);
    expect(groups.staples.map((item) => item.name)).toEqual(["Olive oil"]);
    expect(groups.onHand.map((item) => item.name)).toEqual(["Carrots"]);
  });

  it("filters using the normalized pantry name", () => {
    const groups = groupPantryItems(
      [pantryItem("Olive oil", { isStaple: true }), pantryItem("Sunflower oil")],
      "en",
      "OLIVE!",
      now
    );

    expect(groups.staples.map((item) => item.name)).toEqual(["Olive oil"]);
    expect(groups.onHand).toEqual([]);
  });
});

describe("isPantryIngredientQueued", () => {
  it("matches an active grocery using the normalized pantry name", () => {
    const item = pantryItem("Crème fraîche", { normalizedName: "creme fraiche" });

    expect(isPantryIngredientQueued(item, ["  CREME FRAICHE! "])).toBe(true);
    expect(isPantryIngredientQueued(item, ["Sour cream"])).toBe(false);
  });
});
