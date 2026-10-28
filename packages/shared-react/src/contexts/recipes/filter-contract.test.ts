import { describe, expect, it } from "vitest";

import {
  DEFAULT_RECIPE_FILTERS,
  normalizePersistedRecipeFilters,
  serializeRecipeFilters,
  toRecipesQueryFilters,
} from "./filter-contract";

describe("recipe filter contract", () => {
  it("keeps deterministic defaults and query serialization", () => {
    const queryFilters = toRecipesQueryFilters(DEFAULT_RECIPE_FILTERS);

    expect(queryFilters).toEqual({
      search: undefined,
      searchFields: DEFAULT_RECIPE_FILTERS.searchFields,
      tags: undefined,
      categories: undefined,
      suitableSlots: undefined,
      filterMode: "AND",
      sortMode: "dateDesc",
      minRating: undefined,
      maxCookingTime: undefined,
      maxSodium: undefined,
      maxCholesterol: undefined,
      minFiber: undefined,
      sourceDomains: undefined,
      nutritionDetail: undefined,
    });
    expect(serializeRecipeFilters(DEFAULT_RECIPE_FILTERS)).toBe(JSON.stringify(queryFilters));
  });

  it("normalizes persisted filter payloads and rejects invalid values", () => {
    expect(
      normalizePersistedRecipeFilters({
        sortMode: "dateDesc",
        filterMode: "OR",
        searchTags: ["vegetarian"],
        searchFields: ["name"],
        showFavoritesOnly: true,
        minRating: 4,
        maxCookingTime: 30,
        sourceDomains: ["bbcgoodfood.com"],
        nutritionDetail: "core",
        categories: ["Dinner"],
        suitableSlots: ["dinner", "evening"],
      })
    ).toMatchObject({
      sortMode: "dateDesc",
      filterMode: "OR",
      searchTags: ["vegetarian"],
      showFavoritesOnly: true,
      minRating: 4,
      maxCookingTime: 30,
      sourceDomains: ["bbcgoodfood.com"],
      nutritionDetail: "core",
      categories: ["Dinner"],
      suitableSlots: ["dinner", "evening"],
    });

    expect(normalizePersistedRecipeFilters({ sortMode: "invalid" })).toBeNull();
  });

  it("maps legacy nutrition detail filters to the current names", () => {
    expect(
      normalizePersistedRecipeFilters({
        sortMode: "dateDesc",
        filterMode: "AND",
        nutritionDetail: "extended",
      })
    ).toMatchObject({ nutritionDetail: "core" });

    expect(
      normalizePersistedRecipeFilters({
        sortMode: "dateDesc",
        filterMode: "AND",
        nutritionDetail: "missingExtended",
      })
    ).toMatchObject({ nutritionDetail: "missingCore" });
  });
});
