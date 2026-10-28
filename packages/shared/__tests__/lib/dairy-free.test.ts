import { describe, expect, it } from "vitest";

import { suggestDairyFreeIngredientOverrides } from "@norish/shared/lib/dairy-free";

describe("suggestDairyFreeIngredientOverrides", () => {
  it("omits optional sour cream toppings", () => {
    expect(
      suggestDairyFreeIngredientOverrides([
        {
          recipeIngredientId: "75a68cb5-50b9-4fb7-b408-673853ec6de8",
          ingredientName: "sour cream",
          rawLine: "sour cream, for serving",
        },
      ])
    ).toEqual([
      {
        recipeIngredientId: "75a68cb5-50b9-4fb7-b408-673853ec6de8",
        originalName: "sour cream",
        replacementName: null,
        action: "omit",
        reason: "Optional dairy topping can be left out",
        source: "dairy-free",
      },
    ]);
  });

  it("suggests shopping-ready replacements for recipe ingredients", () => {
    expect(
      suggestDairyFreeIngredientOverrides([
        {
          recipeIngredientId: "02a5a42b-3e43-4b2a-8524-7fe849ec71c9",
          ingredientName: "whole milk",
          rawLine: "1 cup whole milk",
        },
        {
          recipeIngredientId: "923f37c9-2c25-423f-9f42-e14bad0ad254",
          ingredientName: "butter",
          rawLine: "2 tablespoons butter",
        },
      ])
    ).toMatchObject([
      {
        replacementName: "unsweetened dairy-free milk",
        action: "replace",
      },
      {
        replacementName: "dairy-free spread",
        action: "replace",
      },
    ]);
  });

  it("uses a specific replacement for specialist dairy ingredients", () => {
    expect(
      suggestDairyFreeIngredientOverrides([
        {
          recipeIngredientId: "355d7101-c6ae-455f-8792-d80ec40a9b50",
          ingredientName: "condensed milk",
          rawLine: "1 can condensed milk",
        },
      ])[0]?.replacementName
    ).toBe("dairy-free condensed milk");
  });

  it("ignores ingredients that are already dairy-free", () => {
    expect(
      suggestDairyFreeIngredientOverrides([
        {
          recipeIngredientId: "12408599-b131-4dcf-9941-f3aa4c2d96db",
          ingredientName: "coconut milk",
          rawLine: "1 can coconut milk",
        },
        {
          recipeIngredientId: "998c2651-9ec3-462f-9a8b-a9a4a6db149a",
          ingredientName: "butter beans",
          rawLine: "2 cans butter beans",
        },
      ])
    ).toEqual([]);
  });
});
