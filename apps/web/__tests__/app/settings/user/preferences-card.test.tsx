import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import PreferencesCard from "@/app/(app)/settings/user/components/preferences-card";

const mockContext = vi.hoisted(() => ({
  user: { preferences: { timersEnabled: true } },
  updatePreferences: vi.fn().mockResolvedValue(undefined),
  isUpdatingPreferences: false,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const mockRouterRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

vi.mock("@/app/(app)/settings/user/context", () => ({
  useUserSettingsContext: () => ({ ...mockContext, user: mockContext.user }),
}));

let timersMock = { timersEnabled: true, globalEnabled: true } as any;

vi.mock("@/hooks/config", () => ({
  useTimersEnabledQuery: () => timersMock,
  useLocaleConfigQuery: () => ({
    enabledLocales: [
      { code: "en", name: "English" },
      { code: "de-informal", name: "Deutsch" },
    ],
    defaultLocale: "en",
  }),
}));

vi.mock("@heroui-v3/react", () => {
  const Card = ({ children }: any) => <div>{children}</div>;
  const Chip = ({ children }: any) => <span>{children}</span>;
  const InputGroup = ({ children }: any) => <div>{children}</div>;
  const ListBox = ({ children }: any) => <>{children}</>;
  const Select = ({ children, selectedKey, onSelectionChange, isDisabled, ...props }: any) => (
    <select
      aria-label={props["aria-label"]}
      disabled={isDisabled}
      value={selectedKey ?? ""}
      onChange={(event) => onSelectionChange?.(event.target.value)}
    >
      {children}
    </select>
  );
  const Switch = ({ isSelected, isDisabled, onChange }: any) => (
    <button
      aria-pressed={isSelected}
      aria-label="toggle"
      disabled={isDisabled}
      type="button"
      onClick={() => onChange?.(!isSelected)}
    >
      toggle
    </button>
  );

  Card.Header = ({ children }: any) => <div>{children}</div>;
  Card.Content = ({ children }: any) => <div>{children}</div>;
  Chip.Label = ({ children }: any) => <>{children}</>;
  InputGroup.Input = (props: any) => <input {...props} />;
  InputGroup.Suffix = ({ children }: any) => <span>{children}</span>;
  ListBox.Item = ({ children, id }: any) => <option value={id}>{children}</option>;
  ListBox.ItemIndicator = () => null;
  Select.Trigger = () => null;
  Select.Value = () => null;
  Select.Indicator = () => null;
  Select.Popover = ({ children }: any) => <>{children}</>;
  Switch.Content = () => null;
  Switch.Control = () => null;
  Switch.Thumb = () => null;

  return {
    Button: ({ children, onPress, ...props }: any) => (
      <button type="button" onClick={onPress} {...props}>
        {children}
      </button>
    ),
    Card,
    Chip,
    InputGroup,
    Label: ({ children }: any) => <label>{children}</label>,
    ListBox,
    Select,
    Switch,
    TextField: ({ children }: any) => <div>{children}</div>,
  };
});

describe("PreferencesCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows enabled when user preference is true and no global disable", async () => {
    mockContext.user = { preferences: { timersEnabled: true } } as any;

    timersMock = { timersEnabled: true, globalEnabled: true } as any;

    render(<PreferencesCard />);

    // Description should be visible
    expect(screen.getByText("description")).toBeInTheDocument();

    // Locate the timers section parent container (contains the toggle)
    // Find all toggles; timers toggle should be first
    const toggles = screen.getAllByRole("button", { name: /toggle/i });
    const timersToggle = toggles[0];

    expect(timersToggle).toHaveAttribute("aria-pressed", "true");
    expect(timersToggle).not.toBeDisabled();
  });

  it("shows disabled (user-level) when user preference is false and global enabled", async () => {
    mockContext.user = { preferences: { timersEnabled: false } } as any;

    timersMock = { timersEnabled: true, globalEnabled: true } as any;

    render(<PreferencesCard />);

    const toggles = screen.getAllByRole("button", { name: /toggle/i });
    const timersToggle = toggles[0];

    expect(timersToggle).toHaveAttribute("aria-pressed", "false");
    expect(timersToggle).not.toBeDisabled();

    fireEvent.click(timersToggle);

    await waitFor(() => {
      expect(mockContext.updatePreferences).toHaveBeenCalledWith({ timersEnabled: true });
    });
  });

  it("hides the timer toggle when globally disabled", async () => {
    // Set global disabled
    timersMock = { timersEnabled: false, globalEnabled: false } as any;

    render(<PreferencesCard />);

    // The card description should remain visible
    expect(screen.getByText("description")).toBeInTheDocument();

    // Timer toggle should not be rendered, but conversion toggle may still be present
    const titleDiv = screen.queryByText("timers.title");
    const timersToggle = titleDiv?.closest("div")?.parentElement?.querySelector("button") ?? null;

    expect(timersToggle).toBeNull();
  });

  it("toggles showConversionButton preference", async () => {
    mockContext.user = { preferences: { timersEnabled: true, showConversionButton: true } } as any;

    timersMock = { timersEnabled: true, globalEnabled: true } as any;

    render(<PreferencesCard />);

    // The second toggle controls conversion button visibility
    const toggles = screen.getAllByRole("button", { name: /toggle/i });
    const conversionToggle = toggles[1];

    expect(conversionToggle).toHaveAttribute("aria-pressed", "true");
    expect(conversionToggle).not.toBeDisabled();

    fireEvent.click(conversionToggle);

    await waitFor(() => {
      expect(mockContext.updatePreferences).toHaveBeenCalledWith({ showConversionButton: false });
    });
  });

  it("toggles showRatings preference", async () => {
    mockContext.user = { preferences: { timersEnabled: true, showRatings: true } } as any;

    timersMock = { timersEnabled: true, globalEnabled: true } as any;

    render(<PreferencesCard />);

    const toggles = screen.getAllByRole("button", { name: /toggle/i });
    const ratingsToggle = toggles[2];

    expect(ratingsToggle).toHaveAttribute("aria-pressed", "true");
    expect(ratingsToggle).not.toBeDisabled();

    fireEvent.click(ratingsToggle);

    await waitFor(() => {
      expect(mockContext.updatePreferences).toHaveBeenCalledWith({ showRatings: false });
    });
  });

  it("toggles showFavorites preference", async () => {
    mockContext.user = { preferences: { timersEnabled: true, showFavorites: true } } as any;

    timersMock = { timersEnabled: true, globalEnabled: true } as any;

    render(<PreferencesCard />);

    const toggles = screen.getAllByRole("button", { name: /toggle/i });
    const favoritesToggle = toggles[3];

    expect(favoritesToggle).toHaveAttribute("aria-pressed", "true");
    expect(favoritesToggle).not.toBeDisabled();

    fireEvent.click(favoritesToggle);

    await waitFor(() => {
      expect(mockContext.updatePreferences).toHaveBeenCalledWith({ showFavorites: false });
    });
  });

  it("renders language dropdown with current locale", () => {
    mockContext.user = { preferences: { timersEnabled: true, locale: "en" } } as any;

    timersMock = { timersEnabled: true, globalEnabled: true } as any;

    render(<PreferencesCard />);

    // Language section should be visible
    expect(screen.getByText("language.title")).toBeInTheDocument();
    expect(screen.getByText("language.description")).toBeInTheDocument();

    // Language select should be rendered
    const select = screen.getByRole("combobox", { name: /language\.title/i });

    expect(select).toBeInTheDocument();
  });

  it("calls updatePreferences with locale when language is changed", async () => {
    mockContext.user = { preferences: { timersEnabled: true, locale: "en" } } as any;

    timersMock = { timersEnabled: true, globalEnabled: true } as any;

    render(<PreferencesCard />);

    const select = screen.getByRole("combobox", { name: /language\.title/i });

    fireEvent.change(select, { target: { value: "de-informal" } });

    await waitFor(() => {
      expect(mockContext.updatePreferences).toHaveBeenCalledWith({ locale: "de-informal" });
    });
  });
});
