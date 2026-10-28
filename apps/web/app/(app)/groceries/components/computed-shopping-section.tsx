"use client";

import type { ComputedShoppingProjectionResult } from "@/hooks/groceries/use-computed-shopping-query";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DynamicHeroIcon } from "@/components/groceries/dynamic-hero-icon";
import { GroceryCheckbox } from "@/components/groceries/grocery-checkbox";
import { getStoreColorClasses } from "@/components/groceries/store-colors";
import { StoreSelector } from "@/components/groceries/store-selector";
import Panel from "@/components/Panel/Panel";
import { useIsDesktop } from "@/components/planner/use-is-desktop";
import { Button } from "@/components/ui/button";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  BookOpenIcon,
  BuildingStorefrontIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisVerticalIcon,
  HomeIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/16/solid";
import { ArrowPathIcon, ShoppingCartIcon } from "@heroicons/react/24/outline";
import { Dropdown, Input, Label, Modal, TextField, toast, useOverlayState } from "@heroui-v3/react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import type { StoreDto } from "@norish/shared/contracts";
import { normalizeIngredientNameForGrouping } from "@norish/shared/lib/grocery-grouping";

import type { GroceryViewMode } from "../context";

const AISLE_ORDER = ["Produce", "Protein", "Dairy", "Pantry", "Bakery", "General"] as const;
const COMPUTED_DONE_STATE_KEY = "norish:computed-shopping-done";
const COMPUTED_HIDDEN_STATE_KEY = "norish:computed-shopping-hidden";
const COMPUTED_STABLE_DONE_STATE_KEY = "norish:computed-shopping-stable-done";
const COMPUTED_STORE_ASSIGNMENTS_KEY = "norish:computed-shopping-store-assignments";

type ShoppingItem = ComputedShoppingProjectionResult["stableItems"][number];
type ShoppingSource = ShoppingItem["sources"][number];
type PlannerSection = {
  id: string;
  title: string;
  subtitle: string;
  items: ShoppingItem[];
};
type AggregatedRecipeRow = {
  id: string;
  recipeId: string;
  recipeName: string;
  itemName: string;
  qty: number;
  unit: string;
  contextLabels: string[];
  parentItemIds: string[];
};
type StoreSection = {
  id: string;
  title: string;
  storeId: string | null;
  store: StoreDto | null;
  items: ShoppingItem[];
};
type ComputedDoneState = Record<string, string[]>;
type ComputedStoreAssignmentState = Record<string, string | null>;

function validateComputedDoneState(data: unknown): ComputedDoneState | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const result: ComputedDoneState = {};

  for (const [key, value] of Object.entries(data)) {
    if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
      return null;
    }
    result[key] = value;
  }

  return result;
}

function validateComputedStoreAssignments(data: unknown): ComputedStoreAssignmentState | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const result: ComputedStoreAssignmentState = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== "string" && value !== null) {
      return null;
    }
    result[key] = value;
  }

  return result;
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatWeekRange(startDate: string): string {
  return `${formatDate(startDate)} - ${formatDate(addDays(startDate, 6))}`;
}

function formatQty(qty: number, unit: string): string | null {
  if ((!unit || unit.trim().length === 0) && qty <= 0) return null;
  if (unit === "unit") return `${Math.ceil(qty)}`;
  if (!unit || unit.trim().length === 0) {
    return Number.isInteger(qty) ? `${qty}` : `${Math.round(qty * 10) / 10}`;
  }
  if (Number.isInteger(qty)) return `${qty} ${unit}`;

  return `${Math.round(qty * 10) / 10} ${unit}`;
}

function scopeKeyForProjection(
  data: ComputedShoppingProjectionResult | undefined,
  dayCount: 7 | 14 | 28
): string {
  if (!data) return `none:${dayCount}`;

  return `${data.householdId ?? "none"}:${data.windowStart}:${dayCount}`;
}

function stableScopeKeyForProjection(data: ComputedShoppingProjectionResult | undefined): string {
  return `${data?.householdId ?? "none"}:stable`;
}

function buildStoreAssignmentKey(householdId: string | null | undefined, itemName: string): string {
  return `${householdId ?? "none"}::${normalizeIngredientNameForGrouping(itemName)}`;
}

function groupItemsByAisle(items: ShoppingItem[]) {
  return AISLE_ORDER.map((aisle) => ({
    aisle,
    items: items.filter((item) => item.aisle === aisle),
  })).filter((group) => group.items.length > 0);
}

function buildPlannerSections(
  data: ComputedShoppingProjectionResult,
  isCurrentWeek: boolean
): PlannerSection[] {
  const sections: PlannerSection[] = [];

  if (data.stableItems.length > 0) {
    sections.push({
      id: "bulk",
      title: "Bulk Buys",
      subtitle:
        data.dayCount > 7
          ? `Aggregated across ${formatDate(data.windowStart)} - ${formatDate(data.windowEnd)}`
          : "Pantry and batch buys",
      items: data.stableItems,
    });
  }

  if (data.currentWeekItems.length > 0) {
    sections.push({
      id: "fresh-this-week",
      title: isCurrentWeek ? "Fresh This Week" : "Fresh for Selected Week",
      subtitle: formatWeekRange(data.windowStart),
      items: data.currentWeekItems,
    });
  }

  for (const week of data.upcomingWeeks) {
    sections.push({
      id: `week-${week.weekIndex}`,
      title: `Week ${week.weekIndex + 1}`,
      subtitle: formatWeekRange(week.weekStart),
      items: week.items,
    });
  }

  return sections;
}

