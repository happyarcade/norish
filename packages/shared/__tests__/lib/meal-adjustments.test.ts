import { describe, expect, it } from "vitest";

import type { MealIngredientOverride } from "@norish/shared/lib/meal-adjustments";
import {
  getMealIngredientOverrideSource,
  replaceMealIngredientOverrides,
  suggestLowerSodiumIngredientOverrides,
} from "@norish/shared/lib/meal-adjustments";

describe("suggestLowerSodiumIngredientOverrides", () => {
  it("replaces common high-sodium ingredients and omits added salt or MSG", () => {
    expect(
      suggestLowerSodiumIngredientOverrides([
        {
          recipeIngredientId: "soy-id",
          ingredientName: "soy sauce",
          rawLine: "2 tablespoons soy sauce",
        },
        {
          recipeIngredientId: "stock-id",
          ingredientName: "chicken stock",
          rawLine: "2 cups chicken stock",
        },
        {
          recipeIngredientId: "beans-id",
          ingredientName: "canned black beans",
          rawLine: "1 can black beans",
        },
        {
          recipeIngredientId: "salt-id",
          ingredientName: "kosher salt",
          rawLine: "1 teaspoon kosher salt",
        },
        {
          recipeIngredientId: "msg-id",
          ingredientName: "MSG",
          rawLine: "1/4 teaspoon MSG",
        },
      ])
    ).toMatchObject([
      {
        recipeIngredientId: "soy-id",
        replacementName: "reduced-sodium soy sauce",
        action: "replace",
        source: "lower-sodium",
      },
      {
        recipeIngredientId: "stock-id",
        replacementName: "low-sodium chicken stock",
        action: "replace",
        source: "lower-sodium",
      },
      {
        recipeIngredientId: "beans-id",
        replacementName: "no-salt-added black beans",
        action: "replace",
        source: "lower-sodium",
      },
      {
        recipeIngredientId: "salt-id",
        replacementName: null,
        action: "omit",
        source: "lower-sodium",
      },
      {
        recipeIngredientId: "msg-id",
        replacementName: null,
        action: "omit",
        source: "lower-sodium",
      },
    ]);
  });

  it("keeps black pepper when it shares an ingredient with salt", () => {
    expect(
      suggestLowerSodiumIngredientOverrides([
        {
          recipeIngredientId: "seasoning-id",
          ingredientName: "salt and freshly ground black pepper",
          rawLine: "salt and freshly ground black pepper, to taste",
        },
      ])
    ).toMatchObject([
      {
        recipeIngredientId: "seasoning-id",
        replacementName: "black pepper",
        action: "replace",
      },
    ]);
  });

  it("does not alter ingredients that already have a lower-sodium alternative", () => {
    expect(
      suggestLowerSodiumIngredientOverrides([
        {
          recipeIngredientId: "soy-id",
          ingredientName: "reduced-sodium soy sauce",
          rawLine: "2 tablespoons reduced-sodium soy sauce",
        },
        {
          recipeIngredientId: "stock-id",
          ingredientName: "chicken stock",
          rawLine: "2 cups no-salt-added chicken stock",
        },
        {
          recipeIngredientId: "butter-id",
          ingredientName: "unsalted butter",
          rawLine: "1 tablespoon unsalted butter",
        },
      ])
    ).toEqual([]);
  });

  it("offers salt-free seasoning and reduced-sodium tamari", () => {
    expect(
      suggestLowerSodiumIngredientOverrides([
        {
          recipeIngredientId: "fajita-id",
          ingredientName: "fajita seasoning",
          rawLine: "1 tablespoon fajita seasoning",
        },
        {
          recipeIngredientId: "tamari-id",
          ingredientName: "tamari",
          rawLine: "1 tablespoon tamari",
        },
      ])
    ).toMatchObject([
      { replacementName: "salt-free fajita seasoning" },
      { replacementName: "reduced-sodium tamari" },
    ]);
  });
});

describe("meal ingredient override composition", () => {
  const legacyDairyOverride: MealIngredientOverride = {
    recipeIngredientId: "milk-id",
    originalName: "whole milk",
    replacementName: "unsweetened dairy-free milk",
    action: "replace",
    reason: "Use an unsweetened plant-based milk",
  };
  const sodiumOverride: MealIngredientOverride = {
    recipeIngredientId: "salt-id",
    originalName: "kosher salt",
    replacementName: null,
    action: "omit",
    reason: "Leave out added salt",
    source: "lower-sodium",
  };
  const manualOverride: MealIngredientOverride = {
    recipeIngredientId: "cream-id",
    originalName: "sour cream",
    replacementName: "coconut yoghurt",
    action: "replace",
    reason: "Chosen for this planned meal",
    source: "manual",
  };

  it("recognizes existing unlabelled dairy-free overrides", () => {
    expect(getMealIngredientOverrideSource(legacyDairyOverride, true)).toBe("dairy-free");
    expect(getMealIngredientOverrideSource(legacyDairyOverride, false)).toBe("manual");
  });

  it("removes only dairy-free adjustments while preserving sodium and manual changes", () => {
    expect(
      replaceMealIngredientOverrides(
        [legacyDairyOverride, sodiumOverride, manualOverride],
        [],
        "dairy-free",
        true
      )
    ).toEqual([sodiumOverride, manualOverride]);
  });

  it("does not overwrite a manually chosen ingredient with an automatic suggestion", () => {
    const sodiumSuggestion: MealIngredientOverride = {
      recipeIngredientId: manualOverride.recipeIngredientId,
      originalName: manualOverride.originalName,
      replacementName: "low-sodium sour cream",
      action: "replace",
      reason: "Automatic suggestion",
      source: "lower-sodium",
    };

    expect(
      replaceMealIngredientOverrides([manualOverride], [sodiumSuggestion], "lower-sodium")
    ).toEqual([manualOverride]);
  });
});
