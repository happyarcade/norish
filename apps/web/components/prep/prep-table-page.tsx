"use client";

import type { PrepSessionItemResult, PrepSessionResult } from "@/hooks/prep";
import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import PlannerRecipePickerPanel from "@/components/planner/planner-recipe-picker-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHouseholdQuery } from "@/hooks/households/use-household-query";
import { usePrepMutations, usePrepRangeQuery } from "@/hooks/prep";
import {
  ArchiveBoxIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  MinusIcon,
  PlusIcon,
  TrashIcon,
  UserGroupIcon,
} from "@heroicons/react/16/solid";
import { Skeleton } from "@heroui-v3/react";

import {
  addMonths,
  addWeeks,
  dateKey,
  eachDayOfInterval,
  endOfMonth,
  formatMinutesHM,
  getWeekEnd,
  getWeekStart,
  startOfMonth,
} from "@norish/shared/lib/helpers";

function toDate(date: string) {
  return new Date(`${date}T12:00:00`);
}

function formatDateLabel(date: string) {
  const parsed = toDate(date);

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
  }).format(parsed);
}

function formatWeekday(date: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(toDate(date));
}

function isToday(date: string) {
  return date === dateKey(new Date());
}

type PrepViewMode = "week" | "month";

function buildRange(anchorDate: Date, viewMode: PrepViewMode) {
  if (viewMode === "month") {
    const monthStart = startOfMonth(anchorDate);
    const monthEnd = endOfMonth(anchorDate);

    return {
      startDate: dateKey(getWeekStart(monthStart)),
      endDate: dateKey(getWeekEnd(monthEnd)),
    };
  }

  return {
    startDate: dateKey(getWeekStart(anchorDate)),
    endDate: dateKey(getWeekEnd(anchorDate)),
  };
}

