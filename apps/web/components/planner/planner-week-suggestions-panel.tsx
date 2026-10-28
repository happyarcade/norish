"use client";

import type {
  PlannerPlanningMode,
  PlannerSuggestedMeal,
  PlannerSuggestedWeekResult,
  PlannerSuggestionScope,
} from "@/hooks/planner";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Panel from "@/components/Panel/Panel";
import { Button } from "@/components/ui/button";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ClockIcon,
  ShoppingCartIcon,
  SparklesIcon,
} from "@heroicons/react/16/solid";
import { Checkbox, Modal, Spinner, Tooltip, useOverlayState } from "@heroui-v3/react";

import { formatMinutesHM } from "@norish/shared/lib/helpers";

import { useIsDesktop } from "./use-is-desktop";

type PlannerWeekSuggestionsPanelProps = {
  open: boolean;
  data: PlannerSuggestedWeekResult | undefined;
  error: unknown;
  isLoading: boolean;
  isRefreshing: boolean;
  isApplying: boolean;
  mode: PlannerPlanningMode;
  scope: PlannerSuggestionScope;
  onOpenChange: (open: boolean) => void;
  onModeChange: (mode: PlannerPlanningMode) => void;
  onScopeChange: (scope: PlannerSuggestionScope) => void;
  onRefresh: () => void;
  onReplace: (
    suggestion: PlannerSuggestedMeal,
    draftSuggestions: PlannerSuggestedMeal[]
  ) => Promise<PlannerSuggestedMeal | null>;
  onApply: (suggestions: PlannerSuggestedMeal[]) => Promise<void> | void;
};

const PLANNING_MODE_OPTIONS: { label: string; value: PlannerPlanningMode }[] = [
  { label: "Balanced", value: "balanced" },
  { label: "Quick week", value: "quick-week" },
  { label: "Meal prep", value: "meal-prep" },
  { label: "Mediterranean", value: "mediterranean" },
];

const SUGGESTION_SCOPE_OPTIONS: { label: string; value: PlannerSuggestionScope }[] = [
  { label: "Dinners", value: "dinners" },
  { label: "Lunch + dinner", value: "lunch-dinner" },
];

function formatSuggestionDate(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(new Date(date + "T12:00:00"));
}

