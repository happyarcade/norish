import ImportRecipeModal from "@/components/shared/import-recipe-modal";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const modalMock = vi.hoisted(() => vi.fn());
const backdropMock = vi.hoisted(() => vi.fn());

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/context/recipes-context", () => ({
  useRecipesContext: () => ({
    importRecipe: vi.fn(),
    importRecipeWithAI: vi.fn(),
  }),
}));

vi.mock("@/context/permissions-context", () => ({
  usePermissionsContext: () => ({
    isAIEnabled: false,
  }),
}));

vi.mock("@heroui-v3/react", async () => {
  const React = await import("react");
  const TextFieldContext = React.createContext<{
    value: string;
    onChange: (value: string) => void;
  } | null>(null);

  const Modal = Object.assign(
    (props: any) => {
      modalMock(props);

      return props.state.isOpen ? <div>{props.children}</div> : null;
    },
    {
      Backdrop: (props: any) => {
        backdropMock(props);

        return <div>{props.children}</div>;
      },
      Body: ({ children }: any) => <div>{children}</div>,
      CloseTrigger: () => null,
      Container: ({ children }: any) => <div>{children}</div>,
      Dialog: ({ children }: any) => <div>{children}</div>,
      Footer: ({ children }: any) => <div>{children}</div>,
      Header: ({ children }: any) => <div>{children}</div>,
      Heading: ({ children }: any) => <div>{children}</div>,
    }
  );
  const InputGroup = Object.assign(({ children }: any) => <div>{children}</div>, {
    Input: ({ placeholder, type }: any) => {
      const field = React.useContext(TextFieldContext);

      return (
        <input
          placeholder={placeholder}
          type={type}
          value={field?.value ?? ""}
          onChange={(event) => field?.onChange(event.target.value)}
        />
      );
    },
  });

  return {
    Button: ({ children, isDisabled, onPress }: any) => (
      <button disabled={isDisabled} type="button" onClick={onPress}>
        {children}
      </button>
    ),
    InputGroup,
    Label: ({ children }: any) => <label>{children}</label>,
    Modal,
    TextField: ({ children, value, onChange }: any) => (
      <TextFieldContext.Provider value={{ value, onChange }}>{children}</TextFieldContext.Provider>
    ),
    useOverlayState: ({ isOpen, onOpenChange }: any) => ({ isOpen, onOpenChange }),
  };
});

describe("ImportRecipeModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders above desktop menu and overlay stacks", () => {
    render(<ImportRecipeModal isOpen onOpenChange={vi.fn()} />);

    expect(backdropMock).toHaveBeenCalledWith(
      expect.objectContaining({
        className: "z-[1100]",
      })
    );
  });

  it("fills the URL input from clipboard when modal opens", async () => {
    const readText = vi.fn().mockResolvedValue("https://example.com/recipe");

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText },
    });

    render(<ImportRecipeModal isOpen onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveValue("https://example.com/recipe");
    });
  });

  it("does not fill the URL input when clipboard text is not a URL", async () => {
    const readText = vi.fn().mockResolvedValue("just some text");

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText },
    });

    render(<ImportRecipeModal isOpen onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(readText).toHaveBeenCalled();
    });

    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("does not overwrite an existing URL on reopen", async () => {
    const readText = vi.fn().mockResolvedValue("https://example.com/recipe");

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText },
    });

    const { rerender } = render(<ImportRecipeModal isOpen onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveValue("https://example.com/recipe");
    });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "https://my-custom-url.com" },
    });

    rerender(<ImportRecipeModal isOpen={false} onOpenChange={vi.fn()} />);
    rerender(<ImportRecipeModal isOpen onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(readText).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByRole("textbox")).toHaveValue("https://my-custom-url.com");
  });
});
