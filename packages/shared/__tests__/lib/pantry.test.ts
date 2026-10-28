import { describe, expect, it } from "vitest";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import {
  isPantryIngredientStale,
  pantryIngredientFor,
  pantryIngredientOnHandFor,
  sortPantryIngredients,
} from "@norish/shared/lib/pantry";

function item(name: string, normalizedName: string): PantryIngredientDto {
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

const pantry = [
  item("Olive Oil", "olive oil"),
  item("Salt", "salt"),
  item("Crème fraîche", "creme fraiche"),
];

describe("pantryIngredientFor", () => {
  it("matches only an exact folded name", () => {
    expect(pantryIngredientFor(pantry, "  OLIVE  OIL! ")?.name).toBe("Olive Oil");
    expect(pantryIngredientFor(pantry, "creme fraîche")?.name).toBe("Crème fraîche");
    expect(pantryIngredientFor(pantry, "extra virgin olive oil")).toBeNull();
    expect(pantryIngredientFor(pantry, "salted butter")).toBeNull();
  });

  it("does not match an empty name", () => {
    expect(pantryIngredientFor(pantry, "   ")).toBeNull();
    expect(pantryIngredientFor(pantry, null)).toBeNull();
  });
});

describe("pantry availability", () => {
  it("does not count a low item as on hand", () => {
    const low = { ...pantry[0]!, status: "low" as const };

    expect(pantryIngredientFor([low], "olive oil")).toEqual(low);
    expect(pantryIngredientOnHandFor([low], "olive oil")).toBeNull();
  });

  it("flags old non-staples without making staples stale", () => {
    const now = new Date("2026-10-21T12:00:00Z");
    const old = { ...pantry[0]!, lastConfirmedAt: new Date("2026-08-01T12:00:00Z") };

    expect(isPantryIngredientStale(old, now)).toBe(true);
    expect(isPantryIngredientStale({ ...old, isStaple: true }, now)).toBe(false);
    expect(isPantryIngredientStale({ ...old, status: "low" }, now)).toBe(false);
  });
});

describe("sortPantryIngredients", () => {
  it("sorts for the reader's locale without changing the input", () => {
    const input = [item("salt", "salt"), item("Flour", "flour"), item("eggs", "eggs")];
    const sorted = sortPantryIngredients(input, "en");

    expect(sorted.map((candidate) => candidate.name)).toEqual(["eggs", "Flour", "salt"]);
    expect(input.map((candidate) => candidate.name)).toEqual(["salt", "Flour", "eggs"]);
  });
});
