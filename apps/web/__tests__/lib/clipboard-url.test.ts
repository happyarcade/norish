import { readClipboardUrl } from "@/lib/clipboard-url";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("readClipboardUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a trimmed web URL", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { readText: vi.fn().mockResolvedValue(" https://example.com/recipe \n") },
    });

    await expect(readClipboardUrl()).resolves.toBe("https://example.com/recipe");
  });

  it("returns null for non-links and refused reads", async () => {
    vi.stubGlobal("navigator", { clipboard: { readText: vi.fn().mockResolvedValue("dinner") } });
    await expect(readClipboardUrl()).resolves.toBeNull();

    vi.stubGlobal("navigator", {
      clipboard: { readText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    await expect(readClipboardUrl()).resolves.toBeNull();
  });
});
