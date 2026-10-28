export type WeeklyMealCandidate = {
  id: string;
  name: string;
  image: string | null;
  categories: string[];
  protein: number | null;
  calories: number | null;
  sodium: number | null;
  nutritionConfidence: number;
  totalMinutes: number | null;
  dietaryFlags: string[];
  cuisines: string[];
  recipeTypes: string[];
  suitableSlots: string[];
  fruitVegCount: number | null;
  isFreezerFriendly: boolean;
  tags: string[];
  ingredientNames: string[];
  householdFavoriteCount: number;
  householdAverageRating: number | null;
  lastCookedAt: Date | string | null;
  cookCount: number;
};

export type WeeklyMealTarget = {
  date: string;
  plannerSlotDefinitionId: string;
  slotKey: string;
  slotLabel: string;
};

export const weeklyPlanningModes = [
  "balanced",
  "quick-week",
  "meal-prep",
  "mediterranean",
] as const;

export type WeeklyPlanningMode = (typeof weeklyPlanningModes)[number];

export type WeeklyMealSuggestion = {
  date: string;
  plannerSlotDefinitionId: string;
  slotKey: string;
  slotLabel: string;
  recipe: {
    id: string;
    name: string;
    image: string | null;
    protein: number | null;
    sodium: number | null;
    totalMinutes: number | null;
    cuisines: string[];
    pantryIngredientNames: string[];
    additionalIngredientNames: string[];
  };
  reasons: string[];
  score: number;
};

export type WeeklyMealSuggestionOptions = {
  existingRecipeIds?: string[];
  mode?: WeeklyPlanningMode;
  proteinTarget?: number | null;
  seed?: number;
  today?: string;
  pantryIngredientNames?: string[];
};

type PreparedCandidate = {
  candidate: WeeklyMealCandidate;
  baseScore: number;
  ingredients: Set<string>;
  perishableIngredients: Set<string>;
  pantryIngredientNames: string[];
  additionalIngredientNames: string[];
  themeTokens: Set<string>;
  proteinGroup: string;
  slowCooker: boolean;
  mealPrep: boolean;
  mediterraneanStyle: boolean;
  easySodiumSwap: boolean;
};

type ScoredCandidate = {
  prepared: PreparedCandidate;
  score: number;
  sharedIngredientCount: number;
  sharedPerishableIngredientCount: number;
};

const QUALITY_WINDOW = 14;
const MAX_SHORTLIST_SIZE = 24;
const SCORE_TEMPERATURE = 7;

const SLOW_COOKER_PATTERN = /\b(?:slow[\s-]?cook(?:er|ed)?|crock[\s-]?pot)\b/i;
const MEAL_PREP_PATTERN = /\b(?:meal[\s-]?prep|make[\s-]?ahead|batch[\s-]?cook|freezer)\b/i;
const MEDITERRANEAN_CUISINE_PATTERN =
  /\b(?:mediterranean|greek|italian|spanish|turkish|levantine|lebanese|middle eastern|moroccan)\b/i;
const MEDITERRANEAN_INGREDIENT_PATTERN =
  /\b(?:olive oil|olives?|tomatoes?|chickpeas?|lentils?|beans?|aubergine|eggplant|courgette|zucchini|peppers?|spinach|whole grains?|bulgur|couscous|fish|salmon|sardines?|tuna|lemon|garlic|parsley|oregano|basil|tahini)\b/i;
const EASY_SODIUM_SWAP_PATTERN =
  /\b(?:salt|soy sauce|tamari|shoyu|broth|stock|bouillon|msg|monosodium glutamate|seasoning)\b/i;
const PANTRY_INGREDIENT_PATTERN =
  /^(?:water|salt|(?:black|white|ground) pepper|pepper|(?:olive|vegetable|canola|sesame|coconut) oil|oil|cooking spray|sugar|flour|cornstarch)$/i;
