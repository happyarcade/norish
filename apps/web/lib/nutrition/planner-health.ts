import type {
  NutritionFocusMetricKey,
  NutritionMetricTargetsDto,
} from "@norish/shared/contracts/zod/user";
import { NUTRITION_FOCUS_CONFIG } from "@norish/shared/lib/nutrition-focus";
import { getKnownNutritionMetricValue } from "@norish/shared/lib/nutrition-quality";

import type { PlannerDayResult, PlannerSlotItemResult } from "@/hooks/planner";

export type PlannerNutritionTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  metrics: Record<NutritionFocusMetricKey, number>;
  itemCount: number;
};

export type PlannerNutritionWarning = {
  metric: NutritionFocusMetricKey;
  label: string;
  total: number;
  threshold: number;
  unit: string;
  direction: "min" | "max";
  severity: "warning";
  distanceRatio: number;
};

const METRIC_SHORT_LABELS: Record<NutritionFocusMetricKey, string> = {
  sodium: "Na",
  cholesterol: "Chol",
  saturatedFat: "Sat fat",
  transFat: "Trans fat",
  fiber: "Fiber",
  sugar: "Sugar",
};

const METRIC_DISPLAY_NAMES: Record<NutritionFocusMetricKey, string> = {
  sodium: "sodium",
  cholesterol: "cholesterol",
  saturatedFat: "sat fat",
  transFat: "trans fat",
  fiber: "fiber",
  sugar: "sugar",
};

function createMetricRecord(): Record<NutritionFocusMetricKey, number> {
  return {
    sodium: 0,
    cholesterol: 0,
    saturatedFat: 0,
    transFat: 0,
    fiber: 0,
    sugar: 0,
  };
}

export function createEmptyPlannerNutritionTotals(): PlannerNutritionTotals {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fibre: 0,
    metrics: createMetricRecord(),
    itemCount: 0,
  };
}

type RecipeNutritionDetails =
  | {
      servingSize?: string | null;
      nutrients?: Record<
        string,
        {
          label?: string | null;
          value?: number | null;
          unit?: string | null;
          raw?: string | null;
        }
      >;
    }
  | null
  | undefined;

export function getNutritionMetricValueFromDetails(
  nutritionDetails: RecipeNutritionDetails,
  metricKey: NutritionFocusMetricKey
): number {
  return getKnownNutritionMetricValue({ nutritionDetails }, metricKey) ?? 0;
}

export function getRecipeNutritionMetricValue(
  recipe: { nutritionDetails?: RecipeNutritionDetails } | null | undefined,
  metricKey: NutritionFocusMetricKey
): number {
  return getNutritionMetricValueFromDetails(recipe?.nutritionDetails, metricKey);
}

export function getPlannerItemNutritionMetricValue(
  item: PlannerSlotItemResult,
  metricKey: NutritionFocusMetricKey
): number {
  return getRecipeNutritionMetricValue(item.recipe, metricKey);
}

export function calculatePlannerDayNutritionTotals(day: PlannerDayResult): PlannerNutritionTotals {
  return day.slots.reduce((totals, slot) => {
    slot.items.forEach((item) => {
      if (!item.recipe) return;

      totals.calories += item.recipe.calories ?? 0;
      totals.protein += item.recipe.protein ?? 0;
      totals.carbs += item.recipe.carbs ?? 0;
      totals.fat += item.recipe.fat ?? 0;
      totals.metrics.sodium += getPlannerItemNutritionMetricValue(item, "sodium");
      totals.metrics.cholesterol += getPlannerItemNutritionMetricValue(item, "cholesterol");
      totals.metrics.saturatedFat += getPlannerItemNutritionMetricValue(item, "saturatedFat");
      totals.metrics.transFat += getPlannerItemNutritionMetricValue(item, "transFat");
      totals.metrics.fiber += getPlannerItemNutritionMetricValue(item, "fiber");
      totals.metrics.sugar += getPlannerItemNutritionMetricValue(item, "sugar");
      totals.fibre += getPlannerItemNutritionMetricValue(item, "fiber");
      totals.itemCount += 1;
    });

    return totals;
  }, createEmptyPlannerNutritionTotals());
}

