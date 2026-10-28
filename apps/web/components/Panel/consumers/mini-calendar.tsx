"use client";

import type { PlannerDayResult, PlannerDaySlotResult } from "@/hooks/planner";
import { memo, useCallback, useMemo } from "react";
import { PlannedItemThumbnail } from "@/components/calendar/planned-item-thumbnail";
import Panel from "@/components/Panel/Panel";
import { useIsDesktop } from "@/components/planner/use-is-desktop";
import { Button } from "@/components/ui/button";
import { useHouseholdQuery } from "@/hooks/households/use-household-query";
import { usePlannerMutations, usePlannerRangeQuery } from "@/hooks/planner";
import { PlusIcon } from "@heroicons/react/16/solid";
import {
  Dropdown,
  Header,
  Label,
  Modal,
  Separator,
  Spinner,
  useOverlayState,
} from "@heroui-v3/react";
import { useLocale } from "next-intl";

import { dateKey, eachDayOfInterval } from "@norish/shared/lib/helpers";

type MiniCalendarProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
};

type AddMenu = {
  explicitMeals: PlannerDaySlotResult[];
  flexSlots: PlannerDaySlotResult[];
  workoutSlots: PlannerDaySlotResult[];
  snackSlot: PlannerDaySlotResult | null;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);

  next.setDate(next.getDate() + days);

  return next;
}

