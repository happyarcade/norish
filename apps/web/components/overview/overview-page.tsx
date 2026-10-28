"use client";

import type { PlannerDayResult } from "@/hooks/planner";
import type { PlannerNutritionWarning } from "@/lib/nutrition/planner-health";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUserContext } from "@/context/user-context";
import { useHouseholdQuery } from "@/hooks/households";
import { usePlannerRangeQuery } from "@/hooks/planner";
import { usePrepRangeQuery } from "@/hooks/prep/use-prep-range-query";
import { useRecipesQuery } from "@/hooks/recipes";
import {
  calculatePlannerDayNutritionTotals,
  calculatePlannerRangeNutritionAverages,
  evaluateNutritionWarnings,
  formatNutritionMetricValue,
  getPlannerItemNutritionMetricValue,
  getRecipeNutritionMetricValue,
} from "@/lib/nutrition/planner-health";
import {
  ArrowRightIcon,
  BeakerIcon,
  ExclamationTriangleIcon,
  ShoppingBagIcon,
} from "@heroicons/react/16/solid";

import type { NutritionFocusMetricKey } from "@norish/shared/lib/nutrition-focus";
import { dateKey, getWeekEnd, getWeekStart } from "@norish/shared/lib/helpers";
import { NUTRITION_FOCUS_CONFIG } from "@norish/shared/lib/nutrition-focus";
import {
  getFocusNutritionMetricsPreference,
  getNutritionTargetsPreference,
} from "@norish/shared/lib/user-preferences";

const SLOT_ORDER: Record<string, number> = {
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

const SLOT_HOUR_HINT: Record<string, number> = {
  breakfast: 8,
  "mid-am": 10,
  lunch: 13,
  afternoon: 15,
  dinner: 19,
  evening: 21,
  snack: 16,
  "pre-workout": 17,
  "post-workout": 20,
};

function formatDateLabel(dateString: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(`${dateString}T12:00:00`));
}

function buildWeekRange(anchorDate: Date) {
  return {
    startDate: dateKey(getWeekStart(anchorDate)),
    endDate: dateKey(getWeekEnd(anchorDate)),
  };
}

function plannerSlotToSuitableSlot(slotKey: string): string | undefined {
  switch (slotKey) {
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
      return slotKey;
    default:
      return undefined;
  }
}

function recipeTypeFiltersForSwap(slotKey: string, role: string): string[] | undefined {
  if (role === "side") return ["side"];
  if (role === "drink") return ["drink"];

  switch (slotKey) {
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

function findNextPlannedSlot(days: PlannerDayResult[], now: Date) {
  const todayKey = dateKey(now);
  const currentHour = now.getHours();

  for (const day of days) {
    const slots = [...day.slots]
      .filter((slot) => slot.items.length > 0)
      .sort(
        (left, right) =>
          (SLOT_ORDER[left.definition.key] ?? left.definition.sortOrder) -
          (SLOT_ORDER[right.definition.key] ?? right.definition.sortOrder)
      );

    const candidateSlots =
      day.date === todayKey
        ? slots.filter((slot) => (SLOT_HOUR_HINT[slot.definition.key] ?? 99) >= currentHour)
        : slots;
    const slot = candidateSlots[0] ?? slots[0];

    if (!slot) continue;

    return {
      day,
      slot,
      item: slot.items.find((item) => item.role === "main") ?? slot.items[0],
    };
  }

  return null;
}

function ProgressRing({
  metric,
  value,
  threshold,
}: {
  metric: NutritionFocusMetricKey;
  value: number;
  threshold: number;
}) {
  const config = NUTRITION_FOCUS_CONFIG[metric];
  const progress = threshold > 0 ? value / threshold : 0;
  const clamped = Math.min(progress, 1);
  const ringColor = progress > 1 ? "#d97706" : "#3f6f49";

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative h-20 w-20 shrink-0 rounded-full"
        style={{
          background: `conic-gradient(${ringColor} ${clamped * 360}deg, rgba(15,23,42,0.08) 0deg)`,
        }}
      >
        <div className="bg-content1 absolute inset-3 rounded-full" />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-foreground text-sm font-semibold">
            {Math.round(Math.min(progress, 9.99) * 100)}%
          </div>
          <div className="text-default-400 text-[10px] tracking-[0.12em] uppercase">
            {config.shortLabel}
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <div className="text-foreground font-semibold">{config.label}</div>
        <div className="text-default-500 text-sm">
          {formatNutritionMetricValue(metric, value)} / {threshold}
          {config.unit}
        </div>
      </div>
    </div>
  );
}

function DashboardCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-3xl border border-black/5 shadow-sm">
      <Card.Header className="flex flex-col items-start gap-1 px-6 pt-5">
        <div className="text-default-400 text-[11px] tracking-[0.18em] uppercase">{eyebrow}</div>
        <h2 className="text-foreground text-xl font-semibold">{title}</h2>
      </Card.Header>
      <Card.Content className="px-6 pt-2 pb-6">{children}</Card.Content>
    </Card>
  );
}