const PERISHABLE_INGREDIENT_PATTERN =
  /\b(?:apple|apricot|asparagus|aubergine|avocado|banana|beans?|beef|berries?|broccoli|cabbage|carrots?|cauliflower|celery|cheese|chicken|coriander|corn|courgette|cream|cucumber|egg|fish|garlic|ginger|grapes?|herbs?|kale|lamb|leeks?|lemon|lettuce|lime|mango|milk|mushrooms?|onions?|orange|parsley|peach|pears?|peas?|peppers?|pork|potatoes?|prawns?|pumpkin|salmon|spinach|spring onions?|squash|strawberries|tomatoes?|turkey|yogh?urt|zucchini)\b/i;

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const MEAL_THEME_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "baked",
  "beef",
  "best",
  "bowl",
  "bowls",
  "chicken",
  "cook",
  "cooker",
  "crock",
  "crockpot",
  "dinner",
  "dish",
  "easy",
  "for",
  "free",
  "fresh",
  "grilled",
  "healthy",
  "homemade",
  "in",
  "instant",
  "lamb",
  "low",
  "meal",
  "of",
  "one",
  "option",
  "pan",
  "pork",
  "pot",
  "prep",
  "quick",
  "recipe",
  "roasted",
  "salmon",
  "simple",
  "skillet",
  "slow",
  "sodium",
  "style",
  "the",
  "turkey",
  "vegan",
  "vegetarian",
  "with",
]);

function getMealThemeTokens(name: string): Set<string> {
  return new Set(
    normalizeText(name)
      .match(/[a-z0-9]+/g)
      ?.filter((token) => token.length >= 3 && !MEAL_THEME_STOP_WORDS.has(token))
      .map((token) => (token.endsWith("s") ? token.slice(0, -1) : token)) ?? []
  );
}

function hasSimilarMealTheme(left: Set<string>, right: Set<string>): boolean {
  if (left.size === 0 || right.size === 0) return false;

  const sharedCount = Array.from(left).filter((token) => right.has(token)).length;

  return sharedCount >= 2 || (sharedCount === 1 && Math.min(left.size, right.size) === 1);
}

function normalizeIngredient(value: string): string | null {
  const normalized = normalizeText(value)
    .replace(/\([^)]*\)/g, " ")
    .replace(
      /\b(?:fresh|frozen|canned|tinned|chopped|diced|sliced|grated|minced|drained|rinsed)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || normalized.length < 3 || PANTRY_INGREDIENT_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

function stableVariation(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) % 1000) / 1000;
}

function pickWeightedCandidate(candidates: ScoredCandidate[], seedKey: string) {
  const ranked = [...candidates].sort(
    (left, right) =>
      right.score - left.score ||
      left.prepared.candidate.id.localeCompare(right.prepared.candidate.id)
  );
  const bestScore = ranked[0]?.score;

  if (bestScore == null) return null;

  const shortlist = ranked
    .filter((candidate) => candidate.score >= bestScore - QUALITY_WINDOW)
    .slice(0, MAX_SHORTLIST_SIZE);
  const weighted = shortlist.map((candidate) => ({
    candidate,
    weight: Math.exp((candidate.score - bestScore) / SCORE_TEMPERATURE),
  }));
  const totalWeight = weighted.reduce((total, entry) => total + entry.weight, 0);
  let selection = stableVariation(seedKey) * totalWeight;

  for (const entry of weighted) {
    selection -= entry.weight;
    if (selection <= 0) return entry.candidate;
  }

  return weighted.at(-1)?.candidate ?? null;
}

function getProteinGroup(candidate: WeeklyMealCandidate): string {
  const dietaryFlags = candidate.dietaryFlags.map(normalizeText);

  if (dietaryFlags.includes("vegan") || dietaryFlags.includes("vegetarian")) {
    return "plant";
  }

  const corpus =
    candidate.name + " " + candidate.tags.join(" ") + " " + candidate.ingredientNames.join(" ");

  if (/\b(?:salmon|tuna|cod|haddock|tilapia|shrimp|prawn|fish|seafood)\b/i.test(corpus)) {
    return "seafood";
  }
  if (/\bturkey\b/i.test(corpus)) return "turkey";
  if (/\bchicken\b/i.test(corpus)) return "chicken";
  if (/\b(?:beef|steak|ground beef|brisket)\b/i.test(corpus)) return "beef";
  if (/\blamb\b/i.test(corpus)) return "lamb";
  if (/\b(?:pork|ham|bacon|sausage)\b/i.test(corpus)) return "pork";
  if (/\b(?:tofu|tempeh|lentils?|chickpeas?|beans?)\b/i.test(corpus)) return "plant";

  return "mixed";
}