function summarizeRecipeNames(sources: ShoppingSource[]): string {
  const uniqueRecipeNames = Array.from(
    new Set(
      sources
        .map((source) => source.recipeName)
        .filter((recipeName) => recipeName.trim().length > 0)
    )
  );

  return uniqueRecipeNames.join(", ");
}

function summarizeContextLabels(labels: string[]): string {
  const cleanedLabels = labels.map((label) => label.replace(/Â·/g, "·"));

  if (cleanedLabels.length <= 2) return cleanedLabels.join(", ");

  return `${cleanedLabels.slice(0, 2).join(", ")} +${cleanedLabels.length - 2} more`;
}

function buildRecipeGroups(items: ShoppingItem[]) {
  const recipeGroups = new Map<
    string,
    {
      recipeId: string;
      recipeName: string;
      rows: Map<
        string,
        {
          id: string;
          recipeId: string;
          recipeName: string;
          itemName: string;
          qty: number;
          unit: string;
          contextLabels: Set<string>;
          parentItemIds: Set<string>;
        }
      >;
    }
  >();

  for (const item of items) {
    for (const source of item.sources) {
      const recipeGroup = recipeGroups.get(source.recipeId) ?? {
        recipeId: source.recipeId,
        recipeName: source.recipeName,
        rows: new Map(),
      };
      const rowKey = `${normalizeIngredientNameForGrouping(source.itemName)}::${source.unit}`;
      const existingRow = recipeGroup.rows.get(rowKey);

      if (existingRow) {
        existingRow.qty += source.qty;
        existingRow.contextLabels.add(source.contextLabel);
        existingRow.parentItemIds.add(item.id);
      } else {
        recipeGroup.rows.set(rowKey, {
          id: `${source.recipeId}::${rowKey}`,
          recipeId: source.recipeId,
          recipeName: source.recipeName,
          itemName: source.itemName,
          qty: source.qty,
          unit: source.unit,
          contextLabels: new Set([source.contextLabel]),
          parentItemIds: new Set([item.id]),
        });
      }

      recipeGroups.set(source.recipeId, recipeGroup);
    }
  }

  return Array.from(recipeGroups.values())
    .map((group) => ({
      recipeId: group.recipeId,
      recipeName: group.recipeName,
      rows: Array.from(group.rows.values())
        .map<AggregatedRecipeRow>((row) => ({
          id: row.id,
          recipeId: row.recipeId,
          recipeName: row.recipeName,
          itemName: row.itemName,
          qty: Math.round(row.qty * 1000) / 1000,
          unit: row.unit,
          contextLabels: Array.from(row.contextLabels).sort((left, right) =>
            left.localeCompare(right)
          ),
          parentItemIds: Array.from(row.parentItemIds),
        }))
        .sort((left, right) => left.itemName.localeCompare(right.itemName)),
    }))
    .sort((left, right) => left.recipeName.localeCompare(right.recipeName));
}

function buildStoreSections(
  items: ShoppingItem[],
  stores: StoreDto[],
  getAssignedStoreId: (item: ShoppingItem) => string | null
): StoreSection[] {
  const grouped = new Map<string | null, ShoppingItem[]>();

  grouped.set(null, []);
  for (const store of stores) {
    grouped.set(store.id, []);
  }

  for (const item of items) {
    const storeId = getAssignedStoreId(item);

    if (!storeId || !grouped.has(storeId)) {
      grouped.get(null)?.push(item);
      continue;
    }

    grouped.get(storeId)?.push(item);
  }

  const sections: StoreSection[] = [];
  const unsortedItems = grouped.get(null) ?? [];

  if (unsortedItems.length > 0) {
    sections.push({
      id: "store-unsorted",
      title: "Unsorted",
      storeId: null,
      store: null,
      items: unsortedItems,
    });
  }

  for (const store of [...stores].sort((left, right) => left.sortOrder - right.sortOrder)) {
    const storeItems = grouped.get(store.id) ?? [];

    if (storeItems.length === 0) continue;

    sections.push({
      id: `store-${store.id}`,
      title: store.name,
      storeId: store.id,
      store,
      items: storeItems,
    });
  }

  return sections;
}

function doneProgressLabel(doneCount: number, totalCount: number): string {
  return `${doneCount} of ${totalCount} done`;
}

function sectionProgressTone(doneCount: number, totalCount: number) {
  return totalCount > 0 && doneCount === totalCount
    ? {
        background: "bg-success-100 dark:bg-success/20",
        iconBackground: "bg-success-500",
        countText: "text-success-700 dark:text-success-300",
      }
    : {
        background: "bg-default-100",
        iconBackground: "bg-default-400",
        countText: "text-default-400",
      };
}

