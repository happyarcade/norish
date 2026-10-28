import { describe, expect, it } from "vitest";

import { classifyDairyAdaptation } from "@norish/api/parser";

describe("classifyDairyAdaptation", () => {
  it("recognizes recipes without dairy as potentially dairy-free", () => {
    expect(
      classifyDairyAdaptation({
        title: "Chicken fajitas",
        ingredientLines: ["4 chicken breasts", "3 bell peppers", "8 tortillas"],
      })
    ).toEqual({ status: "dairy-free-possible", substitutions: [] });
  });

  it("allows a simple sour cream substitution", () => {
    const result = classifyDairyAdaptation({
      title: "Slow cooker chicken fajitas",
      ingredientLines: ["4 chicken breasts", "sour cream, for serving"],
    });

    expect(result.status).toBe("dairy-free-possible");
    expect(result.substitutions).toEqual([
      "Use plant-based sour cream or unsweetened dairy-free yoghurt",
    ]);
  });

  it("does not mistake plant products or butter beans for dairy", () => {
    expect(
      classifyDairyAdaptation({
        title: "Butter bean curry",
        ingredientLines: ["2 cups butter beans", "1 cup coconut milk", "vegan butter"],
      }).status
    ).toBe("dairy-free-possible");
  });

  it("still detects dairy when a plant ingredient appears on the same line", () => {
    const result = classifyDairyAdaptation({
      title: "Creamy curry",
      ingredientLines: ["coconut milk plus a splash of cream"],
    });

    expect(result.status).toBe("dairy-free-possible");
    expect(result.substitutions).toContain("Use a plant-based cooking cream");
  });
  it("keeps explicit dairy-free recipes strict", () => {
    expect(
      classifyDairyAdaptation({
        title: "Dairy-free pasta",
        ingredientLines: ["plant-based cream"],
        explicitDairyFree: true,
      }).status
    ).toBe("dairy-free");
  });

  it("rejects dairy-centred and dairy-heavy recipes", () => {
    expect(
      classifyDairyAdaptation({
        title: "Mac and cheese",
        ingredientLines: ["2 cups cheddar", "1 cup whole milk", "2 tbsp butter"],
      }).status
    ).toBe("contains-dairy");

    expect(
      classifyDairyAdaptation({
        title: "Creamy dessert",
        ingredientLines: ["1 can condensed milk"],
      }).status
    ).toBe("contains-dairy");
  });
});
