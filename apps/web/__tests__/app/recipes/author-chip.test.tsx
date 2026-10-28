import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import AuthorChip from "@/app/(app)/recipes/[id]/components/author-chip";

let mockCurrentUser: { id: string } | null = { id: "user-1" };

vi.mock("@/context/user-context", () => ({
  useUserContext: () => ({ user: mockCurrentUser }),
}));

vi.mock("@heroui-v3/react", () => {
  const Avatar = Object.assign(({ children }: any) => <div>{children}</div>, {
    Fallback: ({ children }: any) => <span>{children}</span>,
    Image: ({ alt, src }: { alt?: string; src?: string }) => <img alt={alt} src={src} />,
  });

  return { Avatar };
});

describe("AuthorChip avatar src", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = { id: "user-1" };
  });

  it("uses plain avatar URL without cache-busting query params", () => {
    render(<AuthorChip image="/avatars/user-1.png" name="Alice" userId="user-1" />);

    const src = screen.getByAltText("Alice").getAttribute("src");

    expect(src).toBe("/avatars/user-1.png");
  });
});