function SectionShell({
  title,
  subtitle,
  totalCount,
  doneCount,
  icon: Icon,
  iconNode,
  children,
  defaultExpanded = true,
  onDeleteDone,
  onMarkAllDone,
  toneOverride,
  countLabel,
  showActions = true,
}: {
  title: string;
  subtitle?: string;
  totalCount: number;
  doneCount: number;
  icon: ComponentType<{ className?: string }>;
  iconNode?: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
  onDeleteDone?: () => void;
  onMarkAllDone?: () => void;
  countLabel?: string;
  showActions?: boolean;
  toneOverride?: {
    background: string;
    iconBackground: string;
    countText: string;
  };
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const tone =
    totalCount > 0 && doneCount === totalCount
      ? sectionProgressTone(doneCount, totalCount)
      : (toneOverride ?? sectionProgressTone(doneCount, totalCount));

  return (
    <div className="border-default-200/70 bg-content1/90 overflow-hidden rounded-xl border shadow-sm backdrop-blur-xl">
      <div className={`flex items-center gap-3 px-4 py-3 ${tone.background}`}>
        <button
          className="flex min-w-0 flex-1 items-center gap-3 text-left transition-colors hover:opacity-90"
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
        >
          <div className={`shrink-0 rounded-full p-1.5 ${tone.iconBackground}`}>
            {iconNode ?? <Icon className="h-4 w-4 text-white" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-semibold">{title}</span>
              <span className={`shrink-0 text-sm ${tone.countText}`}>
                {countLabel ?? doneProgressLabel(doneCount, totalCount)}
              </span>
            </div>
            {subtitle ? (
              <div className="text-default-400 mt-0.5 truncate text-xs">{subtitle}</div>
            ) : null}
          </div>
        </button>

        {showActions && totalCount > 0 ? (
          <Dropdown>
            <Button
              isIconOnly
              aria-label={`${title} actions`}
              className="shrink-0"
              size="sm"
              variant="tertiary"
            >
              <EllipsisVerticalIcon className="h-5 w-5" />
            </Button>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu aria-label={`${title} actions`}>
                <Dropdown.Item
                  id="mark-done"
                  isDisabled={doneCount === totalCount}
                  textValue="Mark all done"
                  onAction={() => onMarkAllDone?.()}
                >
                  <CheckIcon className="h-4 w-4" />
                  <Label>Mark all done</Label>
                </Dropdown.Item>
                <Dropdown.Item
                  id="delete-done"
                  isDisabled={doneCount === 0}
                  textValue="Delete done"
                  variant="danger"
                  onAction={() => onDeleteDone?.()}
                >
                  <TrashIcon className="h-4 w-4" />
                  <Label>Delete done</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        ) : null}

        <button
          className="text-default-400 hover:text-foreground shrink-0 p-1 transition-colors"
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
        >
          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDownIcon className="h-5 w-5" />
          </motion.div>
        </button>
      </div>

      {isExpanded ? <div className="divide-default-100 divide-y">{children}</div> : null}
    </div>
  );
}

function PantryProjectionRow({
  item,
  isAdded,
  onAdd,
}: {
  item: ShoppingItem;
  isAdded: boolean;
  onAdd: (item: ShoppingItem) => Promise<void>;
}) {
  const t = useTranslations("groceries.pantry");
  const [isAdding, setIsAdding] = useState(false);
  const qtyLabel = formatQty(item.qty, item.unit);
  const recipeNames = summarizeRecipeNames(item.sources);

  const handleAdd = async () => {
    setIsAdding(true);

    try {
      await onAdd(item);
    } catch {
      toast.danger(t("addAnywayFailed"));
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="bg-content1 flex min-h-16 items-center gap-3 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center">
        <HomeIcon className="text-success h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          {qtyLabel ? <span className="text-success shrink-0 font-medium">{qtyLabel}</span> : null}
          <span className="text-foreground truncate text-base">{item.name}</span>
        </div>
        {recipeNames ? (
          <div className="text-default-400 mt-0.5 truncate text-xs">{recipeNames}</div>
        ) : null}
      </div>
      <Button
        className="shrink-0"
        isDisabled={isAdded}
        isPending={isAdding}
        size="sm"
        variant={isAdded ? "secondary" : "tertiary"}
        onPress={handleAdd}
      >
        {isAdded ? <CheckIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
        {isAdded ? t("added") : t("addAnyway")}
      </Button>
    </div>
  );
}

function PantryProjectionSection({
  items,
  addedItemIds,
  onAdd,
}: {
  items: ShoppingItem[];
  addedItemIds: Set<string>;
  onAdd: (item: ShoppingItem) => Promise<void>;
}) {
  const t = useTranslations("groceries.pantry");

  return (
    <SectionShell
      countLabel={t("atHome", { count: items.length })}
      defaultExpanded={false}
      doneCount={0}
      icon={HomeIcon}
      showActions={false}
      subtitle={t("plannedSubtitle")}
      title={t("plannedTitle")}
      toneOverride={{
        background: "bg-success-100 dark:bg-success/20",
        iconBackground: "bg-success-500",
        countText: "text-success-700 dark:text-success-300",
      }}
      totalCount={items.length}
    >
      {items.map((item) => (
        <PantryProjectionRow
          key={item.id}
          isAdded={addedItemIds.has(item.id)}
          item={item}
          onAdd={onAdd}
        />
      ))}
    </SectionShell>
  );
}

function ComputedItemRow({
  item,
  isDone,
  onToggle,
}: {
  item: ShoppingItem;
  isDone: boolean;
  onToggle: (id: string, isDone: boolean) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const qtyLabel = formatQty(item.qty, item.unit);
  const subtitleParts = [
    summarizeRecipeNames(item.sources),
    item.coversUntil ? `Covers needs until ${formatDate(item.coversUntil)}` : null,
  ].filter(Boolean);
  const showExpand = item.sources.length > 1;

  return (
    <div className="bg-content1">
      <div
        className={`flex items-center gap-3 px-4 py-3 ${subtitleParts.length > 0 ? "min-h-[72px]" : "min-h-14"}`}
      >
        <div className="flex h-8 w-8 items-center justify-center" />
        <GroceryCheckbox
          ariaLabel={item.name}
          isSelected={isDone}
          onChange={(checked) => onToggle(item.id, checked)}
        />

        <button
          className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-0.5 text-left"
          type="button"
          onClick={() => showExpand && setIsExpanded((current) => !current)}
        >
          <div className="flex w-full items-baseline gap-1.5">
            {qtyLabel ? (
              <span
                className={`shrink-0 font-medium ${isDone ? "text-default-400" : "text-primary"}`}
              >
                {qtyLabel}
              </span>
            ) : null}
            <span
              className={`truncate text-base ${
                isDone ? "text-default-400 line-through" : "text-foreground"
              }`}
            >
              {item.name}
            </span>
          </div>
          {subtitleParts.length > 0 ? (
            <span className="text-default-400 mt-0.5 truncate text-xs">
              {subtitleParts.join(" · ")}
            </span>
          ) : null}
        </button>

        {showExpand ? (
          <button
            className="text-default-400 hover:text-foreground shrink-0 p-1 transition-colors"
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? (
              <ChevronDownIcon className="h-4 w-4" />
            ) : (
              <ChevronRightIcon className="h-4 w-4" />
            )}
          </button>
        ) : (
          <div className="h-6 w-6 shrink-0" />
        )}
      </div>

      {showExpand && isExpanded ? (
        <div className="divide-default-100 border-default-100 ml-16 divide-y border-t">
          {item.sources.map((source) => {
            const sourceQtyLabel = formatQty(source.qty, source.unit);

            return (
              <div key={source.id} className="px-4 py-2.5">
                <div className="flex items-baseline gap-1.5">
                  {sourceQtyLabel ? (
                    <span className="text-primary shrink-0 text-sm font-medium">
                      {sourceQtyLabel}
                    </span>
                  ) : null}
                  <span className="text-foreground truncate text-sm">{source.itemName}</span>
                </div>
                <div className="text-default-400 mt-0.5 truncate text-xs">
                  {source.recipeName} · {source.contextLabel.replace(/Â·/g, "·")}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ComputedStoreItemRow({
  item,
  isDone,
  onEdit,
  onToggle,
}: {
  item: ShoppingItem;
  isDone: boolean;
  onEdit: (item: ShoppingItem) => void;
  onToggle: (id: string, isDone: boolean) => void;
}) {
  const qtyLabel = formatQty(item.qty, item.unit);
  const subtitleParts = [
    summarizeRecipeNames(item.sources),
    item.coversUntil ? `Covers needs until ${formatDate(item.coversUntil)}` : null,
  ].filter(Boolean);

  return (
    <div className="bg-content1">
      <div
        className={`flex items-center gap-3 px-4 py-3 ${subtitleParts.length > 0 ? "min-h-[72px]" : "min-h-14"}`}
      >
        <div className="flex h-8 w-8 items-center justify-center" />
        <GroceryCheckbox
          ariaLabel={item.name}
          isSelected={isDone}
          onChange={(checked) => onToggle(item.id, checked)}
        />

        <button
          className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-0.5 text-left"
          type="button"
          onClick={() => onEdit(item)}
        >
          <div className="flex w-full items-baseline gap-1.5">
            {qtyLabel ? (
              <span
                className={`shrink-0 font-medium ${isDone ? "text-default-400" : "text-primary"}`}
              >
                {qtyLabel}
              </span>
            ) : null}
            <span
              className={`truncate text-base ${
                isDone ? "text-default-400 line-through" : "text-foreground"
              }`}
            >
              {item.name}
            </span>
          </div>
          {subtitleParts.length > 0 ? (
            <span className="text-default-400 mt-0.5 truncate text-xs">
              {subtitleParts.join(" · ")}
            </span>
          ) : null}
        </button>

        <button
          className="text-default-400 hover:text-foreground shrink-0 p-1 transition-colors"
          type="button"
          onClick={() => onEdit(item)}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AggregatedRecipeRowItem({
  row,
  doneIds,
  onToggle,
}: {
  row: AggregatedRecipeRow;
  doneIds: Set<string>;
  onToggle: (ids: string[], isDone: boolean) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const qtyLabel = formatQty(row.qty, row.unit);
  const doneCount = row.parentItemIds.filter((id) => doneIds.has(id)).length;
  const isDone = doneCount === row.parentItemIds.length;
  const isIndeterminate = doneCount > 0 && doneCount < row.parentItemIds.length;
  const showExpand = row.contextLabels.length > 1;

  return (
    <div className="bg-content1">
      <div
        className={`flex items-center gap-3 px-4 py-3 ${row.contextLabels.length > 0 ? "min-h-[72px]" : "min-h-14"}`}
      >
        <div className="flex h-8 w-8 items-center justify-center" />
        <GroceryCheckbox
          ariaLabel={row.itemName}
          isIndeterminate={isIndeterminate}
          isSelected={isDone}
          onChange={(checked) => onToggle(row.parentItemIds, checked)}
        />

        <button
          className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-0.5 text-left"
          type="button"
          onClick={() => showExpand && setIsExpanded((current) => !current)}
        >
          <div className="flex w-full items-baseline gap-1.5">
            {qtyLabel ? (
              <span
                className={`shrink-0 font-medium ${isDone ? "text-default-400" : "text-primary"}`}
              >
                {qtyLabel}
              </span>
            ) : null}
            <span
              className={`truncate text-base ${
                isDone ? "text-default-400 line-through" : "text-foreground"
              }`}
            >
              {row.itemName}
            </span>
          </div>
          {row.contextLabels.length > 0 ? (
            <span className="text-default-400 mt-0.5 truncate text-xs">
              {summarizeContextLabels(row.contextLabels)}
            </span>
          ) : null}
        </button>

        {showExpand ? (
          <button
            className="text-default-400 hover:text-foreground shrink-0 p-1 transition-colors"
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? (
              <ChevronDownIcon className="h-4 w-4" />
            ) : (
              <ChevronRightIcon className="h-4 w-4" />
            )}
          </button>
        ) : (
          <div className="h-6 w-6 shrink-0" />
        )}
      </div>

      {showExpand && isExpanded ? (
        <div className="divide-default-100 border-default-100 ml-16 divide-y border-t">
          {row.contextLabels.map((contextLabel) => (
            <div key={contextLabel} className="text-default-400 px-4 py-2.5 text-xs">
              {contextLabel}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ComputedStoreAssignmentPanel({
  item,
  open,
  stores,
  initialStoreId,
  onOpenChange,
  onSave,
}: {
  item: ShoppingItem | null;
  open: boolean;
  stores: StoreDto[];
  initialStoreId: string | null;
  onOpenChange: (open: boolean) => void;
  onSave: (storeId: string | null) => void;
}) {
  const isDesktop = useIsDesktop();
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(initialStoreId);
  const modalState = useOverlayState({ isOpen: open, onOpenChange });

  useEffect(() => {
    if (!open) return;
    setSelectedStoreId(initialStoreId);
  }, [initialStoreId, open]);

  const handleSave = () => {
    onSave(selectedStoreId);
    onOpenChange(false);
  };

  const subtitle = item ? summarizeRecipeNames(item.sources) : "";
  const content = item ? (
    <div className="flex flex-col gap-4">
      <div className="space-y-3">
        <TextField fullWidth isReadOnly aria-label="Grocery item" value={item.name}>
          <Input className="text-lg font-medium" variant="secondary" />
        </TextField>
        {subtitle ? <div className="text-default-500 text-sm">{subtitle}</div> : null}
        <StoreSelector
          showWhenEmpty
          label="Select store"
          selectedStoreId={selectedStoreId}
          stores={stores}
          onSelectionChange={setSelectedStoreId}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          className="min-w-16"
          size="sm"
          variant="tertiary"
          onPress={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button className="min-w-16" size="sm" variant="primary" onPress={handleSave}>
          Save
        </Button>
      </div>
    </div>
  ) : null;

  if (!item) return null;

  if (isDesktop) {
    return (
      <Modal state={modalState}>
        <Modal.Backdrop variant="blur">
          <Modal.Container placement="center" size="md">
            <Modal.Dialog className="max-w-md">
              <Modal.CloseTrigger aria-label="Close" />
              <Modal.Header>
                <Modal.Heading>Edit Grocery</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="pb-6">{content}</Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    );
  }

  return (
    <Panel height={40} open={open} title="Edit Grocery" onOpenChange={onOpenChange}>
      {content}
    </Panel>
  );
}

function PlannerView({
  sections,
  doneIds,
  onDeleteDone,
  onToggle,
}: {
  sections: PlannerSection[];
  doneIds: Set<string>;
  onDeleteDone: (ids: string[]) => void;
  onToggle: (ids: string[], isDone: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const doneCount = section.items.filter((item) => doneIds.has(item.id)).length;
        const aisleGroups = groupItemsByAisle(section.items);

        return (
          <SectionShell
            key={section.id}
            doneCount={doneCount}
            icon={CalendarDaysIcon}
            subtitle={section.subtitle}
            title={section.title}
            totalCount={section.items.length}
            onDeleteDone={() =>
              onDeleteDone(
                section.items.filter((item) => doneIds.has(item.id)).map((item) => item.id)
              )
            }
            onMarkAllDone={() =>
              onToggle(
                section.items.map((item) => item.id),
                true
              )
            }
          >
            {aisleGroups.map((group, groupIndex) => {
              const orderedItems = [
                ...group.items.filter((item) => !doneIds.has(item.id)),
                ...group.items.filter((item) => doneIds.has(item.id)),
              ];

              return (
                <div key={group.aisle}>
                  <div className="text-default-500 px-4 pt-3 text-[11px] font-semibold tracking-[0.14em] uppercase">
                    {group.aisle}
                  </div>
                  <div className={groupIndex === aisleGroups.length - 1 ? "pb-1" : ""}>
                    {orderedItems.map((item) => (
                      <ComputedItemRow
                        key={item.id}
                        isDone={doneIds.has(item.id)}
                        item={item}
                        onToggle={(id, checked) => onToggle([id], checked)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </SectionShell>
        );
      })}
    </div>
  );
}

function StoreView({
  sections,
  doneIds,
  onDeleteDone,
  onEdit,
  onToggle,
}: {
  sections: StoreSection[];
  doneIds: Set<string>;
  onDeleteDone: (ids: string[]) => void;
  onEdit: (item: ShoppingItem) => void;
  onToggle: (ids: string[], isDone: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const orderedItems = [
          ...section.items.filter((item) => !doneIds.has(item.id)),
          ...section.items.filter((item) => doneIds.has(item.id)),
        ];
        const doneCount = section.items.filter((item) => doneIds.has(item.id)).length;
        const colorClasses = section.store
          ? getStoreColorClasses(section.store.color)
          : {
              bg: "bg-default-400",
              bgLight: "bg-default-100",
              text: "text-default-500",
            };

        return (
          <SectionShell
            key={section.id}
            doneCount={doneCount}
            icon={BuildingStorefrontIcon}
            iconNode={
              section.store ? (
                <DynamicHeroIcon className="h-4 w-4 text-white" iconName={section.store.icon} />
              ) : undefined
            }
            title={section.title}
            toneOverride={{
              background: colorClasses.bgLight,
              countText: colorClasses.text,
              iconBackground: colorClasses.bg,
            }}
            totalCount={section.items.length}
            onDeleteDone={() =>
              onDeleteDone(
                section.items.filter((item) => doneIds.has(item.id)).map((item) => item.id)
              )
            }
            onMarkAllDone={() =>
              onToggle(
                section.items.map((item) => item.id),
                true
              )
            }
          >
            {orderedItems.map((item) => (
              <ComputedStoreItemRow
                key={item.id}
                isDone={doneIds.has(item.id)}
                item={item}
                onEdit={onEdit}
                onToggle={(id, checked) => onToggle([id], checked)}
              />
            ))}
          </SectionShell>
        );
      })}
    </div>
  );
}

function RecipeView({
  items,
  doneIds,
  onDeleteDone,
  onToggle,
}: {
  items: ShoppingItem[];
  doneIds: Set<string>;
  onDeleteDone: (ids: string[]) => void;
  onToggle: (ids: string[], isDone: boolean) => void;
}) {
  const recipeGroups = buildRecipeGroups(items);

  return (
    <div className="space-y-4">
      {recipeGroups.map((group) => {
        const doneRows = group.rows.filter((row) =>
          row.parentItemIds.every((itemId) => doneIds.has(itemId))
        );
        const doneCount = doneRows.length;
        const orderedRows = [
          ...group.rows.filter((row) => !row.parentItemIds.every((itemId) => doneIds.has(itemId))),
          ...doneRows,
        ];

        return (
          <SectionShell
            key={group.recipeId}
            doneCount={doneCount}
            icon={BookOpenIcon}
            title={group.recipeName}
            totalCount={group.rows.length}
            onDeleteDone={() => onDeleteDone(doneRows.flatMap((row) => row.parentItemIds))}
            onMarkAllDone={() =>
              onToggle(
                group.rows.flatMap((row) => row.parentItemIds),
                true
              )
            }
          >
            {orderedRows.map((row) => (
              <AggregatedRecipeRowItem
                key={row.id}
                doneIds={doneIds}
                row={row}
                onToggle={onToggle}
              />
            ))}
          </SectionShell>
        );
      })}
    </div>
  );
}

export function ComputedShoppingSection({
  data,
  isLoading,
  error,
  windowStart,
  isCurrentWeek,
  onPreviousWeek,
  onNextWeek,
  onResetWeek,
  onAddPantryItem,
  stores,
  viewMode,
}: {
  data: ComputedShoppingProjectionResult | undefined;
  isLoading: boolean;
  error: unknown;
  windowStart: string;
  isCurrentWeek: boolean;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onResetWeek: () => void;
  onAddPantryItem: (item: ShoppingItem) => Promise<void>;
  stores: StoreDto[];
  viewMode: GroceryViewMode;
}) {
  const [showWholePlan, setShowWholePlan] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [addedPantryItemIds, setAddedPantryItemIds] = useState<Set<string>>(() => new Set());
  const dayCount = data?.dayCount ?? 28;
  const [doneByScope, setDoneByScope] = useLocalStorage<ComputedDoneState>(
    COMPUTED_DONE_STATE_KEY,
    {},
    validateComputedDoneState
  );
  const [hiddenByScope, setHiddenByScope] = useLocalStorage<ComputedDoneState>(
    COMPUTED_HIDDEN_STATE_KEY,
    {},
    validateComputedDoneState
  );
  const [stableDoneByScope, setStableDoneByScope] = useLocalStorage<ComputedDoneState>(
    COMPUTED_STABLE_DONE_STATE_KEY,
    {},
    validateComputedDoneState
  );
  const [storeAssignments, setStoreAssignments] = useLocalStorage<ComputedStoreAssignmentState>(
    COMPUTED_STORE_ASSIGNMENTS_KEY,
    {},
    validateComputedStoreAssignments
  );

  const selectedWeekSummary = useMemo(() => formatWeekRange(windowStart), [windowStart]);

  const scopeKey = useMemo(() => scopeKeyForProjection(data, dayCount), [data, dayCount]);
  const stableScopeKey = useMemo(() => stableScopeKeyForProjection(data), [data]);
  const scopedDoneIds = useMemo(
    () => new Set(doneByScope[scopeKey] ?? []),
    [doneByScope, scopeKey]
  );
  const stableDoneIds = useMemo(
    () => new Set(stableDoneByScope[stableScopeKey] ?? []),
    [stableDoneByScope, stableScopeKey]
  );
  const doneIds = useMemo(
    () => new Set([...scopedDoneIds, ...stableDoneIds]),
    [scopedDoneIds, stableDoneIds]
  );
  const hiddenIds = useMemo(
    () => new Set(hiddenByScope[scopeKey] ?? []),
    [hiddenByScope, scopeKey]
  );
  const hasUpcomingWeeks = (data?.upcomingWeeks.length ?? 0) > 0;

  const getAssignedStoreId = useCallback(
    (item: ShoppingItem) => {
      const assignmentKey = buildStoreAssignmentKey(data?.householdId, item.name);
      const assignedStoreId = storeAssignments[assignmentKey];

      if (!assignedStoreId) return null;
      if (!stores.some((store) => store.id === assignedStoreId)) return null;

      return assignedStoreId;
    },
    [data?.householdId, storeAssignments, stores]
  );

  const visibleProjection = useMemo(() => {
    if (!data) return null;

    const filterItems = (items: ShoppingItem[]) => items.filter((item) => !hiddenIds.has(item.id));
    const stableItems = filterItems(data.stableItems);
    const currentWeekItems = filterItems(data.currentWeekItems);
    const upcomingWeeks = data.upcomingWeeks
      .map((week) => ({
        ...week,
        items: filterItems(week.items),
      }))
      .filter((week) => week.items.length > 0);

    return {
      ...data,
      stableItems,
      currentWeekItems,
      upcomingWeeks,
      totalItemCount:
        stableItems.length +
        currentWeekItems.length +
        upcomingWeeks.reduce((sum, week) => sum + week.items.length, 0),
    };
  }, [data, hiddenIds]);
  const stableItemIds = useMemo(
    () => new Set(visibleProjection?.stableItems.map((item) => item.id) ?? []),
    [visibleProjection]
  );

  const setItemsDone = useCallback(
    (ids: string[], isDone: boolean) => {
      const stableIds = ids.filter((id) => stableItemIds.has(id));
      const scopedIds = ids.filter((id) => !stableItemIds.has(id));

      if (scopedIds.length > 0) {
        setDoneByScope((current) => {
          const next = { ...current };
          const currentIds = new Set(next[scopeKey] ?? []);

          for (const id of scopedIds) {
            if (isDone) {
              currentIds.add(id);
            } else {
              currentIds.delete(id);
            }
          }

          next[scopeKey] = Array.from(currentIds);

          return next;
        });
      }

      if (stableIds.length > 0) {
        setStableDoneByScope((current) => {
          const next = { ...current };
          const currentIds = new Set(next[stableScopeKey] ?? []);

          for (const id of stableIds) {
            if (isDone) {
              currentIds.add(id);
            } else {
              currentIds.delete(id);
            }
          }

          next[stableScopeKey] = Array.from(currentIds);

          return next;
        });
      }
    },
    [scopeKey, setDoneByScope, setStableDoneByScope, stableItemIds, stableScopeKey]
  );

  const hideDoneItems = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;

      setHiddenByScope((current) => {
        const next = { ...current };
        const currentIds = new Set(next[scopeKey] ?? []);

        for (const id of ids) {
          currentIds.add(id);
        }

        next[scopeKey] = Array.from(currentIds);

        return next;
      });

      setDoneByScope((current) => {
        const next = { ...current };
        const currentIds = new Set(next[scopeKey] ?? []);

        for (const id of ids) {
          currentIds.delete(id);
        }

        next[scopeKey] = Array.from(currentIds);

        return next;
      });
    },
    [scopeKey, setDoneByScope, setHiddenByScope]
  );

  const allComputedItems = useMemo(() => {
    if (!visibleProjection) return [];

    return [
      ...visibleProjection.stableItems,
      ...visibleProjection.currentWeekItems,
      ...visibleProjection.upcomingWeeks.flatMap((week) => week.items),
    ];
  }, [visibleProjection]);
  const plannerSections = useMemo(() => {
    if (!visibleProjection) return [];

    const sections = buildPlannerSections(visibleProjection, isCurrentWeek);

    return showWholePlan ? sections : sections.slice(0, 2);
  }, [isCurrentWeek, showWholePlan, visibleProjection]);

  const storeSections = useMemo(
    () => buildStoreSections(allComputedItems, stores, getAssignedStoreId),
    [allComputedItems, getAssignedStoreId, stores]
  );

  const handleStoreAssignmentSave = useCallback(
    (storeId: string | null) => {
      if (!editingItem) return;

      const assignmentKey = buildStoreAssignmentKey(data?.householdId, editingItem.name);

      setStoreAssignments((current) => {
        const next = { ...current };

        if (storeId) {
          next[assignmentKey] = storeId;
        } else {
          delete next[assignmentKey];
        }

        return next;
      });
    },
    [data?.householdId, editingItem, setStoreAssignments]
  );

  const handleAddPantryItem = useCallback(
    async (item: ShoppingItem) => {
      await onAddPantryItem(item);
      setAddedPantryItemIds((current) => new Set(current).add(item.id));
    },
    [onAddPantryItem]
  );

  if (isLoading) {
    return (
      <div className="border-default-200/70 bg-content1/90 mb-8 rounded-2xl border p-6 shadow-sm">
        <div className="text-default-500 flex items-center gap-3 text-sm">
          <ArrowPathIcon className="h-4 w-4 animate-spin" />
          Building shopping projection...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-danger/20 bg-danger/10 text-danger mb-8 rounded-2xl border p-4 text-sm">
        Unable to build the shopping projection right now.
      </div>
    );
  }

  if (!visibleProjection) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-default-400 mb-1 text-[11px] font-semibold tracking-[0.18em] uppercase">
            Planned Shop
          </div>
          <div className="text-foreground text-lg font-semibold">Bulk buys and fresh shops</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="border-default-200 bg-content1/90 inline-flex items-center gap-1 rounded-full border p-1 shadow-sm">
            <button
              className="text-default-500 hover:bg-default-100 hover:text-foreground rounded-full p-2 transition-colors"
              title="Previous shopping week"
              type="button"
              onClick={onPreviousWeek}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              className={[
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                isCurrentWeek
                  ? "bg-default-100 text-default-400 cursor-default"
                  : "text-default-600 hover:bg-default-100 hover:text-foreground",
              ].join(" ")}
              disabled={isCurrentWeek}
              title={
                isCurrentWeek
                  ? "Already focused on the current shopping week"
                  : "Reset to the current shopping week"
              }
              type="button"
              onClick={onResetWeek}
            >
              This Week
            </button>
            <button
              className="text-default-500 hover:bg-default-100 hover:text-foreground rounded-full p-2 transition-colors"
              title="Next shopping week"
              type="button"
              onClick={onNextWeek}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="border-default-200 bg-content1/90 text-default-600 rounded-full border px-3 py-2 text-xs font-medium shadow-sm">
            {selectedWeekSummary}
          </div>
          {viewMode === "planner" && hasUpcomingWeeks ? (
            <button
              className="border-default-200 text-default-600 hover:bg-default-100 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
              type="button"
              onClick={() => setShowWholePlan((current) => !current)}
            >
              {showWholePlan ? "Focus This Week" : "Show Whole Plan"}
            </button>
          ) : null}
        </div>
      </div>

      {!visibleProjection.hasHousehold ? (
        <div className="border-default-200/70 bg-content1/90 rounded-2xl border p-5 shadow-sm">
          <div className="text-foreground text-sm font-medium">
            Shopping projection needs a household
          </div>
        </div>
      ) : visibleProjection.totalItemCount === 0 && visibleProjection.pantryItemCount === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-14">
          <div className="bg-content1/90 shadow-large border-default-200/70 relative w-full max-w-xl rounded-xl border backdrop-blur-xl">
            <div className="flex flex-col items-center gap-5 p-8 text-center">
              <div className="bg-primary-500/15 text-primary-500 flex h-14 w-14 items-center justify-center rounded-2xl">
                <ShoppingCartIcon className="h-6 w-6" />
              </div>
              <div className="text-foreground text-base font-semibold">
                No planned groceries yet
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleProjection.totalItemCount > 0 && viewMode === "planner" ? (
            <PlannerView
              doneIds={doneIds}
              sections={plannerSections}
              onDeleteDone={hideDoneItems}
              onToggle={setItemsDone}
            />
          ) : null}

          {visibleProjection.totalItemCount > 0 && viewMode === "store" ? (
            <StoreView
              doneIds={doneIds}
              sections={storeSections}
              onDeleteDone={hideDoneItems}
              onEdit={setEditingItem}
              onToggle={setItemsDone}
            />
          ) : null}

          {visibleProjection.totalItemCount > 0 && viewMode === "recipe" ? (
            <RecipeView
              doneIds={doneIds}
              items={allComputedItems}
              onDeleteDone={hideDoneItems}
              onToggle={setItemsDone}
            />
          ) : null}

          {visibleProjection.pantryItems.length > 0 ? (
            <PantryProjectionSection
              addedItemIds={addedPantryItemIds}
              items={visibleProjection.pantryItems}
              onAdd={handleAddPantryItem}
            />
          ) : null}
        </div>
      )}

      <ComputedStoreAssignmentPanel
        initialStoreId={editingItem ? getAssignedStoreId(editingItem) : null}
        item={editingItem}
        open={Boolean(editingItem)}
        stores={stores}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null);
        }}
        onSave={handleStoreAssignmentSave}
      />
    </div>
  );
}
