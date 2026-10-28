import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { UnsavedChangesChip } from "@/app/(app)/settings/admin/components/unsaved-changes-chip";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => (key === "unsavedChanges" ? "Unsaved changes" : key),
}));

vi.mock("@heroui-v3/react", () => {
  const Chip = Object.assign(
    ({
      children,
      color,
      size,
      variant,
    }: {
      children: ReactNode;
      color?: string;
      size?: string;
      variant?: string;
    }) => (
      <div data-color={color} data-size={size} data-variant={variant}>
        {children}
      </div>
    ),
    {
      Label: ({ children }: { children: ReactNode }) => (
        <span data-slot="chip-label">{children}</span>
      ),
    }
  );

  return { Chip };
});

describe("UnsavedChangesChip", () => {
  it("renders translated unsaved changes text", () => {
    render(<UnsavedChangesChip />);

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("uses the warning soft small chip style", () => {
    const { container } = render(<UnsavedChangesChip />);
    const chip = container.firstElementChild;

    expect(chip).toHaveAttribute("data-color", "warning");
    expect(chip).toHaveAttribute("data-size", "sm");
    expect(chip).toHaveAttribute("data-variant", "soft");
    expect(screen.getByText("Unsaved changes")).toHaveAttribute("data-slot", "chip-label");
  });
});
