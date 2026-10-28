// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  normalizeNutritionMetricForStorage,
  parseNutritionValue,
} from "@norish/api/parser/parsers/nutrition";

describe("nutrition parser", () => {
  it("parses numeric nutrition values from common strings", () => {
    expect(parseNutritionValue("5 grams fiber")).toBe(5);
    expect(parseNutritionValue("1.23 milligram of sodium")).toBe(1.23);
    expect(parseNutritionValue("1,234 mg")).toBe(1234);
  });

  it("normalizes gram-based nutrient units", () => {
    expect(normalizeNutritionMetricForStorage("fiberContent", "5 grams fiber")).toMatchObject({
      value: 5,
      unit: "g",
      raw: "5 grams fiber",
    });
    expect(
      normalizeNutritionMetricForStorage("saturatedFatContent", "5 grams saturated fat")
    ).toMatchObject({
      value: 5,
      unit: "g",
    });
  });

  it("normalizes sodium to milligrams", () => {
    expect(normalizeNutritionMetricForStorage("sodiumContent", "480 mg sodium")).toMatchObject({
      value: 480,
      unit: "mg",
    });
    expect(normalizeNutritionMetricForStorage("sodiumContent", "1 g sodium")).toMatchObject({
      value: 1000,
      unit: "mg",
    });
    expect(normalizeNutritionMetricForStorage("sodiumContent", "1 g salt")).toMatchObject({
      value: 393,
      unit: "mg",
    });
  });

  it("treats tiny 'milligram of sodium' exports as source salt grams", () => {
    expect(
      normalizeNutritionMetricForStorage("sodiumContent", "1.23 milligram of sodium")
    ).toMatchObject({
      value: 484,
      unit: "mg",
    });
  });
});
