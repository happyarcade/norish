import { describe, expect, it } from "vitest";

import type {
  WeeklyMealCandidate,
  WeeklyMealTarget,
} from "@norish/shared/lib/weekly-meal-suggestions";
import { buildWeeklyMealSuggestions } from "@norish/shared/lib/weekly-meal-suggestions";

const TODAY = "2026-08-24";
const DINNER_SLOT = "dinner-slot";

function candidate(id: string, overrides: Partial<WeeklyMealCandidate> = {}): WeeklyMealCandidate {
  return {
    id,
    name: id + " chicken dinner",
    image: null,
    categories: ["Dinner"],
    protein: 28,
    calories: 450,
    sodium: 520,
    nutritionConfidence: 0.9,
    totalMinutes: 35,
    dietaryFlags: ["dairy-free-possible"],
    cuisines: [],
    recipeTypes: ["main"],
    suitableSlots: ["dinner"],
    fruitVegCount: null,
    isFreezerFriendly: false,
    tags: [],
    ingredientNames: ["chicken", "onion"],
    householdFavoriteCount: 0,
    householdAverageRating: null,
    lastCookedAt: null,
    cookCount: 0,
    ...overrides,
  };
}

function target(date: string, slotKey = "dinner", slotLabel = "Dinner"): WeeklyMealTarget {
  return {
    date,
    plannerSlotDefinitionId: slotKey === "dinner" ? DINNER_SLOT : slotKey + "-slot",
    slotKey,
    slotLabel,
  };
}

