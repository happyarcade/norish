import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import ProfileCard from "@/app/(app)/settings/user/components/profile-card";

const mockContext = vi.hoisted(() => ({
  user: { name: "Alice", email: "alice@example.com", image: null },
  updateName: vi.fn().mockResolvedValue(undefined),
  updateImage: vi.fn().mockResolvedValue(undefined),
  deleteImage: vi.fn().mockResolvedValue(undefined),
  isDeletingAvatar: false,
}));

let mockUser: { name: string; email: string; image: string | null } = mockContext.user;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/app/(app)/settings/user/context", () => ({
  useUserSettingsContext: () => ({ ...mockContext, user: mockUser }),
}));

vi.mock("@heroui-v3/react", () => {
  const Avatar = ({ children, onClick }: any) => (
    <button aria-label="avatar-trigger" type="button" onClick={onClick}>
      {children}
    </button>
  );
  const Card = ({ children }: any) => <div>{children}</div>;
  const InputGroup = ({ children }: any) => <>{children}</>;

  Avatar.Image = ({ src }: any) => <img alt="profile avatar" src={src} />;
  Avatar.Fallback = ({ children }: any) => <span>{children}</span>;
  Card.Header = ({ children }: any) => <div>{children}</div>;
  Card.Content = ({ children }: any) => <div>{children}</div>;
  InputGroup.Input = () => null;

  return {
    Avatar,
    Button: ({ children, onPress, isDisabled, type = "button" }: any) => (
      <button disabled={isDisabled} type={type} onClick={onPress}>
        {children}
      </button>
    ),
    Card,
    InputGroup,
    Label: ({ children }: any) => <label>{children}</label>,
    TextField: ({ value, onChange, isReadOnly, isDisabled }: any) => (
      <input
        disabled={isDisabled}
        readOnly={isReadOnly}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
    ),
  };
});

class MockFileReader {
  public onload: ((event: { target: { result: string } }) => void) | null = null;

  readAsDataURL() {
    this.onload?.({ target: { result: "data:image/png;base64,preview" } });
  }
}

describe("ProfileCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("FileReader", MockFileReader);
    mockUser = { name: "Alice", email: "alice@example.com", image: null };
  });

  it("enables save and uploads avatar only after save", async () => {
    const { container } = render(<ProfileCard />);
    const saveButton = screen.getByRole("button", { name: "saveChanges" });

    expect(saveButton).toBeDisabled();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    expect(fileInput).toBeTruthy();

    const file = new File(["avatar"], "avatar.png", { type: "image/png" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(saveButton).toBeEnabled();
    });

    expect(mockContext.updateImage).not.toHaveBeenCalled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockContext.updateImage).toHaveBeenCalledTimes(1);
    });
    expect(mockContext.updateImage).toHaveBeenCalledWith(file);
    expect(mockContext.updateName).not.toHaveBeenCalled();
  });

  it("uses plain avatar URL without cache-busting query params", () => {
    mockUser = {
      name: "Alice",
      email: "alice@example.com",
      image: "/avatars/user-1.png",
    };

    render(<ProfileCard />);

    const src = screen.getByAltText("profile avatar").getAttribute("src");

    expect(src).toBe("/avatars/user-1.png");
  });
});
