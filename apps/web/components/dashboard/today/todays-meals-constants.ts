import type { RecipeCategory, Slot } from "@norish/shared/contracts";

export const TODAY_MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
export const FLEX_MEAL_SLOT_KEYS = ["mid-am", "afternoon", "evening"] as const;

export type TodayMealSlotKey = (typeof TODAY_MEAL_SLOTS)[number];

const todayMealSlotKeySet = new Set<string>(TODAY_MEAL_SLOTS);
const flexMealSlotKeySet = new Set<string>(FLEX_MEAL_SLOT_KEYS);

const SLOT_DISPLAY_ORDER: Record<string, number> = {
  breakfast: 0,
  "mid-am": 1,
  lunch: 2,
  afternoon: 3,
  dinner: 4,
  evening: 5,
  snack: 6,
  "pre-workout": 7,
  "post-workout": 8,
};

export const slotTranslationKeys: Record<
  TodayMealSlotKey,
  "breakfast" | "lunch" | "dinner" | "snack"
> = {
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  snack: "snack",
};

export const slotIconSlots: Record<TodayMealSlotKey, Slot> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export const slotRecipeCategories: Record<TodayMealSlotKey, RecipeCategory> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export function isTodayMealSlotKey(slotKey: string): slotKey is TodayMealSlotKey {
  return todayMealSlotKeySet.has(slotKey);
}

export function isFlexMealSlotKey(slotKey: string): boolean {
  return flexMealSlotKeySet.has(slotKey);
}

export function getSlotDisplayOrder(slotKey: string, fallback: number): number {
  return SLOT_DISPLAY_ORDER[slotKey] ?? fallback;
}

export function getSlotIconSlot(slotKey: string): Slot {
  return isTodayMealSlotKey(slotKey) ? slotIconSlots[slotKey] : "Snack";
}

export function getSlotRecipeCategory(slotKey: string): RecipeCategory | undefined {
  return isTodayMealSlotKey(slotKey) ? slotRecipeCategories[slotKey] : undefined;
}
