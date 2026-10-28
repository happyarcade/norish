"use client";

import type {
  PlannerDaySlotResult,
  PlannerRangeResult,
  PlannerRelocateSlotItemInput,
  PlannerSetSlotItemDairyFreeInput,
  PlannerSetSlotParticipantsInput,
  PlannerSlotDefinitionsResult,
  PlannerSlotItemResult,
  PlannerUpdateSlotItemInput,
} from "@/hooks/planner";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { Panel, PANEL_HEIGHT_COMPACT, PANEL_HEIGHT_LARGE } from "@/components/Panel/Panel";
import { MarkCookedModal } from "@/components/recipes/mark-cooked-modal";
import { Button } from "@/components/ui/button";
import { useRecipeIngredients } from "@/hooks/recipes";
import {
  ArrowTopRightOnSquareIcon,
  ArrowUturnLeftIcon,
  CheckCircleIcon,
  CheckIcon,
  NoSymbolIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/16/solid";
import {
  Calendar,
  DatePicker,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Switch,
  TextField,
  toast,
  Tooltip,
  useOverlayState,
} from "@heroui-v3/react";
import { DateInputGroup } from "@heroui-v3/react/date-input-group";
import { parseDate } from "@internationalized/date";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
  MealIngredientCandidate,
  MealIngredientOverride,
} from "@norish/shared/lib/meal-adjustments";
import {
  getMealIngredientOverrideSource,
  replaceMealIngredientOverrides,
  suggestLowerSodiumIngredientOverrides,
} from "@norish/shared/lib/meal-adjustments";

import { useIsDesktop } from "./use-is-desktop";

function formatMetric(value: number | null | undefined, suffix: string) {
  if (value == null || Number.isNaN(value)) return null;

  return `${Math.round(value)}${suffix}`;
}

