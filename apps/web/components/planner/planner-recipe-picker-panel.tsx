"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Panel from "@/components/Panel/Panel";
import { formatCookHistoryShort } from "@/components/recipes/cook-history";
import { Button } from "@/components/ui/button";
import { useRandomRecipe, useRecipesQuery } from "@/hooks/recipes";
import {
  formatNutritionMetricValue,
  getNutritionMetricDisplayName,
  getNutritionMetricShortLabel,
} from "@/lib/nutrition/planner-health";
import { ArrowPathIcon, ClockIcon, MagnifyingGlassIcon } from "@heroicons/react/16/solid";
import { InputGroup, Modal, Spinner, TextField, useOverlayState } from "@heroui-v3/react";

import type { RecipeCategory } from "@norish/shared/contracts";
import type { NutritionFocusMetricKey } from "@norish/shared/contracts/zod/user";
import { formatMinutesHM } from "@norish/shared/lib/helpers";
import {
  compareKnownNutritionSwapCandidates,
  getKnownNutritionConfidence,
  getKnownNutritionConfidenceRank,
  getKnownNutritionFitScore,
  getKnownNutritionMetricValue,
  scoreKnownNutritionSwapCandidate,
} from "@norish/shared/lib/nutrition-quality";

import { useIsDesktop } from "./use-is-desktop";

function formatMetric(value: number | null | undefined, suffix: string) {
  if (value == null || Number.isNaN(value)) return null;

  return `${Math.round(value)}${suffix}`;
}

type PlannerRecipePickerPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  suggestedCategory?: RecipeCategory;
  recipeTypeFilters?: string[];
  suggestedSuitableSlot?: string;
  subtitleOverride?: string;
  prioritizedRecipeIds?: string[];
  maxSodium?: number;
  maxCholesterol?: number;
  minFiber?: number;
  showRandomButton?: boolean;
  swapContext?: {
    currentRecipeName: string;
    metrics: {
      metric: NutritionFocusMetricKey;
      value: number;
      carryover?: number;
    }[];
  };
  onSelectRecipe: (recipeId: string) => Promise<void> | void;
};

type NutritionDelta = {
  metric: NutritionFocusMetricKey;
  delta: number;
  helpful: boolean;
  text: string;
};

function buildNutritionDelta(
  metric: NutritionFocusMetricKey,
  currentValue: number,
  nextValue: number | null
): NutritionDelta | null {
  if (nextValue == null) return null;

  const delta = Number((nextValue - currentValue).toFixed(1));

  if (Math.abs(delta) < 0.1) return null;

  const helpful = metric === "fiber" ? delta > 0 : delta < 0;
  const sign = delta > 0 ? "+" : "-";

  return {
    metric,
    delta,
    helpful,
    text: `${sign}${formatNutritionMetricValue(metric, Math.abs(delta))} ${getNutritionMetricDisplayName(metric)}`,
  };
}