function formatCuisine(value: string) {
  return value
    .split(/[\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function reasonClassName(reason: string) {
  if (/sodium|protein|dairy/i.test(reason)) return "bg-success-100 text-success-700";
  if (/favourite|rated/i.test(reason)) return "bg-warning-100 text-warning-700";

  return "bg-default-100 text-default-600";
}

function segmentClassName(selected: boolean) {
  return [
    "min-h-9 min-w-0 rounded-md px-3 text-sm font-medium transition-colors",
    "focus-visible:ring-focus focus-visible:ring-2 focus-visible:outline-none",
    "disabled:pointer-events-none disabled:opacity-50",
    selected
      ? "bg-primary text-primary-foreground shadow-sm"
      : "text-default-600 hover:bg-content1 hover:text-foreground",
  ].join(" ");
}

export default function PlannerWeekSuggestionsPanel({
  open,
  data,
  error,
  isLoading,
  isRefreshing,
  isApplying,
  mode,
  scope,
  onOpenChange,
  onModeChange,
  onScopeChange,
  onRefresh,
  onReplace,
  onApply,
}: PlannerWeekSuggestionsPanelProps) {
  const isDesktop = useIsDesktop();
  const router = useRouter();
  const modalState = useOverlayState({ isOpen: open, onOpenChange });
  const serverSuggestions = useMemo(() => data?.suggestions ?? [], [data?.suggestions]);
  const [suggestions, setSuggestions] = useState<PlannerSuggestedMeal[]>(serverSuggestions);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<Set<string>>(new Set());
  const [replacingRecipeId, setReplacingRecipeId] = useState<string | null>(null);

  useEffect(() => {
    setSuggestions(serverSuggestions);
    setSelectedRecipeIds(new Set(serverSuggestions.map((suggestion) => suggestion.recipe.id)));
  }, [serverSuggestions]);

  const selectedSuggestions = useMemo(
    () => suggestions.filter((suggestion) => selectedRecipeIds.has(suggestion.recipe.id)),
    [selectedRecipeIds, suggestions]
  );
  const groceryImpact = useMemo(() => {
    const pantryIngredients = new Set(
      selectedSuggestions.flatMap((suggestion) => suggestion.recipe.pantryIngredientNames)
    );
    const additionalIngredients = new Set(
      selectedSuggestions.flatMap((suggestion) => suggestion.recipe.additionalIngredientNames)
    );

    return {
      pantryMatches: pantryIngredients.size,
      additionalIngredients: additionalIngredients.size,
    };
  }, [selectedSuggestions]);

  const toggleSuggestion = (recipeId: string, selected: boolean) => {
    setSelectedRecipeIds((current) => {
      const next = new Set(current);

      if (selected) next.add(recipeId);
      else next.delete(recipeId);

      return next;
    });
  };

  const replaceSuggestion = async (suggestion: PlannerSuggestedMeal) => {
    setReplacingRecipeId(suggestion.recipe.id);

    try {
      const replacement = await onReplace(suggestion, suggestions);

      if (!replacement) return;

      setSuggestions((current) =>
        current.map((candidate) =>
          candidate.date === suggestion.date &&
          candidate.plannerSlotDefinitionId === suggestion.plannerSlotDefinitionId
            ? replacement
            : candidate
        )
      );
      setSelectedRecipeIds((current) => {
        const next = new Set(current);
        const wasSelected = next.delete(suggestion.recipe.id);

        if (wasSelected) next.add(replacement.recipe.id);

        return next;
      });
    } finally {
      setReplacingRecipeId(null);
    }
  };

  const content = (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div
        aria-label="Suggestion scope"
        className="border-default-200 bg-content2 grid shrink-0 grid-cols-2 gap-1 rounded-lg border p-1"
        role="group"
      >
        {SUGGESTION_SCOPE_OPTIONS.map((option) => {
          const selected = option.value === scope;

          return (
            <button
              key={option.value}
              aria-pressed={selected}
              className={segmentClassName(selected)}
              disabled={isApplying}
              type="button"
              onClick={() => onScopeChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div
        aria-label="Planning mode"
        className="border-default-200 bg-content2 grid shrink-0 grid-cols-2 gap-1 rounded-lg border p-1 sm:grid-cols-4"
        role="group"
      >
        {PLANNING_MODE_OPTIONS.map((option) => {
          const selected = option.value === mode;

          return (
            <button
              key={option.value}
              aria-pressed={selected}
              className={segmentClassName(selected)}
              disabled={isApplying}
              type="button"
              onClick={() => onModeChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {isLoading && suggestions.length === 0 ? (
        <div className="text-default-500 flex min-h-56 items-center justify-center gap-3 text-sm">
          <Spinner size="sm" />
          Finding meals
        </div>
      ) : error ? (
        <div className="border-danger-100 bg-danger-50 text-danger-700 flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border p-5 text-center text-sm">
          <div>Unable to load meal suggestions</div>
          <Button
            isIconOnly
            aria-label="Retry meal suggestions"
            size="sm"
            variant="danger-soft"
            onPress={onRefresh}
          >
            <ArrowPathIcon className="h-4 w-4" />
          </Button>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="bg-default-50 border-default-100 text-default-500 flex min-h-40 items-center justify-center rounded-lg border p-5 text-center text-sm">
          {data?.openMealCount === 0 ? "No open meal slots this week" : "No suitable meals found"}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {suggestions.map((suggestion) => {
            const selected = selectedRecipeIds.has(suggestion.recipe.id);
            const timeLabel = suggestion.recipe.totalMinutes
              ? formatMinutesHM(suggestion.recipe.totalMinutes)
              : null;
            const cuisine = suggestion.recipe.cuisines[0]
              ? formatCuisine(suggestion.recipe.cuisines[0])
              : null;

            return (
              <div
                key={suggestion.date + ":" + suggestion.recipe.id}
                className={
                  "border-default-200 flex gap-3 rounded-lg border p-3 transition-colors " +
                  (selected ? "bg-content2/60" : "bg-content1 opacity-60")
                }
              >
                <Checkbox
                  aria-label={"Include " + suggestion.recipe.name}
                  className="self-start pt-1"
                  isDisabled={isApplying}
                  isSelected={selected}
                  variant="secondary"
                  onChange={(nextSelected) => toggleSuggestion(suggestion.recipe.id, nextSelected)}
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                  </Checkbox.Content>
                </Checkbox>

                <div className="bg-default-200 h-20 w-20 shrink-0 overflow-hidden rounded-md">
                  {suggestion.recipe.image ? (
                    <Image
                      unoptimized
                      alt=""
                      className="h-20 w-20 object-cover"
                      height={80}
                      src={suggestion.recipe.image}
                      width={80}
                    />
                  ) : (
                    <div className="text-default-400 flex h-full items-center justify-center">
                      <SparklesIcon className="h-6 w-6" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-default-400 text-[11px] font-medium uppercase">
                        {formatSuggestionDate(suggestion.date)} · {suggestion.slotLabel}
                      </div>
                      <div className="text-foreground mt-0.5 line-clamp-2 font-semibold">
                        {suggestion.recipe.name}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Tooltip>
                        <Button
                          isIconOnly
                          aria-label={"Replace " + suggestion.recipe.name}
                          className="h-8 w-8 min-w-8"
                          isDisabled={isApplying || replacingRecipeId !== null}
                          isPending={replacingRecipeId === suggestion.recipe.id}
                          size="sm"
                          variant="tertiary"
                          onPress={() => void replaceSuggestion(suggestion)}
                        >
                          <ArrowPathIcon className="h-4 w-4" />
                        </Button>
                        <Tooltip.Content>Replace meal</Tooltip.Content>
                      </Tooltip>
                      <Tooltip>
                        <Button
                          isIconOnly
                          aria-label={"Open " + suggestion.recipe.name}
                          className="h-8 w-8 min-w-8"
                          size="sm"
                          variant="tertiary"
                          onPress={() => router.push("/recipes/" + suggestion.recipe.id)}
                        >
                          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        </Button>
                        <Tooltip.Content>Open recipe</Tooltip.Content>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="text-default-400 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {timeLabel ? (
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon className="h-3.5 w-3.5" />
                        {timeLabel}
                      </span>
                    ) : null}
                    {suggestion.recipe.protein != null ? (
                      <span>{Math.round(suggestion.recipe.protein)}g protein</span>
                    ) : null}
                    {suggestion.recipe.sodium != null ? (
                      <span>{Math.round(suggestion.recipe.sodium)}mg sodium</span>
                    ) : null}
                    {cuisine ? <span>{cuisine}</span> : null}
                    <span className="inline-flex items-center gap-1">
                      <ShoppingCartIcon className="h-3.5 w-3.5" />
                      {suggestion.recipe.pantryIngredientNames.length > 0
                        ? `${suggestion.recipe.pantryIngredientNames.length} on hand, `
                        : ""}
                      ~{suggestion.recipe.additionalIngredientNames.length} others
                    </span>
                  </div>

                  {suggestion.reasons.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {suggestion.reasons.map((reason) => (
                        <span
                          key={reason}
                          className={
                            "rounded-full px-2 py-0.5 text-[10px] font-medium " +
                            reasonClassName(reason)
                          }
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="border-default-100 flex shrink-0 items-center justify-between gap-3 border-t pt-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Tooltip>
            <Button
              isIconOnly
              aria-label="Refresh meal suggestions"
              isDisabled={isApplying || isLoading}
              isPending={isRefreshing && !isLoading}
              variant="secondary"
              onPress={onRefresh}
            >
              <ArrowPathIcon className="h-4 w-4" />
            </Button>
            <Tooltip.Content>Refresh suggestions</Tooltip.Content>
          </Tooltip>
          {selectedSuggestions.length > 0 ? (
            <div className="text-default-500 min-w-0 text-xs leading-5">
              <div className="text-foreground font-medium">Grocery impact</div>
              <div>
                {groceryImpact.pantryMatches} pantry match
                {groceryImpact.pantryMatches === 1 ? "" : "es"} · ~
                {groceryImpact.additionalIngredients} other ingredients
              </div>
            </div>
          ) : null}
        </div>

        <Button
          className="min-w-40"
          isDisabled={selectedSuggestions.length === 0 || isLoading}
          isPending={isApplying}
          variant="primary"
          onPress={() => void onApply(selectedSuggestions)}
        >
          {isApplying ? null : <SparklesIcon className="h-4 w-4" />}
          Add {selectedSuggestions.length} meal{selectedSuggestions.length === 1 ? "" : "s"}
        </Button>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Modal state={modalState}>
        <Modal.Backdrop variant="blur">
          <Modal.Container placement="center" scroll="inside" size="lg">
            <Modal.Dialog className="border-default-200 bg-content1 text-content1-foreground w-full max-w-2xl border shadow-xl">
              <Modal.CloseTrigger aria-label="Close meal suggestions" />
              <Modal.Header className="border-default-100 border-b pb-4">
                <Modal.Heading className="text-foreground text-lg font-semibold">
                  Meal suggestions
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="max-h-[72vh] overflow-hidden pt-4">{content}</Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    );
  }

  return (
    <Panel height={85} open={open} title="Meal suggestions" onOpenChange={onOpenChange}>
      {content}
    </Panel>
  );
}
