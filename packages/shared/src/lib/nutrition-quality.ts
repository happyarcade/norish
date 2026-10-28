import type { NutritionFocusMetricKey } from "@norish/shared/contracts/zod/user";

import { NUTRITION_FOCUS_CONFIG } from "./nutrition-focus";

export type KnownNutritionConfidence = "missing" | "basic" | "extended" | "rich";

type NutritionMetricDetails = {
  label?: string | null;
  value?: number | string | null;
  unit?: string | null;
  raw?: string | null;
};

type RecipeNutritionDetails =
  | {
      servingSize?: string | null;
      nutrients?: Record<string, NutritionMetricDetails> | null;
    }
  | null
  | undefined;

export type KnownNutritionRecipe = {
  servings?: number | null;
  calories?: number | string | null;
  protein?: number | string | null;
  carbs?: number | string | null;
  fat?: number | string | null;
  nutritionDetails?: RecipeNutritionDetails;
};

export type NutritionAuditIssueCode =
  | "missing_nutrition"
  | "invalid_value"
  | "macro_calorie_mismatch"
  | "high_calories"
  | "high_sodium"
  | "high_cholesterol"
  | "high_saturated_fat"
  | "high_trans_fat"
  | "high_sugar"
  | "implausible_macro"
  | "unexpected_unit"
  | "likely_whole_recipe";

export type NutritionAuditIssue = {
  code: NutritionAuditIssueCode;
  severity: "info" | "warning" | "critical";
  message: string;
  metric?: string;
  value?: number;
};

export type NutritionAuditResult = {
  status: "missing" | "credible" | "review";
  confidence: KnownNutritionConfidence;
  confidenceScore: number;
  issues: NutritionAuditIssue[];
  suggestedAction: "none" | "review" | "divideByServings";
  fingerprint: string;
};

export type NutritionAuditValues = {
  calories: number | null;
  fat: number | null;
  carbs: number | null;
  protein: number | null;
  sodium: number | null;
  cholesterol: number | null;
  saturatedFat: number | null;
  transFat: number | null;
  fiber: number | null;
  sugar: number | null;
};

export type NutritionSwapMetricContext = {
  metric: NutritionFocusMetricKey;
  value: number;
  carryover?: number;
};

export type NutritionSwapCandidateScore = {
  score: number;
  knownMetricCount: number;
  confidence: KnownNutritionConfidence;
};

const METRIC_MATCHERS: Record<NutritionFocusMetricKey, RegExp> = {
  sodium: /\bsodium\b/i,
  cholesterol: /\bcholesterol\b/i,
  saturatedFat: /\bsaturated\b/i,
  transFat: /\btrans\s*fat\b/i,
  fiber: /\bfib(?:er|re)\b/i,
  sugar: /\bsugar\b/i,
};

const SWAP_METRIC_SCALES: Record<NutritionFocusMetricKey, number> = {
  sodium: 100,
  cholesterol: 25,
  saturatedFat: 2,
  transFat: 0.25,
  fiber: 2,
  sugar: 5,
};

const CONFIDENCE_RANK: Record<KnownNutritionConfidence, number> = {
  missing: 0,
  basic: 1,
  extended: 2,
  rich: 3,
};

const DEFAULT_FIT_METRICS: NutritionFocusMetricKey[] = [
  "fiber",
  "sodium",
  "saturatedFat",
  "sugar",
  "cholesterol",
];

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;

  const parsed = typeof value === "number" ? value : Number.parseFloat(value.replace(/,/g, ""));

  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundNutritionValue(value: number, unit?: string | null): number {
  if (unit?.toLowerCase() === "mg") return Math.round(value);

  return Number(value.toFixed(2));
}

function getMetricDetails(
  recipe: Pick<KnownNutritionRecipe, "nutritionDetails"> | null | undefined,
  metricKey: NutritionFocusMetricKey
): NutritionMetricDetails | null {
  const nutrients = recipe?.nutritionDetails?.nutrients;

  if (!nutrients) return null;

  for (const [key, metric] of Object.entries(nutrients)) {
    if (matchesMetric(metricKey, key, metric)) return metric;
  }

  return null;
}

function matchesMetric(
  metricKey: NutritionFocusMetricKey,
  key: string,
  value: NutritionMetricDetails
) {
  const matcher = METRIC_MATCHERS[metricKey];
  const keyText = key.toLowerCase();
  const labelText = value.label?.toLowerCase() ?? "";

  if (metricKey === "saturatedFat") {
    const isUnsaturated = keyText.includes("unsaturated") || labelText.includes("unsaturated");

    return !isUnsaturated && (matcher.test(keyText) || matcher.test(labelText));
  }

  return matcher.test(keyText) || matcher.test(labelText);
}

