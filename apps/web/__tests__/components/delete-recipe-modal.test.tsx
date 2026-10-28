import { DeleteRecipeModal } from "@/components/shared/delete-recipe-modal";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const backdropMock = vi.fn(({ children }: any) => <div>{children}</div>);
const containerMock = vi.fn(({ children }: any) => <div>{children}</div>);

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: any) => <button type="button">{children}</button>,
}));

vi.mock("@heroui-v3/react", () => {
  const Modal = Object.assign(({ children }: any) => <div>{children}</div>, {
    Backdrop: (props: any) => backdropMock(props),
    Body: ({ children }: any) => <div>{children}</div>,
    CloseTrigger: () => null,
    Container: (props: any) => containerMock(props),
    Dialog: ({ children }: any) => <div>{children}</div>,
    Footer: ({ children }: any) => <div>{children}</div>,
    Header: ({ children }: any) => <div>{children}</div>,
    Heading: ({ children }: any) => <div>{children}</div>,
  });

  return {
    Modal,
    useOverlayState: ({ isOpen, onOpenChange }: any) => ({
      close: () => onOpenChange(false),
      isOpen,
    }),
  };
});

describe("DeleteRecipeModal", () => {
  it("renders above the mobile nav stack", () => {
    render(<DeleteRecipeModal isOpen recipeName="Soup" onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(backdropMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ className: "z-[1099]" })
    );
    expect(containerMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ className: "z-[1100]" })
    );
  });
});
