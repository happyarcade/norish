"use client";

import type {
  PlannerDayResult,
  PlannerDaySlotResult,
  PlannerPlanningMode,
  PlannerSlotItemResult,
  PlannerSuggestedMeal,
  PlannerSuggestionScope,
} from "@/hooks/planner";
import type { PlannerNutritionWarning } from "@/lib/nutrition/planner-health";
import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { useUserContext } from "@/context/user-context";
import { useHouseholdQuery } from "@/hooks/households";
import {
  usePlannerMutations,
  usePlannerRangeQuery,
  usePlannerSuggestionsFetcher,
  usePlannerSuggestionsQuery,
} from "@/hooks/planner";
import { usePrepRangeQuery } from "@/hooks/prep";
import {
  calculatePlannerDayNutritionTotals,
  evaluateNutritionWarnings,
  formatNutritionMetricValue,
  getNutritionMetricShortLabel,
  getPlannerItemNutritionMetricValue,
} from "@/lib/nutrition/planner-health";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  BeakerIcon,
  BoltIcon,
  CubeIcon,
  FireIcon,
  LockClosedIcon,
  LockOpenIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  UserGroupIcon,
} from "@heroicons/react/16/solid";
import {
  buttonVariants,
  Dropdown,
  Header,
  Label,
  Separator,
  Skeleton,
  toast,
} from "@heroui-v3/react";

import type { RecipeCategory } from "@norish/shared/contracts";
import type {
  NutritionFocusMetricKey,
  NutritionMetricTargetsDto,
} from "@norish/shared/contracts/zod/user";
import {
  addMonths,
  addWeeks,
  dateKey,
  endOfMonth,
  getWeekEnd,
  getWeekStart,
  startOfMonth,
} from "@norish/shared/lib/helpers";
import {
  getFocusNutritionMetricsPreference,
  getNutritionTargetsPreference,
} from "@norish/shared/lib/user-preferences";

import PlannerRecipePickerPanel from "./planner-recipe-picker-panel";
import PlannerSlotItemPanel from "./planner-slot-item-panel";
import PlannerWeekSuggestionsPanel from "./planner-week-suggestions-panel";

type PlannerViewMode = "week" | "month";

type PickerState = {
  date: string;
  slotId: string;
  slotKey: string;
  slotLabel: string;
  slotGroup: "meal" | "snack" | "workout";
  allowMultiple: boolean;
  role: "main" | "side" | "drink";
  reopenEditor: boolean;
  recipeTypeFiltersOverride?: string[];
  subtitleOverride?: string;
  hideRandom?: boolean;
  titleOverride?: string;
  nutritionFilters?: {
    maxSodium?: number;
    maxCholesterol?: number;
    minFiber?: number;
  };
  swapContext?: {
    currentRecipeName: string;
    metrics: {
      metric: NutritionFocusMetricKey;
      value: number;
      carryover?: number;
    }[];
  };
};

type EditState = {
  date: string;
  slotDefinitionId: string;
} | null;

type DisplaySlotItem = {
  item: PlannerSlotItemResult;
  slot: PlannerDaySlotResult;
};

type DisplaySlot = {
  id: string;
  label: string;
  slotGroup: "meal" | "snack" | "workout";
  allowMultiple: boolean;
  targetSlot: PlannerDaySlotResult;
  sourceSlots: PlannerDaySlotResult[];
  items: DisplaySlotItem[];
};

type PlannerMacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  itemCount: number;
};

type PlannerSwapTarget = {
  slot: PlannerDaySlotResult;
  item: PlannerSlotItemResult;
  warning: PlannerNutritionWarning;
  subtitle: string;
  titlePrefix: string;
  nutritionFilters: {
    maxSodium?: number;
    maxCholesterol?: number;
    minFiber?: number;
  };
  currentMetrics: {
    metric: NutritionFocusMetricKey;
    value: number;
    carryover?: number;
  }[];
  currentLabel: string;
};

function labelForDate(dateString: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(`${dateString}T12:00:00`));
}

function buildRange(anchorDate: Date, mode: PlannerViewMode) {
  if (mode === "week") {
    return {
      startDate: dateKey(getWeekStart(anchorDate)),
      endDate: dateKey(getWeekEnd(anchorDate)),
    };
  }

  return {
    startDate: dateKey(getWeekStart(startOfMonth(anchorDate))),
    endDate: dateKey(getWeekEnd(endOfMonth(anchorDate))),
  };
}

function formatMetric(value: number | null | undefined, suffix: string) {
  if (value == null || Number.isNaN(value)) return null;

  return `${Math.round(value)}${suffix}`;
}

function buildRecipeMeta(item: PlannerSlotItemResult) {
  if (!item.recipe) return [];

  return [
    formatMetric(item.recipe.calories ?? null, " kcal"),
    formatMetric(item.recipe.protein ?? null, "P"),
    formatMetric(item.recipe.carbs ?? null, "C"),
    formatMetric(item.recipe.fat ?? null, "F"),
  ].filter((value): value is string => Boolean(value));
}

function getRecipeFibre(item: PlannerSlotItemResult) {
  const nutrients = item.recipe?.nutritionDetails?.nutrients;

  if (!nutrients) return 0;

  const fibreEntry = Object.entries(nutrients).find(([key, metric]) => {
    const normalizedKey = key.toLowerCase();
    const normalizedLabel = metric.label?.toLowerCase() ?? "";

    return (
      normalizedKey.includes("fiber") ||
      normalizedKey.includes("fibre") ||
      normalizedLabel.includes("fiber") ||
      normalizedLabel.includes("fibre")
    );
  });

  const value = fibreEntry?.[1]?.value;

  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function createEmptyMacroTotals(): PlannerMacroTotals {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fibre: 0,
    itemCount: 0,
  };
}

function calculatePlannerDayTotals(day: PlannerDayResult): PlannerMacroTotals {
  return day.slots.reduce((totals, slot) => {
    slot.items.forEach((item) => {
      if (!item.recipe) return;

      totals.calories += item.recipe.calories ?? 0;
      totals.protein += item.recipe.protein ?? 0;
      totals.carbs += item.recipe.carbs ?? 0;
      totals.fat += item.recipe.fat ?? 0;
      totals.fibre += getRecipeFibre(item);
      totals.itemCount += 1;
    });

    return totals;
  }, createEmptyMacroTotals());
}

function calculatePlannerRangeAverages(days: PlannerDayResult[]): PlannerMacroTotals {
  if (days.length === 0) return createEmptyMacroTotals();

  const totals = days.reduce((acc, day) => {
    const dayTotals = calculatePlannerDayTotals(day);

    acc.calories += dayTotals.calories;
    acc.protein += dayTotals.protein;
    acc.carbs += dayTotals.carbs;
    acc.fat += dayTotals.fat;
    acc.fibre += dayTotals.fibre;
    acc.itemCount += dayTotals.itemCount;

    return acc;
  }, createEmptyMacroTotals());

  return {
    calories: totals.calories / days.length,
    protein: totals.protein / days.length,
    carbs: totals.carbs / days.length,
    fat: totals.fat / days.length,
    fibre: totals.fibre / days.length,
    itemCount: totals.itemCount,
  };
}

function formatMacroDisplay(value: number, unit: string = "g") {
  const rounded = Math.round(value);

  return unit ? `${rounded}${unit}` : `${rounded}`;
}