export function getKnownNutritionMetricValue(
  recipe: Pick<KnownNutritionRecipe, "nutritionDetails"> | null | undefined,
  metricKey: NutritionFocusMetricKey
): number | null {
  const nutrients = recipe?.nutritionDetails?.nutrients;

  if (!nutrients) return null;

  for (const [key, metric] of Object.entries(nutrients)) {
    if (!matchesMetric(metricKey, key, metric)) continue;

    const value = toNumber(metric.value);

    if (value != null) return value;
  }

  return null;
}

export function getNutritionAuditValues(
  recipe: KnownNutritionRecipe | null | undefined
): NutritionAuditValues {
  return {
    calories: toNumber(recipe?.calories),
    fat: toNumber(recipe?.fat),
    carbs: toNumber(recipe?.carbs),
    protein: toNumber(recipe?.protein),
    sodium: getKnownNutritionMetricValue(recipe, "sodium"),
    cholesterol: getKnownNutritionMetricValue(recipe, "cholesterol"),
    saturatedFat: getKnownNutritionMetricValue(recipe, "saturatedFat"),
    transFat: getKnownNutritionMetricValue(recipe, "transFat"),
    fiber: getKnownNutritionMetricValue(recipe, "fiber"),
    sugar: getKnownNutritionMetricValue(recipe, "sugar"),
  };
}

export function getNutritionAuditFingerprint(
  recipe: KnownNutritionRecipe | null | undefined
): string {
  const nutrients = Object.entries(recipe?.nutritionDetails?.nutrients ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, metric]) => [key, metric.value ?? null, metric.unit ?? null]);

  return JSON.stringify({
    servings: recipe?.servings ?? null,
    values: getNutritionAuditValues(recipe),
    servingSize: recipe?.nutritionDetails?.servingSize ?? null,
    nutrients,
  });
}