function isRedMeat(group: string): boolean {
  return group === "beef" || group === "lamb" || group === "pork";
}

function isCandidateSuitableForTarget(
  candidate: WeeklyMealCandidate,
  target: WeeklyMealTarget
): boolean {
  const slotKey = normalizeText(target.slotKey);
  const suitableSlots = candidate.suitableSlots.map(normalizeText);

  if (suitableSlots.length > 0) return suitableSlots.includes(slotKey);

  return candidate.categories.some((category) => normalizeText(category) === slotKey);
}

function isMediterraneanStyle(candidate: WeeklyMealCandidate): boolean {
  const identity = [candidate.name, ...candidate.cuisines, ...candidate.tags].join(" ");

  if (MEDITERRANEAN_CUISINE_PATTERN.test(identity)) return true;

  const matchingIngredients = candidate.ingredientNames.filter((ingredient) =>
    MEDITERRANEAN_INGREDIENT_PATTERN.test(ingredient)
  );

  return matchingIngredients.length >= 3;
}

function daysSinceCooked(value: Date | string | null, today: string): number | null {
  if (!value) return null;

  const cookedAt = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(cookedAt.getTime())) return null;

  return Math.max(0, (new Date(today + "T12:00:00Z").getTime() - cookedAt.getTime()) / 86_400_000);
}

