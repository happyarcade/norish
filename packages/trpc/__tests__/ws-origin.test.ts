import { describe, expect, it } from "vitest";

import { isTrustedWebSocketOrigin } from "../src/ws-origin";

const config = {
  authUrl: "https://recipes.example.com",
  trustedOrigins: ["http://localhost:3001", "http://10.130.1.146:3001"],
};

describe("WebSocket origin validation", () => {
  it("accepts the configured auth and trusted origins", () => {
    expect(isTrustedWebSocketOrigin("https://recipes.example.com", "internal:3001", config)).toBe(
      true
    );
    expect(isTrustedWebSocketOrigin("http://10.130.1.146:3001", undefined, config)).toBe(true);
  });

  it("accepts the request host under either proxy scheme", () => {
    expect(isTrustedWebSocketOrigin("http://norish.local:3001", "norish.local:3001", config)).toBe(
      true
    );
    expect(isTrustedWebSocketOrigin("https://norish.local:3001", "norish.local:3001", config)).toBe(
      true
    );
  });

  it("accepts native clients without an Origin header", () => {
    expect(isTrustedWebSocketOrigin(undefined, "10.130.1.146:3001", config)).toBe(true);
  });

  it("rejects malformed and foreign origins", () => {
    expect(isTrustedWebSocketOrigin("not a url", "recipes.example.com", config)).toBe(false);
    expect(
      isTrustedWebSocketOrigin("https://attacker.example", "recipes.example.com", config)
    ).toBe(false);
  });
});