describe("weekly meal suggestions", () => {
  it("favours lean high-protein and lower-sodium family dinners", () => {
    const results = buildWeeklyMealSuggestions(
      [
        candidate("salty-beef", {
          name: "Beef pasta",
          protein: 18,
          sodium: 1480,
          ingredientNames: ["beef", "pasta"],
        }),
        candidate("healthy-chicken", {
          name: "Mediterranean chicken",
          protein: 38,
          sodium: 410,
          cuisines: ["mediterranean"],
          dietaryFlags: ["dairy-free"],
        }),
      ],
      [target("2026-08-25")],
      { today: TODAY }
    );

    expect(results[0]?.recipe.id).toBe("healthy-chicken");
    expect(results[0]?.reasons).toEqual(
      expect.arrayContaining(["High protein", "Lower sodium", "Dairy-free"])
    );
  });

  it("learns from household favourites and positive ratings", () => {
    const results = buildWeeklyMealSuggestions(
      [
        candidate("unrated", { protein: 33 }),
        candidate("family-favourite", {
          protein: 25,
          householdFavoriteCount: 1,
          householdAverageRating: 5,
        }),
      ],
      [target("2026-08-25")],
      { today: TODAY }
    );

    expect(results[0]?.recipe.id).toBe("family-favourite");
    expect(results[0]?.reasons).toEqual(
      expect.arrayContaining(["Household favourite", "Highly rated"])
    );
  });

  it("avoids recipes recently cooked by the household", () => {
    const results = buildWeeklyMealSuggestions(
      [
        candidate("recent", {
          householdFavoriteCount: 1,
          lastCookedAt: "2026-08-22T18:00:00.000Z",
        }),
        candidate("fresh"),
      ],
      [target("2026-08-25")],
      { today: TODAY }
    );

    expect(results[0]?.recipe.id).toBe("fresh");
  });

  it("never repeats a recipe already planned or chosen for another evening", () => {
    const results = buildWeeklyMealSuggestions(
      [
        candidate("already-planned", { householdFavoriteCount: 2 }),
        candidate("first", { name: "Chicken dinner" }),
        candidate("second", { name: "Salmon dinner", ingredientNames: ["salmon"] }),
      ],
      [target("2026-08-25"), target("2026-08-26")],
      { existingRecipeIds: ["already-planned"], today: TODAY }
    );

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.recipe.id)).not.toContain("already-planned");
    expect(new Set(results.map((result) => result.recipe.id)).size).toBe(2);
  });

  it("keeps differently imported versions of the same dinner out of one week", () => {
    const results = buildWeeklyMealSuggestions(
      [
        candidate("cacciatore-a", {
          name: "Kristi Chicken Cacciatore Crockpot",
          householdFavoriteCount: 1,
        }),
        candidate("cacciatore-b", {
          name: "Crockpot Chicken Cacciatore",
          householdFavoriteCount: 1,
        }),
        candidate("salmon-noodles", {
          name: "Thai Salmon Noodles",
          ingredientNames: ["salmon", "rice noodles"],
          cuisines: ["thai"],
        }),
      ],
      [target("2026-08-25"), target("2026-08-26")],
      { today: TODAY }
    );

    expect(results).toHaveLength(2);
    expect(results.filter((result) => /cacciatore/i.test(result.recipe.name))).toHaveLength(1);
  });

  it("balances cuisine and protein variety across the week", () => {
    const results = buildWeeklyMealSuggestions(
      [
        candidate("thai-chicken", {
          name: "Thai chicken curry",
          cuisines: ["thai"],
          ingredientNames: ["chicken", "coconut milk"],
        }),
        candidate("thai-chicken-again", {
          name: "Thai chicken noodles",
          cuisines: ["thai"],
          ingredientNames: ["chicken", "noodles"],
        }),
        candidate("mexican-beans", {
          name: "Mexican bean bowls",
          cuisines: ["mexican"],
          dietaryFlags: ["vegetarian", "dairy-free"],
          ingredientNames: ["black beans", "lime"],
        }),
      ],
      [target("2026-08-25"), target("2026-08-26")],
      { today: TODAY }
    );

    expect(new Set(results.flatMap((result) => result.recipe.cuisines)).size).toBe(2);
    expect(results.some((result) => result.recipe.id === "mexican-beans")).toBe(true);
  });

  it("matches lunch and dinner recipes to their requested slots", () => {
    const results = buildWeeklyMealSuggestions(
      [
        candidate("lunch", {
          name: "Chickpea salad",
          categories: ["Lunch"],
          dietaryFlags: ["vegetarian", "dairy-free"],
          ingredientNames: ["chickpeas", "cucumber", "tomato"],
          suitableSlots: ["lunch"],
        }),
        candidate("dinner", {
          name: "Salmon traybake",
          categories: ["Dinner"],
          ingredientNames: ["salmon", "potatoes", "broccoli"],
          suitableSlots: ["dinner"],
        }),
      ],
      [target("2026-08-25", "lunch", "Lunch"), target("2026-08-25")],
      { today: TODAY }
    );

    expect(results).toEqual([
      expect.objectContaining({
        slotKey: "lunch",
        slotLabel: "Lunch",
        recipe: expect.objectContaining({ id: "lunch" }),
      }),
      expect.objectContaining({
        slotKey: "dinner",
        slotLabel: "Dinner",
        recipe: expect.objectContaining({ id: "dinner" }),
      }),
    ]);
  });

  it("uses shared non-pantry ingredients to reduce waste", () => {
    const results = buildWeeklyMealSuggestions(
      [
        candidate("already-planned", {
          name: "Salmon bowls",
          ingredientNames: ["salmon", "bell pepper", "black beans"],
        }),
        candidate("overlap", {
          name: "Turkey bean bowls",
          ingredientNames: ["turkey", "bell pepper", "black beans"],
        }),
        candidate("different", {
          name: "Turkey dinner",
          ingredientNames: ["turkey", "potatoes", "carrots"],
        }),
      ],
      [target("2026-08-25")],
      { existingRecipeIds: ["already-planned"], today: TODAY }
    );

    expect(results[0]?.recipe.id).toBe("overlap");
    expect(results[0]?.reasons).toContain("Reuses fresh ingredients");
  });

  it("rewards pantry matches and reports the remaining ingredient impact", () => {
    const candidates = [
      candidate("pantry-dinner", {
        ingredientNames: ["chicken", "onion", "spinach", "rice"],
      }),
    ];
    const withoutPantry = buildWeeklyMealSuggestions(candidates, [target("2026-08-25")], {
      today: TODAY,
    });
    const withPantry = buildWeeklyMealSuggestions(candidates, [target("2026-08-25")], {
      pantryIngredientNames: ["onion", "spinach"],
      today: TODAY,
    });

    expect(withPantry[0]?.score).toBeGreaterThan(withoutPantry[0]?.score ?? 0);
    expect(withPantry[0]?.recipe.pantryIngredientNames).toEqual(["onion", "spinach"]);
    expect(withPantry[0]?.recipe.additionalIngredientNames).toEqual(["chicken", "rice"]);
    expect(withPantry[0]?.reasons).toContain("Uses 2 pantry items");
  });

  it("recognizes practical slow-cooker and meal-prep options", () => {
    const results = buildWeeklyMealSuggestions(
      [
        candidate("ordinary", { totalMinutes: 70 }),
        candidate("slow-cooker", {
          name: "Crockpot chicken",
          tags: ["slow cooker", "meal prep"],
          totalMinutes: 240,
        }),
      ],
      [target("2026-08-25")],
      { today: TODAY }
    );

    expect(results[0]?.recipe.id).toBe("slow-cooker");
    expect(results[0]?.reasons).toEqual(expect.arrayContaining(["Slow cooker", "Meal prep"]));
  });

  it("keeps slow-cooker dinners occasional when comparable alternatives exist", () => {
    const names = [
      "Aurora",
      "Basil",
      "Cedar",
      "Dill",
      "Ember",
      "Fennel",
      "Ginger",
      "Harissa",
      "Indigo",
      "Juniper",
      "Kale",
      "Lemon",
      "Mustard",
      "Nutmeg",
    ];
    const candidates = names.map((name, index) =>
      candidate("option-" + String(index), {
        name: name + " chicken",
        tags: index < 7 ? ["slow cooker"] : [],
        totalMinutes: index < 7 ? 240 : 35,
      })
    );
    const targets = Array.from({ length: 7 }, (_, index) =>
      target("2026-08-" + String(24 + index).padStart(2, "0"))
    );
    const results = buildWeeklyMealSuggestions(candidates, targets, { today: TODAY });

    expect(results.filter((result) => result.reasons.includes("Slow cooker"))).toHaveLength(1);
  });

  it("accepts modestly higher sodium when obvious swaps are available", () => {
    const results = buildWeeklyMealSuggestions(
      [
        candidate("not-adjustable", {
          sodium: 1080,
          ingredientNames: ["chicken", "cured olives"],
        }),
        candidate("adjustable", {
          sodium: 1080,
          ingredientNames: ["chicken", "soy sauce", "salt"],
        }),
      ],
      [target("2026-08-25")],
      { today: TODAY }
    );

    expect(results[0]?.recipe.id).toBe("adjustable");
    expect(results[0]?.reasons).toContain("Simple sodium swaps");
  });

  it("keeps balanced as the unchanged default planning mode", () => {
    const candidates = [
      candidate("first", { name: "Chicken tray bake" }),
      candidate("second", { name: "Salmon rice bowl", ingredientNames: ["salmon", "rice"] }),
    ];
    const targets = [target("2026-08-25")];

    expect(buildWeeklyMealSuggestions(candidates, targets, { today: TODAY })).toEqual(
      buildWeeklyMealSuggestions(candidates, targets, { mode: "balanced", today: TODAY })
    );
  });

  it("makes fast dinners decisive in quick-week mode", () => {
    const results = buildWeeklyMealSuggestions(
      [
        candidate("slow-favourite", {
          name: "Sunday chicken braise",
          householdFavoriteCount: 1,
          totalMinutes: 120,
        }),
        candidate("quick", {
          name: "Quick chicken stir fry",
          totalMinutes: 20,
        }),
      ],
      [target("2026-08-25")],
      { mode: "quick-week", today: TODAY }
    );

    expect(results[0]?.recipe.id).toBe("quick");
    expect(results[0]?.reasons).toContain("Quick dinner");
  });

  it("favours batch-friendly freezer meals in meal-prep mode", () => {
    const results = buildWeeklyMealSuggestions(
      [
        candidate("ordinary", { name: "Chicken salad" }),
        candidate("batch", {
          name: "Make-ahead turkey chilli",
          ingredientNames: ["turkey", "beans", "tomato"],
          isFreezerFriendly: true,
          tags: ["meal prep"],
        }),
      ],
      [target("2026-08-25")],
      { mode: "meal-prep", today: TODAY }
    );

    expect(results[0]?.recipe.id).toBe("batch");
    expect(results[0]?.reasons).toContain("Meal prep");
  });

  it("favours Mediterranean-style plant and seafood meals in mediterranean mode", () => {
    const results = buildWeeklyMealSuggestions(
      [
        candidate("beef", {
          name: "Beef burger",
          householdFavoriteCount: 1,
          ingredientNames: ["beef", "bread"],
        }),
        candidate("greek", {
          name: "Greek chickpea and spinach bowls",
          cuisines: ["greek"],
          dietaryFlags: ["vegetarian", "dairy-free"],
          fruitVegCount: 4,
          ingredientNames: ["chickpeas", "spinach", "tomato", "olive oil", "lemon"],
        }),
      ],
      [target("2026-08-25")],
      { mode: "mediterranean", today: TODAY }
    );

    expect(results[0]?.recipe.id).toBe("greek");
    expect(results[0]?.reasons).toContain("Mediterranean-style");
  });

  it("produces stable drafts while allowing a refreshed alternative", () => {
    const candidates = Array.from({ length: 25 }, (_, index) =>
      candidate("option-" + String(index))
    );
    const targets = [target("2026-08-25"), target("2026-08-26")];
    const original = buildWeeklyMealSuggestions(candidates, targets, { seed: 0, today: TODAY });
    const repeat = buildWeeklyMealSuggestions(candidates, targets, { seed: 0, today: TODAY });
    const refreshed = buildWeeklyMealSuggestions(candidates, targets, { seed: 1, today: TODAY });

    expect(repeat).toEqual(original);
    expect(refreshed.map((result) => result.recipe.id)).not.toEqual(
      original.map((result) => result.recipe.id)
    );
    const distinctRefreshedRecipes = new Set(
      Array.from({ length: 6 }, (_, seed) =>
        buildWeeklyMealSuggestions(candidates, targets, { seed, today: TODAY })
      ).flatMap((draft) => draft.map((result) => result.recipe.id))
    );

    expect(distinctRefreshedRecipes.size).toBeGreaterThan(targets.length * 2);
  });
});