function prepareCandidate(
  candidate: WeeklyMealCandidate,
  mode: WeeklyPlanningMode,
  proteinTarget: number,
  today: string,
  pantryIngredients: ReadonlySet<string>
): PreparedCandidate {
  const corpus = candidate.name + " " + candidate.tags.join(" ");
  const dietaryFlags = candidate.dietaryFlags.map(normalizeText);
  const ingredients = new Set(
    candidate.ingredientNames
      .map(normalizeIngredient)
      .filter((ingredient): ingredient is string => ingredient !== null)
  );
  const perishableIngredients = new Set(
    Array.from(ingredients).filter((ingredient) => PERISHABLE_INGREDIENT_PATTERN.test(ingredient))
  );
  const pantryIngredientNames = Array.from(ingredients).filter((ingredient) =>
    pantryIngredients.has(ingredient)
  );
  const additionalIngredientNames = Array.from(ingredients).filter(
    (ingredient) => !pantryIngredients.has(ingredient)
  );
  const slowCooker = SLOW_COOKER_PATTERN.test(corpus);
  const mealPrep = candidate.isFreezerFriendly || MEAL_PREP_PATTERN.test(corpus);
  const mediterraneanStyle = isMediterraneanStyle(candidate);
  const easySodiumSwap = candidate.ingredientNames.some((name) =>
    EASY_SODIUM_SWAP_PATTERN.test(name)
  );
  const proteinGroup = getProteinGroup(candidate);
  const nutritionConfidence = candidate.nutritionConfidence;
  let baseScore = 0;

  if (candidate.protein != null) {
    baseScore += Math.min(candidate.protein / proteinTarget, 1.6) * 22 * nutritionConfidence;
  }

  if (candidate.sodium != null) {
    if (candidate.sodium <= 350) baseScore += 22 * nutritionConfidence;
    else if (candidate.sodium <= 600) baseScore += 18 * nutritionConfidence;
    else if (candidate.sodium <= 800) baseScore += 11 * nutritionConfidence;
    else if (candidate.sodium <= 1000) baseScore += (easySodiumSwap ? 8 : 3) * nutritionConfidence;
    else if (candidate.sodium <= 1300)
      baseScore += (easySodiumSwap ? -2 : -12) * nutritionConfidence;
    else baseScore += (easySodiumSwap ? -14 : -26) * nutritionConfidence;
  }

  if (dietaryFlags.includes("dairy-free")) baseScore += 10;
  else if (dietaryFlags.includes("dairy-free-possible")) baseScore += 3;

  if (dietaryFlags.includes("high-protein")) baseScore += 5;
  if (proteinGroup === "plant" || proteinGroup === "seafood") baseScore += 5;
  if (isRedMeat(proteinGroup)) baseScore -= 4;

  if (candidate.fruitVegCount != null) {
    baseScore += Math.min(candidate.fruitVegCount, 4) * 2;
  }

  if (candidate.cuisines.some((cuisine) => /\b(?:mediterranean|greek)\b/i.test(cuisine))) {
    baseScore += 4;
  }

  baseScore += Math.min(pantryIngredientNames.length, 5) * 2;

  baseScore += Math.min(candidate.householdFavoriteCount, 2) * 16;

  if (candidate.householdAverageRating != null) {
    if (candidate.householdAverageRating >= 4.5) baseScore += 18;
    else if (candidate.householdAverageRating >= 4) baseScore += 12;
    else if (candidate.householdAverageRating >= 3) baseScore += 3;
    else baseScore -= 24;
  }

  const daysSince = daysSinceCooked(candidate.lastCookedAt, today);

  if (daysSince != null) {
    if (daysSince < 7) baseScore -= 52;
    else if (daysSince < 14) baseScore -= 30;
    else if (daysSince < 28) baseScore -= 12;
  }

  if (slowCooker) baseScore += 2;
  if (mealPrep) baseScore += 7;

  if (mode === "quick-week") {
    if (candidate.totalMinutes == null) baseScore -= 3;
    else if (candidate.totalMinutes <= 25) baseScore += 30;
    else if (candidate.totalMinutes <= 35) baseScore += 22;
    else if (candidate.totalMinutes <= 45) baseScore += 10;
    else if (candidate.totalMinutes > 90) baseScore -= 30;
    else if (candidate.totalMinutes > 60) baseScore -= 16;

    if (slowCooker) baseScore -= 18;
  } else if (mode === "meal-prep") {
    if (mealPrep) baseScore += 28;
    if (candidate.isFreezerFriendly) baseScore += 8;
    if (slowCooker) baseScore += 8;
  } else if (mode === "mediterranean") {
    if (mediterraneanStyle) baseScore += 30;
    if (proteinGroup === "plant" || proteinGroup === "seafood") baseScore += 15;
    if (isRedMeat(proteinGroup)) baseScore -= 20;

    if (candidate.fruitVegCount != null) {
      baseScore += Math.min(candidate.fruitVegCount, 5) * 2;
    }
  }

  return {
    candidate,
    baseScore,
    ingredients,
    perishableIngredients,
    pantryIngredientNames,
    additionalIngredientNames,
    themeTokens: getMealThemeTokens(candidate.name),
    proteinGroup,
    slowCooker,
    mealPrep,
    mediterraneanStyle,
    easySodiumSwap,
  };
}

