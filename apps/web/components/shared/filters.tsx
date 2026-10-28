"use client";

import { useMemo, useState } from "react";
import { FiltersPanel } from "@/components/Panel/consumers";
import { Button } from "@/components/ui/button";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { FunnelIcon } from "@heroicons/react/16/solid";

import { cssGlassBackdrop } from "@norish/web/config/css-tokens";

type FiltersProps = {
  isGlass: boolean;
};

export default function Filters({ isGlass = false }: FiltersProps) {
  const { filters } = useRecipesFiltersContext();
  const [isOpen, setIsOpen] = useState(false);

  const hasActiveFilters = useMemo(() => {
    const hasSearch = filters.rawInput.trim().length > 0;
    const hasTags = filters.searchTags.length > 0;
    const hasCategories = filters.categories.length > 0;
    const hasSuitableSlots = filters.suitableSlots.length > 0;
    const hasRating = filters.minRating !== null;
    const hasCookingTime = filters.maxCookingTime !== null;
    const hasSodiumLimit = filters.maxSodium !== null;
    const hasCholesterolLimit = filters.maxCholesterol !== null;
    const hasFiberMinimum = filters.minFiber !== null;
    const hasSources = filters.sourceDomains.length > 0;
    const hasNutritionDetail = filters.nutritionDetail !== null;

    return (
      hasSearch ||
      hasTags ||
      hasCategories ||
      hasSuitableSlots ||
      hasRating ||
      hasCookingTime ||
      hasSodiumLimit ||
      hasCholesterolLimit ||
      hasFiberMinimum ||
      hasSources ||
      hasNutritionDetail
    );
  }, [
    filters.rawInput,
    filters.searchTags,
    filters.categories,
    filters.suitableSlots,
    filters.minRating,
    filters.maxCookingTime,
    filters.maxSodium,
    filters.maxCholesterol,
    filters.minFiber,
    filters.sourceDomains,
    filters.nutritionDetail,
  ]);

  return (
    <>
      <Button
        isIconOnly
        aria-label="Filters"
        className={`relative h-12 w-12 ${isGlass ? cssGlassBackdrop : "bg-default-100 hover:bg-default-200"}`}
        radius="full"
        variant="flat"
        onPress={() => setIsOpen(true)}
      >
        <FunnelIcon className="size-4" />
        {hasActiveFilters && (
          <span className="bg-primary shadow-background absolute top-2.5 right-2.5 inline-flex h-2.5 w-2.5 rounded-full shadow-[0_0_0_2px]" />
        )}
      </Button>

      <FiltersPanel open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