export default function PlannerRecipePickerPanel({
  open,
  onOpenChange,
  title,
  suggestedCategory,
  recipeTypeFilters,
  suggestedSuitableSlot,
  subtitleOverride,
  prioritizedRecipeIds,
  maxSodium,
  maxCholesterol,
  minFiber,
  showRandomButton = true,
  swapContext,
  onSelectRecipe,
}: PlannerRecipePickerPanelProps) {
  const [rawInput, setRawInput] = useState("");
  const [search, setSearch] = useState("");
  const [isTransitionPending, startTransition] = useTransition();
  const [submittingRecipeId, setSubmittingRecipeId] = useState<string | null>(null);
  const [isPickingRandom, setIsPickingRandom] = useState(false);
  const [randomError, setRandomError] = useState<string | null>(null);
  const { getRandomRecipe } = useRandomRecipe();
  const isDesktop = useIsDesktop();

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      setRawInput("");
      setSearch("");
      setSubmittingRecipeId(null);
      setIsPickingRandom(false);
      setRandomError(null);
    }
  };
  const modalState = useOverlayState({ isOpen: open, onOpenChange: handleOpenChange });

  const { recipes, isLoading, error, hasMore, loadMore } = useRecipesQuery({
    search: search || undefined,
    categories: suggestedCategory ? [suggestedCategory] : undefined,
    recipeTypes: recipeTypeFilters?.length ? recipeTypeFilters : undefined,
    suitableSlots: suggestedSuitableSlot ? [suggestedSuitableSlot] : undefined,
    maxSodium,
    maxCholesterol,
    minFiber,
  });
  const hasNutritionFilters = Boolean(maxSodium || maxCholesterol || minFiber);
  const {
    recipes: fallbackRecipes,
    isLoading: isFallbackLoading,
    hasMore: fallbackHasMore,
    loadMore: loadMoreFallback,
  } = useRecipesQuery({
    search: search || undefined,
    categories: suggestedCategory ? [suggestedCategory] : undefined,
    recipeTypes: recipeTypeFilters?.length ? recipeTypeFilters : undefined,
    suitableSlots: suggestedSuitableSlot ? [suggestedSuitableSlot] : undefined,
  });
  const showFallbackRecipes =
    hasNutritionFilters && recipes.length === 0 && fallbackRecipes.length > 0;
  const displayedRecipes = showFallbackRecipes ? fallbackRecipes : recipes;
  const prioritizedRecipeIdSet = useMemo(
    () => new Set(prioritizedRecipeIds ?? []),
    [prioritizedRecipeIds]
  );
  const primaryNutritionMetric =
    swapContext?.metrics[0]?.metric ??
    (maxSodium ? "sodium" : maxCholesterol ? "cholesterol" : minFiber ? "fiber" : null);
  const orderedRecipes = useMemo(() => {
    if (swapContext?.metrics.length) {
      return [...displayedRecipes].sort((left, right) => {
        const swapComparison = compareKnownNutritionSwapCandidates(
          left,
          right,
          swapContext.metrics
        );

        if (swapComparison !== 0) return swapComparison;

        const leftPriority = prioritizedRecipeIdSet.has(left.id) ? 0 : 1;
        const rightPriority = prioritizedRecipeIdSet.has(right.id) ? 0 : 1;

        return (
          leftPriority - rightPriority ||
          getKnownNutritionFitScore(right) - getKnownNutritionFitScore(left)
        );
      });
    }

    if (hasNutritionFilters && primaryNutritionMetric) {
      return [...displayedRecipes].sort((left, right) => {
        const leftValue = getKnownNutritionMetricValue(left, primaryNutritionMetric);
        const rightValue = getKnownNutritionMetricValue(right, primaryNutritionMetric);

        if (leftValue == null && rightValue != null) return 1;
        if (rightValue == null && leftValue != null) return -1;

        const leftConfidence = getKnownNutritionConfidenceRank(getKnownNutritionConfidence(left));
        const rightConfidence = getKnownNutritionConfidenceRank(getKnownNutritionConfidence(right));

        if (primaryNutritionMetric === "fiber") {
          return (rightValue ?? 0) - (leftValue ?? 0) || rightConfidence - leftConfidence;
        }

        return (leftValue ?? 0) - (rightValue ?? 0) || rightConfidence - leftConfidence;
      });
    }

    if (prioritizedRecipeIdSet.size === 0) return displayedRecipes;

    return [...displayedRecipes].sort((left, right) => {
      const leftPriority = prioritizedRecipeIdSet.has(left.id) ? 0 : 1;
      const rightPriority = prioritizedRecipeIdSet.has(right.id) ? 0 : 1;

      return leftPriority - rightPriority;
    });
  }, [
    displayedRecipes,
    hasNutritionFilters,
    primaryNutritionMetric,
    prioritizedRecipeIdSet,
    swapContext?.metrics,
  ]);
  const activeHasMore = showFallbackRecipes ? fallbackHasMore : hasMore;
  const activeLoadMore = showFallbackRecipes ? loadMoreFallback : loadMore;
  const isActiveLoading = isLoading || (showFallbackRecipes && isFallbackLoading);

  const subtitle = useMemo(() => {
    if (subtitleOverride) return subtitleOverride;
    if (recipeTypeFilters?.length === 1 && recipeTypeFilters[0] === "side") {
      return "Side recipes first";
    }
    if (recipeTypeFilters?.length === 1 && recipeTypeFilters[0] === "drink") {
      return "Drink recipes first";
    }
    if (suggestedSuitableSlot === "mid-morning") return "Mid-morning recipes first";
    if (suggestedSuitableSlot === "afternoon") return "Afternoon recipes first";
    if (suggestedSuitableSlot === "evening") return "Evening recipes first";
    if (suggestedSuitableSlot === "pre-workout") return "Pre-workout recipes first";
    if (suggestedSuitableSlot === "post-workout") return "Post-workout recipes first";
    if (suggestedSuitableSlot === "snack") return "Snack recipes first";
    if (suggestedCategory === "Breakfast") return "Breakfast recipes first";
    if (suggestedCategory === "Lunch") return "Lunch recipes first";
    if (suggestedCategory === "Dinner") return "Dinner recipes first";
    if (suggestedCategory === "Snack") return "Snack recipes first";

    return "All recipes";
  }, [recipeTypeFilters, suggestedCategory, suggestedSuitableSlot, subtitleOverride]);

  const handleInputChange = (value: string) => {
    setRawInput(value);
    startTransition(() => setSearch(value.trim()));
  };

  const handleSelect = async (recipeId: string) => {
    setSubmittingRecipeId(recipeId);

    try {
      await onSelectRecipe(recipeId);
      onOpenChange(false);
      setRawInput("");
      setSearch("");
      setRandomError(null);
    } finally {
      setSubmittingRecipeId(null);
    }
  };

  const handleRandomRecipe = async () => {
    setRandomError(null);
    setIsPickingRandom(true);

    try {
      const recipe = await getRandomRecipe({
        category: suggestedCategory,
        recipeTypes: recipeTypeFilters?.length ? recipeTypeFilters : undefined,
        suitableSlots: suggestedSuitableSlot ? [suggestedSuitableSlot] : undefined,
      });

      if (!recipe) {
        setRandomError("No recipes available for that slot yet");

        return;
      }

      await handleSelect(recipe.id);
    } finally {
      setIsPickingRandom(false);
    }
  };

  const content = (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <TextField
        fullWidth
        aria-label="Search recipes"
        value={rawInput}
        onChange={handleInputChange}
      >
        <InputGroup fullWidth variant="secondary">
          <InputGroup.Prefix>
            {isTransitionPending ? (
              <Spinner size="sm" />
            ) : (
              <MagnifyingGlassIcon className="text-default-400 h-4 w-4" />
            )}
          </InputGroup.Prefix>
          <InputGroup.Input placeholder="Search recipes..." />
        </InputGroup>
      </TextField>

      <div className="text-default-500 text-sm">{subtitle}</div>

      {swapContext?.metrics.length ? (
        <div className="bg-default-50 border-default-100 rounded-2xl border px-4 py-3">
          <div className="text-default-400 text-[10px] tracking-[0.16em] uppercase">
            Current focus
          </div>
          <div className="text-foreground mt-1 text-sm font-medium">
            {swapContext.currentRecipeName}
          </div>
          <div className="text-default-500 mt-2 flex flex-wrap gap-2 text-xs">
            {swapContext.metrics.map(({ metric, value }) => (
              <span key={metric} className="bg-default-100 rounded-full px-2 py-1">
                {getNutritionMetricShortLabel(metric)} {formatNutritionMetricValue(metric, value)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {showRandomButton ? (
        <div className="shrink-0">
          <Button
            fullWidth
            className="min-h-10 w-full shrink-0 justify-center py-2"
            isDisabled={Boolean(submittingRecipeId) || isPickingRandom}
            isPending={isPickingRandom}
            variant="primary"
            onPress={handleRandomRecipe}
          >
            {isPickingRandom ? null : <ArrowPathIcon className="h-4 w-4" />}
            Random Recipe
          </Button>
        </div>
      ) : null}

      {showRandomButton && randomError ? (
        <div className="text-warning text-sm">{randomError}</div>
      ) : null}

      {error ? (
        <div className="flex flex-1 items-center justify-center text-sm text-red-500">
          Failed to load recipes
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {isActiveLoading && orderedRecipes.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <>
              {showFallbackRecipes ? (
                <div className="text-default-500 rounded-xl bg-amber-50 px-3 py-2 text-sm dark:bg-amber-900/20">
                  No exact nutrition matches yet. Showing closest compatible recipes instead.
                </div>
              ) : null}

              {orderedRecipes.length === 0 ? (
                <div className="text-default-500 flex flex-1 items-center justify-center text-sm">
                  No recipes found
                </div>
              ) : null}

              {orderedRecipes.map((recipe) => {
                const totalMinutes =
                  recipe.totalMinutes ??
                  ((recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0) || undefined);
                const timeLabel = formatMinutesHM(totalMinutes);
                const isSubmitting = submittingRecipeId === recipe.id;
                const cookHistoryLabel = formatCookHistoryShort(
                  recipe.lastCookedAt,
                  recipe.cookCount
                );
                const isPrioritized = prioritizedRecipeIdSet.has(recipe.id) && !hasNutritionFilters;
                const swapFit = swapContext?.metrics.length
                  ? scoreKnownNutritionSwapCandidate(recipe, swapContext.metrics)
                  : null;
                const nutritionDeltas = (swapContext?.metrics ?? [])
                  .map(({ metric, value, carryover = 0 }) => {
                    const nextValue = getKnownNutritionMetricValue(recipe, metric);

                    return buildNutritionDelta(
                      metric,
                      value,
                      nextValue == null ? null : nextValue + carryover
                    );
                  })
                  .filter((delta): delta is NutritionDelta => Boolean(delta))
                  .sort((left, right) => {
                    if (left.helpful !== right.helpful) {
                      return left.helpful ? -1 : 1;
                    }

                    return Math.abs(right.delta) - Math.abs(left.delta);
                  })
                  .slice(0, 2);

                return (
                  <button
                    key={recipe.id}
                    className="bg-default-50 hover:bg-default-100 border-default-100 flex items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors"
                    disabled={Boolean(submittingRecipeId)}
                    type="button"
                    onClick={() => handleSelect(recipe.id)}
                  >
                    <div className="bg-default-200 relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                      {recipe.image ? (
                        <Image
                          unoptimized
                          alt={recipe.name}
                          className="h-full w-full object-cover"
                          height={64}
                          src={recipe.image}
                          width={64}
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-foreground truncate font-medium">{recipe.name}</div>
                        {isPrioritized ? (
                          <span className="bg-success-100 text-success-700 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-[0.14em] uppercase">
                            In prep
                          </span>
                        ) : null}
                        {swapFit && swapFit.score > 0 && swapFit.knownMetricCount > 0 ? (
                          <span className="bg-success-100 text-success-700 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-[0.14em] uppercase">
                            Better fit
                          </span>
                        ) : null}
                      </div>
                      {recipe.description ? (
                        <div className="text-default-500 mt-1 line-clamp-2 text-sm">
                          {recipe.description}
                        </div>
                      ) : null}

                      <div className="text-default-400 mt-2 flex flex-wrap items-center gap-3 text-xs">
                        {timeLabel ? (
                          <span className="inline-flex items-center gap-1">
                            <ClockIcon className="h-3.5 w-3.5" />
                            {timeLabel}
                          </span>
                        ) : null}
                        {recipe.calories ? <span>{recipe.calories} kcal</span> : null}
                        {formatMetric(recipe.protein ?? null, "P") ? (
                          <span>{formatMetric(recipe.protein ?? null, "P")}</span>
                        ) : null}
                        {formatMetric(recipe.carbs ?? null, "C") ? (
                          <span>{formatMetric(recipe.carbs ?? null, "C")}</span>
                        ) : null}
                        {formatMetric(recipe.fat ?? null, "F") ? (
                          <span>{formatMetric(recipe.fat ?? null, "F")}</span>
                        ) : null}
                      </div>

                      {cookHistoryLabel ? (
                        <div className="text-default-400 mt-1 text-xs">{cookHistoryLabel}</div>
                      ) : null}

                      {nutritionDeltas.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {nutritionDeltas.map((delta) => (
                            <span
                              key={`${recipe.id}:${delta.metric}`}
                              className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                                delta.helpful
                                  ? "bg-success-100 text-success-700"
                                  : "bg-danger-100 text-danger-700"
                              }`}
                            >
                              {delta.text}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {isSubmitting ? <Spinner size="sm" /> : null}
                  </button>
                );
              })}
            </>
          )}

          {activeHasMore ? (
            <Button variant="secondary" onPress={activeLoadMore}>
              Load more
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <Modal state={modalState}>
        <Modal.Backdrop variant="blur">
          <Modal.Container placement="center" scroll="inside" size="lg">
            <Modal.Dialog className="max-w-lg">
              <Modal.CloseTrigger aria-label={`Close ${title}`} />
              <Modal.Header>
                <Modal.Heading>{title}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="max-h-[72vh] overflow-y-auto pb-6">{content}</Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    );
  }

  return (
    <Panel height={82} open={open} title={title} onOpenChange={handleOpenChange}>
      {content}
    </Panel>
  );
}
