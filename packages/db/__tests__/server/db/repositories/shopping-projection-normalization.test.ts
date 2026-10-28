import { describe, expect, it } from "vitest";

import {
  applyPlanSlotIngredientOverrides,
  previewShoppingProjectionIngredient,
} from "@norish/db/repositories/shopping-projection";

describe("shopping projection ingredient normalization", () => {
  it("treats canned package sizes as shopping counts", () => {
    const item = previewShoppingProjectionIngredient({
      ingredientName: "can diced tomatoes",
      amount: 1,
      unit: "ounce",
      rawLine: "1 - 15oz can diced tomatoes",
    });

    expect(item).toMatchObject({
      displayName: "Diced Tomato",
      qty: 1,
      unit: "can",
      aisle: "Pantry",
    });
  });

  it("preserves useful count units instead of flattening everything to unit", () => {
    const item = previewShoppingProjectionIngredient({
      ingredientName: "garlic cloves (grated or mince)",
      amount: 2,
      unit: "",
      rawLine: "2 garlic cloves (grated or mince)",
    });

    expect(item).toMatchObject({
      displayName: "Garlic",
      qty: 2,
      unit: "clove",
      aisle: "Produce",
    });
  });

  it("merges common oat wording to one shopping name", () => {
    const item = previewShoppingProjectionIngredient({
      ingredientName: "gluten free old-fashioned oats",
      amount: 1,
      unit: "cup",
      rawLine: "1 cup gluten free old-fashioned oats",
    });

    expect(item).toMatchObject({
      displayName: "Oats",
      unit: "cup",
      aisle: "Pantry",
    });
  });

  it("keeps alternatives readable instead of mashing them together", () => {
    const item = previewShoppingProjectionIngredient({
      ingredientName: "maple syrup or honey",
      amount: 1,
      unit: "tablespoon",
      rawLine: "1 tablespoon maple syrup or honey",
    });

    expect(item).toMatchObject({
      displayName: "Maple Syrup or Honey",
      unit: "tablespoon",
      aisle: "Pantry",
    });
  });

  it("drops water from computed shopping", () => {
    expect(
      previewShoppingProjectionIngredient({
        ingredientName: "water",
        amount: 1,
        unit: "cup",
        rawLine: "1 cup water",
      })
    ).toBeNull();
  });

  it("keeps unitless serving extras as unquantified shopping reminders", () => {
    const item = previewShoppingProjectionIngredient({
      ingredientName: "cashew butter, for serving",
      amount: null,
      unit: "",
      rawLine: "cashew butter, for serving",
    });

    expect(item).toMatchObject({
      displayName: "Cashew Butter (for serving)",
      dedupName: "cashew butter::for-serving",
      unit: "",
      aisle: "Pantry",
    });
    expect(item?.qty).toBe(0);
  });

  it("applies lower-sodium and manual adjustments even when dairy-free is disabled", () => {
    expect(
      applyPlanSlotIngredientOverrides(
        [
          { recipeIngredientId: "soy-id", ingredientName: "soy sauce" },
          { recipeIngredientId: "salt-id", ingredientName: "kosher salt" },
          { recipeIngredientId: "pepper-id", ingredientName: "black pepper" },
        ],
        false,
        [
          {
            recipeIngredientId: "soy-id",
            replacementName: "reduced-sodium soy sauce",
            action: "replace",
          },
          {
            recipeIngredientId: "salt-id",
            replacementName: null,
            action: "omit",
          },
        ]
      )
    ).toEqual([
      { recipeIngredientId: "soy-id", ingredientName: "reduced-sodium soy sauce" },
      { recipeIngredientId: "pepper-id", ingredientName: "black pepper" },
    ]);
  });

  it("preserves lower-sodium substitutions in grocery names and grouping", () => {
    expect(
      previewShoppingProjectionIngredient({
        ingredientName: "reduced-sodium soy sauce",
        amount: 1,
        unit: "tablespoon",
        rawLine: "1 tablespoon reduced-sodium soy sauce",
      })
    ).toMatchObject({
      displayName: "Reduced-Sodium Soy Sauce",
      dedupName: "reduced-sodium soy sauce",
      aisle: "Pantry",
    });

    expect(
      previewShoppingProjectionIngredient({
        ingredientName: "no-salt-added canned black beans",
        amount: 1,
        unit: "can",
        rawLine: "1 can no-salt-added black beans",
      })
    ).toMatchObject({
      displayName: "No-Salt-Added Black Beans",
      dedupName: "no-salt-added black beans",
      aisle: "Pantry",
    });
  });
  it("uses planned replacements and removes omitted dairy from shopping inputs", () => {
    expect(
      applyPlanSlotIngredientOverrides(
        [
          { recipeIngredientId: "milk-id", ingredientName: "whole milk" },
          { recipeIngredientId: "sour-cream-id", ingredientName: "sour cream" },
          { recipeIngredientId: "pepper-id", ingredientName: "black pepper" },
        ],
        true,
        [
          {
            recipeIngredientId: "milk-id",
            replacementName: "unsweetened dairy-free milk",
            action: "replace",
          },
          {
            recipeIngredientId: "sour-cream-id",
            replacementName: null,
            action: "omit",
          },
        ]
      )
    ).toEqual([
      { recipeIngredientId: "milk-id", ingredientName: "unsweetened dairy-free milk" },
      { recipeIngredientId: "pepper-id", ingredientName: "black pepper" },
    ]);
  });
});
