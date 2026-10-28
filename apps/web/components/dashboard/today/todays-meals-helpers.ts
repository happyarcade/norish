import type { PlannerSlotItemResult } from "@/hooks/planner";

export type PlannedItemSubtitleLabels = {
  note: string;
  serving: string;
  servings: string;
};

export function getPlannerItemTitle(item: PlannerSlotItemResult | undefined, fallback: string) {
  if (!item) return fallback;

  return item.recipe?.name ?? item.title ?? fallback;
}

export function buildPlannerItemSubtitle(
  item: PlannerSlotItemResult | undefined,
  labels: PlannedItemSubtitleLabels
) {
  if (!item) return null;
  if (item.itemKind === "note") return labels.note;

  const details = [
    item.recipe?.servings
      ? `${item.recipe.servings} ${item.recipe.servings === 1 ? labels.serving : labels.servings}`
      : null,
    item.recipe?.calories ? `${item.recipe.calories} kcal` : null,
  ].filter(Boolean);

  return details.length > 0 ? details.join(" / ") : null;
}
