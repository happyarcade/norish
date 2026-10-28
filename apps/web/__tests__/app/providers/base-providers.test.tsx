import { BaseProviders } from "@/app/providers/base-providers";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const v3ToastProviderMock = vi.hoisted(() => vi.fn());

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@heroui-v3/react", () => ({
  Toast: {
    Provider: (props: unknown) => {
      v3ToastProviderMock(props);

      return null;
    },
  },
}));

vi.mock("@/app/providers/trpc-provider", () => ({
  TRPCProviderWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/timer-dock", () => ({
  TimerDock: () => null,
}));

describe("BaseProviders", () => {
  it("mounts the v3 toast region", () => {
    render(
      <BaseProviders>
        <div>content</div>
      </BaseProviders>
    );

    expect(v3ToastProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        placement: "top end",
        maxVisibleToasts: 1,
      })
    );
  });
});
