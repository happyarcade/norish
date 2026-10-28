import type { ComponentType, ReactNode } from "react";
import NutritionCard from "@/components/recipes/nutrition-card";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canEdit: true,
  recipe: {
    calories: 420,
    carbs: 32,
    fat: 18,
    id: "recipe-1",
    name: "Fish & Bean Bake",
    nutritionDetails: {
      nutrients: {
        cholesterol: {
          label: "Cholesterol",
          unit: "mg",
          value: 176,
        },
      },
    },
    protein: 36,
    servings: 4,
    userId: "user-1",
  },
}));

vi.mock("@/app/(app)/recipes/[id]/context", () => ({
  useRecipeContext: () => ({
    estimateNutrition: vi.fn(),
    isEstimatingNutrition: false,
    recipe: mocks.recipe,
  }),
}));

vi.mock("@/context/permissions-context", () => ({
  usePermissionsContext: () => ({
    canEditRecipe: () => mocks.canEdit,
    isAIEnabled: false,
  }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/shared/ai-action-button", () => ({
  default: () => null,
}));

vi.mock("@/components/recipes/nutrition-portion-control", () => ({
  default: () => null,
}));

vi.mock("@/components/ui/card", () => {
  const Card = ({ children }: { children: ReactNode }) => <div>{children}</div>;

  return {
    Card: Object.assign(Card, {
      Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    }),
  };
});

vi.mock("@/components/ui/button", () => ({
  Button: ({
    as: Component = "button",
    children,
    href,
  }: {
    as?: ComponentType<{ children: ReactNode; href?: string }> | "button";
    children: ReactNode;
    href?: string;
  }) => <Component href={href}>{children}</Component>,
}));

vi.mock("@heroui-v3/react", () => ({
  Separator: () => <hr />,
  Skeleton: () => <span />,
}));

describe("NutritionCard", () => {
  beforeEach(() => {
    mocks.canEdit = true;
    mocks.recipe.nutritionDetails.nutrients.cholesterol.value = 176;
  });

  it("links suspicious values to the filtered nutrition review queue", () => {
    render(<NutritionCard />);

    const link = screen.getByRole("link", { name: "Review values" });

    expect(link.getAttribute("href")).toBe(
      "/recipes/review/nutrition?search=Fish%20%26%20Bean%20Bake"
    );
    expect(
      screen.getByText("Cholesterol is high enough to verify the serving basis.")
    ).toBeTruthy();
  });

  it("keeps the review action hidden without edit permission", () => {
    mocks.canEdit = false;

    render(<NutritionCard />);

    expect(screen.queryByRole("link", { name: "Review values" })).toBeNull();
  });

  it("keeps credible nutrition uncluttered", () => {
    mocks.recipe.nutritionDetails.nutrients.cholesterol.value = 50;

    render(<NutritionCard />);

    expect(screen.queryByRole("link", { name: "Review values" })).toBeNull();
  });
});