export function auditRecipeNutrition(
  recipe: KnownNutritionRecipe | null | undefined
): NutritionAuditResult {
  const values = getNutritionAuditValues(recipe);
  const confidence = getKnownNutritionConfidence(recipe);
  const issues: NutritionAuditIssue[] = [];
  const knownValues = Object.values(values).filter((value) => value != null);
  const servings = Math.max(1, Math.round(recipe?.servings ?? 1));

  if (knownValues.length === 0) {
    issues.push({
      code: "missing_nutrition",
      severity: "info",
      message: "No usable nutrition values are stored for this recipe.",
    });

    return {
      status: "missing",
      confidence,
      confidenceScore: 0,
      issues,
      suggestedAction: "none",
      fingerprint: getNutritionAuditFingerprint(recipe),
    };
  }

  for (const [metric, value] of Object.entries(values)) {
    if (value != null && value < 0) {
      issues.push({
        code: "invalid_value",
        severity: "critical",
        message: `${metric} cannot be negative.`,
        metric,
        value,
      });
    }
  }

  const macroValues = [values.fat, values.carbs, values.protein].filter(
    (value): value is number => value != null
  );

  if (values.calories != null && values.calories >= 50 && macroValues.length >= 2) {
    const calculatedCalories =
      (values.fat ?? 0) * 9 + (values.carbs ?? 0) * 4 + (values.protein ?? 0) * 4;
    const differenceRatio = Math.abs(calculatedCalories - values.calories) / values.calories;

    if (calculatedCalories >= 100 && differenceRatio > 0.35) {
      issues.push({
        code: "macro_calorie_mismatch",
        severity: "warning",
        message: "Calories differ substantially from the stored protein, carbohydrate and fat.",
        metric: "calories",
        value: values.calories,
      });
    }
  }

  const servingSize = recipe?.nutritionDetails?.servingSize?.toLowerCase() ?? "";
  const explicitWholeRecipe = /\b(?:whole|entire|full)\s+(?:recipe|batch)\b|\bper\s+batch\b/.test(
    servingSize
  );
  const wholeRecipeSignals =
    servings > 1
      ? [
          values.calories != null &&
            values.calories >= 1200 &&
            values.calories / servings >= 150 &&
            values.calories / servings <= 900,
          values.protein != null &&
            values.protein >= 100 &&
            values.protein / servings >= 10 &&
            values.protein / servings <= 80,
          values.fat != null && values.fat >= 100 && values.fat / servings <= 60,
          values.carbs != null && values.carbs >= 250 && values.carbs / servings <= 160,
          values.sodium != null && values.sodium >= 1600 && values.sodium / servings <= 1000,
          values.cholesterol != null &&
            values.cholesterol >= 150 &&
            values.cholesterol / servings <= 100,
        ].filter(Boolean).length
      : 0;
  const likelyWholeRecipe = explicitWholeRecipe || wholeRecipeSignals >= 2;

  if (likelyWholeRecipe) {
    issues.push({
      code: "likely_whole_recipe",
      severity: "critical",
      message: `The stored values look like totals for all ${servings} servings.`,
    });
  }

  const addHighIssue = (
    code: NutritionAuditIssueCode,
    metric: keyof NutritionAuditValues,
    threshold: number,
    message: string,
    severity: NutritionAuditIssue["severity"] = "warning"
  ) => {
    const value = values[metric];

    if (value != null && value >= threshold) {
      issues.push({ code, severity, message, metric, value });
    }
  };

  addHighIssue(
    "high_calories",
    "calories",
    1200,
    "Calories are unusually high for one serving.",
    "critical"
  );
  addHighIssue(
    "high_sodium",
    "sodium",
    1800,
    "Sodium is unusually high for one serving.",
    "critical"
  );
  addHighIssue(
    "high_cholesterol",
    "cholesterol",
    150,
    "Cholesterol is high enough to verify the serving basis."
  );
  addHighIssue(
    "high_saturated_fat",
    "saturatedFat",
    25,
    "Saturated fat is unusually high for one serving."
  );
  addHighIssue("high_trans_fat", "transFat", 3, "Trans fat is unusually high for one serving.");
  addHighIssue("high_sugar", "sugar", 100, "Sugar is unusually high for one serving.");

  for (const [metric, value, threshold] of [
    ["protein", values.protein, 120],
    ["fat", values.fat, 100],
    ["carbs", values.carbs, 250],
  ] as const) {
    if (value != null && value >= threshold) {
      issues.push({
        code: "implausible_macro",
        severity: "warning",
        message: `${metric} is unusually high for one serving.`,
        metric,
        value,
      });
    }
  }

  for (const metricKey of ["sodium", "cholesterol"] as const) {
    const metric = getMetricDetails(recipe, metricKey);
    const unit = metric?.unit?.toLowerCase();
    const value = toNumber(metric?.value);

    if (value != null && unit && unit !== "mg") {
      issues.push({
        code: "unexpected_unit",
        severity: "warning",
        message: `${metricKey} is expected to use milligrams, but is stored as ${unit}.`,
        metric: metricKey,
        value,
      });
    }
  }

  const actionableIssues = issues.filter((issue) => issue.severity !== "info");
  const baseConfidence = {
    missing: 0,
    basic: 0.45,
    extended: 0.7,
    rich: 0.9,
  }[confidence];
  const confidencePenalty = actionableIssues.reduce(
    (total, issue) => total + (issue.severity === "critical" ? 0.3 : 0.12),
    0
  );

  return {
    status: actionableIssues.length > 0 ? "review" : "credible",
    confidence,
    confidenceScore: Number(clamp(baseConfidence - confidencePenalty, 0.05, 0.95).toFixed(2)),
    issues,
    suggestedAction: likelyWholeRecipe
      ? "divideByServings"
      : actionableIssues.length
        ? "review"
        : "none",
    fingerprint: getNutritionAuditFingerprint(recipe),
  };
}

export function divideRecipeNutritionByServings(
  recipe: KnownNutritionRecipe
): KnownNutritionRecipe {
  const servings = Math.max(1, Math.round(recipe.servings ?? 1));

  if (servings <= 1) return recipe;

  const divide = (value: number | string | null | undefined) => {
    const parsed = toNumber(value);

    return parsed == null ? value : roundNutritionValue(parsed / servings);
  };
  const nutrients = Object.fromEntries(
    Object.entries(recipe.nutritionDetails?.nutrients ?? {}).map(([key, metric]) => {
      const metricValue = toNumber(metric.value);
      const dividedValue =
        metricValue == null ? null : roundNutritionValue(metricValue / servings, metric.unit);

      return [
        key,
        {
          ...metric,
          value: dividedValue,
          raw:
            dividedValue == null
              ? metric.raw
              : `${dividedValue}${metric.unit ? ` ${metric.unit}` : ""}`,
        },
      ];
    })
  );

  return {
    ...recipe,
    calories: (() => {
      const value = toNumber(recipe.calories);

      return value == null ? recipe.calories : Math.round(value / servings);
    })(),
    fat: divide(recipe.fat),
    carbs: divide(recipe.carbs),
    protein: divide(recipe.protein),
    nutritionDetails: recipe.nutritionDetails
      ? {
          ...recipe.nutritionDetails,
          servingSize: "1 serving",
          nutrients,
        }
      : recipe.nutritionDetails,
  };
}

