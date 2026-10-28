import type { ReactNode } from "react";
import { MarkCookedModal } from "@/components/recipes/mark-cooked-modal";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reconcilePantryIngredients: vi.fn(),
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
    children,
    isDisabled,
    isLoading,
    onPress,
    ...props
  }: {
    children: ReactNode;
    isDisabled?: boolean;
    isLoading?: boolean;
    onPress?: () => void;
    [key: string]: unknown;
  }) => {
    const { color, fullWidth, isIconOnly, radius, variant, ...buttonProps } = props;

    void color;
    void fullWidth;
    void isIconOnly;
    void radius;
    void variant;

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
});