function formatPanelDateLabel(date: string | null) {
  if (!date) return null;

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00`));
}

function buildRecipeMeta(item: PlannerSlotItemResult | null) {
  if (!item?.recipe) return [];

  return [
    formatMetric(item.recipe.calories ?? null, " kcal"),
    formatMetric(item.recipe.protein ?? null, "P"),
    formatMetric(item.recipe.carbs ?? null, "C"),
    formatMetric(item.recipe.fat ?? null, "F"),
  ].filter((value): value is string => Boolean(value));
}

function isComposableMainMeal(slotKey: string | null) {
  return slotKey === "breakfast" || slotKey === "lunch" || slotKey === "dinner";
}

function SectionHeader({
  title,
  buttonLabel,
  onPress,
}: {
  title: string;
  buttonLabel?: string;
  onPress?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-default-400 text-[11px] tracking-[0.18em] uppercase">{title}</div>
      {buttonLabel && onPress ? (
        <Button className="min-w-0 px-3" size="sm" variant="secondary" onPress={onPress}>
          {buttonLabel}
        </Button>
      ) : null}
    </div>
  );
}

function SlotPanelItemCard({
  isActive,
  item,
  isSaving,
  onDelete,
  onSelect,
}: {
  isActive: boolean;
  item: PlannerSlotItemResult;
  isSaving: boolean;
  onDelete: (id: string) => Promise<void> | void;
  onSelect: (id: string) => void;
}) {
  const title = item.recipe?.name ?? item.title ?? "Untitled item";
  const recipeMeta = buildRecipeMeta(item);
  const hasLowerSodiumAdjustments = item.ingredientOverrides.some(
    (override) => getMealIngredientOverrideSource(override, item.dairyFree) === "lower-sodium"
  );
  const hasManualAdjustments = item.ingredientOverrides.some(
    (override) => getMealIngredientOverrideSource(override, item.dairyFree) === "manual"
  );

  return (
    <div
      className={`border-default-100 bg-default-50/60 flex items-start gap-3 rounded-2xl border p-3 transition-colors ${
        isActive ? "ring-primary/40 bg-primary/5 ring-2" : ""
      }`}
    >
      <button
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
        type="button"
        onClick={() => onSelect(item.id)}
      >
        <div className="bg-default-100 relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
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
            <div className="text-default-400 flex h-full w-full items-center justify-center text-xs font-medium">
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
          <div className="text-foreground truncate text-sm font-medium">{title}</div>
          {recipeMeta.length > 0 ||
          item.isConsumer ||
          item.dairyFree ||
          hasLowerSodiumAdjustments ||
          hasManualAdjustments ? (
            <div className="text-default-400 mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs">
              {recipeMeta.map((value) => (
                <span key={value}>{value}</span>
              ))}
              {item.isConsumer ? (
                <span className="bg-success-100 text-success-700 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-[0.14em] uppercase">
                  Prep
                </span>
              ) : null}
              {item.dairyFree ? (
                <span className="bg-primary-100 text-primary-700 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-[0.14em] uppercase">
                  Dairy-free
                </span>
              ) : null}
              {hasLowerSodiumAdjustments ? (
                <span className="bg-success-100 text-success-700 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-[0.14em] uppercase">
                  Lower sodium
                </span>
              ) : null}
              {hasManualAdjustments ? (
                <span className="bg-default-100 text-default-600 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-[0.14em] uppercase">
                  Adjusted
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </button>

      <button
        className="text-default-400 hover:text-danger rounded-md p-1 transition-colors"
        disabled={isSaving}
        type="button"
        onClick={() => onDelete(item.id)}
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

type PlannerSlotItemPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string | null;
  slotDefinitionId: string | null;
  slotDefinitions: PlannerSlotDefinitionsResult;
  slotLabel: string | null;
  slotKey: string | null;
  slotGroup: "meal" | "snack" | "workout" | null;
  items: PlannerSlotItemResult[];
  householdPeople: PlannerRangeResult["householdPeople"];
  participantOverrides: PlannerDaySlotResult["participantOverrides"];
  usesWholeHousehold: boolean;
  effectivePortionUnits: number;
  defaultPortionUnits: number;
  onAddRecipe: (role: "main" | "side" | "drink") => void;
  onDelete: (id: string) => Promise<void> | void;
  onDuplicate: (input: PlannerRelocateSlotItemInput) => Promise<void> | void;
  onMarkCooked: (input: {
    cookedAt?: Date;
    planSlotItemId: string;
    recipeId: string;
  }) => Promise<void> | void;
  onSetDairyFree?: (input: PlannerSetSlotItemDairyFreeInput) => Promise<void> | void;
  onSetParticipants: (input: PlannerSetSlotParticipantsInput) => Promise<void> | void;
  onUpdateItem: (input: PlannerUpdateSlotItemInput) => Promise<void> | void;
  onSave: (input: PlannerRelocateSlotItemInput) => Promise<void> | void;
  isSaving: boolean;
};

export default function PlannerSlotItemPanel({
  open,
  onOpenChange,
  date,
  slotDefinitionId,
  slotDefinitions,
  slotLabel,
  slotKey,
  slotGroup,
  items,
  householdPeople,
  participantOverrides,
  usesWholeHousehold,
  effectivePortionUnits,
  defaultPortionUnits,
  onAddRecipe,
  onDelete,
  onDuplicate,
  onMarkCooked,
  onSetDairyFree,
  onSetParticipants,
  onUpdateItem,
  onSave,
  isSaving,
}: PlannerSlotItemPanelProps) {
  const [selectedDate, setSelectedDate] = useState(() => parseDate("2026-01-01"));
  const [selectedSlotDefinitionId, setSelectedSlotDefinitionId] = useState<string>("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [openMarkCooked, setOpenMarkCooked] = useState(false);
  const [showIngredientEditor, setShowIngredientEditor] = useState(false);
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);
  const [ingredientReplacementDraft, setIngredientReplacementDraft] = useState("");
  const isDesktop = useIsDesktop();
  const modalState = useOverlayState({ isOpen: open, onOpenChange });
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const updateSlotItemFallbackMutation = useMutation(
    trpc.planner.updateSlotItem.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [
            trpc.planner.getRange.queryKey({
              startDate: "2000-01-01",
              endDate: "2000-01-01",
              enabledOnly: false,
            })[0],
          ],
        });
        queryClient.invalidateQueries({
          queryKey: [trpc.groceries.projection.queryKey({ dayCount: 28 })[0]],
        });
      },
    })
  );
  const setDairyFreeFallbackMutation = useMutation(
    trpc.planner.setSlotItemDairyFree.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [
            trpc.planner.getRange.queryKey({
              startDate: "2000-01-01",
              endDate: "2000-01-01",
              enabledOnly: false,
            })[0],
          ],
        });
        queryClient.invalidateQueries({
          queryKey: [trpc.groceries.projection.queryKey({ dayCount: 28 })[0]],
        });
      },
    })
  );

  const activeHouseholdPersonIds = useMemo(
    () =>
      householdPeople
        .filter((person) => person.isActive)
        .map((person) => person.id)
        .sort(),
    [householdPeople]
  );

  const initialParticipantIds = useMemo(
    () =>
      (usesWholeHousehold
        ? activeHouseholdPersonIds
        : participantOverrides.map((person) => person.id)
      ).sort(),
    [activeHouseholdPersonIds, participantOverrides, usesWholeHousehold]
  );

  useEffect(() => {
    if (!open || !date || !slotDefinitionId) return;

    setSelectedDate(parseDate(date));
    setSelectedSlotDefinitionId(slotDefinitionId);
    setSelectedItemId((current) => {
      if (current && items.some((item) => item.id === current)) return current;

      return items.find((item) => item.role === "main")?.id ?? items[0]?.id ?? null;
    });
  }, [date, items, open, slotDefinitionId]);

  useEffect(() => {
    if (!open) return;

    setSelectedParticipantIds(initialParticipantIds);
  }, [initialParticipantIds, open]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId]
  );
  const { ingredients: recipeIngredients, isLoading: isLoadingIngredients } = useRecipeIngredients(
    open ? (selectedItem?.recipe?.id ?? null) : null
  );
  const adjustmentCandidates = useMemo<MealIngredientCandidate[]>(
    () =>
      recipeIngredients
        .filter((ingredient) => {
          const name = ingredient.ingredientName?.trim() ?? "";

          return Boolean(
            ingredient.ingredientId &&
            name &&
            !name.startsWith("#") &&
            !name.includes("(id:") &&
            !name.includes("/recipe:")
          );
        })
        .map((ingredient) => ({
          recipeIngredientId: ingredient.id,
          ingredientName: ingredient.ingredientName,
          rawLine: ingredient.rawLine ?? null,
        })),
    [recipeIngredients]
  );
  const ingredientOverridesById = useMemo(
    () =>
      new Map(
        (selectedItem?.ingredientOverrides ?? []).map((override) => [
          override.recipeIngredientId,
          override,
        ])
      ),
    [selectedItem?.ingredientOverrides]
  );
  const pantryUsageIngredientNames = useMemo(
    () =>
      adjustmentCandidates.flatMap((ingredient) => {
        const override = ingredientOverridesById.get(ingredient.recipeIngredientId);

        if (override?.action === "omit") return [];

        return [override?.replacementName?.trim() || ingredient.ingredientName];
      }),
    [adjustmentCandidates, ingredientOverridesById]
  );
  const hasLowerSodiumAdjustments = useMemo(
    () =>
      selectedItem?.ingredientOverrides.some(
        (override) =>
          getMealIngredientOverrideSource(override, selectedItem.dairyFree) === "lower-sodium"
      ) ?? false,
    [selectedItem]
  );
  const recipeMeta = useMemo(() => buildRecipeMeta(selectedItem), [selectedItem]);
  const dateLabel = useMemo(() => formatPanelDateLabel(date), [date]);
  const groupedItems = useMemo(
    () => ({
      mains: items.filter((item) => item.role === "main"),
      sides: items.filter((item) => item.role === "side"),
      drinks: items.filter((item) => item.role === "drink"),
      other: items.filter((item) => !["main", "side", "drink"].includes(item.role)),
    }),
    [items]
  );
  const composableMainMeal = slotGroup === "meal" && isComposableMainMeal(slotKey);
  const selectedParticipantIdsSorted = useMemo(
    () => [...selectedParticipantIds].sort(),
    [selectedParticipantIds]
  );
  const selectedPeople = useMemo(
    () => householdPeople.filter((person) => selectedParticipantIdsSorted.includes(person.id)),
    [householdPeople, selectedParticipantIdsSorted]
  );
  const participantUnits = useMemo(
    () =>
      Math.round(selectedPeople.reduce((sum, person) => sum + person.portionFactor, 0) * 100) / 100,
    [selectedPeople]
  );
  const matchesWholeHousehold = useMemo(
    () =>
      selectedParticipantIdsSorted.length === activeHouseholdPersonIds.length &&
      selectedParticipantIdsSorted.every(
        (personId, index) => personId === activeHouseholdPersonIds[index]
      ),
    [activeHouseholdPersonIds, selectedParticipantIdsSorted]
  );
  const participantSelectionChanged = useMemo(
    () =>
      initialParticipantIds.length !== selectedParticipantIdsSorted.length ||
      initialParticipantIds.some(
        (personId, index) => personId !== selectedParticipantIdsSorted[index]
      ),
    [initialParticipantIds, selectedParticipantIdsSorted]
  );

  useEffect(() => {
    setShowIngredientEditor(false);
    setEditingIngredientId(null);
    setIngredientReplacementDraft("");
  }, [selectedItemId, open]);

  const participantSummary = useMemo(() => {
    if (matchesWholeHousehold) {
      return {
        label: "Whole household",
        portionUnits: defaultPortionUnits,
      };
    }

    if (selectedPeople.length === 0) {
      return {
        label: "Choose at least one person for this slot",
        portionUnits: null,
      };
    }

    return {
      label: selectedPeople.map((person) => person.displayName).join(", "),
      portionUnits: participantUnits,
    };
  }, [defaultPortionUnits, matchesWholeHousehold, participantUnits, selectedPeople]);

  const handleSave = async () => {
    if (!selectedItem || !selectedSlotDefinitionId) return;

    await onSave({
      id: selectedItem.id,
      date: selectedDate.toString(),
      plannerSlotDefinitionId: selectedSlotDefinitionId,
    });
    onOpenChange(false);
  };

  const handleDuplicate = async () => {
    if (!selectedItem || !selectedSlotDefinitionId) return;

    await onDuplicate({
      id: selectedItem.id,
      date: selectedDate.toString(),
      plannerSlotDefinitionId: selectedSlotDefinitionId,
    });
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!selectedItem) return;

    await onDelete(selectedItem.id);
    onOpenChange(false);
  };

  const handleMarkCooked = async (cookedAt: Date) => {
    if (!selectedItem?.recipe?.id) return;

    try {
      await onMarkCooked({
        cookedAt,
        planSlotItemId: selectedItem.id,
        recipeId: selectedItem.recipe.id,
      });
      toast.success("Marked as cooked", { description: selectedItem.recipe.name });
    } catch (error) {
      toast.danger("Could not mark cooked", { description: "Please try again." });
      throw error;
    }
  };

  const handleInlineDelete = async (id: string) => {
    await onDelete(id);

    if (selectedItemId === id) {
      const nextItem =
        items.find((item) => item.id !== id && item.role === "main") ??
        items.find((item) => item.id !== id) ??
        null;

      setSelectedItemId(nextItem?.id ?? null);
    }
  };

  const handleToggleParticipant = (personId: string) => {
    setSelectedParticipantIds((current) => {
      if (current.includes(personId)) {
        return current.filter((id) => id !== personId);
      }

      return [...current, personId];
    });
  };

  const handleUseWholeHousehold = () => {
    setSelectedParticipantIds(activeHouseholdPersonIds);
  };

  const handleApplyParticipants = async () => {
    if (!date || !slotDefinitionId || selectedParticipantIdsSorted.length === 0) return;

    await onSetParticipants({
      date,
      plannerSlotDefinitionId: slotDefinitionId,
      householdPersonIds: selectedParticipantIdsSorted,
    });
  };

  const handleToggleDairyFree = async (enabled: boolean) => {
    if (!selectedItem?.recipe?.id) return;

    try {
      const input = { id: selectedItem.id, enabled };

      await (onSetDairyFree
        ? onSetDairyFree(input)
        : setDairyFreeFallbackMutation.mutateAsync(input));
      const title = enabled ? "Dairy-free plan applied" : "Dairy-free adjustments removed";

      if (enabled) {
        toast.success(title, { description: selectedItem.recipe.name });
      } else {
        toast(title, { description: selectedItem.recipe.name });
      }
    } catch (error) {
      toast.danger("Could not update this meal", { description: "Please try again." });
      throw error;
    }
  };

  const persistIngredientOverrides = async (
    ingredientOverrides: MealIngredientOverride[],
    dairyFree?: boolean
  ) => {
    if (!selectedItem) return;

    const updateHandler =
      onUpdateItem ??
      ((input: PlannerUpdateSlotItemInput) => updateSlotItemFallbackMutation.mutateAsync(input));

    await updateHandler({
      id: selectedItem.id,
      data: {
        ingredientOverrides,
        ...(dairyFree === undefined ? {} : { dairyFree }),
      },
    });
  };

  const handleToggleLowerSodium = async (enabled: boolean) => {
    if (!selectedItem?.recipe?.id) return;

    const suggestedOverrides = enabled
      ? suggestLowerSodiumIngredientOverrides(adjustmentCandidates)
      : [];
    const ingredientOverrides = replaceMealIngredientOverrides(
      selectedItem.ingredientOverrides,
      suggestedOverrides,
      "lower-sodium",
      selectedItem.dairyFree
    );
    const hasSuggestedChanges = ingredientOverrides.some(
      (override) =>
        getMealIngredientOverrideSource(override, selectedItem.dairyFree) === "lower-sodium"
    );

    if (enabled && !hasSuggestedChanges) {
      toast("No obvious sodium swaps found", { description: selectedItem.recipe.name });

      return;
    }

    try {
      await persistIngredientOverrides(ingredientOverrides);
      const title = enabled
        ? "Lower-sodium adjustments applied"
        : "Lower-sodium adjustments removed";

      if (enabled) {
        toast.success(title, { description: selectedItem.recipe.name });
      } else {
        toast(title, { description: selectedItem.recipe.name });
      }
    } catch {
      toast.danger("Could not update this meal", { description: "Please try again." });
    }
  };

  const handleIngredientAdjustment = async (
    ingredient: MealIngredientCandidate,
    action: "replace" | "omit" | "restore"
  ) => {
    if (!selectedItem) return;

    const replacementName = ingredientReplacementDraft.trim();

    if (action === "replace" && !replacementName) return;

    const existingOverride = ingredientOverridesById.get(ingredient.recipeIngredientId);
    const restoresDairyIngredient =
      action === "restore" &&
      selectedItem.dairyFree &&
      existingOverride !== undefined &&
      getMealIngredientOverrideSource(existingOverride, true) === "dairy-free";
    let ingredientOverrides: MealIngredientOverride[] = selectedItem.ingredientOverrides.filter(
      (override) => override.recipeIngredientId !== ingredient.recipeIngredientId
    );

    if (restoresDairyIngredient) {
      ingredientOverrides = replaceMealIngredientOverrides(
        ingredientOverrides,
        [],
        "dairy-free",
        true
      );
    }

    if (action !== "restore") {
      ingredientOverrides.push({
        recipeIngredientId: ingredient.recipeIngredientId,
        originalName: ingredient.ingredientName,
        replacementName: action === "omit" ? null : replacementName,
        action,
        reason:
          action === "omit" ? "Omitted for this planned meal" : "Chosen for this planned meal",
        source: "manual",
      });
    }

    try {
      await persistIngredientOverrides(
        ingredientOverrides,
        restoresDairyIngredient ? false : undefined
      );
      setEditingIngredientId(null);
      setIngredientReplacementDraft("");
    } catch {
      toast.danger("Could not update this ingredient", { description: "Please try again." });
    }
  };

  const handleToggleCoveredByPrep = async () => {
    if (!selectedItem) return;

    const updateHandler =
      onUpdateItem ??
      ((input: PlannerUpdateSlotItemInput) => updateSlotItemFallbackMutation.mutateAsync(input));

    await updateHandler({
      id: selectedItem.id,
      data: {
        isConsumer: !selectedItem.isConsumer,
      },
    });
  };

  const content = (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-default-400 text-[11px] tracking-[0.18em] uppercase">
          {slotLabel ?? "Planner slot"}
        </div>
        {dateLabel ? (
          <div className="text-foreground mt-2 text-lg font-semibold">{dateLabel}</div>
        ) : null}
      </div>

      {householdPeople.length > 0 ? (
        <div className="border-default-100 bg-default-50/60 flex flex-col gap-3 rounded-2xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-default-400 text-[11px] tracking-[0.18em] uppercase">
                People fed
              </div>
              <div className="text-default-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span>{participantSummary.label}</span>
                {participantSummary.portionUnits !== null ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="bg-default-400 size-1 shrink-0 rounded-full"
                    />
                    <span>{participantSummary.portionUnits} portion units</span>
                  </>
                ) : null}
                {participantSelectionChanged ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="bg-default-400 size-1 shrink-0 rounded-full"
                    />
                    <span>currently {effectivePortionUnits} units</span>
                  </>
                ) : null}
              </div>
            </div>

            <Button
              isDisabled={activeHouseholdPersonIds.length === 0}
              size="sm"
              variant={matchesWholeHousehold ? "primary" : "secondary"}
              onPress={handleUseWholeHousehold}
            >
              Whole household
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {householdPeople.map((person) => {
              const isSelected = selectedParticipantIdsSorted.includes(person.id);

              return (
                <Button
                  key={person.id}
                  aria-pressed={isSelected}
                  className="min-w-0"
                  size="sm"
                  variant={isSelected ? "primary" : "secondary"}
                  onPress={() => handleToggleParticipant(person.id)}
                >
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span>{person.displayName}</span>
                    <span
                      aria-hidden="true"
                      className="size-1 shrink-0 rounded-full bg-current opacity-50"
                    />
                    <span>{person.portionFactor}</span>
                    {!person.isActive ? <span className="opacity-70">optional</span> : null}
                  </span>
                </Button>
              );
            })}
          </div>

          {participantSelectionChanged ? (
            <div className="flex justify-end">
              <Button
                isDisabled={isSaving || selectedParticipantIdsSorted.length === 0}
                size="sm"
                variant="primary"
                onPress={handleApplyParticipants}
              >
                Apply people
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {composableMainMeal ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <SectionHeader
              buttonLabel={groupedItems.mains.length > 0 ? "Replace main" : "Add main"}
              title="Main"
              onPress={() => onAddRecipe("main")}
            />
            {groupedItems.mains.length > 0 ? (
              groupedItems.mains.map((item) => (
                <SlotPanelItemCard
                  key={item.id}
                  isActive={selectedItemId === item.id}
                  isSaving={isSaving}
                  item={item}
                  onDelete={handleInlineDelete}
                  onSelect={setSelectedItemId}
                />
              ))
            ) : (
              <div className="text-default-400 rounded-2xl border border-dashed px-4 py-4 text-sm">
                No main meal yet.
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <SectionHeader
              buttonLabel="Add side"
              title="Sides"
              onPress={() => onAddRecipe("side")}
            />
            {groupedItems.sides.length > 0 ? (
              groupedItems.sides.map((item) => (
                <SlotPanelItemCard
                  key={item.id}
                  isActive={selectedItemId === item.id}
                  isSaving={isSaving}
                  item={item}
                  onDelete={handleInlineDelete}
                  onSelect={setSelectedItemId}
                />
              ))
            ) : (
              <div className="text-default-400 rounded-2xl border border-dashed px-4 py-4 text-sm">
                No sides added yet.
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <SectionHeader
              buttonLabel="Add drink"
              title="Drinks"
              onPress={() => onAddRecipe("drink")}
            />
            {groupedItems.drinks.length > 0 ? (
              groupedItems.drinks.map((item) => (
                <SlotPanelItemCard
                  key={item.id}
                  isActive={selectedItemId === item.id}
                  isSaving={isSaving}
                  item={item}
                  onDelete={handleInlineDelete}
                  onSelect={setSelectedItemId}
                />
              ))
            ) : (
              <div className="text-default-400 rounded-2xl border border-dashed px-4 py-4 text-sm">
                No drinks added yet.
              </div>
            )}
          </div>

          {groupedItems.other.length > 0 ? (
            <div className="flex flex-col gap-3">
              <SectionHeader title="Other" />
              {groupedItems.other.map((item) => (
                <SlotPanelItemCard
                  key={item.id}
                  isActive={selectedItemId === item.id}
                  isSaving={isSaving}
                  item={item}
                  onDelete={handleInlineDelete}
                  onSelect={setSelectedItemId}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <SectionHeader
            buttonLabel="Add recipe"
            title={slotGroup === "snack" ? "Snacks" : "Items"}
            onPress={() => onAddRecipe("main")}
          />
          {items.length > 0 ? (
            items.map((item) => (
              <SlotPanelItemCard
                key={item.id}
                isActive={selectedItemId === item.id}
                isSaving={isSaving}
                item={item}
                onDelete={handleInlineDelete}
                onSelect={setSelectedItemId}
              />
            ))
          ) : (
            <div className="text-default-400 rounded-2xl border border-dashed px-4 py-4 text-sm">
              Nothing planned here yet.
            </div>
          )}
        </div>
      )}

      {selectedItem ? (
        <div className="border-default-100 border-t pt-5">
          <div className="flex items-center gap-3 rounded-lg">
            <div className="bg-default-100 relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
              {selectedItem.recipe?.image ? (
                <Image
                  fill
                  unoptimized
                  alt={selectedItem.recipe.name}
                  className="h-full w-full object-cover"
                  sizes="56px"
                  src={selectedItem.recipe.image}
                />
              ) : (
                <div className="text-default-400 flex h-full w-full items-center justify-center text-xs font-medium">
                  Recipe
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-foreground truncate text-lg font-medium">
                {selectedItem.recipe?.name ?? selectedItem.title ?? "Untitled item"}
              </div>
              {selectedItem.recipe?.id ? (
                <Link
                  className="text-primary mt-1 inline-flex items-center gap-1 text-sm"
                  href={`/recipes/${selectedItem.recipe.id}`}
                  onClick={() => onOpenChange(false)}
                >
                  Go to recipe
                  <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                </Link>
              ) : null}
              {recipeMeta.length > 0 ? (
                <div className="text-default-500 mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  {recipeMeta.map((value) => (
                    <span key={value}>{value}</span>
                  ))}
                </div>
              ) : null}
              {selectedItem.isConsumer ? (
                <div className="text-success-700 mt-2 text-sm font-medium">Covered by prep</div>
              ) : null}
            </div>
          </div>

          <div className="border-default-100 bg-default-50/60 mt-4 rounded-2xl border p-4">
            <div className="text-default-400 text-[11px] tracking-[0.18em] uppercase">
              Meal adjustments
            </div>

            <div className="mt-3 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <div className="text-foreground text-sm font-medium">Make dairy-free</div>
                <Switch
                  aria-label="Make this planned meal dairy-free"
                  isDisabled={
                    isSaving || setDairyFreeFallbackMutation.isPending || !selectedItem.recipe?.id
                  }
                  isSelected={selectedItem.dairyFree}
                  size="sm"
                  onChange={handleToggleDairyFree}
                >
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Content>
                </Switch>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="text-foreground text-sm font-medium">Make lower sodium</div>
                <Switch
                  aria-label="Make this planned meal lower in sodium"
                  isDisabled={
                    isSaving ||
                    updateSlotItemFallbackMutation.isPending ||
                    !selectedItem.recipe?.id ||
                    (isLoadingIngredients && !hasLowerSodiumAdjustments)
                  }
                  isSelected={hasLowerSodiumAdjustments}
                  size="sm"
                  onChange={handleToggleLowerSodium}
                >
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Content>
                </Switch>
              </div>
            </div>

            {selectedItem.ingredientOverrides.length > 0 && !showIngredientEditor ? (
              <div className="border-default-100 mt-4 flex flex-col gap-2 border-t pt-3">
                {selectedItem.ingredientOverrides.map((override) => (
                  <div key={override.recipeIngredientId} className="text-sm">
                    <div className="text-foreground flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                      <span>{override.originalName}</span>
                      <span className="text-default-400">to</span>
                      <span className="text-success-700">
                        {override.action === "omit" ? "Omit" : override.replacementName}
                      </span>
                    </div>
                    <div className="text-default-400 mt-0.5 text-xs">{override.reason}</div>
                  </div>
                ))}
              </div>
            ) : selectedItem.dairyFree &&
              selectedItem.ingredientOverrides.length === 0 &&
              !showIngredientEditor ? (
              <div className="text-success-700 mt-3 text-sm">No dairy ingredients detected.</div>
            ) : null}

            <div className="border-default-100 mt-4 border-t pt-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-default-400 text-[11px] tracking-[0.18em] uppercase">
                  Ingredients
                </div>
                <Button
                  className="min-w-0 px-3"
                  isDisabled={isLoadingIngredients || !selectedItem.recipe?.id}
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    setShowIngredientEditor((current) => !current);
                    setEditingIngredientId(null);
                    setIngredientReplacementDraft("");
                  }}
                >
                  {showIngredientEditor ? null : <PencilSquareIcon className="h-3.5 w-3.5" />}
                  {showIngredientEditor ? "Done" : "Adjust"}
                </Button>
              </div>

              {showIngredientEditor ? (
                <div className="divide-default-100 mt-2 divide-y">
                  {adjustmentCandidates.map((ingredient) => {
                    const override = ingredientOverridesById.get(ingredient.recipeIngredientId);
                    const isEditing = editingIngredientId === ingredient.recipeIngredientId;

                    return (
                      <div key={ingredient.recipeIngredientId} className="py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-sm break-words ${
                                override?.action === "omit"
                                  ? "text-default-400 line-through"
                                  : "text-foreground"
                              }`}
                            >
                              {ingredient.ingredientName}
                            </div>
                            {override?.action === "replace" ? (
                              <div className="text-success-700 mt-0.5 text-xs break-words">
                                {override.replacementName}
                              </div>
                            ) : override?.action === "omit" ? (
                              <div className="text-default-400 mt-0.5 text-xs">Omitted</div>
                            ) : null}
                          </div>

                          {!isEditing ? (
                            <div className="flex shrink-0 items-center gap-0.5">
                              <Tooltip>
                                <Button
                                  isIconOnly
                                  aria-label={`Replace ${ingredient.ingredientName}`}
                                  className="h-8 w-8 min-w-8"
                                  isDisabled={isSaving}
                                  size="sm"
                                  variant="tertiary"
                                  onPress={() => {
                                    setEditingIngredientId(ingredient.recipeIngredientId);
                                    setIngredientReplacementDraft(
                                      override?.action === "replace"
                                        ? (override.replacementName ?? "")
                                        : ""
                                    );
                                  }}
                                >
                                  <PencilSquareIcon className="h-4 w-4" />
                                </Button>
                                <Tooltip.Content>
                                  Replace {ingredient.ingredientName}
                                </Tooltip.Content>
                              </Tooltip>

                              {override ? (
                                <Tooltip>
                                  <Button
                                    isIconOnly
                                    aria-label={`Restore ${ingredient.ingredientName}`}
                                    className="h-8 w-8 min-w-8"
                                    isDisabled={isSaving}
                                    size="sm"
                                    variant="tertiary"
                                    onPress={() => {
                                      void handleIngredientAdjustment(ingredient, "restore");
                                    }}
                                  >
                                    <ArrowUturnLeftIcon className="h-4 w-4" />
                                  </Button>
                                  <Tooltip.Content>
                                    Restore {ingredient.ingredientName}
                                  </Tooltip.Content>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <Button
                                    isIconOnly
                                    aria-label={`Omit ${ingredient.ingredientName}`}
                                    className="h-8 w-8 min-w-8"
                                    isDisabled={isSaving}
                                    size="sm"
                                    variant="danger-soft"
                                    onPress={() => {
                                      void handleIngredientAdjustment(ingredient, "omit");
                                    }}
                                  >
                                    <NoSymbolIcon className="h-4 w-4" />
                                  </Button>
                                  <Tooltip.Content>
                                    Omit {ingredient.ingredientName}
                                  </Tooltip.Content>
                                </Tooltip>
                              )}
                            </div>
                          ) : null}
                        </div>

                        {isEditing ? (
                          <div className="mt-2 flex items-center gap-1.5">
                            <TextField
                              aria-label={`Replacement for ${ingredient.ingredientName}`}
                              className="min-w-0 flex-1"
                              value={ingredientReplacementDraft}
                              onChange={setIngredientReplacementDraft}
                            >
                              <Input
                                className="min-h-8"
                                placeholder="Replacement ingredient"
                                variant="secondary"
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    void handleIngredientAdjustment(ingredient, "replace");
                                  }

                                  if (event.key === "Escape") {
                                    setEditingIngredientId(null);
                                    setIngredientReplacementDraft("");
                                  }
                                }}
                              />
                            </TextField>
                            <Tooltip>
                              <Button
                                isIconOnly
                                aria-label="Save replacement"
                                className="text-success h-8 w-8 min-w-8"
                                isDisabled={
                                  isSaving || ingredientReplacementDraft.trim().length === 0
                                }
                                size="sm"
                                variant="secondary"
                                onPress={() => {
                                  void handleIngredientAdjustment(ingredient, "replace");
                                }}
                              >
                                <CheckIcon className="h-4 w-4" />
                              </Button>
                              <Tooltip.Content>Save replacement</Tooltip.Content>
                            </Tooltip>
                            <Tooltip>
                              <Button
                                isIconOnly
                                aria-label="Cancel replacement"
                                className="h-8 w-8 min-w-8"
                                size="sm"
                                variant="tertiary"
                                onPress={() => {
                                  setEditingIngredientId(null);
                                  setIngredientReplacementDraft("");
                                }}
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </Button>
                              <Tooltip.Content>Cancel replacement</Tooltip.Content>
                            </Tooltip>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="border-default-100 text-default-400 mt-4 border-t pt-4 text-[11px] tracking-[0.18em] uppercase">
              Shopping
            </div>
            <div className="text-default-500 mt-2 text-sm">
              Keep this meal on the planner without adding it to groceries again when it is already
              made in Prep Table.
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-foreground text-sm font-medium">
                {selectedItem.isConsumer ? "Covered by prep" : "Needs groceries"}
              </div>
              <Button
                isDisabled={isSaving || updateSlotItemFallbackMutation.isPending}
                size="sm"
                variant={selectedItem.isConsumer ? "primary" : "secondary"}
                onPress={handleToggleCoveredByPrep}
              >
                {selectedItem.isConsumer ? "Prep covered" : "Mark as prep covered"}
              </Button>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <DatePicker
              isRequired
              className="flex-1"
              value={selectedDate}
              onChange={(value) => {
                if (value) setSelectedDate(value);
              }}
            >
              <Label>Date</Label>
              <DateInputGroup fullWidth variant="secondary">
                <DateInputGroup.Input>
                  {(segment) => <DateInputGroup.Segment segment={segment} />}
                </DateInputGroup.Input>
                <DateInputGroup.Suffix>
                  <DatePicker.Trigger aria-label="Open date picker">
                    <DatePicker.TriggerIndicator />
                  </DatePicker.Trigger>
                </DateInputGroup.Suffix>
              </DateInputGroup>
              <DatePicker.Popover>
                <Calendar>
                  <Calendar.Header>
                    <Calendar.NavButton slot="previous" />
                    <Calendar.Heading />
                    <Calendar.NavButton slot="next" />
                  </Calendar.Header>
                  <Calendar.Grid>
                    <Calendar.GridHeader>
                      {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                    </Calendar.GridHeader>
                    <Calendar.GridBody>
                      {(calendarDate) => <Calendar.Cell date={calendarDate} />}
                    </Calendar.GridBody>
                  </Calendar.Grid>
                </Calendar>
              </DatePicker.Popover>
            </DatePicker>
            <Select
              fullWidth
              className="flex-1"
              selectedKey={selectedSlotDefinitionId || null}
              variant="secondary"
              onSelectionChange={(key) =>
                setSelectedSlotDefinitionId(typeof key === "string" ? key : "")
              }
            >
              <Label>Slot</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox aria-label="Planner slot">
                  {slotDefinitions.map((definition) => (
                    <ListBox.Item
                      key={definition.id}
                      id={definition.id}
                      textValue={definition.label}
                    >
                      {definition.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              isIconOnly
              aria-label="Delete planned item"
              isDisabled={isSaving}
              size="sm"
              variant="danger-soft"
              onPress={handleDelete}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
            <Button
              className="min-w-28"
              isDisabled={isSaving || !selectedItem.recipe?.id}
              size="sm"
              variant="secondary"
              onPress={() => setOpenMarkCooked(true)}
            >
              <CheckCircleIcon className="h-4 w-4" />
              Mark cooked
            </Button>
            <Button
              className="min-w-20"
              isDisabled={isSaving || !selectedSlotDefinitionId}
              size="sm"
              variant="secondary"
              onPress={handleDuplicate}
            >
              Duplicate
            </Button>
            <Button
              className="min-w-20"
              isDisabled={isSaving || !selectedSlotDefinitionId}
              size="sm"
              variant="primary"
              onPress={handleSave}
            >
              Save
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );

  if (isDesktop) {
    return (
      <>
        <Modal state={modalState}>
          <Modal.Backdrop variant="blur">
            <Modal.Container placement="center" scroll="inside" size="lg">
              <Modal.Dialog className="border-default-200 bg-content1 text-content1-foreground w-full max-w-xl border shadow-xl">
                <Modal.CloseTrigger aria-label="Close planned meal editor" />
                <Modal.Header className="border-default-100 border-b pb-4">
                  <Modal.Heading className="text-foreground text-lg font-semibold">
                    {slotLabel ? `${slotLabel} plan` : "Edit planned recipe"}
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body className="max-h-[76vh] overflow-y-auto pt-4 pb-6">
                  {content}
                </Modal.Body>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
        <MarkCookedModal
          defaultDate={date}
          ingredientNames={pantryUsageIngredientNames}
          isLoadingIngredients={isLoadingIngredients}
          isOpen={openMarkCooked}
          isSaving={isSaving}
          recipeId={selectedItem?.recipe?.id ?? null}
          recipeName={selectedItem?.recipe?.name ?? null}
          onConfirm={handleMarkCooked}
          onOpenChange={setOpenMarkCooked}
        />
      </>
    );
  }

  return (
    <>
      <Panel
        height={showIngredientEditor ? PANEL_HEIGHT_LARGE : PANEL_HEIGHT_COMPACT}
        open={open}
        title={slotLabel ? `${slotLabel} plan` : "Edit planned recipe"}
        onOpenChange={onOpenChange}
      >
        {content}
      </Panel>
      <MarkCookedModal
        defaultDate={date}
        ingredientNames={pantryUsageIngredientNames}
        isLoadingIngredients={isLoadingIngredients}
        isOpen={openMarkCooked}
        isSaving={isSaving}
        recipeId={selectedItem?.recipe?.id ?? null}
        recipeName={selectedItem?.recipe?.name ?? null}
        onConfirm={handleMarkCooked}
        onOpenChange={setOpenMarkCooked}
      />
    </>
  );
}
