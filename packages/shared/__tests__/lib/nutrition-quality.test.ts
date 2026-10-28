import { describe, expect, it } from "vitest";

import {
  auditRecipeNutrition,
  compareKnownNutritionSwapCandidates,
  divideRecipeNutritionByServings,
  getKnownNutritionConfidence,
  getKnownNutritionMetricValue,
  scoreKnownNutritionSwapCandidate,
} from "../../src/lib/nutrition-quality";

const baseRecipe = {
  calories: 400,
  protein: 24,
  carbs: 40,
  fat: 14,
};

function withNutrients(nutrients: Record<string, { value: number; label?: string }>) {
  return {
    ...baseRecipe,
    nutritionDetails: {
      nutrients,
    },
  };
}

describe("nutrition quality helpers", () => {
  it("separates missing nutrition from a real zero value", () => {
    expect(getKnownNutritionMetricValue(baseRecipe, "sodium")).toBeNull();
    expect(
      getKnownNutritionMetricValue(
        withNutrients({
          sodiumContent: { value: 0, label: "Sodium" },
        }),
        "sodium"
      )
    ).toBe(0);
  });

  it("assigns confidence from available nutrition depth", () => {
    expect(getKnownNutritionConfidence({})).toBe("missing");
    expect(getKnownNutritionConfidence(baseRecipe)).toBe("basic");
    expect(
      getKnownNutritionConfidence(
        withNutrients({
          sodiumContent: { value: 320, label: "Sodium" },
          fiberContent: { value: 8, label: "Fiber" },
        })
      )
    ).toBe("extended");
  });

  it("scores helpful swap movement without showing a public score", () => {
    const currentContext = [
      { metric: "sodium" as const, value: 900 },
      { metric: "fiber" as const, value: 2 },
    ];
    const better = withNutrients({
      sodiumContent: { value: 320, label: "Sodium" },
      fiberContent: { value: 7, label: "Fiber" },
    });
    const worse = withNutrients({
      sodiumContent: { value: 1100, label: "Sodium" },
      fiberContent: { value: 1, label: "Fiber" },
    });

    expect(scoreKnownNutritionSwapCandidate(better, currentContext).score).toBeGreaterThan(
      scoreKnownNutritionSwapCandidate(worse, currentContext).score
    );
    expect(compareKnownNutritionSwapCandidates(better, worse, currentContext)).toBeLessThan(0);
  });

  it("flags a high per-serving cholesterol value for review without guessing a correction", () => {
    const audit = auditRecipeNutrition({
      ...withNutrients({
        cholesterolContent: { value: 176, label: "Cholesterol" },
      }),
      servings: 4,
    });

    expect(audit.status).toBe("review");
    expect(audit.suggestedAction).toBe("review");
    expect(audit.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "high_cholesterol", value: 176 })])
    );
  });

  it("detects nutrition that is likely stored for the whole recipe", () => {
    const audit = auditRecipeNutrition({
      servings: 4,
      calories: 2200,
      protein: 160,
      carbs: 180,
      fat: 80,
      nutritionDetails: {
        nutrients: {
          sodiumContent: { value: 2400, label: "Sodium", unit: "mg" },
        },
      },
    });

    expect(audit.status).toBe("review");
    expect(audit.suggestedAction).toBe("divideByServings");
    expect(audit.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "likely_whole_recipe" })])
    );
  });

  it("converts whole-recipe nutrition to per-serving values", () => {
    const corrected = divideRecipeNutritionByServings({
      servings: 4,
      calories: 2200,
      protein: 160,
      carbs: 180,
      fat: 80,
      nutritionDetails: {
        servingSize: "whole recipe",
        nutrients: {
          sodiumContent: { value: 2400, label: "Sodium", unit: "mg", raw: "2400 mg" },
          fiberContent: { value: 24, label: "Fiber", unit: "g", raw: "24 g" },
        },
      },
    });

    expect(corrected).toMatchObject({
      calories: 550,
      protein: 40,
      carbs: 45,
      fat: 20,
      nutritionDetails: {
        servingSize: "1 serving",
        nutrients: {
          sodiumContent: { value: 600, raw: "600 mg" },
          fiberContent: { value: 6, raw: "6 g" },
        },
      },
    });
  });

  it("does not penalize a coherent per-serving nutrition record", () => {
    const audit = auditRecipeNutrition({
      servings: 4,
      calories: 420,
      protein: 32,
      carbs: 42,
      fat: 14,
      nutritionDetails: {
        servingSize: "1 serving",
        nutrients: {
          sodiumContent: { value: 480, label: "Sodium", unit: "mg" },
          cholesterolContent: { value: 65, label: "Cholesterol", unit: "mg" },
          fiberContent: { value: 8, label: "Fiber", unit: "g" },
          sugarContent: { value: 7, label: "Sugar", unit: "g" },
          saturatedFatContent: { value: 4, label: "Saturated fat", unit: "g" },
        },
      },
    });

    expect(audit.status).toBe("credible");
    expect(audit.confidenceScore).toBeGreaterThanOrEqual(0.85);
    expect(audit.issues).toEqual([]);
  });
});
