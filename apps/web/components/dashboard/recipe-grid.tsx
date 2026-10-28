"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRecipesContext } from "@/context/recipes-context";
import { useContainerColumns } from "@/hooks/use-container-columns";
import { useRecipeDashboardViewMode } from "@/hooks/use-recipe-dashboard-view-mode";
import { Spinner } from "@heroui-v3/react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useWindowSize } from "usehooks-ts";

import { useScrollRestoration } from "@norish/shared-react/hooks";
import { RecipeDashboardDTO } from "@norish/shared/contracts";

import RecipeCardSkeleton from "../skeleton/recipe-card-skeleton";
import RecipeGridSkeleton from "../skeleton/recipe-grid-skeleton";
import NoRecipeResults from "./no-recipe-results";
import NoRecipesText from "./no-recipes-text";
import RecipeCard from "./recipe-card";

const ESTIMATED_GRID_ROW_HEIGHT = 380;
const ESTIMATED_LIST_ROW_HEIGHT = 144;
const GRID_ROW_OVERSCAN = 3;
const LIST_ROW_OVERSCAN = 12;
const GRID_LOAD_MORE_ROW_THRESHOLD = 2;
const LIST_LOAD_MORE_ROW_THRESHOLD = 6;

export default function RecipeGrid() {
  const {
    recipes,
    isLoading,
    isFetchingMore,
    hasMore: _hasMore,
    loadMore,
    pendingRecipeIds,
    hasAppliedFilters,
    clearFilters,
    filterKey,
    isFavorite,
    toggleFavorite,
    deleteRecipe,
    allergies,
  } = useRecipesContext();

  const { saveScrollState, getScrollState } = useScrollRestoration(filterKey);

  const [showSkeleton, setShowSkeleton] = useState(false);
  const [isLoadedOnce, setIsLoadedOnce] = useState(false);
  const [viewMode] = useRecipeDashboardViewMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const hasTriggeredLoadMoreRef = useRef(false);

  const columnCount = useContainerColumns();
  const effectiveColumnCount = viewMode === "list" ? 1 : columnCount;
  const rowOverscan = viewMode === "list" ? LIST_ROW_OVERSCAN : GRID_ROW_OVERSCAN;
  const loadMoreRowThreshold =
    viewMode === "list" ? LIST_LOAD_MORE_ROW_THRESHOLD : GRID_LOAD_MORE_ROW_THRESHOLD;

  const { height: _windowHeight } = useWindowSize();

  const scrollMargin = useMemo(() => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();

    return rect.top + window.scrollY;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_windowHeight]);

  const displayData = useMemo(() => {
    const pendingSkeletons = Array.from(pendingRecipeIds).map((id) => ({
      id,
      isLoading: true,
    }));

    return [...pendingSkeletons, ...recipes];
  }, [pendingRecipeIds, recipes]);

  const rowCount = useMemo(() => {
    return Math.ceil(displayData.length / effectiveColumnCount);
  }, [displayData.length, effectiveColumnCount]);

  const savedState = getScrollState();

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () =>
      viewMode === "list" ? ESTIMATED_LIST_ROW_HEIGHT : ESTIMATED_GRID_ROW_HEIGHT,
    overscan: rowOverscan,
    scrollMargin,
    initialOffset: savedState?.scrollOffset,
    initialMeasurementsCache: savedState?.measurementsCache,
    onChange: (instance) => {
      if (!instance.isScrolling) {
        saveScrollState(instance.scrollOffset ?? 0, instance.measurementsCache);
      }
    },
  });

  const virtualRows = virtualizer.getVirtualItems();

  useEffect(() => {
    virtualizer.measure();
  }, [effectiveColumnCount, viewMode, virtualizer]);

  useEffect(() => {
    if (virtualRows.length === 0) return;

    const lastRow = virtualRows[virtualRows.length - 1];

    if (!lastRow) return;

    const isNearEnd = lastRow.index >= rowCount - loadMoreRowThreshold;

    if (isNearEnd && !isFetchingMore && !hasTriggeredLoadMoreRef.current) {
      hasTriggeredLoadMoreRef.current = true;
      loadMore();
    }

    if (!isNearEnd) {
      hasTriggeredLoadMoreRef.current = false;
    }
  }, [virtualRows, rowCount, loadMoreRowThreshold, isFetchingMore, loadMore]);

  useEffect(() => {
    if (!isLoadedOnce && isLoading) {
      setShowSkeleton(true);

      return;
    }

    if (!isLoading) {
      setIsLoadedOnce(true);
      setShowSkeleton(false);

      return;
    }

    if (isLoadedOnce && isLoading) {
      const timeout = setTimeout(() => setShowSkeleton(true), 100);

      return () => clearTimeout(timeout);
    }
  }, [isLoading, recipes.length, isLoadedOnce]);

  const showEmptyState = !isLoading && displayData.length === 0;

  const renderItem = useCallback(
    (item: (typeof displayData)[number]) => {
      if ("isLoading" in item && item.isLoading) {
        return <RecipeCardSkeleton key={`skeleton-${item.id}`} variant={viewMode} />;
      }

      const recipe = item as RecipeDashboardDTO;

      return (
        <RecipeCard
          key={`recipe-${recipe.id}`}
          allergies={allergies}
          isFavorite={isFavorite(recipe.id)}
          recipe={recipe}
          variant={viewMode}
          onDelete={deleteRecipe}
          onToggleFavorite={toggleFavorite}
        />
      );
    },
    [allergies, isFavorite, deleteRecipe, toggleFavorite, viewMode]
  );

  if (showSkeleton) return <RecipeGridSkeleton variant={viewMode} />;

  return (
    <div
      ref={containerRef}
      className="relative flex h-full flex-col"
      style={{ containIntrinsicSize: "0 500px" }}
    >
      {showEmptyState ? (
        hasAppliedFilters ? (
          <NoRecipeResults onClear={clearFilters} />
        ) : (
          <NoRecipesText />
        )
      ) : (
        <>
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualRows.map((virtualRow) => {
              const startIndex = virtualRow.index * effectiveColumnCount;
              const rowItems = displayData.slice(startIndex, startIndex + effectiveColumnCount);

              return (
                <div
                  key={virtualRow.key}
                  ref={virtualizer.measureElement}
                  className={viewMode === "list" ? "pb-3" : ""}
                  data-index={virtualRow.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start - scrollMargin}px)`,
                  }}
                >
                  <div
                    className={viewMode === "list" ? "flex flex-col gap-4" : "grid gap-4"}
                    style={{
                      gridTemplateColumns:
                        viewMode === "list"
                          ? undefined
                          : `repeat(${effectiveColumnCount}, minmax(0, 1fr))`,
                    }}
                  >
                    {rowItems.map((item) => (
                      <div key={item.id} className={viewMode === "list" ? "" : "p-2"}>
                        {renderItem(item)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {isFetchingMore && (
            <div className="flex justify-center py-8">
              <Spinner color="accent" size="lg" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
