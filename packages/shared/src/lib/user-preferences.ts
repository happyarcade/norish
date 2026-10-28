import type { User } from "@norish/shared/contracts";
import type {
  NutritionFocusMetricKey,
  NutritionMetricTargetsDto,
  UserPreferencesDto,
} from "@norish/shared/contracts/zod/user";

import {
  DEFAULT_FOCUS_NUTRITION_METRICS,
  DEFAULT_NUTRITION_TARGETS,
  isNutritionFocusMetricKey,
} from "./nutrition-focus";

export function getUserPreferences(
  user: Pick<User, "preferences"> | null | undefined
): UserPreferencesDto {
  return user?.preferences ?? {};
}

export function getTimersEnabledPreference(
  user: Pick<User, "preferences"> | null | undefined,
  fallback = true
): boolean {
  const value = getUserPreferences(user).timersEnabled;

  return typeof value === "boolean" ? value : fallback;
}

export function getShowConversionButtonPreference(
  user: Pick<User, "preferences"> | null | undefined,
  fallback = true
): boolean {
  const value = getUserPreferences(user).showConversionButton;

  return typeof value === "boolean" ? value : fallback;
}

export function getShowRatingsPreference(
  user: Pick<User, "preferences"> | null | undefined,
  fallback = true
): boolean {
  const value = getUserPreferences(user).showRatings;

  return typeof value === "boolean" ? value : fallback;
}

export function getShowFavoritesPreference(
  user: Pick<User, "preferences"> | null | undefined,
  fallback = true
): boolean {
  const value = getUserPreferences(user).showFavorites;

  return typeof value === "boolean" ? value : fallback;
}

export function getLocalePreference(
  user: Pick<User, "preferences"> | null | undefined
): string | null {
  const value = getUserPreferences(user).locale;

  return typeof value === "string" ? value : null;
}

export function getFocusNutritionMetricsPreference(
  user: Pick<User, "preferences"> | null | undefined,
  fallback: NutritionFocusMetricKey[] = DEFAULT_FOCUS_NUTRITION_METRICS
): NutritionFocusMetricKey[] {
  const value = getUserPreferences(user).focusNutritionMetrics;

  if (!Array.isArray(value)) return fallback;

  const metrics = value.filter(
    (metric): metric is NutritionFocusMetricKey =>
      typeof metric === "string" && isNutritionFocusMetricKey(metric)
  );

  return metrics.length > 0 ? metrics : fallback;
}

export function getNutritionTargetsPreference(
  user: Pick<User, "preferences"> | null | undefined
): NutritionMetricTargetsDto {
  const value = getUserPreferences(user).nutritionTargets;

  return Object.fromEntries(
    Object.entries(DEFAULT_NUTRITION_TARGETS).map(([metricKey, defaults]) => [
      metricKey,
      {
        ...defaults,
        ...((value as NutritionMetricTargetsDto | undefined)?.[
          metricKey as NutritionFocusMetricKey
        ] ?? {}),
      },
    ])
  ) as NutritionMetricTargetsDto;
}
