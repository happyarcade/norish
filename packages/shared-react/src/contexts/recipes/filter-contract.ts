import {
  DEFAULT_SEARCH_FIELDS,
  FilterMode,
  NutritionDetailFilter,
  RecipeCategory,
  SEARCH_FIELDS,
  SearchField,
  SortOrder,
} from "@norish/shared/contracts";

export type CanonicalRecipeFilters = {
  rawInput: string;
  searchTags: string[];
  searchFields: SearchField[];
  filterMode: FilterMode;
  sortMode: SortOrder;
  showFavoritesOnly: boolean;
  minRating: number | null;
  maxCookingTime: number | null;
  maxSodium: number | null;
  maxCholesterol: number | null;
  minFiber: number | null;
  sourceDomains: string[];
  nutritionDetail: NutritionDetailFilter | null;
  categories: RecipeCategory[];
  suitableSlots: string[];
};

export type PersistedRecipeFilters = Omit<CanonicalRecipeFilters, "rawInput">;

export type RecipeFilterPreset = {
  id: string;
  label: string;
  apply: (filters: CanonicalRecipeFilters) => CanonicalRecipeFilters;
  isActive: (filters: CanonicalRecipeFilters) => boolean;
};

const VALID_CATEGORIES: RecipeCategory[] = ["Breakfast", "Lunch", "Dinner", "Snack"];
const VALID_SUITABLE_SLOTS = [
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
const VALID_SORT_MODES: SortOrder[] = ["titleAsc", "titleDesc", "dateAsc", "dateDesc", "none"];
const VALID_FILTER_MODES: FilterMode[] = ["AND", "OR"];
const VALID_NUTRITION_DETAIL_FILTERS: NutritionDetailFilter[] = ["core", "complete", "missingCore"];

export const DEFAULT_PERSISTED_RECIPE_FILTERS: PersistedRecipeFilters = {
  searchTags: [],
  searchFields: [...DEFAULT_SEARCH_FIELDS],
  filterMode: "AND",
  sortMode: "dateDesc",
  showFavoritesOnly: false,
  minRating: null,
  maxCookingTime: null,
  maxSodium: null,
  maxCholesterol: null,
  minFiber: null,
  sourceDomains: [],
  nutritionDetail: null,
  categories: [],
  suitableSlots: [],
};

export const DEFAULT_RECIPE_FILTERS: CanonicalRecipeFilters = {
  rawInput: "",
  ...DEFAULT_PERSISTED_RECIPE_FILTERS,
};

export const RECIPE_COOKING_TIME_OPTIONS: Array<{ label: string; value: number }> = [
  { label: "< 15 min", value: 15 },
  { label: "< 30 min", value: 30 },
  { label: "< 60 min", value: 60 },
  { label: "< 2 hrs", value: 120 },
];

export const RECIPE_CATEGORY_OPTIONS: readonly RecipeCategory[] = VALID_CATEGORIES;

export function normalizePersistedRecipeFilters(data: unknown): PersistedRecipeFilters | null {
  if (typeof data !== "object" || data === null) return null;

  const d = data as Record<string, unknown>;
  const sortMode = VALID_SORT_MODES.includes(d.sortMode as SortOrder)
    ? (d.sortMode as SortOrder)
    : null;
  const filterMode = VALID_FILTER_MODES.includes(d.filterMode as FilterMode)
    ? (d.filterMode as FilterMode)
    : null;
  const searchTags = Array.isArray(d.searchTags)
    ? d.searchTags.filter((tag): tag is string => typeof tag === "string")
    : null;
  const searchFields = Array.isArray(d.searchFields)
    ? d.searchFields.filter((field): field is SearchField =>
        SEARCH_FIELDS.includes(field as SearchField)
      )
    : null;
  const showFavoritesOnly = typeof d.showFavoritesOnly === "boolean" ? d.showFavoritesOnly : null;
  const minRating =
    d.minRating === null || (typeof d.minRating === "number" && d.minRating >= 0)
      ? (d.minRating as number | null)
      : null;
  const maxCookingTime =
    d.maxCookingTime === null || (typeof d.maxCookingTime === "number" && d.maxCookingTime > 0)
      ? (d.maxCookingTime as number | null)
      : null;
  const maxSodium =
    d.maxSodium === null || (typeof d.maxSodium === "number" && d.maxSodium >= 0)
      ? (d.maxSodium as number | null)
      : null;
  const maxCholesterol =
    d.maxCholesterol === null || (typeof d.maxCholesterol === "number" && d.maxCholesterol >= 0)
      ? (d.maxCholesterol as number | null)
      : null;
  const minFiber =
    d.minFiber === null || (typeof d.minFiber === "number" && d.minFiber >= 0)
      ? (d.minFiber as number | null)
      : null;
  const sourceDomains = Array.isArray(d.sourceDomains)
    ? d.sourceDomains.filter(
        (sourceDomain): sourceDomain is string =>
          typeof sourceDomain === "string" && sourceDomain.trim().length > 0
      )
    : null;
  const normalizedNutritionDetail =
    d.nutritionDetail === "extended"
      ? "core"
      : d.nutritionDetail === "missingExtended"
        ? "missingCore"
        : d.nutritionDetail;
  const nutritionDetail =
    normalizedNutritionDetail === null ||
    VALID_NUTRITION_DETAIL_FILTERS.includes(normalizedNutritionDetail as NutritionDetailFilter)
      ? (normalizedNutritionDetail as NutritionDetailFilter | null)
      : null;
  const categories = Array.isArray(d.categories)
    ? d.categories.filter((category): category is RecipeCategory =>
        VALID_CATEGORIES.includes(category as RecipeCategory)
      )
    : null;
  const suitableSlots = Array.isArray(d.suitableSlots)
    ? d.suitableSlots.filter(
        (slot): slot is (typeof VALID_SUITABLE_SLOTS)[number] =>
          typeof slot === "string" &&
          VALID_SUITABLE_SLOTS.includes(slot as (typeof VALID_SUITABLE_SLOTS)[number])
      )
    : null;

  if (sortMode === null && filterMode === null && searchFields === null) return null;

  return {
    sortMode: sortMode ?? DEFAULT_PERSISTED_RECIPE_FILTERS.sortMode,
    filterMode: filterMode ?? DEFAULT_PERSISTED_RECIPE_FILTERS.filterMode,
    searchTags: searchTags ?? DEFAULT_PERSISTED_RECIPE_FILTERS.searchTags,
    searchFields: searchFields ?? [...DEFAULT_PERSISTED_RECIPE_FILTERS.searchFields],
    showFavoritesOnly: showFavoritesOnly ?? DEFAULT_PERSISTED_RECIPE_FILTERS.showFavoritesOnly,
    minRating: minRating ?? DEFAULT_PERSISTED_RECIPE_FILTERS.minRating,
    maxCookingTime: maxCookingTime ?? DEFAULT_PERSISTED_RECIPE_FILTERS.maxCookingTime,
    maxSodium: maxSodium ?? DEFAULT_PERSISTED_RECIPE_FILTERS.maxSodium,
    maxCholesterol: maxCholesterol ?? DEFAULT_PERSISTED_RECIPE_FILTERS.maxCholesterol,
    minFiber: minFiber ?? DEFAULT_PERSISTED_RECIPE_FILTERS.minFiber,
    sourceDomains: sourceDomains ?? DEFAULT_PERSISTED_RECIPE_FILTERS.sourceDomains,
    nutritionDetail: nutritionDetail ?? DEFAULT_PERSISTED_RECIPE_FILTERS.nutritionDetail,
    categories: categories ?? DEFAULT_PERSISTED_RECIPE_FILTERS.categories,
    suitableSlots: suitableSlots ?? DEFAULT_PERSISTED_RECIPE_FILTERS.suitableSlots,
  };
}

export function hasAppliedRecipeFilters(filters: CanonicalRecipeFilters): boolean {
  return (
    filters.rawInput.trim().length > 0 ||
    filters.searchTags.length > 0 ||
    filters.categories.length > 0 ||
    filters.suitableSlots.length > 0 ||
    filters.showFavoritesOnly ||
    filters.minRating !== null ||
    filters.maxCookingTime !== null ||
    filters.maxSodium !== null ||
    filters.maxCholesterol !== null ||
    filters.minFiber !== null ||
    filters.sourceDomains.length > 0 ||
    filters.nutritionDetail !== null
  );
}

export function toRecipesQueryFilters(filters: CanonicalRecipeFilters) {
  return {
    search: filters.rawInput || undefined,
    searchFields: filters.searchFields,
    tags: filters.searchTags.length > 0 ? filters.searchTags : undefined,
    categories: filters.categories.length > 0 ? filters.categories : undefined,
    suitableSlots: filters.suitableSlots.length > 0 ? filters.suitableSlots : undefined,
    filterMode: filters.filterMode,
    sortMode: filters.sortMode,
    minRating: filters.minRating ?? undefined,
    maxCookingTime: filters.maxCookingTime ?? undefined,
    maxSodium: filters.maxSodium ?? undefined,
    maxCholesterol: filters.maxCholesterol ?? undefined,
    minFiber: filters.minFiber ?? undefined,
    sourceDomains: filters.sourceDomains.length > 0 ? filters.sourceDomains : undefined,
    nutritionDetail: filters.nutritionDetail ?? undefined,
  };
}

export function serializeRecipeFilters(filters: CanonicalRecipeFilters) {
  const queryFilters = toRecipesQueryFilters(filters);

  return JSON.stringify(queryFilters);
}

function toggleFilterValue(values: string[], value: string): string[] {
  const normalizedValue = value.toLowerCase();
  const isActive = values.some((entry) => entry.toLowerCase() === normalizedValue);

  return isActive
    ? values.filter((entry) => entry.toLowerCase() !== normalizedValue)
    : [...values, value];
}

function includesFilterValue(values: string[], value: string): boolean {
  const normalizedValue = value.toLowerCase();

  return values.some((entry) => entry.toLowerCase() === normalizedValue);
}

export const RECIPE_FILTER_PRESETS: RecipeFilterPreset[] = [
  {
    id: "quick",
    label: "Quick (<30 min)",
    apply: (filters) => ({
      ...filters,
      maxCookingTime: filters.maxCookingTime !== null && filters.maxCookingTime <= 30 ? null : 30,
    }),
    isActive: (filters) => filters.maxCookingTime !== null && filters.maxCookingTime <= 30,
  },
  {
    id: "meal-prep",
    label: "Meal Prep",
    apply: (filters) => ({
      ...filters,
      searchTags: toggleFilterValue(filters.searchTags, "meal prep"),
    }),
    isActive: (filters) => includesFilterValue(filters.searchTags, "meal prep"),
  },
  {
    id: "slow-cooker",
    label: "Slow Cooker",
    apply: (filters) => ({
      ...filters,
      searchTags: toggleFilterValue(filters.searchTags, "slow cooker"),
    }),
    isActive: (filters) => includesFilterValue(filters.searchTags, "slow cooker"),
  },
  {
    id: "dinner",
    label: "Dinner",
    apply: (filters) => ({
      ...filters,
      categories: toggleFilterValue(filters.categories, "Dinner") as RecipeCategory[],
    }),
    isActive: (filters) => includesFilterValue(filters.categories, "Dinner"),
  },
  {
    id: "breakfast",
    label: "Breakfast",
    apply: (filters) => ({
      ...filters,
      categories: toggleFilterValue(filters.categories, "Breakfast") as RecipeCategory[],
    }),
    isActive: (filters) => includesFilterValue(filters.categories, "Breakfast"),
  },
  {
    id: "lunch",
    label: "Lunch",
    apply: (filters) => ({
      ...filters,
      categories: toggleFilterValue(filters.categories, "Lunch") as RecipeCategory[],
    }),
    isActive: (filters) => includesFilterValue(filters.categories, "Lunch"),
  },
  {
    id: "vegetarian",
    label: "Vegetarian",
    apply: (filters) => ({
      ...filters,
      searchTags: toggleFilterValue(filters.searchTags, "vegetarian"),
    }),
    isActive: (filters) => includesFilterValue(filters.searchTags, "vegetarian"),
  },
  {
    id: "dairy-free",
    label: "Dairy Free",
    apply: (filters) => ({
      ...filters,
      searchTags: toggleFilterValue(filters.searchTags, "dairy-free"),
    }),
    isActive: (filters) => includesFilterValue(filters.searchTags, "dairy-free"),
  },
  {
    id: "dairy-free-possible",
    label: "Dairy-free possible",
    apply: (filters) => ({
      ...filters,
      searchTags: toggleFilterValue(filters.searchTags, "dairy-free-possible"),
    }),
    isActive: (filters) => includesFilterValue(filters.searchTags, "dairy-free-possible"),
  },
  {
    id: "low-sodium",
    label: "< 1,000 mg sodium",
    apply: (filters) => ({
      ...filters,
      maxSodium: filters.maxSodium !== null && filters.maxSodium <= 1000 ? null : 1000,
    }),
    isActive: (filters) => filters.maxSodium !== null && filters.maxSodium <= 1000,
  },
  {
    id: "favorites",
    label: "Favorites",
    apply: (filters) => ({ ...filters, showFavoritesOnly: !filters.showFavoritesOnly }),
    isActive: (filters) => filters.showFavoritesOnly,
  },
];
