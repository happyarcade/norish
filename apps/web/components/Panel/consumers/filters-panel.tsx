"use client";

import { useCallback, useEffect, useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import SearchFieldToggles from "@/components/dashboard/search-field-toggles";
import Panel from "@/components/Panel/Panel";
import { useIsDesktop } from "@/components/planner/use-is-desktop";
import ChipSkeleton from "@/components/skeleton/chip-skeleton";
import { Button } from "@/components/ui/button";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { useUserContext } from "@/context/user-context";
import { useTagsQuery } from "@/hooks/config";
import {
  ArrowPathIcon,
  ArrowRightIcon,
  CheckIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/16/solid";
import { InputGroup, Label, Modal, TextField, useOverlayState } from "@heroui-v3/react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import type {
  FilterMode,
  NutritionDetailFilter,
  RecipeCategory,
  SortOrder,
} from "@norish/shared/contracts";
import {
  getShowFavoritesPreference,
  getShowRatingsPreference,
} from "@norish/shared/lib/user-preferences";
import RatingStars from "@norish/ui/rating-stars";

const ALL_CATEGORIES: RecipeCategory[] = ["Breakfast", "Lunch", "Dinner", "Snack"];
const ALL_SUITABLE_SLOTS = [
  "breakfast",
  "mid-morning",
  "lunch",
  "afternoon",
  "dinner",
  "evening",
  "snack",
  "pre-workout",
  "post-workout",
] as const;

const COOKING_TIME_OPTIONS: Array<{ value: number; labelKey: string }> = [
  { value: 15, labelKey: "cookingTimeUnder15" },
  { value: 30, labelKey: "cookingTimeUnder30" },
  { value: 60, labelKey: "cookingTimeUnder60" },
  { value: 120, labelKey: "cookingTimeUnder120" },
];

function normalizeSortMode(sortMode: SortOrder | null | undefined): SortOrder {
  if (
    sortMode === "titleAsc" ||
    sortMode === "titleDesc" ||
    sortMode === "dateAsc" ||
    sortMode === "dateDesc" ||
    sortMode === "none"
  ) {
    return sortMode;
  }

  return "none";
}

type FiltersPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function FiltersPanelContent({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { filters, setFilters, clearFilters } = useRecipesFiltersContext();
  const { user } = useUserContext();
  const trpc = useTRPC();
  const t = useTranslations("common.filters");
  const tActions = useTranslations("common.actions");
  const tRecipes = useTranslations("recipes.dashboard");
  const showRatings = getShowRatingsPreference(user);
  const showFavorites = getShowFavoritesPreference(user);

  const [tagFilter, setTagFilter] = useState("");
  const [workingTags, setWorkingTags] = useState<string[]>(filters.searchTags);
  const [workingCategories, setWorkingCategories] = useState<RecipeCategory[]>(filters.categories);
  const [workingSuitableSlots, setWorkingSuitableSlots] = useState<string[]>(filters.suitableSlots);
  const [workingSourceDomains, setWorkingSourceDomains] = useState<string[]>(filters.sourceDomains);
  const [localNutritionDetail, setLocalNutritionDetail] = useState<NutritionDetailFilter | null>(
    filters.nutritionDetail
  );
  const [localFilterMode, setLocalFilterMode] = useState<FilterMode>(filters.filterMode);
  const [localSortMode, setLocalSortMode] = useState<SortOrder>(
    normalizeSortMode(filters.sortMode)
  );
  const [localInput, setLocalInput] = useState(filters.rawInput);
  const [localFavoritesOnly, setLocalFavoritesOnly] = useState(filters.showFavoritesOnly);
  const [localMinRating, setLocalMinRating] = useState<number | null>(filters.minRating);
  const [localMaxCookingTime, setLocalMaxCookingTime] = useState<number | null>(
    filters.maxCookingTime ?? null
  );
  const [localMaxSodium, setLocalMaxSodium] = useState<string>(
    filters.maxSodium != null ? String(filters.maxSodium) : ""
  );
  const [localMaxCholesterol, setLocalMaxCholesterol] = useState<string>(
    filters.maxCholesterol != null ? String(filters.maxCholesterol) : ""
  );
  const [localMinFiber, setLocalMinFiber] = useState<string>(
    filters.minFiber != null ? String(filters.minFiber) : ""
  );

  const { tags: allTags, isLoading } = useTagsQuery();
  const { data: sourceOptions = [], isLoading: isLoadingSources } = useQuery(
    trpc.recipes.listSourceOptions.queryOptions()
  );

  useEffect(() => {
    setWorkingTags(filters.searchTags);
    setWorkingCategories(filters.categories);
    setWorkingSuitableSlots(filters.suitableSlots);
    setWorkingSourceDomains(filters.sourceDomains);
    setLocalNutritionDetail(filters.nutritionDetail);
    setLocalFilterMode(filters.filterMode);
    setLocalSortMode(normalizeSortMode(filters.sortMode));
    setLocalInput(filters.rawInput);
    setLocalFavoritesOnly(filters.showFavoritesOnly);
    setLocalMinRating(filters.minRating);
    setLocalMaxCookingTime(filters.maxCookingTime ?? null);
    setLocalMaxSodium(filters.maxSodium != null ? String(filters.maxSodium) : "");
    setLocalMaxCholesterol(filters.maxCholesterol != null ? String(filters.maxCholesterol) : "");
    setLocalMinFiber(filters.minFiber != null ? String(filters.minFiber) : "");
  }, [filters]);

  const toggleTag = useCallback((tag: string) => {
    setWorkingTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }, []);

  const toggleCategory = useCallback((category: RecipeCategory) => {
    setWorkingCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  }, []);

  const toggleSuitableSlot = useCallback((slot: string) => {
    setWorkingSuitableSlots((prev) =>
      prev.includes(slot) ? prev.filter((value) => value !== slot) : [...prev, slot]
    );
  }, []);

  const toggleSourceDomain = useCallback((sourceDomain: string) => {
    setWorkingSourceDomains((prev) =>
      prev.includes(sourceDomain)
        ? prev.filter((value) => value !== sourceDomain)
        : [...prev, sourceDomain]
    );
  }, []);

  const toggleCookingTime = useCallback((value: number) => {
    setLocalMaxCookingTime((prev) => (prev === value ? null : value));
  }, []);

  const decideSortOrder = (type: "title" | "date") => {
    const asc = `${type}Asc` as SortOrder;
    const desc = `${type}Desc` as SortOrder;

    if (localSortMode === asc) {
      setLocalSortMode(desc);

      return;
    }
    if (localSortMode === desc) {
      setLocalSortMode("none");

      return;
    }

    setLocalSortMode(asc);
  };

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleReset = useCallback(() => {
    clearFilters();
    setWorkingTags([]);
    setWorkingCategories([]);
    setWorkingSuitableSlots([]);
    setWorkingSourceDomains([]);
    setLocalNutritionDetail(null);
    setLocalFilterMode("AND");
    setLocalSortMode("dateDesc");
    setLocalInput("");
    setLocalFavoritesOnly(false);
    setLocalMinRating(null);
    setLocalMaxCookingTime(null);
    setLocalMaxSodium("");
    setLocalMaxCholesterol("");
    setLocalMinFiber("");
    close();
  }, [clearFilters, close]);

  const apply = useCallback(() => {
    const parsedMaxSodium = Number.parseFloat(localMaxSodium);
    const parsedMaxCholesterol = Number.parseFloat(localMaxCholesterol);
    const parsedMinFiber = Number.parseFloat(localMinFiber);

    setFilters({
      searchTags: [...workingTags],
      categories: [...workingCategories],
      suitableSlots: [...workingSuitableSlots],
      sourceDomains: [...workingSourceDomains],
      nutritionDetail: localNutritionDetail,
      filterMode: localFilterMode,
      sortMode: localSortMode,
      rawInput: localInput,
      showFavoritesOnly: showFavorites ? localFavoritesOnly : false,
      minRating: showRatings ? localMinRating : null,
      maxCookingTime: localMaxCookingTime,
      maxSodium: Number.isFinite(parsedMaxSodium) ? parsedMaxSodium : null,
      maxCholesterol: Number.isFinite(parsedMaxCholesterol) ? parsedMaxCholesterol : null,
      minFiber: Number.isFinite(parsedMinFiber) ? parsedMinFiber : null,
    });

    close();
  }, [
    setFilters,
    workingTags,
    workingCategories,
    workingSuitableSlots,
    workingSourceDomains,
    localNutritionDetail,
    localFilterMode,
    localSortMode,
    localInput,
    localFavoritesOnly,
    localMinRating,
    localMaxCookingTime,
    localMaxSodium,
    localMaxCholesterol,
    localMinFiber,
    showFavorites,
    showRatings,
    close,
  ]);

  return (
    <div className="flex flex-col gap-6">
      {/* Search */}
      <section>
        <h3 className="text-default-500 mb-2 text-[11px] font-medium tracking-wide uppercase">
          {t("search")}
        </h3>
        <TextField
          fullWidth
          aria-label={tRecipes("searchRecipesPlaceholder")}
          value={localInput}
          onChange={setLocalInput}
        >
          <InputGroup fullWidth className="rounded-full" variant="secondary">
            <InputGroup.Prefix>
              <MagnifyingGlassIcon className="text-default-400 h-4 w-4" />
            </InputGroup.Prefix>
            <InputGroup.Input placeholder={tRecipes("searchRecipesPlaceholder")} />
            {localInput ? (
              <InputGroup.Suffix>
                <button
                  aria-label="Clear search"
                  className="text-default-400 hover:text-foreground rounded-full p-1 transition-colors"
                  type="button"
                  onClick={() => setLocalInput("")}
                >
                  <XMarkIcon className="size-4" />
                </button>
              </InputGroup.Suffix>
            ) : null}
          </InputGroup>
        </TextField>
        <SearchFieldToggles className="mt-2" itemClassName="h-9 px-3 text-xs" />
      </section>

      {/* Sort */}
      <section>
        <h3 className="text-default-500 mb-2 text-[11px] font-medium tracking-wide uppercase">
          {t("sort")}
        </h3>
        <div className="flex gap-2">
          {[
            { key: "title", label: t("sortByTitle") },
            { key: "date", label: t("sortByDate") },
          ].map(({ key, label }) => {
            const isActive = localSortMode.startsWith(key) && localSortMode !== "none";
            const isAsc = localSortMode === `${key}Asc`;

            return (
              <Button
                key={key}
                className="h-9 rounded-full px-3 text-xs"
                size="sm"
                variant={isActive ? "primary" : "tertiary"}
                onPress={() => decideSortOrder(key as "title" | "date")}
              >
                <motion.span
                  animate={{
                    rotate: !isActive ? 0 : isAsc ? -90 : 90,
                  }}
                  className="inline-flex origin-center"
                  initial={false}
                  transition={{ type: "spring", stiffness: 340, damping: 26 }}
                >
                  <ArrowRightIcon className="size-3.5" />
                </motion.span>
                {label}
              </Button>
            );
          })}
        </div>
      </section>

      {/* Favorites & Rating */}
      {(showFavorites || showRatings) && (
        <section>
          <h3 className="text-default-500 mb-2 text-[11px] font-medium tracking-wide uppercase">
            {t("favoritesAndRating")}
          </h3>
          <div className="flex items-center gap-4">
            {showFavorites && (
              <Button
                className="h-9 rounded-full px-3 text-xs"
                size="sm"
                variant={localFavoritesOnly ? "danger" : "tertiary"}
                onPress={() => setLocalFavoritesOnly(!localFavoritesOnly)}
              >
                <HeartIcon className="size-3.5" />
                {t("favorites")}
              </Button>
            )}

            {showRatings && <RatingStars value={localMinRating} onChange={setLocalMinRating} />}
          </div>
        </section>
      )}

      {/* Cooking time */}
      <section>
        <h3 className="text-default-500 mb-2 text-[11px] font-medium tracking-wide uppercase">
          {t("cookingTime")}
        </h3>
        <div className="flex flex-wrap gap-2">
          {COOKING_TIME_OPTIONS.map(({ value, labelKey }) => {
            const active = localMaxCookingTime === value;

            return (
              <Button
                key={value}
                className="h-9 rounded-full px-3 text-xs"
                size="sm"
                variant={active ? "primary" : "tertiary"}
                onPress={() => toggleCookingTime(value)}
              >
                {t(labelKey)}
              </Button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-default-500 mb-2 text-[11px] font-medium tracking-wide uppercase">
          {t("nutrition")}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField fullWidth value={localMaxSodium} onChange={setLocalMaxSodium}>
            <Label>{t("maxSodium")}</Label>
            <InputGroup fullWidth variant="secondary">
              <InputGroup.Input type="number" />
              <InputGroup.Suffix>
                <span className="text-default-400 text-xs tracking-[0.12em] uppercase">mg</span>
              </InputGroup.Suffix>
            </InputGroup>
          </TextField>
          <TextField fullWidth value={localMaxCholesterol} onChange={setLocalMaxCholesterol}>
            <Label>{t("maxCholesterol")}</Label>
            <InputGroup fullWidth variant="secondary">
              <InputGroup.Input type="number" />
              <InputGroup.Suffix>
                <span className="text-default-400 text-xs tracking-[0.12em] uppercase">mg</span>
              </InputGroup.Suffix>
            </InputGroup>
          </TextField>
          <TextField fullWidth value={localMinFiber} onChange={setLocalMinFiber}>
            <Label>{t("minFiber")}</Label>
            <InputGroup fullWidth variant="secondary">
              <InputGroup.Input type="number" />
              <InputGroup.Suffix>
                <span className="text-default-400 text-xs tracking-[0.12em] uppercase">g</span>
              </InputGroup.Suffix>
            </InputGroup>
          </TextField>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { label: "Any detail", value: null },
            { label: "Core health data", value: "core" },
            { label: "Complete", value: "complete" },
            { label: "Missing core", value: "missingCore" },
          ].map(({ label, value }) => {
            const active = localNutritionDetail === value;

            return (
              <Button
                key={value ?? "any"}
                className="h-8 rounded-full px-3 text-xs"
                size="sm"
                variant={active ? "primary" : "tertiary"}
                onPress={() => setLocalNutritionDetail(value as NutritionDetailFilter | null)}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </section>

      {(isLoadingSources || sourceOptions.length > 0) && (
        <section>
          <h3 className="text-default-500 mb-2 text-[11px] font-medium tracking-wide uppercase">
            Source
          </h3>
          {isLoadingSources ? (
            <ChipSkeleton />
          ) : (
            <div className="flex max-h-[120px] flex-wrap gap-1 overflow-y-auto pr-1">
              {sourceOptions.map((source) => {
                const active = workingSourceDomains.includes(source.sourceDomain);
                const label = source.siteName || source.sourceDomain;

                return (
                  <Button
                    key={source.sourceDomain}
                    className="h-7 rounded-full px-2 text-[11px]"
                    size="sm"
                    variant={active ? "primary" : "tertiary"}
                    onPress={() => toggleSourceDomain(source.sourceDomain)}
                  >
                    {label} ({source.count})
                  </Button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Categories */}
      <section>
        <h3 className="text-default-500 mb-2 text-[11px] font-medium tracking-wide uppercase">
          {t("categories")}
        </h3>
        <div className="flex flex-wrap gap-1">
          {ALL_CATEGORIES.map((category) => {
            const active = workingCategories.includes(category);

            return (
              <Button
                key={category}
                className="h-7 rounded-full px-2 text-[11px]"
                size="sm"
                variant={active ? "primary" : "tertiary"}
                onPress={() => toggleCategory(category)}
              >
                {t(`category.${category.toLowerCase()}`)}
              </Button>
            );
          })}
        </div>
      </section>

      {/* Suitable slots */}
      <section>
        <h3 className="text-default-500 mb-2 text-[11px] font-medium tracking-wide uppercase">
          {t("suitableSlots")}
        </h3>
        <div className="flex flex-wrap gap-1">
          {ALL_SUITABLE_SLOTS.map((slot) => {
            const active = workingSuitableSlots.includes(slot);

            return (
              <Button
                key={slot}
                className="h-7 rounded-full px-2 text-[11px]"
                size="sm"
                variant={active ? "primary" : "tertiary"}
                onPress={() => toggleSuitableSlot(slot)}
              >
                {t(`slot.${slot}`)}
              </Button>
            );
          })}
        </div>
      </section>

      {/* Tags */}
      <section>
        <h3 className="text-default-500 mb-3 text-xs font-medium tracking-wide uppercase">
          {t("tags")}
        </h3>

        <div className="relative mb-3">
          <TextField
            fullWidth
            aria-label={t("searchTags")}
            value={tagFilter}
            onChange={setTagFilter}
          >
            <InputGroup fullWidth className="h-9 rounded-full" variant="secondary">
              <InputGroup.Prefix>
                <MagnifyingGlassIcon className="text-default-400 h-4 w-4" />
              </InputGroup.Prefix>
              <InputGroup.Input className="text-sm" placeholder={t("searchTags")} />
              {tagFilter ? (
                <InputGroup.Suffix>
                  <button
                    aria-label="Clear tag search"
                    className="text-default-400 hover:text-foreground rounded-full p-1 transition-colors"
                    type="button"
                    onClick={() => setTagFilter("")}
                  >
                    <XMarkIcon className="size-4" />
                  </button>
                </InputGroup.Suffix>
              ) : null}
            </InputGroup>
          </TextField>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-default-500 mr-1 text-[11px] font-medium tracking-wide uppercase">
            Tag matching
          </span>
          {[
            { label: "All tags", value: "AND" },
            { label: "Any tag", value: "OR" },
          ].map(({ label, value }) => (
            <Button
              key={value}
              className="h-8 rounded-full px-3 text-xs"
              size="sm"
              variant={localFilterMode === value ? "primary" : "tertiary"}
              onPress={() => setLocalFilterMode(value as FilterMode)}
            >
              {localFilterMode === value ? <CheckIcon className="size-3.5" /> : null}
              {label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <ChipSkeleton />
        ) : (
          <div className="flex max-h-[220px] flex-wrap gap-1 overflow-y-auto pr-1">
            {allTags
              .filter((tag) => tag.toLowerCase().includes(tagFilter.toLowerCase()))
              .map((tag) => {
                const active = workingTags.includes(tag);

                return (
                  <Button
                    key={tag}
                    className="h-7 rounded-full px-2 text-[11px]"
                    size="sm"
                    variant={active ? "primary" : "tertiary"}
                    onPress={() => toggleTag(tag)}
                  >
                    {tag}
                  </Button>
                );
              })}
          </div>
        )}
      </section>

      {/* Footer */}
      <div className="border-default-200/50 mt-auto flex justify-end gap-3 border-t pt-3">
        <Button className="rounded-full" size="sm" variant="danger-soft" onPress={handleReset}>
          <ArrowPathIcon className="size-4" />
          {tActions("reset")}
        </Button>
        <Button className="rounded-full" size="sm" variant="primary" onPress={apply}>
          <CheckIcon className="size-4" />
          {tActions("apply")}
        </Button>
      </div>
    </div>
  );
}

export default function FiltersPanel({ open, onOpenChange }: FiltersPanelProps) {
  const t = useTranslations("common.filters");
  const isDesktop = useIsDesktop();
  const modalState = useOverlayState({ isOpen: open, onOpenChange });
  const content = open ? <FiltersPanelContent onOpenChange={onOpenChange} /> : null;

  if (isDesktop) {
    return (
      <Modal state={modalState}>
        <Modal.Backdrop variant="blur">
          <Modal.Container placement="center" scroll="inside" size="lg">
            <Modal.Dialog className="max-w-lg">
              <Modal.CloseTrigger aria-label="Close filters" />
              <Modal.Header>
                <Modal.Heading>{t("title")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="max-h-[72vh] overflow-y-auto pb-6">{content}</Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    );
  }

  return (
    <Panel open={open} title={t("title")} onOpenChange={onOpenChange}>
      {content}
    </Panel>
  );
}