function formatWeekTitle(startDate: string, endDate: string) {
  const start = toDate(startDate);
  const end = toDate(endDate);

  return `${new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(start)} - ${new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(end)}`;
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatItemMeta(item: PrepSessionItemResult) {
  const parts = [`${item.batchCount} ${item.batchCount === 1 ? "batch" : "batches"}`];
  const recipe = item.recipe;

  if (recipe) {
    const totalMinutes =
      recipe.totalMinutes ?? ((recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0) || undefined);
    const timeLabel = formatMinutesHM(totalMinutes);

    if (timeLabel) parts.push(timeLabel);
    if (recipe.calories) parts.push(`${Math.round(recipe.calories)} kcal`);
  }

  if (item.isFreezerBatch) parts.push("freezer");

  return parts.join(" - ");
}

type PrepItemCompactRowProps = {
  item: PrepSessionItemResult;
  isSaving: boolean;
  onDelete: (id: string) => void;
};

function PrepItemCompactRow({ item, isSaving, onDelete }: PrepItemCompactRowProps) {
  const recipe = item.recipe;

  return (
    <div className="border-default-100 flex items-center gap-2 border-b py-2 last:border-b-0">
      <div className="bg-default-200 h-9 w-9 shrink-0 overflow-hidden rounded-lg">
        {recipe?.image ? (
          <Image
            unoptimized
            alt={recipe.name}
            className="h-full w-full object-cover"
            height={36}
            src={recipe.image}
            width={36}
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        {recipe?.id ? (
          <Link
            className="text-foreground hover:text-primary block truncate text-sm font-semibold transition-colors"
            href={`/recipes/${recipe.id}`}
          >
            {recipe.name}
          </Link>
        ) : (
          <div className="text-foreground truncate text-sm font-semibold">
            {recipe?.name ?? "Recipe unavailable"}
          </div>
        )}
        <div className="text-default-500 text-xs">
          {item.batchCount} {item.batchCount === 1 ? "batch" : "batches"}
          {item.isFreezerBatch ? " - freezer" : ""}
        </div>
      </div>
      <Button
        isIconOnly
        aria-label="Remove prep item"
        color="danger"
        isDisabled={isSaving}
        radius="full"
        size="sm"
        variant="light"
        onPress={() => onDelete(item.id)}
      >
        <TrashIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}

type PrepItemCardProps = {
  item: PrepSessionItemResult;
  isSaving: boolean;
  onUpdate: (
    item: PrepSessionItemResult,
    data: { batchCount?: number; isFreezerBatch?: boolean; notes?: string | null }
  ) => void;
  onDelete: (id: string) => void;
};

function PrepItemCard({ item, isSaving, onUpdate, onDelete }: PrepItemCardProps) {
  const recipe = item.recipe;

  return (
    <div className="border-default-100 bg-content1/70 rounded-xl border p-3 shadow-sm">
      <div className="flex gap-3">
        <div className="bg-default-200 h-14 w-14 shrink-0 overflow-hidden rounded-lg">
          {recipe?.image && recipe?.id ? (
            <Link className="block h-full w-full" href={`/recipes/${recipe.id}`}>
              <Image
                unoptimized
                alt={recipe.name}
                className="h-full w-full object-cover"
                height={56}
                src={recipe.image}
                width={56}
              />
            </Link>
          ) : recipe?.image ? (
            <Image
              unoptimized
              alt={recipe.name}
              className="h-full w-full object-cover"
              height={56}
              src={recipe.image}
              width={56}
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          {recipe?.id ? (
            <Link
              className="text-foreground hover:text-primary block truncate font-semibold transition-colors"
              href={`/recipes/${recipe.id}`}
            >
              {recipe.name}
            </Link>
          ) : (
            <div className="text-foreground truncate font-semibold">
              {recipe?.name ?? "Recipe unavailable"}
            </div>
          )}
          <div className="text-default-500 mt-1 text-xs">{formatItemMeta(item)}</div>
          {recipe?.id ? (
            <Link
              className="text-primary mt-2 inline-flex text-xs font-medium"
              href={`/recipes/${recipe.id}`}
            >
              Open recipe
            </Link>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="bg-default-100 flex items-center rounded-full">
              <Button
                isIconOnly
                aria-label="Decrease batch count"
                isDisabled={isSaving || item.batchCount <= 1}
                radius="full"
                size="sm"
                variant="light"
                onPress={() => onUpdate(item, { batchCount: Math.max(1, item.batchCount - 1) })}
              >
                <MinusIcon className="h-4 w-4" />
              </Button>
              <span className="min-w-8 text-center text-sm font-semibold">{item.batchCount}</span>
              <Button
                isIconOnly
                aria-label="Increase batch count"
                isDisabled={isSaving}
                radius="full"
                size="sm"
                variant="light"
                onPress={() => onUpdate(item, { batchCount: item.batchCount + 1 })}
              >
                <PlusIcon className="h-4 w-4" />
              </Button>
            </div>

            <Button
              color={item.isFreezerBatch ? "primary" : "default"}
              isDisabled={isSaving}
              radius="full"
              size="sm"
              startContent={<ArchiveBoxIcon className="h-4 w-4" />}
              variant={item.isFreezerBatch ? "flat" : "light"}
              onPress={() => onUpdate(item, { isFreezerBatch: !item.isFreezerBatch })}
            >
              Freezer
            </Button>

            <Button
              isIconOnly
              aria-label="Remove prep item"
              color="danger"
              isDisabled={isSaving}
              radius="full"
              size="sm"
              variant="light"
              onPress={() => onDelete(item.id)}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Input
        key={`${item.id}-${item.notes ?? ""}`}
        className="mt-3"
        defaultValue={item.notes ?? ""}
        placeholder="Prep note"
        size="sm"
        onBlur={(event) => {
          const next = event.currentTarget.value.trim();
          const current = item.notes ?? "";

          if (next !== current) {
            onUpdate(item, { notes: next || null });
          }
        }}
      />
    </div>
  );
}

type PrepDayCardProps = {
  date: string;
  mode: PrepViewMode;
  sessions: PrepSessionResult[];
  isSaving: boolean;
  onAdd: (date: string) => void;
  onUpdateItem: PrepItemCardProps["onUpdate"];
  onDeleteItem: PrepItemCardProps["onDelete"];
};

function PrepDayCard({
  date,
  mode,
  sessions,
  isSaving,
  onAdd,
  onUpdateItem,
  onDeleteItem,
}: PrepDayCardProps) {
  const items = sessions.flatMap((session) => session.items);

  return (
    <div
      className={`bg-content1 rounded-2xl border p-4 shadow-sm ${mode === "month" ? "min-h-56" : "min-h-72"} ${
        isToday(date) ? "border-l-primary border-l-3 shadow-md" : "border-default-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          {isToday(date) ? (
            <>
              <span className="text-primary text-lg font-bold">Today</span>
              <span className="text-default-500 text-sm">
                {formatDateLabel(date)}, {formatWeekday(date)}
              </span>
            </>
          ) : (
            <>
              <span className="text-foreground text-base font-semibold">
                {formatDateLabel(date)}
              </span>
              <span className="text-default-400 text-sm">{formatWeekday(date)}</span>
            </>
          )}
        </div>

        <Button
          isIconOnly
          aria-label={`Add prep for ${formatDateLabel(date)}`}
          radius="full"
          size="sm"
          variant="flat"
          onPress={() => onAdd(date)}
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className="border-default-200 mt-3 border-t pt-4">
        {items.length === 0 ? (
          <button
            className="text-default-400 hover:text-default-500 hover:border-default-300 border-default-200 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-6 transition-colors"
            type="button"
            onClick={() => onAdd(date)}
          >
            <PlusIcon className="h-5 w-5" />
            <span className="text-xs">Add prep</span>
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) =>
              mode === "month" ? (
                <PrepItemCompactRow
                  key={item.id}
                  isSaving={isSaving}
                  item={item}
                  onDelete={onDeleteItem}
                />
              ) : (
                <PrepItemCard
                  key={item.id}
                  isSaving={isSaving}
                  item={item}
                  onDelete={onDeleteItem}
                  onUpdate={onUpdateItem}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PrepTableSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-72 rounded-2xl" />
      ))}
    </div>
  );
}

export default function PrepTablePage() {
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<PrepViewMode>("week");
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const householdQuery = useHouseholdQuery();

  const range = useMemo(() => buildRange(anchorDate, viewMode), [anchorDate, viewMode]);

  const rangeDays = useMemo(
    () => eachDayOfInterval(toDate(range.startDate), toDate(range.endDate)).map(dateKey),
    [range.endDate, range.startDate]
  );
  const prepQuery = usePrepRangeQuery(range, { enabled: Boolean(householdQuery.household) });
  const prepMutations = usePrepMutations({ queryKey: prepQuery.queryKey });

  const sessionsByDate = useMemo(() => {
    return (prepQuery.data?.sessions ?? []).reduce<Record<string, PrepSessionResult[]>>(
      (acc, session) => {
        const bucket = acc[session.date] ?? (acc[session.date] = []);
        bucket.push(session);

        return acc;
      },
      {}
    );
  }, [prepQuery.data?.sessions]);

  const title =
    viewMode === "week"
      ? formatWeekTitle(range.startDate, range.endDate)
      : formatMonthTitle(anchorDate);

  const handlePrevious = () => {
    setAnchorDate((current) =>
      viewMode === "week" ? addWeeks(current, -1) : addMonths(current, -1)
    );
  };

  const handleNext = () => {
    setAnchorDate((current) =>
      viewMode === "week" ? addWeeks(current, 1) : addMonths(current, 1)
    );
  };

  const handleAddRecipe = async (recipeId: string) => {
    if (!pickerDate) return;

    await prepMutations.addRecipe({
      date: pickerDate,
      recipeId,
      batchCount: 1,
      isFreezerBatch: false,
      notes: null,
    });
  };

  const handleUpdateItem: PrepItemCardProps["onUpdate"] = (item, data) => {
    void prepMutations.updateItem({
      id: item.id,
      data,
    });
  };

  const handleDeleteItem: PrepItemCardProps["onDelete"] = (id) => {
    void prepMutations.deleteItem(id);
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
          <div className="border-default-100 bg-background/85 flex w-fit items-center gap-1 rounded-full border p-1 shadow-sm">
            <Button
              color={viewMode === "week" ? "primary" : "default"}
              radius="full"
              size="sm"
              variant={viewMode === "week" ? "solid" : "light"}
              onPress={() => setViewMode("week")}
            >
              Week
            </Button>
            <Button
              color={viewMode === "month" ? "primary" : "default"}
              radius="full"
              size="sm"
              variant={viewMode === "month" ? "solid" : "light"}
              onPress={() => setViewMode("month")}
            >
              Month
            </Button>
          </div>

          <div>
            <div className="text-default-400 text-xs tracking-[0.18em] uppercase">Prep Table</div>
            <h1 className="text-foreground mt-1 text-2xl font-bold">{title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            isIconOnly
            aria-label="Previous range"
            className="rounded-full"
            size="sm"
            variant="flat"
            onPress={handlePrevious}
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            className="rounded-full"
            size="sm"
            variant="flat"
            onPress={() => setAnchorDate(new Date())}
          >
            Today
          </Button>
          <Button
            isIconOnly
            aria-label="Next range"
            className="rounded-full"
            size="sm"
            variant="flat"
            onPress={handleNext}
          >
            <ArrowRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {householdQuery.isLoading ? (
        <PrepTableSkeleton />
      ) : !householdQuery.household ? (
        <div className="bg-content1 border-default-200 rounded-2xl border p-8 text-center shadow-sm">
          <div className="bg-default-100 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
            <UserGroupIcon className="text-default-500 h-7 w-7" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">Create a household first</h2>
          <p className="text-default-500 mx-auto mt-2 max-w-md">
            Prep Table uses your household so batches can flow into the shared shopping projection.
          </p>
          <Button as={Link} className="mt-5" color="primary" href="/settings/household">
            Household settings
          </Button>
        </div>
      ) : prepQuery.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-600">
          Prep Table failed to load.
        </div>
      ) : prepQuery.isLoading ? (
        <PrepTableSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rangeDays.map((day) => (
            <PrepDayCard
              key={day}
              date={day}
              mode={viewMode}
              isSaving={prepMutations.isSaving}
              sessions={sessionsByDate[day] ?? []}
              onAdd={setPickerDate}
              onDeleteItem={handleDeleteItem}
              onUpdateItem={handleUpdateItem}
            />
          ))}
        </div>
      )}

      <PlannerRecipePickerPanel
        open={Boolean(pickerDate)}
        title={pickerDate ? `Add prep - ${formatDateLabel(pickerDate)}` : "Add prep"}
        onOpenChange={(open) => {
          if (!open) setPickerDate(null);
        }}
        onSelectRecipe={handleAddRecipe}
      />
    </div>
  );
}
