import { describe, expect, it } from "vitest";

import {
  hasMojibake,
  repairMojibakeText,
  repairMojibakeValue,
} from "../../scripts/lib/repair-mojibake";

describe("repairMojibakeText", () => {
  it("repairs common UTF-8 text decoded as Latin-1", () => {
    expect(repairMojibakeText("saut\u00c3\u00a9")).toBe("saut\u00e9");
    expect(repairMojibakeText("\u00c2\u00bd cup")).toBe("\u00bd cup");
    expect(repairMojibakeText("don\u00e2\u0080\u0099t")).toBe("don\u2019t");
    expect(repairMojibakeText("\u00e2\u0085\u0093 cup")).toBe("\u2153 cup");
  });

  it("leaves correctly encoded text unchanged", () => {
    expect(repairMojibakeText("Cr\u00e8me br\u00fbl\u00e9e")).toBe("Cr\u00e8me br\u00fbl\u00e9e");
    expect(hasMojibake("Cr\u00e8me br\u00fbl\u00e9e")).toBe(false);
  });

  it("repairs strings in nested schema payloads", () => {
    expect(
      repairMojibakeValue({
        ingredients: ["\u00c2\u00bd cup olive oil"],
        steps: [{ text: "Saut\u00c3\u00a9 the onions" }],
      })
    ).toEqual({
      ingredients: ["\u00bd cup olive oil"],
      steps: [{ text: "Saut\u00e9 the onions" }],
    });
  });
});