export function calculatePlannerRangeNutritionAverages(
  days: PlannerDayResult[]
): PlannerNutritionTotals {
  if (days.length === 0) return createEmptyPlannerNutritionTotals();

  const totals = days.reduce((acc, day) => {
    const dayTotals = calculatePlannerDayNutritionTotals(day);

    acc.calories += dayTotals.calories;
    acc.protein += dayTotals.protein;
    acc.carbs += dayTotals.carbs;
    acc.fat += dayTotals.fat;
    acc.fibre += dayTotals.fibre;
    acc.metrics.sodium += dayTotals.metrics.sodium;
    acc.metrics.cholesterol += dayTotals.metrics.cholesterol;
    acc.metrics.saturatedFat += dayTotals.metrics.saturatedFat;
    acc.metrics.transFat += dayTotals.metrics.transFat;
    acc.metrics.fiber += dayTotals.metrics.fiber;
    acc.metrics.sugar += dayTotals.metrics.sugar;
    acc.itemCount += dayTotals.itemCount;

    return acc;
  }, createEmptyPlannerNutritionTotals());

  return {
    calories: totals.calories / days.length,
    protein: totals.protein / days.length,
    carbs: totals.carbs / days.length,
    fat: totals.fat / days.length,
    fibre: totals.fibre / days.length,
    metrics: {
      sodium: totals.metrics.sodium / days.length,
      cholesterol: totals.metrics.cholesterol / days.length,
      saturatedFat: totals.metrics.saturatedFat / days.length,
      transFat: totals.metrics.transFat / days.length,
      fiber: totals.metrics.fiber / days.length,
      sugar: totals.metrics.sugar / days.length,
    },
    itemCount: totals.itemCount,
  };
}

export function evaluateNutritionWarnings(
  totals: PlannerNutritionTotals,
  focusMetrics: NutritionFocusMetricKey[],
  targets: NutritionMetricTargetsDto
): PlannerNutritionWarning[] {
  if (totals.itemCount === 0) return [];

  const MAX_WARNING_BUFFER = 1.1;
  const MIN_WARNING_BUFFER = 0.85;

  return focusMetrics
    .flatMap((metricKey) => {
      const config = NUTRITION_FOCUS_CONFIG[metricKey];
      const threshold =
        config.direction === "min"
          ? targets[metricKey]?.min ?? config.defaultThreshold
          : targets[metricKey]?.max ?? config.defaultThreshold;
      const total = totals.metrics[metricKey];

      if (threshold <= 0) return [];

      const isWarning =
        config.direction === "max"
          ? total > threshold * MAX_WARNING_BUFFER
          : total < threshold * MIN_WARNING_BUFFER;

      if (!isWarning) return [];

      return [
        {
          metric: metricKey,
          label: config.warningLabel,
          total,
          threshold,
          unit: config.unit,
          direction: config.direction,
          severity: "warning" as const,
          distanceRatio:
            config.direction === "max"
              ? (total - threshold * MAX_WARNING_BUFFER) / threshold
              : (threshold * MIN_WARNING_BUFFER - total) / threshold,
        },
      ];
    })
    .sort((left, right) => right.distanceRatio - left.distanceRatio);
}

export function formatNutritionMetricValue(metricKey: NutritionFocusMetricKey, value: number): string {
  const config = NUTRITION_FOCUS_CONFIG[metricKey];
  const rounded = config.unit === "mg" ? Math.round(value) : Number(value.toFixed(1));

  return `${rounded}${config.unit}`;
}

export function getNutritionMetricShortLabel(metricKey: NutritionFocusMetricKey): string {
  return METRIC_SHORT_LABELS[metricKey];
}

export function getNutritionMetricDisplayName(metricKey: NutritionFocusMetricKey): string {
  return METRIC_DISPLAY_NAMES[metricKey];
}
