"use client";

import type { PlannerDaySlotResult } from "@/hooks/planner";
import { useCallback, useMemo, useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import PlannerRecipePickerPanel from "@/components/planner/planner-recipe-picker-panel";
import TodaysMealsSkeleton from "@/components/skeleton/todays-meals-skeleton";
import { DropdownButtonTrigger } from "@/components/ui/overlay-button-trigger";
import { useHouseholdQuery } from "@/hooks/households/use-household-query";
import { usePlannerMutations, usePlannerRangeQuery } from "@/hooks/planner";
import { PlusIcon } from "@heroicons/react/16/solid";
import { Dropdown } from "@heroui-v3/react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import { dateKey, getWeekEnd, getWeekStart } from "@norish/shared/lib/helpers";

import TodayMealSlotCard from "./today-meal-slot-card";
import {
  getSlotDisplayOrder,
  getSlotRecipeCategory,
  isFlexMealSlotKey,
  isTodayMealSlotKey,
  slotTranslationKeys,
  TODAY_MEAL_SLOTS,
} from "./todays-meals-constants";

type DisplaySlot = {
  key: string;
  slotKey: string;
  slotLabel: string;
  sortOrder: number;
  slot: PlannerDaySlotResult | undefined;
};

function sortPlannerItems(slot: PlannerDaySlotResult | undefined) {
  return [...(slot?.items ?? [])].sort((left, right) => left.sortOrder - right.sortOrder);
}

function comparePlannerSlots(left: PlannerDaySlotResult, right: PlannerDaySlotResult) {
  return (
    getSlotDisplayOrder(left.definition.key, left.definition.sortOrder) -
      getSlotDisplayOrder(right.definition.key, right.definition.sortOrder) ||
    left.definition.label.localeCompare(right.definition.label)
  );
}

function compareDisplaySlots(left: DisplaySlot, right: DisplaySlot) {
  return left.sortOrder - right.sortOrder || left.slotLabel.localeCompare(right.slotLabel);
}

export default function TodaysMealsContent() {
  const locale = useLocale();
  const tCalendar = useTranslations("calendar");
  const tSlots = useTranslations("common.slots");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const householdQuery = useHouseholdQuery();
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => dateKey(today), [today]);
  const todayDate = useMemo(() => new Date(`${todayKey}T12:00:00`), [todayKey]);
  const range = useMemo(
    () => ({
      startDate: dateKey(getWeekStart(todayDate)),
      endDate: dateKey(getWeekEnd(todayDate)),
      enabledOnly: false,
    }),
    [todayDate]
  );
  const plannerQuery = usePlannerRangeQuery(range, {
    enabled: Boolean(householdQuery.household),
  });
  const plannerMutations = usePlannerMutations({ queryKey: plannerQuery.queryKey });
  const [planningSlot, setPlanningSlot] = useState<PlannerDaySlotResult | null>(null);
  const [planningOpen, setPlanningOpen] = useState(false);

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "long",
        month: "short",
        day: "numeric",
      }).format(todayDate),
    [locale, todayDate]
  );

  const todaysPlannerDay = useMemo(
    () => plannerQuery.data?.days.find((day) => day.date === todayKey),
    [plannerQuery.data?.days, todayKey]
  );

  const slotsByKey = useMemo(() => {
    const nextSlots = new Map<string, PlannerDaySlotResult>();

    for (const slot of todaysPlannerDay?.slots ?? []) {
      nextSlots.set(slot.definition.key, slot);
    }

    return nextSlots;
  }, [todaysPlannerDay?.slots]);

  const displaySlots = useMemo<DisplaySlot[]>(() => {
    const defaultSlots = TODAY_MEAL_SLOTS.map((slotKey) => {
      const slot = slotsByKey.get(slotKey);

      return {
        key: slotKey,
        slot,
        slotKey,
        slotLabel: slot?.definition.label ?? tSlots(slotTranslationKeys[slotKey]),
        sortOrder: getSlotDisplayOrder(slotKey, slot?.definition.sortOrder ?? 99),
      };
    });
    const populatedAdditionalSlots = [...(todaysPlannerDay?.slots ?? [])]
      .filter((slot) => !isTodayMealSlotKey(slot.definition.key) && slot.items.length > 0)
      .map((slot) => ({
        key: slot.definition.id,
        slot,
        slotKey: slot.definition.key,
        slotLabel: slot.definition.label,
        sortOrder: getSlotDisplayOrder(slot.definition.key, slot.definition.sortOrder),
      }));

    return [...defaultSlots, ...populatedAdditionalSlots].sort(compareDisplaySlots);
  }, [slotsByKey, todaysPlannerDay?.slots, tSlots]);

  const addableFlexSlots = useMemo(
    () =>
      [...(todaysPlannerDay?.slots ?? [])]
        .filter(
          (slot) =>
            isFlexMealSlotKey(slot.definition.key) &&
            slot.definition.isEnabled &&
            slot.items.length === 0
        )
        .sort(comparePlannerSlots),
    [todaysPlannerDay?.slots]
  );

  const plannerRangeBaseQueryKey = useMemo(
    () => [
      trpc.planner.getRange.queryKey({
        startDate: "2000-01-01",
        endDate: "2000-01-01",
        enabledOnly: false,
      })[0],
    ],
    [trpc]
  );

  const isLoading = householdQuery.isLoading || plannerQuery.isLoading;

  const openPlanner = useCallback(
    (slotKey: string) => {
      const slot = slotsByKey.get(slotKey);

      if (!slot?.definition.isEnabled) return;

      setPlanningSlot(slot);
      setPlanningOpen(true);
    },
    [slotsByKey]
  );

  const handlePickerOpenChange = useCallback((open: boolean) => {
    setPlanningOpen(open);

    if (!open) setPlanningSlot(null);
  }, []);

  const handleSelectRecipe = useCallback(
    async (recipeId: string) => {
      if (!planningSlot) return;

      await plannerMutations.addRecipeToSlot(todayKey, planningSlot.definition.id, recipeId, {
        append:
          planningSlot.definition.allowMultiple || planningSlot.definition.slotGroup === "snack",
        role: "main",
      });
      await queryClient.invalidateQueries({ queryKey: plannerRangeBaseQueryKey });
      setPlanningSlot(null);
      setPlanningOpen(false);
    },
    [plannerMutations, plannerRangeBaseQueryKey, planningSlot, queryClient, todayKey]
  );

  return (
    <section className="flex shrink-0 flex-col gap-4" aria-labelledby="today-meals-heading">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="today-meals-heading" className="text-foreground text-2xl leading-8 font-semibold">
            {tCalendar("mobile.today")}
          </h2>
          <p className="text-default-500 mt-1 text-sm">{dateLabel}</p>
        </div>

        {!isLoading && addableFlexSlots.length > 0 ? (
          <Dropdown>
            <DropdownButtonTrigger
              className="shrink-0"
              isDisabled={plannerMutations.isSaving}
              radius="full"
              size="sm"
              startContent={<PlusIcon className="h-4 w-4" />}
              variant="flat"
            >
              Flex slot
            </DropdownButtonTrigger>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu aria-label="Choose flex slot">
                {addableFlexSlots.map((slot) => (
                  <Dropdown.Item
                    key={slot.definition.id}
                    id={slot.definition.id}
                    onAction={() => openPlanner(slot.definition.key)}
                  >
                    {slot.definition.label}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        ) : null}
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {isLoading ? (
          <TodaysMealsSkeleton />
        ) : (
          <div className="flex gap-3">
            {displaySlots.map((displaySlot) => (
              <TodayMealSlotCard
                key={displaySlot.key}
                isDisabled={!displaySlot.slot?.definition.isEnabled || plannerMutations.isSaving}
                items={sortPlannerItems(displaySlot.slot)}
                onPlan={openPlanner}
                slotKey={displaySlot.slotKey}
                slotLabel={displaySlot.slotLabel}
              />
            ))}
          </div>
        )}
      </div>

      <PlannerRecipePickerPanel
        open={planningOpen}
        showRandomButton
        suggestedCategory={
          planningSlot ? getSlotRecipeCategory(planningSlot.definition.key) : undefined
        }
        suggestedSuitableSlot={planningSlot?.definition.key}
        title={
          planningSlot
            ? `${tCalendar("panel.addRecipe")} ${planningSlot.definition.label}`
            : tCalendar("panel.addRecipe")
        }
        onOpenChange={handlePickerOpenChange}
        onSelectRecipe={handleSelectRecipe}
      />
    </section>
  );
}