function formatDateLabel(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function buildAddMenu(day: PlannerDayResult): AddMenu {
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

const MiniCalendarDay = memo(function MiniCalendarDay({
  day,
  locale,
  onPlan,
}: {
  day: PlannerDayResult;
  locale: string;
  onPlan: (date: string, slot: PlannerDaySlotResult) => void;
}) {
  const parsedDate = useMemo(() => new Date(`${day.date}T12:00:00`), [day.date]);
  const isToday = day.date === dateKey(new Date());
  const menu = buildAddMenu(day);
  const plannedItems = day.slots.flatMap((slot) =>
    slot.items.map((item) => ({
      item,
      slot,
    }))
  );

  return (
    <div className="border-default-100 border-b last:border-none">
      <div className="bg-background hover:bg-default-50/50 flex flex-col gap-3 px-4 py-4 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className={`text-sm font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>
            {formatDateLabel(parsedDate, locale)}
          </div>

          <Dropdown>
            <Button
              isIconOnly
              aria-label="Add to meal planner"
              className="text-default-500 hover:text-primary h-8 min-w-8 rounded-full shadow-sm transition-transform active:scale-95"
              size="sm"
              variant="tertiary"
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu aria-label="Choose planner slot">
                {menu.explicitMeals.length > 0 ? (
                  <Dropdown.Section>
                    <Header>Main meals</Header>
                    {menu.explicitMeals.map((slot) => (
                      <Dropdown.Item
                        key={slot.definition.id}
                        id={`main-${slot.definition.id}`}
                        textValue={slot.definition.label}
                        onAction={() => onPlan(day.date, slot)}
                      >
                        <Label>{slot.definition.label}</Label>
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Section>
                ) : null}

                {menu.explicitMeals.length > 0 && menu.flexSlots.length > 0 ? <Separator /> : null}
                {menu.flexSlots.length > 0 ? (
                  <Dropdown.Section>
                    <Header>Flex</Header>
                    {menu.flexSlots.map((slot) => (
                      <Dropdown.Item
                        key={slot.definition.id}
                        id={`flex-${slot.definition.id}`}
                        textValue={slot.definition.label}
                        onAction={() => onPlan(day.date, slot)}
                      >
                        <Label>{slot.definition.label}</Label>
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Section>
                ) : null}

                {(menu.explicitMeals.length > 0 || menu.flexSlots.length > 0) && menu.snackSlot ? (
                  <Separator />
                ) : null}
                {menu.snackSlot ? (
                  <Dropdown.Section>
                    <Header>Snacks</Header>
                    <Dropdown.Item
                      key={menu.snackSlot.definition.id}
                      id={`snack-${menu.snackSlot.definition.id}`}
                      textValue="Snack"
                      onAction={() => onPlan(day.date, menu.snackSlot!)}
                    >
                      <Label>Snack</Label>
                    </Dropdown.Item>
                  </Dropdown.Section>
                ) : null}

                {(menu.explicitMeals.length > 0 || menu.flexSlots.length > 0 || menu.snackSlot) &&
                menu.workoutSlots.length > 0 ? (
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
                        onAction={() => onPlan(day.date, slot)}
                      >
                        <Label>{slot.definition.label}</Label>
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Section>
                ) : null}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>

        <Separator className="my-1" />

        <div className="flex w-full flex-col gap-2">
          {plannedItems.length === 0 ? (
            <span className="text-default-400 text-xs italic">No items planned</span>
          ) : (
            plannedItems.map(({ item, slot }) => {
              const title = item.recipe?.name ?? item.title ?? "Untitled item";

              return (
                <div key={item.id} className="flex w-full items-start gap-3 py-1">
                  <PlannedItemThumbnail
                    alt={title}
                    image={item.recipe?.image ?? null}
                    itemType={item.itemKind === "recipe" ? "recipe" : "note"}
                    size="md"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-foreground truncate text-sm font-medium" title={title}>
                      {title}
                    </span>
                    <span className="text-default-400 text-xs">{slot.definition.label}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
});

function MiniCalendarContent({
  open,
  recipeId,
  onOpenChange,
}: {
  open: boolean;
  recipeId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const locale = useLocale();
  const householdQuery = useHouseholdQuery();
  const today = useMemo(() => new Date(), []);
  const rangeStart = useMemo(() => dateKey(today), [today]);
  const rangeEnd = useMemo(() => dateKey(addDays(today, 27)), [today]);
  const range = useMemo(
    () => ({
      startDate: rangeStart,
      endDate: rangeEnd,
      enabledOnly: false,
    }),
    [rangeEnd, rangeStart]
  );
  const plannerQuery = usePlannerRangeQuery(range, {
    enabled: open && Boolean(householdQuery.household),
  });
  const plannerMutations = usePlannerMutations({ queryKey: plannerQuery.queryKey });
  const fallbackDays = useMemo(
    () =>
      eachDayOfInterval(new Date(`${rangeStart}T12:00:00`), new Date(`${rangeEnd}T12:00:00`)).map(
        (date) => dateKey(date)
      ),
    [rangeEnd, rangeStart]
  );

  const days = plannerQuery.data?.days ?? [];

  const handlePlan = useCallback(
    async (day: string, slot: PlannerDaySlotResult) => {
      await plannerMutations.addRecipeToSlot(day, slot.definition.id, recipeId, {
        append: slot.definition.allowMultiple || slot.definition.slotGroup === "snack",
        role: "main",
      });
      onOpenChange(false);
    },
    [onOpenChange, plannerMutations, recipeId]
  );

  if (householdQuery.isLoading || plannerQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  if (!householdQuery.household) {
    return (
      <div className="text-default-500 flex flex-1 items-center justify-center p-8 text-center text-sm">
        Create a household before adding recipes to the meal planner.
      </div>
    );
  }

  if (plannerQuery.error) {
    return (
      <div className="text-danger flex flex-1 items-center justify-center p-8 text-center text-sm">
        Meal planner failed to load.
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="text-default-500 flex flex-1 items-center justify-center p-8 text-center text-sm">
        No planner days available for {fallbackDays[0]} to {fallbackDays[fallbackDays.length - 1]}.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {days.map((day) => (
        <MiniCalendarDay key={day.date} day={day} locale={locale} onPlan={handlePlan} />
      ))}
    </div>
  );
}

export default function MiniCalendar({ open, onOpenChange, recipeId }: MiniCalendarProps) {
  const isDesktop = useIsDesktop();
  const title = "Add to Meal Planner";
  const modalState = useOverlayState({ isOpen: open, onOpenChange });
  const content = open ? (
    <MiniCalendarContent open={open} recipeId={recipeId} onOpenChange={onOpenChange} />
  ) : null;

  if (isDesktop) {
    return (
      <Modal state={modalState}>
        <Modal.Backdrop variant="blur">
          <Modal.Container placement="center" scroll="inside" size="lg">
            <Modal.Dialog className="max-w-lg">
              <Modal.CloseTrigger aria-label="Close meal planner" />
              <Modal.Header>
                <Modal.Heading>{title}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="max-h-[72vh] overflow-y-auto p-0">{content}</Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    );
  }

  return (
    <Panel height={82} open={open} title={title} onOpenChange={onOpenChange}>
      <div className="flex min-h-0 flex-1 flex-col">{content}</div>
    </Panel>
  );
}
