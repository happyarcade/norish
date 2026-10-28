import type { PlannerSuggestedWeekResult } from "@/hooks/planner";
import PlannerWeekSuggestionsPanel from "@/components/planner/planner-week-suggestions-panel";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/planner/use-is-desktop", () => ({
  useIsDesktop: () => true,
}));

vi.mock("@/components/Panel/Panel", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@heroui-v3/react", () => {
  const Button = ({
    children,
    onPress,
    isDisabled,
    isPending,
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    isDisabled?: boolean;
    isPending?: boolean;
    "aria-label"?: string;
  }) => (
    <button
      aria-label={ariaLabel}
      disabled={isDisabled || isPending}
      type="button"
      onClick={onPress}
    >
      {children}
    </button>
  );
  const Checkbox = ({
    isSelected,
    isDisabled,
    onChange,
    "aria-label": ariaLabel,
  }: {
    isSelected: boolean;
    isDisabled?: boolean;
    onChange: (selected: boolean) => void;
    "aria-label": string;
  }) => (
    <input
      aria-label={ariaLabel}
      checked={isSelected}
      disabled={isDisabled}
      type="checkbox"
      onChange={(event) => onChange(event.currentTarget.checked)}
    />
  );
  const Modal = ({ children, state }: { children: React.ReactNode; state: { isOpen: boolean } }) =>
    state.isOpen ? <div>{children}</div> : null;
  const Tooltip = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;

  Object.assign(Checkbox, {
    Content: Container,
    Control: Container,
    Indicator: () => null,
  });
  Object.assign(Modal, {
    Backdrop: Container,
    Container,
    Dialog: Container,
    CloseTrigger: () => null,
    Header: Container,
    Heading: Container,
    Body: Container,
  });
  Object.assign(Tooltip, { Content: Container });

  return {
    Button,
    Checkbox,
    Modal,
    Spinner: () => <span role="status">Loading</span>,
    Tooltip,
    useOverlayState: ({
      isOpen,
      onOpenChange,
    }: {
      isOpen: boolean;
      onOpenChange: (open: boolean) => void;
    }) => ({ isOpen, onOpenChange }),
  };
});

const draft: PlannerSuggestedWeekResult = {
  candidateCount: 3795,
  openMealCount: 2,
  suggestions: [
    {
      date: "2026-08-25",
      plannerSlotDefinitionId: "slot-lunch",
      slotKey: "lunch",
      slotLabel: "Lunch",
      recipe: {
        id: "recipe-1",
        name: "Greek Chicken Bowls",
        image: null,
        protein: 35,
        sodium: 420,
        totalMinutes: 35,
        cuisines: ["greek"],
        pantryIngredientNames: ["chicken", "lemon"],
        additionalIngredientNames: ["couscous", "cucumber"],
      },
      reasons: ["High protein", "Lower sodium"],
      score: 82,
    },
    {
      date: "2026-08-26",
      plannerSlotDefinitionId: "slot-dinner",
      slotKey: "dinner",
      slotLabel: "Dinner",
      recipe: {
        id: "recipe-2",
        name: "Slow Cooker Lentil Curry",
        image: null,
        protein: 22,
        sodium: 390,
        totalMinutes: 240,
        cuisines: ["indian"],
        pantryIngredientNames: ["lentils"],
        additionalIngredientNames: ["coconut milk", "spinach"],
      },
      reasons: ["Slow cooker", "Meal prep"],
      score: 79,
    },
  ],
};

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof PlannerWeekSuggestionsPanel>> = {}
) {
  const onApply = vi.fn().mockResolvedValue(undefined);
  const onRefresh = vi.fn();
  const onReplace = vi.fn().mockResolvedValue(null);
  const onModeChange = vi.fn();
  const onScopeChange = vi.fn();
  const props = {
    open: true,
    data: draft,
    error: null,
    isLoading: false,
    isRefreshing: false,
    isApplying: false,
    mode: "balanced" as const,
    scope: "dinners" as const,
    onOpenChange: vi.fn(),
    onModeChange,
    onScopeChange,
    onRefresh,
    onReplace,
    onApply,
    ...overrides,
  };

  const result = render(<PlannerWeekSuggestionsPanel {...props} />);

  return { ...result, onApply, onModeChange, onRefresh, onReplace, onScopeChange, props };
}

describe("weekly meal suggestions review", () => {
  it("starts with every suggested meal selected", async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add 2 meals" })).toBeEnabled();
    });

    expect(screen.getByRole("checkbox", { name: "Include Greek Chicken Bowls" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Include Slow Cooker Lentil Curry" })
    ).toBeChecked();
  });

  it("only approves meals left selected by the household", async () => {
    const { onApply } = renderPanel();

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "Include Greek Chicken Bowls" })).toBeChecked();
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "Include Slow Cooker Lentil Curry" }));
    fireEvent.click(screen.getByRole("button", { name: "Add 1 meal" }));

    expect(onApply).toHaveBeenCalledWith([draft.suggestions[0]]);
  });

  it("keeps loading stable before a draft is returned", () => {
    renderPanel({ data: undefined, isLoading: true });

    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(screen.getByText("Finding meals")).toBeInTheDocument();
  });

  it("requests an alternative draft without approving meals", () => {
    const { onApply, onRefresh } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Refresh meal suggestions" }));

    expect(onRefresh).toHaveBeenCalledOnce();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("shows a pantry-aware grocery impact for the selected draft", async () => {
    renderPanel();

    expect(await screen.findByText("Grocery impact")).toBeInTheDocument();
    expect(screen.getByText("3 pantry matches · ~4 other ingredients")).toBeInTheDocument();
    expect(screen.getByText("2 on hand, ~2 others")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Include Slow Cooker Lentil Curry" }));

    expect(screen.getByText("2 pantry matches · ~2 other ingredients")).toBeInTheDocument();
  });

  it("changes scope and planning mode without approving the draft", () => {
    const { onApply, onModeChange, onScopeChange } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Lunch + dinner" }));
    fireEvent.click(screen.getByRole("button", { name: "Meal prep" }));

    expect(onScopeChange).toHaveBeenCalledWith("lunch-dinner");
    expect(onModeChange).toHaveBeenCalledWith("meal-prep");
    expect(onApply).not.toHaveBeenCalled();
  });

  it("replaces one meal without changing the rest of the draft", async () => {
    const replacement: PlannerSuggestedWeekResult["suggestions"][number] = {
      ...draft.suggestions[0],
      recipe: {
        ...draft.suggestions[0]!.recipe,
        id: "recipe-3",
        name: "Mediterranean Salmon Traybake",
      },
    };
    const onReplace = vi.fn().mockResolvedValue(replacement);
    const { onApply } = renderPanel({ onReplace });

    fireEvent.click(screen.getByRole("button", { name: "Replace Greek Chicken Bowls" }));

    expect(await screen.findByText("Mediterranean Salmon Traybake")).toBeInTheDocument();
    expect(screen.getByText("Slow Cooker Lentil Curry")).toBeInTheDocument();
    expect(onReplace).toHaveBeenCalledWith(draft.suggestions[0], draft.suggestions);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add 2 meals" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Add 2 meals" }));

    expect(onApply).toHaveBeenCalledWith([replacement, draft.suggestions[1]]);
  });
});
