import type {
  NutritionFocusMetricKey,
  NutritionMetricTargetsDto,
} from "@norish/shared/contracts/zod/user";

type NutritionMetricConfig = {
  label: string;
  shortLabel: string;
  unit: string;
  direction: "min" | "max";
  defaultThreshold: number;
  warningLabel: string;
};

export const NUTRITION_FOCUS_CONFIG: Record<NutritionFocusMetricKey, NutritionMetricConfig> = {
  sodium: {
    label: "Sodium",
    shortLabel: "Na",
    unit: "mg",
    direction: "max",
    defaultThreshold: 2300,
    warningLabel: "High sodium",
  },
  cholesterol: {
    label: "Cholesterol",
    shortLabel: "Chol",
    unit: "mg",
    direction: "max",
    defaultThreshold: 300,
    warningLabel: "High cholesterol",
  },
  saturatedFat: {
    label: "Saturated Fat",
    shortLabel: "Sat fat",
    unit: "g",
    direction: "max",
    defaultThreshold: 20,
    warningLabel: "High sat fat",
  },
  transFat: {
    label: "Trans Fat",
    shortLabel: "Trans fat",
    unit: "g",
    direction: "max",
    defaultThreshold: 2,
    warningLabel: "High trans fat",
  },
  fiber: {
    label: "Fiber",
    shortLabel: "Fiber",
    unit: "g",
    direction: "min",
    defaultThreshold: 30,
    warningLabel: "Low fiber",
  },
  sugar: {
    label: "Sugar",
    shortLabel: "Sugar",
    unit: "g",
    direction: "max",
    defaultThreshold: 50,
    warningLabel: "High sugar",
  },
};

export const DEFAULT_FOCUS_NUTRITION_METRICS: NutritionFocusMetricKey[] = [
  "sodium",
  "cholesterol",
  "fiber",
];

export const DEFAULT_NUTRITION_TARGETS: NutritionMetricTargetsDto = Object.fromEntries(
  Object.entries(NUTRITION_FOCUS_CONFIG).map(([metricKey, config]) => [
    metricKey,
    config.direction === "min"
      ? { min: config.defaultThreshold }
      : { max: config.defaultThreshold },
  ])
) as NutritionMetricTargetsDto;

export function isNutritionFocusMetricKey(value: string): value is NutritionFocusMetricKey {
  return value in NUTRITION_FOCUS_CONFIG;
}
