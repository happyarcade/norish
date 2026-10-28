import {
  queueGroceryToggle,
  readGroceryToggleOutbox,
  removeGroceryToggle,
  shouldQueueGroceryToggle,
} from "@/lib/grocery-toggle-outbox";
import { describe, expect, it } from "vitest";

function memoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

describe("grocery toggle outbox", () => {
  it("keeps toggles in order and removes confirmed entries", () => {
    const storage = memoryStorage();
    const first = queueGroceryToggle(["one"], true, storage);

    queueGroceryToggle(["one"], false, storage);
    expect(readGroceryToggleOutbox(storage).map((entry) => entry.isDone)).toEqual([true, false]);

    removeGroceryToggle(first.id, storage);
    expect(readGroceryToggleOutbox(storage).map((entry) => entry.isDone)).toEqual([false]);
  });

  it("queues disconnected and network failures", () => {
    expect(shouldQueueGroceryToggle(new Error("anything"), false)).toBe(true);
    expect(shouldQueueGroceryToggle(new Error("Failed to fetch"), true)).toBe(true);
    expect(shouldQueueGroceryToggle(new Error("Forbidden"), true)).toBe(false);
  });
});