export function getKnownNutritionConfidence(
  recipe: KnownNutritionRecipe | null | undefined
): KnownNutritionConfidence {
  if (!recipe) return "missing";

  const hasCalories = toNumber(recipe.calories) != null;
  const macroCount = [recipe.protein, recipe.carbs, recipe.fat].filter(
    (value) => toNumber(value) != null
  ).length;
  const focusMetricCount = (
    Object.keys(NUTRITION_FOCUS_CONFIG) as NutritionFocusMetricKey[]
  ).filter((metricKey) => getKnownNutritionMetricValue(recipe, metricKey) != null).length;

  if (!hasCalories && macroCount === 0 && focusMetricCount === 0) return "missing";
  if (hasCalories && macroCount >= 3 && focusMetricCount >= 5) return "rich";
  if (focusMetricCount >= 2) return "extended";

  return "basic";
}

export function getKnownNutritionConfidenceRank(confidence: KnownNutritionConfidence): number {
  return CONFIDENCE_RANK[confidence];
}

export function getKnownNutritionFitScore(
  recipe: KnownNutritionRecipe | null | undefined,
  metrics: NutritionFocusMetricKey[] = DEFAULT_FIT_METRICS
): number {
  if (!recipe) return 0;

  const calories = toNumber(recipe.calories);
  const confidence = getKnownNutritionConfidence(recipe);
  const audit = auditRecipeNutrition(recipe);
  let score = CONFIDENCE_RANK[confidence] * 0.05;
  let metricCount = 0;

  if (calories && calories > 0) {
    const protein = toNumber(recipe.protein);

    if (protein != null) {
      const proteinPer100Kcal = (protein / calories) * 100;

      score += clamp(proteinPer100Kcal / 5, 0, 2) * 1.5;
      metricCount += 1;
    }

    for (const metricKey of Array.from(new Set(metrics))) {
      const value = getKnownNutritionMetricValue(recipe, metricKey);

      if (value == null) continue;

      const config = NUTRITION_FOCUS_CONFIG[metricKey];
      const referencePer100Kcal = config.defaultThreshold / 20;
      const valuePer100Kcal = (value / calories) * 100;

      if (config.direction === "min") {
        score += clamp(valuePer100Kcal / referencePer100Kcal, 0, 2);
      } else {
        score += clamp(1 - valuePer100Kcal / referencePer100Kcal, -2, 1);
      }

      metricCount += 1;
    }
  }

  const result = metricCount > 0 ? score : CONFIDENCE_RANK[confidence] * 0.05;

  return result * audit.confidenceScore;
}

export function scoreKnownNutritionSwapCandidate(
  recipe: KnownNutritionRecipe | null | undefined,
  contexts: NutritionSwapMetricContext[]
): NutritionSwapCandidateScore {
  const confidence = getKnownNutritionConfidence(recipe);
  const audit = auditRecipeNutrition(recipe);
  let score = CONFIDENCE_RANK[confidence] * 0.05;
  let knownMetricCount = 0;

  for (const context of contexts) {
    const nextValue = getKnownNutritionMetricValue(recipe, context.metric);

    if (nextValue == null) continue;

    const adjustedNextValue = nextValue + (context.carryover ?? 0);
    const delta = adjustedNextValue - context.value;
    const direction = NUTRITION_FOCUS_CONFIG[context.metric].direction;
    const helpfulDelta = direction === "min" ? delta : -delta;

    score += helpfulDelta / SWAP_METRIC_SCALES[context.metric];
    knownMetricCount += 1;
  }

  if (contexts.length > 0) {
    score +=
      getKnownNutritionFitScore(
        recipe,
        contexts.map((context) => context.metric)
      ) * 0.1;
  }

  return {
    score: score - (1 - audit.confidenceScore) * 2,
    knownMetricCount: audit.issues.some((issue) => issue.severity === "critical")
      ? 0
      : knownMetricCount,
    confidence,
  };
}

export function compareKnownNutritionSwapCandidates(
  left: KnownNutritionRecipe,
  right: KnownNutritionRecipe,
  contexts: NutritionSwapMetricContext[]
): number {
  const leftScore = scoreKnownNutritionSwapCandidate(left, contexts);
  const rightScore = scoreKnownNutritionSwapCandidate(right, contexts);

  return (
    rightScore.knownMetricCount - leftScore.knownMetricCount ||
    rightScore.score - leftScore.score ||
    CONFIDENCE_RANK[rightScore.confidence] - CONFIDENCE_RANK[leftScore.confidence]
  );
}
