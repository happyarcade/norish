import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import FiltersPanel from "@/components/Panel/consumers/filters-panel";

const filtersState = {
  searchTags: [] as string[],
  categories: [] as string[],
  suitableSlots: [] as string[],
  sourceDomains: [] as string[],
  nutritionDetail: null,
  filterMode: "AND" as const,
  sortMode: "dateDesc" as "dateDesc" | undefined,
  rawInput: "",
  showFavoritesOnly: false,
  minRating: null as number | null,
  maxCookingTime: null as number | null,
  maxSodium: null as number | null,
  maxCholesterol: null as number | null,
  minFiber: null as number | null,
};

const userPreferencesState = {
  showRatings: true,
  showFavorites: true,
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("motion/react", () => ({
  motion: {
    span: ({
      children,
      animate: _animate,
      initial: _initial,
      transition: _transition,
      ...props
    }: any) => <span {...props}>{children}</span>,
  },
}));

vi.mock("@/components/Panel/Panel", () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/planner/use-is-desktop", () => ({
  useIsDesktop: () => false,
}));

vi.mock("@/components/dashboard/search-field-toggles", () => ({
  default: () => <div>search-field-toggles</div>,
}));

vi.mock("@/components/skeleton/chip-skeleton", () => ({
  default: () => <div>loading</div>,
}));

vi.mock("@norish/ui/rating-stars", () => ({
  default: () => <div>rating-stars</div>,
}));

vi.mock("@/context/recipes-filters-context", () => ({
  useRecipesFiltersContext: () => ({
    filters: filtersState,
    setFilters: vi.fn(),
    clearFilters: vi.fn(),
  }),
}));

vi.mock("@/context/user-context", () => ({
  useUserContext: () => ({
    user: { preferences: userPreferencesState },
  }),
}));

vi.mock("@/hooks/config", () => ({
  useTagsQuery: () => ({
    tags: ["Dinner", "Quick", "Vegetarian", "Soup", "Pasta", "Spicy"],
    isLoading: false,
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    recipes: {
      listSourceOptions: {
        queryOptions: () => ({}),
      },
    },
  }),
}));

vi.mock("@heroui-v3/react", () => {
  const Button = ({ children, onPress, ...props }: any) => (
    <button onClick={onPress} {...props}>
      {children}
    </button>
  );
  const InputGroup = ({ children, fullWidth: _fullWidth, ...props }: any) => (
    <div {...props}>{children}</div>
  );
  const Modal = ({ children }: any) => <>{children}</>;

  InputGroup.Prefix = ({ children }: any) => <span>{children}</span>;
  InputGroup.Input = (props: any) => <input {...props} />;
  InputGroup.Suffix = ({ children }: any) => <span>{children}</span>;
  Modal.Backdrop = ({ children }: any) => <div>{children}</div>;
  Modal.Container = ({ children }: any) => <div>{children}</div>;
  Modal.Dialog = ({ children }: any) => <div>{children}</div>;
  Modal.CloseTrigger = () => null;
  Modal.Header = ({ children }: any) => <div>{children}</div>;
  Modal.Heading = ({ children }: any) => <h2>{children}</h2>;
  Modal.Body = ({ children, ...props }: any) => <div {...props}>{children}</div>;

  return {
    Button,
    InputGroup,
    Label: ({ children }: any) => <label>{children}</label>,
    Modal,
    TextField: ({ children }: any) => <div>{children}</div>,
    useOverlayState: ({ isOpen, onOpenChange }: any) => ({ isOpen, onOpenChange }),
  };
});

describe("FiltersPanel", () => {
  it("does not crash when sort mode is missing", () => {
    filtersState.sortMode = undefined;

    expect(() => render(<FiltersPanel open onOpenChange={vi.fn()} />)).not.toThrow();

    expect(screen.getByText("sortByDate")).toHaveAttribute("variant", "tertiary");
    expect(screen.getByText("sortByTitle")).toHaveAttribute("variant", "tertiary");

    filtersState.sortMode = "dateDesc";
  });

  it("limits tag container height and enables vertical scrolling", () => {
    filtersState.sortMode = "dateDesc";

    const { container } = render(<FiltersPanel open onOpenChange={vi.fn()} />);

    const tagContainer = container.querySelector(".overflow-y-auto");

    expect(tagContainer).toBeInTheDocument();
    expect(tagContainer).toHaveClass("max-h-[220px]");
  });

  it("hides favorites and rating section when both preferences are disabled", () => {
    userPreferencesState.showFavorites = false;
    userPreferencesState.showRatings = false;

    render(<FiltersPanel open onOpenChange={vi.fn()} />);

    expect(screen.queryByText("favoritesAndRating")).not.toBeInTheDocument();
    expect(screen.queryByText("favorites")).not.toBeInTheDocument();
    expect(screen.queryByText("rating-stars")).not.toBeInTheDocument();

    userPreferencesState.showFavorites = true;
    userPreferencesState.showRatings = true;
  });

  it("shows only favorites filter when ratings are disabled", () => {
    userPreferencesState.showFavorites = true;
    userPreferencesState.showRatings = false;

    render(<FiltersPanel open onOpenChange={vi.fn()} />);

    expect(screen.getByText("favoritesAndRating")).toBeInTheDocument();
    expect(screen.getByText("favorites")).toBeInTheDocument();
    expect(screen.queryByText("rating-stars")).not.toBeInTheDocument();

    userPreferencesState.showRatings = true;
  });

  it("shows only rating filter when favorites are disabled", () => {
    userPreferencesState.showFavorites = false;
    userPreferencesState.showRatings = true;

    render(<FiltersPanel open onOpenChange={vi.fn()} />);

    expect(screen.getByText("favoritesAndRating")).toBeInTheDocument();
    expect(screen.queryByText("favorites")).not.toBeInTheDocument();
    expect(screen.getByText("rating-stars")).toBeInTheDocument();

    userPreferencesState.showFavorites = true;
  });
});
