import type { ComponentType, ReactNode } from "react";
import { MarkCookedModal } from "@/components/recipes/mark-cooked-modal";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reconcilePantryIngredients: vi.fn(),
  recipe: {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Soup",
    nutritionReview: {
      confidenceScore: 0.9,
      hasCriticalIssue: false,
      issueCount: 0,
      reviewed: false,
      status: "credible",
    },
  },
}));

vi.mock("@/hooks/pantry", () => ({
  usePantryMutations: () => ({
    isReconciling: false,
    reconcilePantryIngredients: mocks.reconcilePantryIngredients,
  }),
  usePantryQuery: () => ({
    isLoading: false,
    items: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        isStaple: true,
        lastConfirmedAt: new Date("2026-10-01T12:00:00Z"),
        name: "Salt",
        normalizedName: "salt",
        status: "on_hand",
        userId: "user-1",
      },
    ],
  }),
}));

vi.mock("@/hooks/recipes", () => ({
  useRecipeIngredients: () => ({ ingredients: [], isLoading: false }),
  useRecipeQuery: () => ({ recipe: mocks.recipe }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    const messages: Record<string, string> = {
      description: "Choose what is true after cooking.",
      keepUnchanged: "Keep pantry unchanged",
      loading: "Checking pantry matches...",
      nothingAutomatic: "Nothing changes until you confirm.",
      onHand: "On hand",
      runningLow: "Running low",
      statusFor: `Pantry status for ${values?.name ?? "item"}`,
      title: "Update pantry",
      usedUp: "Used up",
    };

    return messages[key] ?? key;
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    as: Component = "button",
    children,
    href,
    isDisabled,
    isLoading,
    onPress,
    ...props
  }: {
    children: ReactNode;
    as?:
      | ComponentType<{
          children: ReactNode;
          href?: string;
          onClick?: () => void;
        }>
      | "button";
    href?: string;
    isDisabled?: boolean;
    isLoading?: boolean;
    onPress?: () => void;
    [key: string]: unknown;
  }) => {
    const { color, fullWidth, isIconOnly, radius, startContent, variant, ...buttonProps } = props;

    void color;
    void fullWidth;
    void isIconOnly;
    void radius;
    void startContent;
    void variant;

    if (Component !== "button") {
      return (
        <Component href={href} onClick={onPress} {...buttonProps}>
          {children}
        </Component>
      );
    }

    return (
      <button disabled={isDisabled || isLoading} onClick={onPress} {...buttonProps}>
        {children}
      </button>
    );
  },
}));

vi.mock("@heroui-v3/react/date-input-group", () => {
  const Root = ({ children }: { children: ReactNode }) => <div>{children}</div>;

  return {
    DateInputGroup: Object.assign(Root, {
      Input: () => null,
      Segment: () => null,
      Suffix: ({ children }: { children: ReactNode }) => <>{children}</>,
    }),
  };
});

vi.mock("@heroui-v3/react", () => {
  const Container = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  const Modal = ({ children }: { children: ReactNode }) => <>{children}</>;
  const DatePicker = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  const Calendar = ({ children }: { children: ReactNode }) => <div>{children}</div>;

  return {
    ButtonGroup: ({
      "aria-label": ariaLabel,
      children,
    }: {
      "aria-label": string;
      children: ReactNode;
    }) => (
      <div aria-label={ariaLabel} role="group">
        {children}
      </div>
    ),
    Calendar: Object.assign(Calendar, {
      Cell: () => null,
      Grid: Container,
      GridBody: () => null,
      GridHeader: () => null,
      Header: Container,
      HeaderCell: () => null,
      Heading: () => null,
      NavButton: () => null,
    }),
    DatePicker: Object.assign(DatePicker, {
      Popover: Container,
      Trigger: Container,
      TriggerIndicator: () => null,
    }),
    Label: ({ children }: { children: ReactNode }) => <label>{children}</label>,
    Modal: Object.assign(Modal, {
      Backdrop: Container,
      Body: Container,
      CloseTrigger: ({ "aria-label": ariaLabel }: { "aria-label": string }) => (
        <button aria-label={ariaLabel} />
      ),
      Container,
      Dialog: Container,
      Footer: Container,
      Header: Container,
      Heading: Container,
    }),
    Spinner: () => <span>Loading</span>,
    useOverlayState: () => ({}),
  };
});

describe("MarkCookedModal", () => {
  beforeEach(() => {
    mocks.reconcilePantryIngredients.mockReset();
    mocks.reconcilePantryIngredients.mockResolvedValue({ removedIds: [], updatedItems: [] });
    mocks.recipe.nutritionReview.reviewed = false;
    mocks.recipe.nutritionReview.status = "credible";
  });

  it("offers accessible pantry outcomes and applies the reviewed choice", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <MarkCookedModal
        ingredientNames={["Salt"]}
        isOpen
        recipeName="Soup"
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark cooked" }));

    expect(await screen.findByRole("group", { name: "Pantry status for Salt" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "On hand" }).getAttribute("aria-pressed")).toBe(
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "Used up" }));
    fireEvent.click(screen.getByRole("button", { name: "Update pantry" }));

    await waitFor(() =>
      expect(mocks.reconcilePantryIngredients).toHaveBeenCalledWith([
        { id: "11111111-1111-4111-8111-111111111111", outcome: "used_up" },
      ])
    );
  });

  it("surfaces outstanding nutrition review before recording a cooked meal", () => {
    mocks.recipe.nutritionReview.status = "review";

    render(
      <MarkCookedModal
        isOpen
        recipeId={mocks.recipe.id}
        recipeName={mocks.recipe.name}
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
      />
    );

    expect(
      screen.getByText(/planner totals may be unreliable until they are reviewed/i)
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Review nutrition" }).getAttribute("href")).toBe(
      "/recipes/review/nutrition?search=Soup"
    );
  });
});
