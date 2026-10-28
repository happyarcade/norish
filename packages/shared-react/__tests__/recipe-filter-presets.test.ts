import { describe, expect, it } from "vitest";

import type { CanonicalRecipeFilters } from "../src/contexts/recipes/filter-contract";
import {
  DEFAULT_RECIPE_FILTERS,
  RECIPE_FILTER_PRESETS,
} from "../src/contexts/recipes/filter-contract";

function getPreset(id: string) {
  const preset = RECIPE_FILTER_PRESETS.find((candidate) => candidate.id === id);

  if (!preset) throw new Error(`Missing recipe filter preset: ${id}`);

  return preset;
}

describe("recipe filter presets", () => {
  it("toggles quick cooking without losing other filters", () => {
    const preset = getPreset("quick");
    const initial: CanonicalRecipeFilters = {
      ...DEFAULT_RECIPE_FILTERS,
      searchTags: ["vegetarian"],
    };
    const active = preset.apply(initial);

    expect(active.maxCookingTime).toBe(30);
    expect(active.searchTags).toEqual(["vegetarian"]);
    expect(preset.apply(active).maxCookingTime).toBeNull();
  });

  it("combines and removes meal categories independently", () => {
    const preset = getPreset("dinner");
    const initial: CanonicalRecipeFilters = {
      ...DEFAULT_RECIPE_FILTERS,
      categories: ["Breakfast"],
    };
    const active = preset.apply(initial);

    expect(active.categories).toEqual(["Breakfast", "Dinner"]);
    expect(preset.apply(active).categories).toEqual(["Breakfast"]);
  });

  it("toggles lifestyle and cooking-method tags case-insensitively", () => {
    const mealPrep = getPreset("meal-prep");
    const slowCooker = getPreset("slow-cooker");
    const dairyFree = getPreset("dairy-free");
    const dairyFreePossible = getPreset("dairy-free-possible");
    const initial: CanonicalRecipeFilters = {
      ...DEFAULT_RECIPE_FILTERS,
      searchTags: ["Meal Prep"],
    };

    expect(mealPrep.apply(initial).searchTags).toEqual([]);
    expect(slowCooker.apply(initial).searchTags).toEqual(["Meal Prep", "slow cooker"]);
    expect(dairyFree.apply(initial).searchTags).toEqual(["Meal Prep", "dairy-free"]);
    expect(dairyFreePossible.apply(initial).searchTags).toEqual([
      "Meal Prep",
      "dairy-free-possible",
    ]);
  });

  it("toggles the 1,000 mg sodium shortcut", () => {
    const preset = getPreset("low-sodium");
    const active = preset.apply(DEFAULT_RECIPE_FILTERS);

    expect(active.maxSodium).toBe(1000);
    expect(preset.apply(active).maxSodium).toBeNull();
  });
});
