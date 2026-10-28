import { describe, expect, it } from "vitest";

import {
  getCanonicalCookingMethodTags,
  isAliasedRecipeTag,
  matchesRecipeTagFilter,
} from "../../src/lib/recipe-tag-aliases";

describe("recipe tag aliases", () => {
  it.each(["Slow Cooker Chicken", "Crockpot Chili", "Crock-Pot Stew", "crock pot roast"])(
    "canonicalizes %s",
    (value) => {
      expect(getCanonicalCookingMethodTags([value])).toEqual(["slow cooker"]);
    }
  );

  it("does not treat other slow cooking descriptions as slow-cooker tags", () => {
    expect(getCanonicalCookingMethodTags(["Slow roasted salmon"])).toEqual([]);
  });

  it("matches aliases while leaving ordinary tags exact", () => {
    expect(isAliasedRecipeTag("Slow Cooker")).toBe(true);
    expect(isAliasedRecipeTag("vegetarian")).toBe(false);
    expect(matchesRecipeTagFilter(new Set(["healthy crockpot tortilla soup"]), "slow cooker")).toBe(
      true
    );
    expect(matchesRecipeTagFilter(new Set(["Vegetarian"]), "vegetarian")).toBe(true);
    expect(matchesRecipeTagFilter(new Set(["slow roasted"]), "slow cooker")).toBe(false);
  });
});