const PLANNER_MACROS = [
  {
    key: "calories" as const,
    label: "Calories",
    unit: "kcal",
    icon: FireIcon,
    color: "text-orange-500",
    bg: "bg-orange-100 dark:bg-orange-900/30",
  },
  {
    key: "fat" as const,
    label: "Fat",
    unit: "g",
    icon: BeakerIcon,
    color: "text-yellow-500",
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
  },
  {
    key: "carbs" as const,
    label: "Carbs",
    unit: "g",
    icon: CubeIcon,
    color: "text-blue-500",
    bg: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    key: "protein" as const,
    label: "Protein",
    unit: "g",
    icon: BoltIcon,
    color: "text-rose-500",
    bg: "bg-rose-100 dark:bg-rose-900/30",
  },
];

function PlannerMacroStrip({
  title,
  totals,
  compact = false,
}: {
  title?: string;
  totals: PlannerMacroTotals;
  compact?: boolean;
}) {
  if (compact) {
    // In-card: flat row, no border/bg, just values
    const compactMetrics = [
      { label: "kcal", value: formatMacroDisplay(totals.calories, "") },
      { label: "P", value: formatMacroDisplay(totals.protein) },
      { label: "C", value: formatMacroDisplay(totals.carbs) },
      { label: "F", value: formatMacroDisplay(totals.fat) },
      { label: "Fibre", value: formatMacroDisplay(totals.fibre) },
    ];

    return (
      <div className="grid grid-cols-5 gap-2 py-1 text-xs">
        {compactMetrics.map((metric) => (
          <div key={metric.label} className="min-w-0 text-center">
            <div className="text-foreground text-sm font-semibold">{metric.value}</div>
            <div className="text-default-400 truncate text-[10px] tracking-[0.14em] uppercase">
              {metric.label}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const allMacros = [
    ...PLANNER_MACROS.map(({ key, label, unit, icon, color, bg }) => ({
      key,
      label,
      unit,
      icon,
      color,
      bg,
      value: key === "calories" ? totals.calories : totals[key],
    })),
    ...(totals.fibre > 0
      ? [
          {
            key: "fibre" as const,
            label: "Fibre",
            unit: "g",
            icon: BeakerIcon,
            color: "text-green-500",
            bg: "bg-green-100 dark:bg-green-900/30",
            value: totals.fibre,
          },
        ]
      : []),
  ];

  return (
    <div className="border-default-100 bg-content1 rounded-2xl border px-4 py-3 shadow-sm">
      {title ? (
        <div className="text-default-400 mb-3 text-[11px] tracking-[0.18em] uppercase">{title}</div>
      ) : null}
      <div className="grid grid-cols-5 gap-1 sm:hidden">
        {allMacros.map(({ key, label, unit, value }) => (
          <div key={key} className="min-w-0 text-center">
            <div className="text-foreground text-sm leading-tight font-semibold">
              {Math.round(value)}
              <span className="text-default-400 ml-0.5 text-[10px] font-normal">{unit}</span>
            </div>
            <div className="text-default-400 truncate text-[9px] tracking-[0.12em] uppercase">
              {label}
            </div>
          </div>
        ))}
      </div>
      <div
        className="hidden gap-3 sm:grid"
        style={{ gridTemplateColumns: `repeat(${allMacros.length}, minmax(0, 1fr))` }}
      >
        {allMacros.map(({ key, label, unit, icon: Icon, color, bg, value }) => (
          <div key={key} className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bg}`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div className="min-w-0">
              <div className="text-foreground text-sm leading-tight font-semibold">
                {Math.round(value)}
                <span className="text-default-400 ml-0.5 text-xs font-normal">{unit}</span>
              </div>
              <div className="text-default-400 text-[10px] tracking-[0.14em] uppercase">
                {label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function suggestedCategoryForSlot(slot: PickerState | null): RecipeCategory | undefined {
  if (!slot) return undefined;

  if (slot.role === "drink") return undefined;
  if (slot.role === "side") return undefined;

  switch (slot.slotKey) {
    case "breakfast":
      return "Breakfast";
    case "lunch":
      return "Lunch";
    case "dinner":
      return "Dinner";
    case "snack":
      return "Snack";
    default:
      break;
  }

  return undefined;
}

function recipeTypeFiltersForPicker(slot: PickerState | null): string[] | undefined {
  if (!slot) return undefined;
  if (slot.recipeTypeFiltersOverride?.length) return slot.recipeTypeFiltersOverride;

  if (slot.role === "side") return ["side"];
  if (slot.role === "drink") return ["drink"];

  switch (slot.slotKey) {
    case "breakfast":
      return ["breakfast", "bake"];
    case "lunch":
    case "dinner":
      return ["main", "soup", "salad", "bake"];
    case "snack":
      return ["snack", "dessert", "bake"];
    default:
      return undefined;
  }
}

function recipeTypeFiltersForSwap(slot: PlannerDaySlotResult): string[] | undefined {
  switch (slot.definition.key) {
    case "breakfast":
      return ["breakfast", "bake"];
    case "lunch":
    case "dinner":
      return ["main", "soup", "salad"];
    case "snack":
      return ["snack", "dessert", "drink"];
    case "pre-workout":
    case "post-workout":
      return ["drink", "snack", "breakfast"];
    case "mid-am":
    case "afternoon":
    case "evening":
      return ["main", "soup", "salad", "snack", "drink"];
    default:
      return undefined;
  }
}

function suitableSlotForPicker(slot: PickerState | null): string | undefined {
  if (!slot || slot.role !== "main") return undefined;

  switch (slot.slotKey) {
    case "mid-am":
      return "mid-morning";
    case "afternoon":
      return "afternoon";
    case "evening":
      return "evening";
    case "pre-workout":
      return "pre-workout";
    case "post-workout":
      return "post-workout";
    case "breakfast":
    case "lunch":
    case "dinner":
    case "snack":
      return slot.slotKey;
    default:
      return undefined;
  }
}

function buildSwapNutritionFilters(
  warning: PlannerNutritionWarning,
  dayTotals: ReturnType<typeof calculatePlannerDayNutritionTotals>,
  itemMetricValue: number
): PickerState["nutritionFilters"] | null {
  const remainingDayMetric = Math.max(0, dayTotals.metrics[warning.metric] - itemMetricValue);

  switch (warning.metric) {
    case "sodium": {
      const improvementMax = itemMetricValue > 0 ? itemMetricValue * 0.8 : 0;
      const strictMax = warning.threshold - remainingDayMetric;
      const maxSodium = Math.round(
        Math.max(0, strictMax > 0 ? Math.min(improvementMax, strictMax) : improvementMax)
      );

      return maxSodium > 0 ? { maxSodium } : null;
    }
    case "cholesterol": {
      const improvementMax = itemMetricValue > 0 ? itemMetricValue * 0.8 : 0;
      const strictMax = warning.threshold - remainingDayMetric;
      const maxCholesterol = Math.round(
        Math.max(0, strictMax > 0 ? Math.min(improvementMax, strictMax) : improvementMax)
      );

      return maxCholesterol > 0 ? { maxCholesterol } : null;
    }
    case "fiber": {
      const mealTarget = Math.min(warning.threshold * 0.35, 12);
      const neededMin = Math.max(0, warning.threshold - remainingDayMetric);
      const minFiber = Number(
        Math.max(itemMetricValue + 2, Math.min(neededMin, mealTarget)).toFixed(1)
      );

      return minFiber > 0 ? { minFiber } : null;
    }
    default:
      return null;
  }
}

function buildFiberBoostNutritionFilters(
  warning: PlannerNutritionWarning,
  dayTotals: ReturnType<typeof calculatePlannerDayNutritionTotals>
): PickerState["nutritionFilters"] | null {
  const remainingGap = Math.max(0, warning.threshold - dayTotals.metrics.fiber);
  const minFiber = Number(Math.max(2, Math.min(remainingGap, 8)).toFixed(1));

  return minFiber > 0 ? { minFiber } : null;
}

function buildSwapTarget(
  day: PlannerDayResult,
  dayTotals: ReturnType<typeof calculatePlannerDayNutritionTotals>,
  warnings: PlannerNutritionWarning[]
): PlannerSwapTarget | null {
  const supportedWarning = warnings.find((warning) =>
    ["sodium", "cholesterol", "fiber"].includes(warning.metric)
  );

  if (!supportedWarning) return null;

  if (supportedWarning.metric === "fiber") {
    const snackSlot =
      day.slots.find((slot) => slot.definition.key === "snack") ??
      day.slots.find((slot) => slot.definition.slotGroup === "snack") ??
      null;

    if (snackSlot) {
      const nutritionFilters = buildFiberBoostNutritionFilters(supportedWarning, dayTotals);
      const contextItem =
        snackSlot.items[0] ??
        day.slots.flatMap((slot) => slot.items).find((item) => item.recipe) ??
        null;

      if (!nutritionFilters || !contextItem) return null;

      return {
        slot: snackSlot,
        item: contextItem,
        warning: supportedWarning,
        subtitle: "Higher-fibre add-ins first",
        titlePrefix: "Boost fibre for",
        nutritionFilters,
        currentMetrics: [
          {
            metric: "fiber",
            value: dayTotals.metrics.fiber,
            carryover: 0,
          },
        ],
        currentLabel: `${labelForDate(day.date, { weekday: "long" })} total`,
      };
    }
  }

  const candidates = buildDisplaySlots(day)
    .filter((slot) => slot.slotGroup === "meal")
    .flatMap((slot) => {
      const primaryItem = getPrimaryDisplaySlotItem(slot);

      if (!primaryItem?.item.recipe) return [];

      const displayMetrics = calculateDisplaySlotMetricTotals(slot);
      const replaceableMetrics = createNutritionMetricRecord();

      for (const warning of warnings) {
        replaceableMetrics[warning.metric] = getPlannerItemNutritionMetricValue(
          primaryItem.item,
          warning.metric
        );
      }

      return [
        {
          slot: slot.targetSlot,
          item: primaryItem.item,
          metricValue: replaceableMetrics[supportedWarning.metric],
          displayMetricValue: displayMetrics[supportedWarning.metric],
          displayMetrics,
          replaceableMetrics,
          calories: slot.items.reduce((sum, { item }) => sum + (item.recipe?.calories ?? 0), 0),
          label: buildDisplaySlotLabel(slot, primaryItem),
        },
      ];
    });

  if (candidates.length === 0) return null;

  const rankedCandidates = [...candidates].sort((left, right) => {
    if (supportedWarning.direction === "max") {
      return (
        right.metricValue - left.metricValue ||
        right.displayMetricValue - left.displayMetricValue ||
        right.calories - left.calories
      );
    }

    return (
      left.metricValue - right.metricValue ||
      left.displayMetricValue - right.displayMetricValue ||
      right.calories - left.calories
    );
  });

  const chosenCandidate = rankedCandidates[0];
  const nutritionFilters = buildSwapNutritionFilters(
    supportedWarning,
    dayTotals,
    chosenCandidate.metricValue
  );

  if (!nutritionFilters) return null;

  const subtitle =
    supportedWarning.metric === "fiber"
      ? "Higher-fibre recipes first"
      : supportedWarning.metric === "cholesterol"
        ? "Lower-cholesterol recipes first"
        : "Lower-sodium recipes first";

  return {
    slot: chosenCandidate.slot,
    item: chosenCandidate.item,
    warning: supportedWarning,
    subtitle,
    titlePrefix: "Swap",
    nutritionFilters,
    currentMetrics: warnings
      .map((warning) => ({
        metric: warning.metric,
        value: chosenCandidate.displayMetrics[warning.metric],
        carryover: Math.max(
          0,
          chosenCandidate.displayMetrics[warning.metric] -
            chosenCandidate.replaceableMetrics[warning.metric]
        ),
      }))
      .filter(({ value }, index, metrics) => {
        if (value > 0) return true;

        return metrics[index]?.metric === "fiber";
      }),
    currentLabel: chosenCandidate.label,
  };
}

function buildNutritionSignalText(metric: NutritionFocusMetricKey, value: number) {
  return `${getNutritionMetricShortLabel(metric)} ${formatNutritionMetricValue(metric, value)}`;
}

const DISPLAY_SLOT_ORDER: Record<string, number> = {
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

function buildDisplaySlots(day: PlannerDayResult): DisplaySlot[] {
  const displaySlots: DisplaySlot[] = [];
  const snackSlots = day.slots.filter((slot) => slot.definition.slotGroup === "snack");
  const primarySnackSlot =
    snackSlots.find((slot) => slot.definition.key === "snack") ?? snackSlots[0] ?? null;

  if (primarySnackSlot && snackSlots.some((slot) => slot.items.length > 0)) {
    displaySlots.push({
      id: `${day.date}:snacks`,
      label: "Snacks",
      slotGroup: "snack",
      allowMultiple: true,
      targetSlot: primarySnackSlot,
      sourceSlots: snackSlots.filter(
        (slot) => slot.items.length > 0 || slot.definition.id === primarySnackSlot.definition.id
      ),
      items: snackSlots.flatMap((slot) =>
        slot.items.map((item) => ({
          item,
          slot,
        }))
      ),
    });
  }

  for (const slot of day.slots) {
    if (slot.definition.slotGroup === "snack" || slot.items.length === 0) continue;

    displaySlots.push({
      id: `${day.date}:${slot.definition.id}`,
      label: slot.definition.label,
      slotGroup: slot.definition.slotGroup,
      allowMultiple: slot.definition.allowMultiple,
      targetSlot: slot,
      sourceSlots: [slot],
      items: slot.items.map((item) => ({
        item,
        slot,
      })),
    });
  }

  return displaySlots.sort(
    (left, right) =>
      (DISPLAY_SLOT_ORDER[left.targetSlot.definition.key] ?? left.targetSlot.definition.sortOrder) -
      (DISPLAY_SLOT_ORDER[right.targetSlot.definition.key] ?? right.targetSlot.definition.sortOrder)
  );
}

function createNutritionMetricRecord(): Record<NutritionFocusMetricKey, number> {
  return {
    sodium: 0,
    cholesterol: 0,
    saturatedFat: 0,
    transFat: 0,
    fiber: 0,
    sugar: 0,
  };
}

function getPrimaryDisplaySlotItem(slot: DisplaySlot): DisplaySlotItem | null {
  if (slot.slotGroup === "meal") {
    return slot.items.find(({ item }) => item.role === "main") ?? slot.items[0] ?? null;
  }

  return null;
}

function calculateDisplaySlotMetricTotals(
  slot: DisplaySlot
): Record<NutritionFocusMetricKey, number> {
  const totals = createNutritionMetricRecord();

  for (const { item } of slot.items) {
    if (!item.recipe) continue;

    totals.sodium += getPlannerItemNutritionMetricValue(item, "sodium");
    totals.cholesterol += getPlannerItemNutritionMetricValue(item, "cholesterol");
    totals.saturatedFat += getPlannerItemNutritionMetricValue(item, "saturatedFat");
    totals.transFat += getPlannerItemNutritionMetricValue(item, "transFat");
    totals.fiber += getPlannerItemNutritionMetricValue(item, "fiber");
    totals.sugar += getPlannerItemNutritionMetricValue(item, "sugar");
  }

  return totals;
}

function buildDisplaySlotLabel(slot: DisplaySlot, primaryItem: DisplaySlotItem): string {
  const baseName = primaryItem.item.recipe?.name ?? primaryItem.item.title ?? "Current meal";
  const hasSecondaryItems = slot.items.some(({ item }) => item.id !== primaryItem.item.id);

  return hasSecondaryItems ? `${baseName} (incl. add-ons)` : baseName;
}

function buildDisplayedHealthSignals(
  slots: DisplaySlot[],
  warnings: PlannerNutritionWarning[]
): Map<string, string[]> {
  const signals = new Map<string, string[]>();

  for (const warning of warnings) {
    const candidates = slots
      .flatMap((slot) => {
        if (slot.slotGroup === "meal") {
          const primaryItem = getPrimaryDisplaySlotItem(slot);

          if (!primaryItem?.item.recipe) return [];

          return [
            {
              item: primaryItem.item,
              value: calculateDisplaySlotMetricTotals(slot)[warning.metric],
            },
          ];
        }

        return slot.items
          .filter(({ item }) => Boolean(item.recipe))
          .map(({ item }) => ({
            item,
            value: getPlannerItemNutritionMetricValue(item, warning.metric),
          }));
      })
      .filter(({ value }) => value > 0 || warning.metric === "fiber");

    if (candidates.length === 0) continue;

    candidates.sort((left, right) => {
      if (warning.direction === "max") {
        return right.value - left.value;
      }

      return left.value - right.value;
    });

    const selectedCandidates =
      warning.direction === "max"
        ? candidates
            .filter(({ value }, index) => {
              const topValue = candidates[0]?.value ?? 0;
              const minimumRelevantValue = Math.max(warning.total * 0.2, topValue * 0.6);

              if (index === 0) return true;

              return value >= minimumRelevantValue;
            })
            .slice(0, 2)
        : (() => {
            const lowContributionCutoff = Math.max(4, warning.threshold * 0.15);
            const lowContributors = candidates
              .filter(({ value }) => value <= lowContributionCutoff)
              .slice(0, 2);

            return lowContributors.length > 0 ? lowContributors : candidates.slice(0, 1);
          })();

    for (const candidate of selectedCandidates) {
      const nextSignals = [...(signals.get(candidate.item.id) ?? [])];
      const text = buildNutritionSignalText(warning.metric, candidate.value);

      if (!nextSignals.includes(text)) {
        nextSignals.push(text);
        signals.set(candidate.item.id, nextSignals);
      }
    }
  }

  return signals;
}

function buildAddMenu(day: PlannerDayResult) {
  const availableSlots = day.slots.filter((slot) => slot.definition.isEnabled);
  const slotByKey = new Map(availableSlots.map((slot) => [slot.definition.key, slot] as const));
  const pick = (key: string) => slotByKey.get(key) ?? null;
  const explicitMeals = ["breakfast", "lunch", "dinner"]
    .map(pick)
    .filter((slot): slot is PlannerDaySlotResult => Boolean(slot));
  const flexSlots = ["mid-am", "afternoon", "evening"]
    .map(pick)
    .filter((slot): slot is PlannerDaySlotResult => Boolean(slot));
  const workoutSlots = ["pre-workout", "post-workout"]
    .map(pick)
    .filter((slot): slot is PlannerDaySlotResult => Boolean(slot));
  const snackSlot =
    availableSlots.find((slot) => slot.definition.key === "snack") ??
    availableSlots.find((slot) => slot.definition.slotGroup === "snack") ??
    null;

  return {
    explicitMeals,
    flexSlots,
    workoutSlots,
    snackSlot,
  };
}

function formatCountLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildMainRoleSummary(slot: DisplaySlot) {
  const mainItems = slot.items.filter(({ item }) => item.role === "main");

  if (mainItems.length <= 1) return null;

  const itemNames = mainItems
    .map(({ item }) => item.recipe?.name ?? item.title ?? null)
    .filter((value): value is string => Boolean(value));

  if (itemNames.length === 0) {
    return `${formatCountLabel(mainItems.length, "main", "mains")} planned`;
  }

  const uniqueNames = Array.from(new Set(itemNames));

  if (uniqueNames.length === 1) {
    return `Main x${mainItems.length}: ${uniqueNames[0]}`;
  }

  return `Mains: ${uniqueNames[0]} +${uniqueNames.length - 1} more`;
}

function buildSecondaryRoleSummary(slot: DisplaySlot) {
  const sideItems = slot.items.filter(({ item }) => item.role === "side");
  const drinkItems = slot.items.filter(({ item }) => item.role === "drink");
  const buildDetail = (items: DisplaySlotItem[], singularLabel: string, pluralLabel: string) => {
    if (items.length === 0) return null;

    const firstName = items[0]?.item.recipe?.name ?? items[0]?.item.title ?? null;

    if (!firstName) {
      return `+${formatCountLabel(items.length, singularLabel.toLowerCase(), pluralLabel.toLowerCase())}`;
    }

    if (items.length === 1) {
      return `${singularLabel}: ${firstName}`;
    }

    return `${pluralLabel}: ${firstName} +${items.length - 1} more`;
  };

  return [
    buildMainRoleSummary(slot),
    buildDetail(sideItems, "Side", "Sides"),
    buildDetail(drinkItems, "Drink", "Drinks"),
  ].filter((value): value is string => Boolean(value));
}

function PlannerToolbar({
  householdName,
  title,
  viewMode,
  macroSummary,
  onPrev,
  onNext,
  onToday,
  onWeek,
  onMonth,
  onSuggest,
  suggestionsDisabled = false,
}: {
  householdName: string | null;
  title: string;
  viewMode: PlannerViewMode;
  macroSummary: PlannerMacroTotals | null;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onWeek: () => void;
  onMonth: () => void;
  onSuggest?: () => void;
  suggestionsDisabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-default-400 text-xs tracking-[0.18em] uppercase">
            {householdName ? `${householdName} planner` : "Household planner"}
          </div>
          <h1 className="text-foreground mt-1 truncate text-2xl font-bold">{title}</h1>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end sm:gap-3">
          {onSuggest ? (
            <Button
              className="button-accent-soft"
              isDisabled={suggestionsDisabled}
              size="sm"
              variant="secondary"
              onPress={onSuggest}
            >
              <SparklesIcon className="h-4 w-4" />
              Suggest meals
            </Button>
          ) : null}

          <div
            aria-label="Planner view"
            className="bg-content2 border-default-200 flex items-center gap-1 rounded-lg border p-1"
            role="group"
          >
            <Button
              aria-pressed={viewMode === "week"}
              className="min-w-16"
              size="sm"
              variant={viewMode === "week" ? "primary" : "ghost"}
              onPress={onWeek}
            >
              Week
            </Button>
            <Button
              aria-pressed={viewMode === "month"}
              className="min-w-16"
              size="sm"
              variant={viewMode === "month" ? "primary" : "ghost"}
              onPress={onMonth}
            >
              Month
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              isIconOnly
              aria-label="Previous period"
              size="sm"
              variant="tertiary"
              onPress={onPrev}
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="tertiary" onPress={onToday}>
              Today
            </Button>
            <Button
              isIconOnly
              aria-label="Next period"
              size="sm"
              variant="tertiary"
              onPress={onNext}
            >
              <ArrowRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {macroSummary && macroSummary.itemCount > 0 ? (
        <PlannerMacroStrip
          title={viewMode === "week" ? "Weekly average" : "Daily average"}
          totals={macroSummary}
        />
      ) : null}
    </div>
  );
}

function NoHouseholdState() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="bg-background/90 border-default-100 w-full max-w-xl border shadow-sm">
        <Card.Content className="items-center gap-4 p-8 text-center">
          <div className="bg-primary/10 text-primary flex h-14 w-14 items-center justify-center rounded-full">
            <UserGroupIcon className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-foreground text-2xl font-semibold">Create your household first</h2>
            <p className="text-default-500 mt-2 text-sm leading-relaxed">
              The new planner is household-scoped, so it needs a household before it can load slots,
              targets, and shared shopping context.
            </p>
          </div>
          <Link
            className={buttonVariants({ size: "md", variant: "primary" })}
            href="/settings/household"
          >
            Open household settings
          </Link>
        </Card.Content>
      </Card>
    </div>
  );
}

function PlannerSlotItemCard({
  item,
  isSaving,
  onDelete,
  onEdit,
  healthSignals,
  peopleCount,
  showInlineDelete = true,
}: {
  item: PlannerSlotItemResult;
  isSaving: boolean;
  onDelete: (itemId: string) => void;
  onEdit: () => void;
  healthSignals?: string[];
  peopleCount?: number | null;
  showInlineDelete?: boolean;
}) {
  const title = item.recipe?.name ?? item.title ?? "Untitled item";
  const recipeMeta = buildRecipeMeta(item);

  return (
    <div className="flex items-start gap-3 rounded-xl">
      <button
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
        type="button"
        onClick={onEdit}
      >
        <div className="bg-default-100 border-default-100 relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border">
          {item.recipe?.image ? (
            <Image
              fill
              unoptimized
              alt={title}
              className="h-full w-full object-cover"
              sizes="56px"
              src={item.recipe.image}
            />
          ) : (
            <div className="text-default-400 flex h-full w-full items-center justify-center text-[11px] font-medium">
              {item.itemKind === "recipe" ? "Recipe" : "Note"}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {item.role !== "main" ? (
            <div className="text-default-400 text-[10px] tracking-[0.18em] uppercase">
              {item.role}
            </div>
          ) : null}
          <div className="text-foreground [display:-webkit-box] overflow-hidden text-sm font-medium [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
            {title}
          </div>
          {recipeMeta.length > 0 || item.isConsumer ? (
            <div className="text-default-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              {peopleCount && peopleCount > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <UserGroupIcon className="h-3 w-3" />
                  {peopleCount}
                </span>
              ) : null}
              {recipeMeta.map((value) => (
                <span key={value}>{value}</span>
              ))}
              {item.isConsumer ? (
                <span className="bg-success-100 text-success-700 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-[0.14em] uppercase">
                  Prep
                </span>
              ) : null}
            </div>
          ) : null}
          {healthSignals?.length ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-amber-700 dark:text-amber-200">
              {healthSignals.map((signal) => (
                <span key={signal}>{signal}</span>
              ))}
            </div>
          ) : null}
        </div>
      </button>

      {showInlineDelete ? (
        <button
          className="text-default-400 hover:text-danger rounded-md p-1 transition-colors"
          disabled={isSaving}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(item.id);
          }}
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function PlannerAddMenu({
  menu,
  onOpenPicker,
  showEmptyState = false,
}: {
  menu: ReturnType<typeof buildAddMenu>;
  onOpenPicker: (slot: PlannerDaySlotResult) => void;
  showEmptyState?: boolean;
}) {
  const snackSlot = menu.snackSlot;
  const hasMainMeals = menu.explicitMeals.length > 0;
  const hasFlexSlots = menu.flexSlots.length > 0;
  const hasSnackSlot = Boolean(snackSlot);

  return (
    <Dropdown>
      {showEmptyState ? (
        <Dropdown.Trigger className="text-default-400 hover:text-default-500 hover:border-default-300 border-default-200 flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-6 transition-colors">
          <PlusIcon className="h-5 w-5" />
          <span className="text-xs">Plan a meal</span>
        </Dropdown.Trigger>
      ) : (
        <Button
          isIconOnly
          aria-label="Add planner item"
          className="text-default-500 hover:text-primary h-8 min-w-8"
          size="sm"
          variant="tertiary"
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      )}

      <Dropdown.Popover placement={showEmptyState ? "bottom" : "bottom end"}>
        <Dropdown.Menu aria-label="Choose planner slot">
          {hasMainMeals ? (
            <Dropdown.Section>
              <Header>Main meals</Header>
              {menu.explicitMeals.map((slot) => (
                <Dropdown.Item
                  key={slot.definition.id}
                  id={`main-${slot.definition.id}`}
                  textValue={slot.definition.label}
                  onAction={() => onOpenPicker(slot)}
                >
                  <Label>{slot.definition.label}</Label>
                </Dropdown.Item>
              ))}
            </Dropdown.Section>
          ) : null}

          {hasMainMeals && hasFlexSlots ? <Separator /> : null}
          {hasFlexSlots ? (
            <Dropdown.Section>
              <Header>Flex</Header>
              {menu.flexSlots.map((slot) => (
                <Dropdown.Item
                  key={slot.definition.id}
                  id={`flex-${slot.definition.id}`}
                  textValue={slot.definition.label}
                  onAction={() => onOpenPicker(slot)}
                >
                  <Label>{slot.definition.label}</Label>
                </Dropdown.Item>
              ))}
            </Dropdown.Section>
          ) : null}

          {(hasMainMeals || hasFlexSlots) && hasSnackSlot ? <Separator /> : null}
          {snackSlot ? (
            <Dropdown.Section>
              <Header>Snacks</Header>
              <Dropdown.Item
                id={`snack-${snackSlot.definition.id}`}
                textValue="Snack"
                onAction={() => onOpenPicker(snackSlot)}
              >
                <Label>Snack</Label>
              </Dropdown.Item>
            </Dropdown.Section>
          ) : null}

          {(hasMainMeals || hasFlexSlots || hasSnackSlot) && menu.workoutSlots.length > 0 ? (
            <Separator />
          ) : null}
          {menu.workoutSlots.length > 0 ? (
            <Dropdown.Section>
              <Header>Workout</Header>
              {menu.workoutSlots.map((slot) => (
                <Dropdown.Item
                  key={slot.definition.id}
                  id={`workout-${slot.definition.id}`}
                  textValue={slot.definition.label}
                  onAction={() => onOpenPicker(slot)}
                >
                  <Label>{slot.definition.label}</Label>
                </Dropdown.Item>
              ))}
            </Dropdown.Section>
          ) : null}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

function PlannerDayCard({
  day,
  mode,
  isToday,
  defaultPeopleCount,
  focusMetrics,
  nutritionTargets,
  onOpenPicker,
  onOpenSwapPicker,
  onClearSlot,
  onToggleLock,
  onDeleteSlotItem,
  onOpenSlotEditor,
  isSaving,
}: {
  day: PlannerDayResult;
  mode: PlannerViewMode;
  isToday: boolean;
  defaultPeopleCount: number;
  focusMetrics: NutritionFocusMetricKey[];
  nutritionTargets: NutritionMetricTargetsDto;
  onOpenPicker: (slot: PlannerDaySlotResult) => void;
  onOpenSwapPicker: (target: PlannerSwapTarget) => void;
  onClearSlot: (slot: DisplaySlot) => void;
  onToggleLock: (slot: PlannerDaySlotResult) => void;
  onDeleteSlotItem: (itemId: string) => void;
  onOpenSlotEditor: (slot: PlannerDaySlotResult, date: string) => void;
  isSaving: boolean;
}) {
  const visibleSlots = buildDisplaySlots(day);
  const menu = buildAddMenu(day);
  const dayTotals = calculatePlannerDayTotals(day);
  const nutritionTotals = calculatePlannerDayNutritionTotals(day);
  const warningChips = evaluateNutritionWarnings(
    nutritionTotals,
    focusMetrics,
    nutritionTargets
  ).slice(0, 3);
  const swapTarget = buildSwapTarget(day, nutritionTotals, warningChips);
  const displayedHealthSignals = buildDisplayedHealthSignals(visibleSlots, warningChips);
  const showDayTotals = dayTotals.itemCount > 0;
  const getPeopleCount = (slot: PlannerDaySlotResult) =>
    slot.usesWholeHousehold ? defaultPeopleCount : slot.participantOverrides.length;

  return (
    <Card className={`shadow-sm ${isToday ? "border-l-primary border-l-3 shadow-md" : ""}`}>
      <Card.Content
        className={`flex flex-col gap-2 overflow-hidden px-4 py-3 ${mode === "month" ? "min-h-[280px]" : "min-h-[320px]"}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            {isToday ? (
              <>
                <span className="text-primary text-lg font-bold">Today</span>
                <span className="text-default-500 text-sm">
                  {labelForDate(day.date, { weekday: "long", month: "long", day: "numeric" })}
                </span>
              </>
            ) : (
              <>
                <span className="text-foreground text-base font-semibold">
                  {labelForDate(day.date, { month: "long", day: "numeric" })}
                </span>
                <span className="text-default-400 text-sm">
                  {labelForDate(day.date, { weekday: "long" })}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {swapTarget ? (
              <Button
                isIconOnly
                aria-label={`Find a swap for ${swapTarget.warning.label.toLowerCase()}`}
                className="h-8 min-w-8 bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200"
                size="sm"
                variant="tertiary"
                onPress={() => onOpenSwapPicker(swapTarget)}
              >
                <ArrowPathIcon className="h-4 w-4" />
              </Button>
            ) : null}

            <PlannerAddMenu menu={menu} onOpenPicker={onOpenPicker} />
          </div>
        </div>

        <Separator />

        {showDayTotals ? <PlannerMacroStrip compact totals={dayTotals} /> : null}

        {warningChips.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {warningChips.map((warning) => (
              <Chip
                key={warning.metric}
                className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                color="warning"
                size="sm"
                variant="soft"
              >
                <Chip.Label>{buildNutritionSignalText(warning.metric, warning.total)}</Chip.Label>
              </Chip>
            ))}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {visibleSlots.length === 0 ? (
            <PlannerAddMenu showEmptyState menu={menu} onOpenPicker={onOpenPicker} />
          ) : (
            <div className="flex flex-col">
              {visibleSlots.map((slot) => {
                const isLockable = slot.sourceSlots.length === 1;
                const isLocked = isLockable ? (slot.targetSlot.planSlot?.isLocked ?? false) : false;

                return (
                  <div key={slot.id} className="border-default-100 border-b py-3 last:border-b-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-default-400 text-[11px] tracking-[0.18em] uppercase">
                        {slot.label}
                      </div>

                      <div className="flex items-center gap-1">
                        {isLockable ? (
                          <button
                            className="text-default-400 hover:text-foreground rounded-md p-1 transition-colors"
                            disabled={isSaving}
                            type="button"
                            onClick={() => onToggleLock(slot.targetSlot)}
                          >
                            {isLocked ? (
                              <LockClosedIcon className="h-4 w-4" />
                            ) : (
                              <LockOpenIcon className="h-4 w-4" />
                            )}
                          </button>
                        ) : null}
                        <button
                          className="text-default-400 hover:text-danger rounded-md p-1 transition-colors"
                          disabled={isSaving}
                          type="button"
                          onClick={() => onClearSlot(slot)}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 space-y-2">
                      {slot.slotGroup === "meal"
                        ? (() => {
                            const primaryItem =
                              slot.items.find(({ item }) => item.role === "main") ??
                              slot.items[0] ??
                              null;
                            const secondarySummary = buildSecondaryRoleSummary(slot);

                            if (!primaryItem) return null;

                            return (
                              <>
                                <PlannerSlotItemCard
                                  healthSignals={displayedHealthSignals.get(primaryItem.item.id)}
                                  isSaving={isSaving}
                                  item={primaryItem.item}
                                  peopleCount={getPeopleCount(slot.targetSlot)}
                                  showInlineDelete={false}
                                  onDelete={onDeleteSlotItem}
                                  onEdit={() => onOpenSlotEditor(slot.targetSlot, day.date)}
                                />
                                {secondarySummary.length > 0 ? (
                                  <button
                                    className="text-default-400 hover:text-foreground flex w-full flex-col items-start gap-1 text-left text-xs transition-colors"
                                    type="button"
                                    onClick={() => onOpenSlotEditor(slot.targetSlot, day.date)}
                                  >
                                    {secondarySummary.map((summary) => (
                                      <span key={summary} className="max-w-full truncate">
                                        {summary}
                                      </span>
                                    ))}
                                  </button>
                                ) : null}
                              </>
                            );
                          })()
                        : slot.items.map(({ item, slot: sourceSlot }) => (
                            <PlannerSlotItemCard
                              key={item.id}
                              healthSignals={displayedHealthSignals.get(item.id)}
                              isSaving={isSaving}
                              item={item}
                              peopleCount={getPeopleCount(sourceSlot)}
                              onDelete={onDeleteSlotItem}
                              onEdit={() => onOpenSlotEditor(sourceSlot, day.date)}
                            />
                          ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}

function PlannerLoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-[340px] rounded-2xl" />
      ))}
    </div>
  );
}

export default function ManualPlannerPage() {
  const [viewMode, setViewMode] = useState<PlannerViewMode>("week");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [pickerState, setPickerState] = useState<PickerState | null>(null);
  const [editState, setEditState] = useState<EditState>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionMode, setSuggestionMode] = useState<PlannerPlanningMode>("balanced");
  const [suggestionScope, setSuggestionScope] = useState<PlannerSuggestionScope>("dinners");
  const [suggestionSeed, setSuggestionSeed] = useState(0);
  const [isApplyingSuggestions, setIsApplyingSuggestions] = useState(false);
  const suggestionReplacementSeed = useRef(0);
  const { user } = useUserContext();

  const { household, isLoading: isHouseholdLoading } = useHouseholdQuery();
  const range = useMemo(() => buildRange(anchorDate, viewMode), [anchorDate, viewMode]);
  const {
    data,
    isLoading: isPlannerLoading,
    error,
    queryKey,
  } = usePlannerRangeQuery(
    {
      ...range,
      enabledOnly: false,
    },
    {
      enabled: Boolean(household),
    }
  );
  const suggestionsQuery = usePlannerSuggestionsQuery(
    {
      startDate: range.startDate,
      endDate: range.endDate,
      mode: suggestionMode,
      scope: suggestionScope,
      today: dateKey(new Date()),
      seed: suggestionSeed,
    },
    {
      enabled: Boolean(household) && viewMode === "week" && suggestionsOpen,
    }
  );
  const fetchPlannerSuggestions = usePlannerSuggestionsFetcher();

  const prepQuery = usePrepRangeQuery(range, {
    enabled: Boolean(household),
  });
  const {
    addRecipeToSlot,
    clearSlot,
    deleteSlotItem,
    duplicateSlotItem,
    isSaving,
    markSlotItemCooked,
    moveSlotItem,
    saveSlotState,
    setSlotItemDairyFree,
    setSlotParticipants,
    updateSlotItem,
  } = usePlannerMutations({ queryKey });
  const prepRecipeIds = useMemo(
    () =>
      Array.from(
        new Set(
          (prepQuery.data?.sessions ?? []).flatMap((session) =>
            session.items
              .map((item) => item.recipe?.id)
              .filter((recipeId): recipeId is string => Boolean(recipeId))
          )
        )
      ),
    [prepQuery.data?.sessions]
  );
  const activeDay = editState
    ? (data?.days.find((day) => day.date === editState.date) ?? null)
    : null;
  const activeSlot =
    editState && activeDay
      ? (activeDay.slots.find((slot) => slot.definition.id === editState.slotDefinitionId) ?? null)
      : null;

  const title = useMemo(() => {
    if (viewMode === "week") {
      return `${labelForDate(range.startDate, { day: "numeric", month: "short" })} - ${labelForDate(range.endDate, { day: "numeric", month: "short" })}`;
    }

    return labelForDate(dateKey(startOfMonth(anchorDate)), {
      month: "long",
      year: "numeric",
    });
  }, [anchorDate, range.endDate, range.startDate, viewMode]);
  const macroSummary = useMemo(
    () => (data ? calculatePlannerRangeAverages(data.days) : null),
    [data]
  );
  const focusMetrics = useMemo(() => getFocusNutritionMetricsPreference(user), [user]);
  const nutritionTargets = useMemo(() => getNutritionTargetsPreference(user), [user]);

  const handlePrev = () =>
    setAnchorDate((current) =>
      viewMode === "week" ? addWeeks(current, -1) : addMonths(current, -1)
    );
  const handleNext = () =>
    setAnchorDate((current) =>
      viewMode === "week" ? addWeeks(current, 1) : addMonths(current, 1)
    );
  const handleToday = () => setAnchorDate(new Date());

  const buildPickerState = (
    slot: PlannerDaySlotResult,
    date: string,
    options?: {
      allowMultiple?: boolean;
      reopenEditor?: boolean;
      role?: "main" | "side" | "drink";
      recipeTypeFiltersOverride?: string[];
      subtitleOverride?: string;
      hideRandom?: boolean;
      titleOverride?: string;
      nutritionFilters?: PickerState["nutritionFilters"];
      swapContext?: PickerState["swapContext"];
    }
  ): PickerState => ({
    date,
    slotId: slot.definition.id,
    slotKey: slot.definition.key,
    slotLabel: slot.definition.label,
    slotGroup: slot.definition.slotGroup,
    allowMultiple:
      options?.allowMultiple ??
      (slot.definition.allowMultiple || slot.definition.slotGroup === "snack"),
    role: options?.role ?? "main",
    reopenEditor: options?.reopenEditor ?? false,
    recipeTypeFiltersOverride: options?.recipeTypeFiltersOverride,
    subtitleOverride: options?.subtitleOverride,
    hideRandom: options?.hideRandom ?? false,
    titleOverride: options?.titleOverride,
    nutritionFilters: options?.nutritionFilters,
    swapContext: options?.swapContext,
  });

  const handleSelectRecipe = async (recipeId: string) => {
    if (!pickerState) return;

    const nextEditState = pickerState.reopenEditor
      ? {
          date: pickerState.date,
          slotDefinitionId: pickerState.slotId,
        }
      : null;

    await addRecipeToSlot(pickerState.date, pickerState.slotId, recipeId, {
      append: pickerState.allowMultiple,
      role: pickerState.role,
    });
    setPickerState(null);
    setEditState(nextEditState);
  };

  const handleApplySuggestedMeals = async (suggestions: PlannerSuggestedMeal[]) => {
    if (suggestions.length === 0) return;

    setIsApplyingSuggestions(true);

    try {
      let appliedCount = 0;

      for (const suggestion of suggestions) {
        const slot = data?.days
          .find((day) => day.date === suggestion.date)
          ?.slots.find(
            (candidateSlot) => candidateSlot.definition.id === suggestion.plannerSlotDefinitionId
          );

        if (!slot || slot.planSlot?.isLocked || slot.items.length > 0) continue;

        await addRecipeToSlot(
          suggestion.date,
          suggestion.plannerSlotDefinitionId,
          suggestion.recipe.id,
          {
            append: false,
            role: "main",
          }
        );
        appliedCount += 1;
      }

      const message =
        appliedCount > 0
          ? String(appliedCount) + " meal" + (appliedCount === 1 ? "" : "s") + " added"
          : "No open meal slots remain";

      if (appliedCount > 0) {
        toast.success(message);
      } else {
        toast.warning(message);
      }

      if (appliedCount > 0) setSuggestionsOpen(false);
    } catch {
      toast.danger("Could not update your meal plan", { description: "Please try again." });
    } finally {
      setIsApplyingSuggestions(false);
    }
  };

  const handleReplaceSuggestedMeal = async (
    suggestion: PlannerSuggestedMeal,
    draftSuggestions: PlannerSuggestedMeal[]
  ) => {
    suggestionReplacementSeed.current = (suggestionReplacementSeed.current + 1) % 10_001;

    try {
      const result = await fetchPlannerSuggestions({
        startDate: range.startDate,
        endDate: range.endDate,
        mode: suggestionMode,
        scope: suggestionScope,
        today: dateKey(new Date()),
        seed: (suggestionSeed + suggestionReplacementSeed.current) % 10_001,
        targetDates: [suggestion.date],
        targetSlotDefinitionIds: [suggestion.plannerSlotDefinitionId],
        excludedRecipeIds: draftSuggestions.map((candidate) => candidate.recipe.id),
      });
      const replacement = result.suggestions.find(
        (candidate) =>
          candidate.date === suggestion.date &&
          candidate.plannerSlotDefinitionId === suggestion.plannerSlotDefinitionId
      );

      if (!replacement) {
        toast.warning("No alternative meal found");
      }

      return replacement ?? null;
    } catch {
      toast.danger("Could not replace this meal", { description: "Please try again." });

      return null;
    }
  };

  const plannerErrorMessage = error instanceof Error ? error.message : "Planner failed to load";

  return (
    <>
      <div className="flex w-full flex-col gap-6">
        <PlannerToolbar
          householdName={household?.name ?? null}
          macroSummary={macroSummary}
          suggestionsDisabled={!household || !data || isSaving || isApplyingSuggestions}
          title={title}
          viewMode={viewMode}
          onMonth={() => setViewMode("month")}
          onNext={handleNext}
          onPrev={handlePrev}
          onSuggest={viewMode === "week" && household ? () => setSuggestionsOpen(true) : undefined}
          onToday={handleToday}
          onWeek={() => setViewMode("week")}
        />

        {isHouseholdLoading ? (
          <PlannerLoadingGrid />
        ) : !household ? (
          <NoHouseholdState />
        ) : isPlannerLoading ? (
          <PlannerLoadingGrid />
        ) : error ? (
          <Card className="border-danger-100 bg-danger-50 border shadow-none">
            <Card.Content className="flex items-center justify-between gap-4 p-5 md:flex-row">
              <div>
                <div className="text-danger text-lg font-semibold">Planner failed to load</div>
                <div className="text-danger-700 mt-1 text-sm">{plannerErrorMessage}</div>
              </div>
              <Button variant="danger-soft" onPress={() => window.location.reload()}>
                <ArrowPathIcon className="h-4 w-4" />
                Reload
              </Button>
            </Card.Content>
          </Card>
        ) : data ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.days.map((day) => (
              <PlannerDayCard
                key={day.date}
                day={day}
                defaultPeopleCount={data.householdPeople.filter((person) => person.isActive).length}
                focusMetrics={focusMetrics}
                isSaving={isSaving}
                isToday={day.date === dateKey(new Date())}
                mode={viewMode}
                nutritionTargets={nutritionTargets}
                onClearSlot={(slot) =>
                  Promise.all(
                    slot.sourceSlots
                      .filter((sourceSlot) => sourceSlot.items.length > 0)
                      .map((sourceSlot) =>
                        clearSlot({
                          date: day.date,
                          plannerSlotDefinitionId: sourceSlot.definition.id,
                        })
                      )
                  )
                }
                onDeleteSlotItem={deleteSlotItem}
                onOpenPicker={(slot) => setPickerState(buildPickerState(slot, day.date))}
                onOpenSlotEditor={(slot, date) =>
                  setEditState({
                    date,
                    slotDefinitionId: slot.definition.id,
                  })
                }
                onOpenSwapPicker={(target) =>
                  setPickerState(
                    buildPickerState(target.slot, day.date, {
                      allowMultiple: target.warning.metric === "fiber",
                      hideRandom: true,
                      nutritionFilters: target.nutritionFilters,
                      role: "main",
                      recipeTypeFiltersOverride:
                        target.warning.metric === "fiber"
                          ? ["snack"]
                          : recipeTypeFiltersForSwap(target.slot),
                      subtitleOverride: target.subtitle,
                      titleOverride: `${target.titlePrefix} ${labelForDate(day.date, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}`,
                      swapContext: {
                        currentRecipeName: target.currentLabel,
                        metrics: target.currentMetrics,
                      },
                    })
                  )
                }
                onToggleLock={(slot) =>
                  saveSlotState({
                    date: day.date,
                    plannerSlotDefinitionId: slot.definition.id,
                    isLocked: !(slot.planSlot?.isLocked ?? false),
                    status: slot.planSlot?.status ?? "neutral",
                    batchMultiplier: slot.planSlot?.batchMultiplier ?? 1,
                    headcountOverride: slot.planSlot?.headcountOverride ?? null,
                  })
                }
              />
            ))}
          </div>
        ) : null}
      </div>

      <PlannerRecipePickerPanel
        maxCholesterol={pickerState?.nutritionFilters?.maxCholesterol}
        maxSodium={pickerState?.nutritionFilters?.maxSodium}
        minFiber={pickerState?.nutritionFilters?.minFiber}
        open={Boolean(pickerState)}
        prioritizedRecipeIds={prepRecipeIds}
        recipeTypeFilters={recipeTypeFiltersForPicker(pickerState)}
        showRandomButton={!pickerState?.hideRandom}
        subtitleOverride={pickerState?.subtitleOverride}
        suggestedCategory={
          pickerState?.role === "main" && suitableSlotForPicker(pickerState)
            ? undefined
            : suggestedCategoryForSlot(pickerState)
        }
        suggestedSuitableSlot={suitableSlotForPicker(pickerState)}
        swapContext={pickerState?.swapContext}
        title={
          pickerState
            ? (pickerState.titleOverride ??
              `${pickerState.hideRandom ? "Swap" : pickerState.role === "main" ? "Add to" : pickerState.role === "side" ? "Add side to" : "Add drink to"} ${pickerState.slotLabel} - ${labelForDate(
                pickerState.date,
                {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                }
              )}`)
            : "Add recipe"
        }
        onOpenChange={(open) => {
          if (!open) setPickerState(null);
        }}
        onSelectRecipe={handleSelectRecipe}
      />

      <PlannerWeekSuggestionsPanel
        data={suggestionsQuery.data}
        error={suggestionsQuery.error}
        isApplying={isApplyingSuggestions}
        isLoading={suggestionsQuery.isLoading}
        isRefreshing={suggestionsQuery.isFetching}
        mode={suggestionMode}
        open={suggestionsOpen}
        scope={suggestionScope}
        onApply={handleApplySuggestedMeals}
        onModeChange={(mode) => {
          suggestionReplacementSeed.current = 0;
          setSuggestionMode(mode);
        }}
        onOpenChange={setSuggestionsOpen}
        onRefresh={() => setSuggestionSeed((current) => (current + 1) % 10_001)}
        onReplace={handleReplaceSuggestedMeal}
        onScopeChange={(scope) => {
          suggestionReplacementSeed.current = 0;
          setSuggestionScope(scope);
        }}
      />

      <PlannerSlotItemPanel
        date={editState?.date ?? null}
        defaultPortionUnits={data?.defaultPortionUnits ?? 0}
        effectivePortionUnits={activeSlot?.effectivePortionUnits ?? 0}
        householdPeople={data?.householdPeople ?? []}
        isSaving={isSaving}
        items={activeSlot?.items ?? []}
        open={Boolean(editState)}
        participantOverrides={activeSlot?.participantOverrides ?? []}
        slotDefinitionId={editState?.slotDefinitionId ?? null}
        slotDefinitions={data?.slotDefinitions ?? []}
        slotGroup={activeSlot?.definition.slotGroup ?? null}
        slotKey={activeSlot?.definition.key ?? null}
        slotLabel={activeSlot?.definition.label ?? null}
        usesWholeHousehold={activeSlot?.usesWholeHousehold ?? true}
        onAddRecipe={(role) => {
          if (!activeSlot || !editState) return;

          setEditState(null);
          setPickerState(
            buildPickerState(activeSlot, editState.date, {
              allowMultiple: role !== "main",
              reopenEditor: true,
              role,
            })
          );
        }}
        onDelete={deleteSlotItem}
        onDuplicate={duplicateSlotItem}
        onMarkCooked={markSlotItemCooked}
        onOpenChange={(open) => {
          if (!open) setEditState(null);
        }}
        onSave={moveSlotItem}
        onSetDairyFree={setSlotItemDairyFree}
        onSetParticipants={setSlotParticipants}
        onUpdateItem={updateSlotItem}
      />
    </>
  );
}