function buildReasons(
  prepared: PreparedCandidate,
  sharedIngredientCount: number,
  sharedPerishableIngredientCount: number,
  mode: WeeklyPlanningMode
): string[] {
  const { candidate } = prepared;
  const reasons: string[] = [];

  if (candidate.householdFavoriteCount > 0) reasons.push("Household favourite");
  if ((candidate.householdAverageRating ?? 0) >= 4) reasons.push("Highly rated");
  if (prepared.pantryIngredientNames.length > 0) {
    reasons.push(
      `Uses ${prepared.pantryIngredientNames.length} pantry ${prepared.pantryIngredientNames.length === 1 ? "item" : "items"}`
    );
  }
  if ((candidate.protein ?? 0) >= 25) reasons.push("High protein");
  if (candidate.sodium != null && candidate.sodium <= 600) reasons.push("Lower sodium");
  else if (candidate.sodium != null && candidate.sodium > 800 && prepared.easySodiumSwap) {
    reasons.push("Simple sodium swaps");
  }
  if (prepared.slowCooker) reasons.push("Slow cooker");
  if (prepared.mealPrep) reasons.push("Meal prep");
  if (mode === "quick-week" && (candidate.totalMinutes ?? Infinity) <= 35) {
    reasons.push("Quick dinner");
  }
  if (mode === "mediterranean" && prepared.mediterraneanStyle) {
    reasons.push("Mediterranean-style");
  }
  if (candidate.dietaryFlags.some((flag) => normalizeText(flag) === "dairy-free")) {
    reasons.push("Dairy-free");
  }
  if (sharedPerishableIngredientCount > 0) reasons.push("Reuses fresh ingredients");
  else if (sharedIngredientCount >= 2) reasons.push("Shared ingredients");

  return reasons.slice(0, 5);
}

