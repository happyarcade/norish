import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import SystemConvertMenu from "@/app/(app)/recipes/[id]/components/system-convert-menu";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/app/(app)/recipes/[id]/context", () => ({
  useRecipeContextRequired: () => ({
    recipe: { id: "r1", systemUsed: "metric", recipeIngredients: [] } as any,
    convertingTo: null,
    startConversion: () => {},
  }),
}));

// Permissions context: AI disabled -> conversion options should be empty when no data
vi.mock("@/context/user-context", () => ({
  useUserContext: () => ({ user: { preferences: { showConversionButton: true } } }),
}));

vi.mock("@/context/permissions-context", () => ({
  usePermissionsContext: () => ({ isAIEnabled: false }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, isDisabled }: any) => <button disabled={isDisabled}>{children}</button>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@heroui-v3/react", () => ({
  Dropdown: ({ children }: any) => <div>{children}</div>,
  DropdownTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownItem: ({ children }: any) => <div>{children}</div>,
  Button: ({ children }: any) => <button>{children}</button>,
  Spinner: () => <span />,
}));

vi.mock("@heroicons/react/20/solid", () => ({
  ArrowsRightLeftIcon: () => <span />,
  SparklesIcon: () => <span />,
}));

describe("SystemConvertMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps conversion discoverable when no alternative system is available", () => {
    render(<SystemConvertMenu />);

    expect(screen.getByRole("button", { name: "metric" })).toBeDisabled();
  });
});
