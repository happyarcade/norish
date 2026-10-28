import QuickFilterRow from "@/components/dashboard/quick-filter-row";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CanonicalRecipeFilters } from "@norish/shared-react/contexts";
import { DEFAULT_RECIPE_FILTERS } from "@norish/shared-react/contexts";

const setFilters = vi.fn();
let filtersState: CanonicalRecipeFilters = DEFAULT_RECIPE_FILTERS;

vi.mock("@/context/recipes-filters-context", () => ({
  useRecipesFiltersContext: () => ({
    filters: filtersState,
    setFilters,
    isHydrated: true,
  }),
}));

vi.mock("@heroui-v3/react", () => ({
  Button: ({ children, onPress, isDisabled, ...props }: any) => (
    <button disabled={isDisabled} onClick={onPress} {...props}>
      {children}
    </button>
  ),
}));

describe("QuickFilterRow", () => {
  beforeEach(() => {
    filtersState = { ...DEFAULT_RECIPE_FILTERS };
    setFilters.mockReset();
  });

  it("renders the quick choices and applies a preset without clearing other filters", () => {
    filtersState = {
      ...DEFAULT_RECIPE_FILTERS,
      categories: ["Dinner"],
      maxSodium: 800,
    };

    render(<QuickFilterRow />);

    expect(screen.getByRole("navigation", { name: "Quick recipe filters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dinner" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Slow Cooker" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: "< 1,000 mg sodium" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "Meal Prep" }));

    expect(setFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        categories: ["Dinner"],
        maxSodium: 800,
        searchTags: ["meal prep"],
      })
    );
  });
});