export function buildWeeklyMealSuggestions(
  candidates: WeeklyMealCandidate[],
  targets: WeeklyMealTarget[],
  options: WeeklyMealSuggestionOptions = {}
): WeeklyMealSuggestion[] {
  if (candidates.length === 0 || targets.length === 0) return [];

  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const mode = options.mode ?? "balanced";
  const proteinTarget = Math.min(45, Math.max(20, (options.proteinTarget ?? 75) / 3));
  const pantryIngredients = new Set(
    (options.pantryIngredientNames ?? [])
      .map(normalizeIngredient)
      .filter((ingredient): ingredient is string => ingredient !== null)
  );
  const preparedCandidates = candidates.map((candidate) =>
    prepareCandidate(candidate, mode, proteinTarget, today, pantryIngredients)
  );
  const preparedById = new Map(
    preparedCandidates.map((candidate) => [candidate.candidate.id, candidate])
  );
  const usedRecipeIds = new Set(options.existingRecipeIds ?? []);
  const sharedIngredients = new Set<string>();
  const sharedPerishableIngredients = new Set<string>();
  const cuisineCounts = new Map<string, number>();
  const proteinCounts = new Map<string, number>();
  const existingMeals = Array.from(usedRecipeIds)
    .map((recipeId) => preparedById.get(recipeId))
    .filter((candidate): candidate is PreparedCandidate => Boolean(candidate));

  for (const existing of existingMeals) {
    for (const ingredient of existing.ingredients) sharedIngredients.add(ingredient);
    for (const ingredient of existing.perishableIngredients) {
      sharedPerishableIngredients.add(ingredient);
    }
    for (const cuisine of existing.candidate.cuisines.map(normalizeText)) {
      cuisineCounts.set(cuisine, (cuisineCounts.get(cuisine) ?? 0) + 1);
    }
    proteinCounts.set(existing.proteinGroup, (proteinCounts.get(existing.proteinGroup) ?? 0) + 1);
  }

  const selectedMealThemes = existingMeals
    .map((meal) => meal.themeTokens)
    .filter((theme) => theme.size > 0);
  let slowCookerCount = existingMeals.filter((meal) => meal.slowCooker).length;
  let previousProteinGroup = existingMeals.at(-1)?.proteinGroup ?? null;
  const suggestions: WeeklyMealSuggestion[] = [];

  for (const target of [...targets].sort((left, right) => left.date.localeCompare(right.date))) {
    const dayOfWeek = new Date(target.date + "T12:00:00Z").getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const scoredCandidates: ScoredCandidate[] = [];

    for (const prepared of preparedCandidates) {
      if (usedRecipeIds.has(prepared.candidate.id)) continue;
      if (!isCandidateSuitableForTarget(prepared.candidate, target)) continue;
      if (selectedMealThemes.some((theme) => hasSimilarMealTheme(theme, prepared.themeTokens))) {
        continue;
      }

      const sharedIngredientCount = Array.from(prepared.ingredients).filter((ingredient) =>
        sharedIngredients.has(ingredient)
      ).length;
      const sharedPerishableIngredientCount = Array.from(prepared.perishableIngredients).filter(
        (ingredient) => sharedPerishableIngredients.has(ingredient)
      ).length;
      const existingCuisineCount = Math.max(
        0,
        ...prepared.candidate.cuisines.map(
          (cuisine) => cuisineCounts.get(normalizeText(cuisine)) ?? 0
        )
      );
      const existingProteinCount = proteinCounts.get(prepared.proteinGroup) ?? 0;
      let score = prepared.baseScore;

      score += Math.min(sharedIngredientCount, 3) * 4;
      score += Math.min(sharedPerishableIngredientCount, 2) * 3;

      if (mode === "meal-prep") {
        score += Math.min(sharedIngredientCount, 4) * 3;
        score += Math.min(sharedPerishableIngredientCount, 3) * 3;
      }
      score -= Math.min(existingCuisineCount, 3) * 12;
      score -= existingProteinCount * 5;

      if (prepared.proteinGroup === previousProteinGroup && prepared.proteinGroup !== "mixed") {
        score -= 14;
      }

      if (isRedMeat(prepared.proteinGroup)) {
        const redMeatCount = Array.from(proteinCounts.entries())
          .filter(([group]) => isRedMeat(group))
          .reduce((total, [, count]) => total + count, 0);

        if (redMeatCount >= 2) score -= 36;
        else if (redMeatCount >= 1) score -= 10;

        if (mode === "mediterranean" && redMeatCount >= 1) score -= 24;
      }

      if (prepared.slowCooker && !isWeekend && slowCookerCount === 0) score += 3;
      if (prepared.slowCooker && slowCookerCount >= 2) score -= 60;
      else if (prepared.slowCooker && slowCookerCount >= 1) score -= 30;
      if (prepared.mealPrep && dayOfWeek === 0) score += 9;
      if (
        !isWeekend &&
        prepared.candidate.totalMinutes != null &&
        prepared.candidate.totalMinutes <= 45
      ) {
        score += 6;
      }

      scoredCandidates.push({
        prepared,
        score,
        sharedIngredientCount,
        sharedPerishableIngredientCount,
      });
    }

    const best = pickWeightedCandidate(
      scoredCandidates,
      String(options.seed ?? 0) + ":" + target.date + ":pick"
    );

    if (!best) break;

    const { candidate } = best.prepared;

    suggestions.push({
      date: target.date,
      plannerSlotDefinitionId: target.plannerSlotDefinitionId,
      slotKey: target.slotKey,
      slotLabel: target.slotLabel,
      recipe: {
        id: candidate.id,
        name: candidate.name,
        image: candidate.image,
        protein: candidate.protein,
        sodium: candidate.sodium,
        totalMinutes: candidate.totalMinutes,
        cuisines: candidate.cuisines,
        pantryIngredientNames: best.prepared.pantryIngredientNames,
        additionalIngredientNames: best.prepared.additionalIngredientNames,
      },
      reasons: buildReasons(
        best.prepared,
        best.sharedIngredientCount,
        best.sharedPerishableIngredientCount,
        mode
      ),
      score: Math.round(best.score * 100) / 100,
    });

    usedRecipeIds.add(candidate.id);
    previousProteinGroup = best.prepared.proteinGroup;
    if (best.prepared.themeTokens.size > 0) selectedMealThemes.push(best.prepared.themeTokens);
    if (best.prepared.slowCooker) slowCookerCount += 1;

    for (const ingredient of best.prepared.ingredients) sharedIngredients.add(ingredient);
    for (const ingredient of best.prepared.perishableIngredients) {
      sharedPerishableIngredients.add(ingredient);
    }
    for (const cuisine of candidate.cuisines.map(normalizeText)) {
      cuisineCounts.set(cuisine, (cuisineCounts.get(cuisine) ?? 0) + 1);
    }
    proteinCounts.set(
      best.prepared.proteinGroup,
      (proteinCounts.get(best.prepared.proteinGroup) ?? 0) + 1
    );
  }

  return suggestions;
}
