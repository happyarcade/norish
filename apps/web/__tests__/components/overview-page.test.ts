import type { PlannerDayResult } from "@/hooks/planner";
import { findNextPlannedSlot } from "@/components/overview/overview-page";
import { describe, expect, it } from "vitest";

type TestSlot = {
  key: string;
  label: string;
  sortOrder: number;
  title: string;
};

function plannerDay(date: string, slots: TestSlot[]): PlannerDayResult {
  return {
    date,
    slots: slots.map((slot) => ({
      definition: {
        key: slot.key,
        label: slot.label,
        sortOrder: slot.sortOrder,
      },
      items: [{ role: "main", title: slot.title }],
    })),
  } as unknown as PlannerDayResult;
}

describe("findNextPlannedSlot", () => {
  it("ignores earlier days and elapsed slots today", () => {
    const result = findNextPlannedSlot(
      [
        plannerDay("2026-10-26", [
          { key: "breakfast", label: "Breakfast", sortOrder: 0, title: "Old breakfast" },
        ]),
        plannerDay("2026-10-29", [
          { key: "breakfast", label: "Breakfast", sortOrder: 0, title: "Past breakfast" },
          { key: "dinner", label: "Dinner", sortOrder: 4, title: "Tonight's dinner" },
        ]),
      ],
      new Date("2026-10-29T14:00:00")
    );

    expect(result?.item.title).toBe("Tonight's dinner");
  });

  it("moves to the next day when today's slots have elapsed", () => {
    const result = findNextPlannedSlot(
      [
        plannerDay("2026-10-29", [
          { key: "dinner", label: "Dinner", sortOrder: 4, title: "Past dinner" },
        ]),
        plannerDay("2026-10-30", [
          { key: "lunch", label: "Lunch", sortOrder: 2, title: "Tomorrow's lunch" },
        ]),
      ],
      new Date("2026-10-29T22:00:00")
    );

    expect(result?.item.title).toBe("Tomorrow's lunch");
  });

  it("returns null when the week only contains past meals", () => {
    const result = findNextPlannedSlot(
      [
        plannerDay("2026-10-26", [
          { key: "breakfast", label: "Breakfast", sortOrder: 0, title: "Old breakfast" },
        ]),
      ],
      new Date("2026-10-29T14:00:00")
    );

    expect(result).toBeNull();
  });
});
