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
  CalendarDaysIcon,
  CheckCircleIcon,
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

export function findNextPlannedSlot(days: PlannerDayResult[], now: Date) {
  const todayKey = dateKey(now);
  const currentHour = now.getHours();

  const upcomingDays = [...days]
    .filter((day) => day.date >= todayKey)
    .sort((left, right) => left.date.localeCompare(right.date));

  for (const day of upcomingDays) {
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
    const slot = candidateSlots[0];

    if (!slot) continue;

    return {
      day,
      slot,
      item: slot.items.find((item) => item.role === "main") ?? slot.items[0],
    };
  }

  return null;
}

function NutritionMetric({
  metric,
  value,
  threshold,
  weeklyAverage,
}: {
  metric: NutritionFocusMetricKey;
  value: number;
  threshold: number;
  weeklyAverage: number;
}) {
  const config = NUTRITION_FOCUS_CONFIG[metric];
  const progress = threshold > 0 ? value / threshold : 0;
  const isOutsideTarget = config.direction === "min" ? value < threshold : value > threshold;
  const progressWidth = `${Math.min(progress, 1) * 100}%`;

  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-default-500 text-xs font-medium uppercase">{config.shortLabel}</div>
          <div className="text-foreground mt-1 text-base font-semibold">{config.label}</div>
        </div>
        <div className="text-right">
          <div className="text-foreground text-sm font-semibold">
            {formatNutritionMetricValue(metric, value)}
          </div>
          <div className="text-default-400 text-xs">
            {config.direction === "min" ? "goal" : "limit"} {threshold}
            {config.unit}
          </div>
        </div>
      </div>

      <div className="bg-default-100 mt-3 h-1.5 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full ${isOutsideTarget ? "bg-warning" : "bg-primary"}`}
          style={{ width: progressWidth }}
        />
      </div>

      <div className="text-default-500 mt-2 flex items-center justify-between gap-2 text-xs">
        <span>Week avg</span>
        <span className="text-default-700 font-medium">
          {formatNutritionMetricValue(metric, weeklyAverage)}
        </span>
      </div>
    </div>
  );
}

function EmptyDashboardState({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 py-2">
      <p className="text-default-500 max-w-xl text-sm leading-6">{children}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

function DashboardStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-foreground text-sm font-semibold">{value}</span>
      <span className="text-default-500 text-xs">{label}</span>
    </div>
  );
}

