import { describe, expect, it } from "vitest";

import { PantryIngredientReconcileSchema } from "@norish/shared/contracts/zod";

describe("PantryIngredientReconcileSchema", () => {
  const firstId = "11111111-1111-4111-8111-111111111111";
  const secondId = "22222222-2222-4222-8222-222222222222";

  it("accepts the three post-cooking outcomes", () => {
    const result = PantryIngredientReconcileSchema.safeParse({
      items: [
        { id: firstId, outcome: "on_hand" },
        { id: secondId, outcome: "used_up" },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects duplicate pantry ingredients", () => {
    const result = PantryIngredientReconcileSchema.safeParse({
      items: [
        { id: firstId, outcome: "on_hand" },
        { id: firstId, outcome: "low" },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("requires at least one pantry ingredient", () => {
    expect(PantryIngredientReconcileSchema.safeParse({ items: [] }).success).toBe(false);
  });
});