type SwapSuggestionTarget = {
  day: PlannerDayResult;
  warning: PlannerNutritionWarning;
  slot: PlannerDayResult["slots"][number];
  item: PlannerDayResult["slots"][number]["items"][number];
  metricValue: number;
};

export default function OverviewPage({ initialNowIso }: { initialNowIso: string }) {
  const [now, setNow] = useState(() => new Date(initialNowIso));
  const { user } = useUserContext();
  const { household, isLoading: isHouseholdLoading } = useHouseholdQuery();
  const focusMetrics = useMemo(() => getFocusNutritionMetricsPreference(user), [user]);
  const nutritionTargets = useMemo(() => getNutritionTargetsPreference(user), [user]);
  const todayKey = useMemo(() => dateKey(now), [now]);
  const range = useMemo(() => buildWeekRange(new Date(`${todayKey}T12:00:00`)), [todayKey]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const { data: plannerData, isLoading: isPlannerLoading } = usePlannerRangeQuery(
    { ...range, enabledOnly: false },
    { enabled: Boolean(household) }
  );
  const { data: prepData, isLoading: isPrepLoading } = usePrepRangeQuery(range, {
    enabled: Boolean(household),
  });

  const nextPlannedSlot = useMemo(
    () => (plannerData ? findNextPlannedSlot(plannerData.days, now) : null),
    [now, plannerData]
  );
  const todayDay = useMemo(
    () => plannerData?.days.find((day) => day.date === todayKey) ?? null,
    [plannerData, todayKey]
  );
  const todayTotals = useMemo(
    () => (todayDay ? calculatePlannerDayNutritionTotals(todayDay) : null),
    [todayDay]
  );
  const weeklyAverageTotals = useMemo(
    () => (plannerData ? calculatePlannerRangeNutritionAverages(plannerData.days) : null),
    [plannerData]
  );
  const todayWarnings = useMemo(
    () =>
      todayTotals
        ? evaluateNutritionWarnings(todayTotals, focusMetrics, nutritionTargets).slice(0, 3)
        : [],
    [focusMetrics, nutritionTargets, todayTotals]
  );
  const weekWatchouts = useMemo(() => {
    if (!plannerData) return [];

    return plannerData.days
      .flatMap((day) =>
        evaluateNutritionWarnings(
          calculatePlannerDayNutritionTotals(day),
          focusMetrics,
          nutritionTargets
        ).map((warning) => ({
          day,
          warning,
        }))
      )
      .slice(0, 6);
  }, [focusMetrics, nutritionTargets, plannerData]);
  const prepReminders = useMemo(() => {
    if (!prepData) return [];

    return prepData.sessions
      .filter((session) => session.items.length > 0 && session.date >= todayKey)
      .slice(0, 4);
  }, [prepData, todayKey]);
  const weeklyPlannedItems = useMemo(
    () =>
      plannerData?.days.reduce(
        (total, day) =>
          total + day.slots.reduce((slotTotal, slot) => slotTotal + slot.items.length, 0),
        0
      ) ?? 0,
    [plannerData]
  );
  const heroTitle = nextPlannedSlot
    ? nextPlannedSlot.slot.definition.label
    : weeklyPlannedItems > 0
      ? "All done"
      : "Nothing planned";
  const heroSubtitle = nextPlannedSlot
    ? `${nextPlannedSlot.item.recipe?.name ?? nextPlannedSlot.item.title ?? "Untitled meal"} - ${nextPlannedSlot.day.date === todayKey ? "Today" : formatDateLabel(nextPlannedSlot.day.date, { weekday: "long", day: "numeric", month: "short" })}`
    : weeklyPlannedItems > 0
      ? "No more meals are planned for the rest of this week."
      : "Add meals to your planner to see what's next.";
  const swapSuggestionTarget = useMemo<SwapSuggestionTarget | null>(() => {
    const baseDay =
      todayWarnings.length > 0 && todayDay ? todayDay : (weekWatchouts[0]?.day ?? null);
    const baseWarning = todayWarnings[0] ?? weekWatchouts[0]?.warning ?? null;

    if (!baseDay || !baseWarning) return null;

    const candidates = baseDay.slots.flatMap((slot) =>
      slot.items
        .filter((item) => item.recipe)
        .map((item) => ({
          slot,
          item,
          metricValue: getPlannerItemNutritionMetricValue(item, baseWarning.metric),
        }))
    );

    if (candidates.length === 0) return null;

    const ranked = [...candidates].sort((left, right) =>
      baseWarning.direction === "max"
        ? right.metricValue - left.metricValue
        : left.metricValue - right.metricValue
    );
    const top = ranked[0];

    if (!top?.item.recipe) return null;

    return {
      day: baseDay,
      warning: baseWarning,
      slot: top.slot,
      item: top.item,
      metricValue: top.metricValue,
    };
  }, [todayWarnings, todayDay, weekWatchouts]);
  const swapQueryFilters = useMemo(() => {
    if (!swapSuggestionTarget) {
      return {
        limit: 6,
        recipeTypes: ["__no_swap__"],
      };
    }

    const suitableSlot = plannerSlotToSuitableSlot(swapSuggestionTarget.slot.definition.key);
    const recipeTypes = recipeTypeFiltersForSwap(
      swapSuggestionTarget.slot.definition.key,
      swapSuggestionTarget.item.role
    );
    const baseFilters = {
      limit: 12,
      recipeTypes:
        recipeTypes && recipeTypes.length > 0
          ? recipeTypes
          : suitableSlot
            ? undefined
            : ["__no_swap__"],
      suitableSlots: suitableSlot ? [suitableSlot] : undefined,
    };

    switch (swapSuggestionTarget.warning.metric) {
      case "sodium":
        return {
          ...baseFilters,
          maxSodium: Math.max(1, Math.round(swapSuggestionTarget.metricValue * 0.85)),
        };
      case "cholesterol":
        return {
          ...baseFilters,
          maxCholesterol: Math.max(1, Math.round(swapSuggestionTarget.metricValue * 0.85)),
        };
      case "fiber":
        return {
          ...baseFilters,
          minFiber: Math.max(5, Number((swapSuggestionTarget.metricValue + 3).toFixed(1))),
        };
      default:
        return baseFilters;
    }
  }, [swapSuggestionTarget]);
  const { recipes: swapCandidates } = useRecipesQuery(swapQueryFilters);
  const swapSuggestions = useMemo(() => {
    if (!swapSuggestionTarget?.item.recipe) return [];

    return swapCandidates
      .filter((recipe) => recipe.id !== swapSuggestionTarget.item.recipe?.id)
      .slice(0, 3)
      .map((recipe) => ({
        recipe,
        metricValue: getRecipeNutritionMetricValue(recipe, swapSuggestionTarget.warning.metric),
      }));
  }, [swapCandidates, swapSuggestionTarget]);

  if (isHouseholdLoading || isPlannerLoading || isPrepLoading) {
    return <div className="text-default-400 text-sm">Loading dashboard...</div>;
  }

  if (!household) {
    return (
      <DashboardCard eyebrow="Overview" title="Set up your household">
        <div className="flex flex-col gap-4">
          <p className="text-default-500 text-sm">
            {
              "Create a household first so the dashboard can track who you're feeding and what's due."
            }
          </p>
          <div>
            <Button as={Link} color="primary" href="/settings/household" radius="full">
              Open household settings
            </Button>
          </div>
        </div>
      </DashboardCard>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-default-400 text-[11px] tracking-[0.18em] uppercase">
            {formatDateLabel(todayKey, {
              weekday: "long",
              day: "numeric",
              month: "short",
            })}
          </div>
          <h1 className="text-foreground mt-1 text-3xl font-bold">Dashboard</h1>
        </div>
      </div>

      <section
        className="overflow-hidden rounded-[32px] px-8 py-8 text-white shadow-[0_18px_45px_-24px_rgba(0,0,0,0.45)]"
        style={{
          background:
            "linear-gradient(135deg, rgb(38, 64, 50) 0%, rgb(51, 86, 64) 58%, rgb(86, 118, 89) 100%)",
        }}
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="text-sm tracking-[0.24em] text-[#d8b29d] uppercase">Next up</div>
            <div className="mt-3 text-6xl font-medium tracking-tight">{heroTitle}</div>
            <div className="mt-3 text-lg text-white/75">{heroSubtitle}</div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              as={Link}
              className="rounded-full bg-[#d28d66] font-medium text-white"
              endContent={<ArrowRightIcon className="h-4 w-4" />}
              href="/calendar"
            >
              Open Meal Planner
            </Button>
            <Button
              as={Link}
              className="rounded-full bg-white/10 text-white"
              href="/groceries"
              startContent={<ShoppingBagIcon className="h-4 w-4" />}
              variant="flat"
            >
              View Groceries
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {focusMetrics.map((metricKey) => {
          const config = NUTRITION_FOCUS_CONFIG[metricKey];
          const threshold =
            config.direction === "min"
              ? (nutritionTargets[metricKey]?.min ?? config.defaultThreshold)
              : (nutritionTargets[metricKey]?.max ?? config.defaultThreshold);
          const value = todayTotals?.metrics[metricKey] ?? 0;
          const weeklyAverage = weeklyAverageTotals?.metrics[metricKey] ?? 0;

          return (
            <DashboardCard key={metricKey} eyebrow="Today" title={config.label}>
              <div className="space-y-4">
                <ProgressRing metric={metricKey} threshold={threshold} value={value} />
                <div className="text-default-500 text-sm">
                  <span className="text-default-700 font-medium">Week avg:</span>{" "}
                  {formatNutritionMetricValue(metricKey, weeklyAverage)}
                </div>
              </div>
            </DashboardCard>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <DashboardCard eyebrow="Tonight's Prep" title="Prep reminders">
          {prepReminders.length > 0 ? (
            <div className="space-y-4">
              {prepReminders.map((session) => (
                <div
                  key={session.id}
                  className="border-default-100 flex items-start gap-3 border-b pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="mt-0.5 rounded-full bg-orange-100 p-2 text-orange-600">
                    <BeakerIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-foreground font-medium">
                      {formatDateLabel(session.date, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                    <div className="text-default-500 mt-1 text-sm">
                      {session.items.map((item) => item.recipe?.name ?? "Untitled prep").join(", ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-default-500 text-sm">No prep reminders queued for this week.</p>
          )}
        </DashboardCard>

        <DashboardCard eyebrow="This Week" title="Watchouts">
          {todayWarnings.length > 0 || weekWatchouts.length > 0 ? (
            <div className="space-y-4">
              {todayWarnings.length > 0 ? (
                <div>
                  <div className="text-foreground mb-2 text-sm font-semibold">Today</div>
                  <div className="flex flex-wrap gap-2">
                    {todayWarnings.map((warning) => (
                      <span
                        key={`today-${warning.metric}`}
                        className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800"
                      >
                        {warning.label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {weekWatchouts.slice(0, 4).map(({ day, warning }) => (
                <div key={`${day.date}-${warning.metric}`} className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700">
                    <ExclamationTriangleIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-foreground font-medium">{warning.label}</div>
                    <div className="text-default-500 text-sm">
                      {formatDateLabel(day.date, {
                        weekday: "long",
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      - {formatNutritionMetricValue(warning.metric, warning.total)}
                    </div>
                  </div>
                </div>
              ))}

              {swapSuggestionTarget && swapSuggestions.length > 0 ? (
                <div className="border-default-100 mt-5 border-t pt-4">
                  <div className="text-foreground text-sm font-semibold">
                    Swap ideas for {swapSuggestionTarget.slot.definition.label}
                  </div>
                  <div className="text-default-500 mt-1 text-sm">
                    Lighter options for {swapSuggestionTarget.warning.label.toLowerCase()}.
                  </div>
                  <div className="mt-3 space-y-3">
                    {swapSuggestions.map(({ recipe, metricValue }) => (
                      <div
                        key={recipe.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <div className="text-foreground truncate font-medium">{recipe.name}</div>
                          <div className="text-default-500 text-sm">
                            {formatNutritionMetricValue(
                              swapSuggestionTarget.warning.metric,
                              metricValue
                            )}{" "}
                            vs{" "}
                            {formatNutritionMetricValue(
                              swapSuggestionTarget.warning.metric,
                              swapSuggestionTarget.metricValue
                            )}
                          </div>
                        </div>
                        <Button
                          as={Link}
                          className="rounded-full"
                          href={`/recipes/${recipe.id}`}
                          radius="full"
                          size="sm"
                          variant="flat"
                        >
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-default-500 text-sm">
              No watchouts this week. Your focus metrics are sitting comfortably inside target.
            </p>
          )}
        </DashboardCard>
      </div>
    </div>
  );
}