function NextMealSummary({
  title,
  meta,
  weeklyPlannedItems,
  prepReminderCount,
  watchoutCount,
}: {
  title: string;
  meta: string;
  weeklyPlannedItems: number;
  prepReminderCount: number;
  watchoutCount: number;
}) {
  return (
    <section className="border-default-200 bg-content1 overflow-hidden rounded-lg border shadow-sm">
      <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="bg-primary/10 text-primary shrink-0 rounded-lg p-3">
            <CalendarDaysIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-default-400 text-[11px] font-medium tracking-[0.16em] uppercase">
              Next meal
            </div>
            <h2 className="text-foreground mt-1 truncate text-xl font-semibold">{title}</h2>
            <p className="text-default-500 mt-1 text-sm">{meta}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            as={Link}
            color="primary"
            endContent={<ArrowRightIcon className="h-4 w-4" />}
            href="/calendar"
            size="sm"
          >
            Meal Planner
          </Button>
          <Button
            as={Link}
            href="/groceries"
            size="sm"
            startContent={<ShoppingBagIcon className="h-4 w-4" />}
            variant="tertiary"
          >
            Groceries
          </Button>
        </div>
      </div>

      <div className="border-default-100 flex flex-wrap gap-x-6 gap-y-2 border-t px-5 py-3">
        <DashboardStat label="planned this week" value={weeklyPlannedItems} />
        <DashboardStat label="prep reminders" value={prepReminderCount} />
        <DashboardStat label="watchouts" value={watchoutCount} />
      </div>
    </section>
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
    <Card className="border-default-200 rounded-lg border shadow-sm">
      <Card.Header className="flex flex-col items-start gap-1 px-5 pt-5">
        <div className="text-default-400 text-[11px] tracking-[0.18em] uppercase">{eyebrow}</div>
        <h2 className="text-foreground text-xl font-semibold">{title}</h2>
      </Card.Header>
      <Card.Content className="px-5 pt-3 pb-5">{children}</Card.Content>
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
  const todayPlannedItems = useMemo(
    () => todayDay?.slots.reduce((total, slot) => total + slot.items.length, 0) ?? 0,
    [todayDay]
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
      todayTotals && todayPlannedItems > 0
        ? evaluateNutritionWarnings(todayTotals, focusMetrics, nutritionTargets).slice(0, 3)
        : [],
    [focusMetrics, nutritionTargets, todayPlannedItems, todayTotals]
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
  const visibleWeekWatchouts = useMemo(
    () =>
      weekWatchouts
        .filter(({ day }) => todayWarnings.length === 0 || day.date !== todayKey)
        .slice(0, 4),
    [todayKey, todayWarnings.length, weekWatchouts]
  );
  const nextMealTitle = nextPlannedSlot
    ? (nextPlannedSlot.item.recipe?.name ?? nextPlannedSlot.item.title ?? "Untitled meal")
    : weeklyPlannedItems > 0
      ? "Nothing else planned"
      : "No meals planned yet";
  const nextMealMeta = nextPlannedSlot
    ? `${nextPlannedSlot.slot.definition.label} - ${
        nextPlannedSlot.day.date === todayKey
          ? "Today"
          : formatDateLabel(nextPlannedSlot.day.date, {
              weekday: "long",
              day: "numeric",
              month: "short",
            })
      }`
    : weeklyPlannedItems > 0
      ? "Your remaining week is clear."
      : "Add a meal to start shaping the week.";
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
    <div className="flex w-full flex-col gap-5">
      <header className="flex items-end justify-between gap-4">
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
      </header>

      <NextMealSummary
        meta={nextMealMeta}
        prepReminderCount={prepReminders.length}
        title={nextMealTitle}
        watchoutCount={todayWarnings.length + visibleWeekWatchouts.length}
        weeklyPlannedItems={weeklyPlannedItems}
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.75fr)]">
        <DashboardCard eyebrow="Today" title="Nutrition snapshot">
          {todayPlannedItems > 0 ? (
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {focusMetrics.map((metricKey) => {
                const config = NUTRITION_FOCUS_CONFIG[metricKey];
                const threshold =
                  config.direction === "min"
                    ? (nutritionTargets[metricKey]?.min ?? config.defaultThreshold)
                    : (nutritionTargets[metricKey]?.max ?? config.defaultThreshold);

                return (
                  <NutritionMetric
                    key={metricKey}
                    metric={metricKey}
                    threshold={threshold}
                    value={todayTotals?.metrics[metricKey] ?? 0}
                    weeklyAverage={weeklyAverageTotals?.metrics[metricKey] ?? 0}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyDashboardState
              action={
                <Button as={Link} href="/calendar" size="sm" variant="tertiary">
                  Plan today's meals
                </Button>
              }
            >
              No meals are planned today. Nutrition totals will appear as meals are added.
            </EmptyDashboardState>
          )}
        </DashboardCard>

        <DashboardCard eyebrow="Coming Up" title="Prep reminders">
          {prepReminders.length > 0 ? (
            <div className="space-y-4">
              {prepReminders.map((session) => (
                <div
                  key={session.id}
                  className="border-default-100 flex items-start gap-3 border-b pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="bg-warning/10 text-warning mt-0.5 rounded-lg p-2">
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
            <EmptyDashboardState
              action={
                <Button as={Link} href="/prep-table" size="sm" variant="tertiary">
                  Open Prep Table
                </Button>
              }
            >
              No prep reminders are queued for the rest of this week.
            </EmptyDashboardState>
          )}
        </DashboardCard>
      </div>

      <DashboardCard eyebrow="This Week" title="Watchouts and useful swaps">
        {todayWarnings.length > 0 || visibleWeekWatchouts.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              {todayWarnings.length > 0 ? (
                <div className="border-default-100 border-b pb-4">
                  <div className="text-foreground mb-2 text-sm font-semibold">Today</div>
                  <div className="flex flex-wrap gap-2">
                    {todayWarnings.map((warning) => (
                      <span
                        key={`today-${warning.metric}`}
                        className="bg-warning/10 text-warning rounded-full px-3 py-1 text-xs font-medium"
                      >
                        {warning.label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {visibleWeekWatchouts.map(({ day, warning }) => (
                <div key={`${day.date}-${warning.metric}`} className="flex items-start gap-3">
                  <div className="bg-warning/10 text-warning mt-0.5 rounded-lg p-2">
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
            </div>

            {swapSuggestionTarget && swapSuggestions.length > 0 ? (
              <div className="lg:border-default-100 lg:border-l lg:pl-6">
                <div className="text-foreground text-sm font-semibold">
                  Swap ideas for {swapSuggestionTarget.slot.definition.label}
                </div>
                <div className="text-default-500 mt-1 text-sm">
                  Lighter options for {swapSuggestionTarget.warning.label.toLowerCase()}.
                </div>
                <div className="mt-3 divide-y">
                  {swapSuggestions.map(({ recipe, metricValue }) => (
                    <div
                      key={recipe.id}
                      className="border-default-100 flex items-center justify-between gap-3 py-3 first:pt-0"
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
                      <Button as={Link} href={`/recipes/${recipe.id}`} size="sm" variant="tertiary">
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex items-start gap-3 py-2">
            <div className="bg-success/10 text-success rounded-lg p-2">
              <CheckCircleIcon className="h-4 w-4" />
            </div>
            <p className="text-default-500 pt-1 text-sm">
              No watchouts this week. Your focus metrics are sitting inside target.
            </p>
          </div>
        )}
      </DashboardCard>
    </div>
  );
}
