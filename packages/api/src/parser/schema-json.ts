import { createHash } from "crypto";
import { decode } from "html-entities";

import type { FullRecipeInsertDTO, RecipeCategory } from "@norish/shared/contracts/dto/recipe";
import { getUnits } from "@norish/config/server-config-loader";
import { parseIsoDuration } from "@norish/shared/lib/helpers";
import { getCanonicalCookingMethodTags } from "@norish/shared/lib/recipe-tag-aliases";

import {
  classifyDairyAdaptation,
  getServings,
  normalizeNutritionMetricForStorage,
  parseImages,
  parseIngredients,
  parseNutritionValue,
  parseSteps,
} from "./parsers";

export interface SchemaJsonImportSource {
  sourceType: "schema_org";
  sourceUrl: string | null;
  sourceDomain: string | null;
  siteName: string | null;
  author: string | null;
  language: string | null;
  rawPayload: unknown;
}

export interface SchemaJsonPlannerProfile {
  mealTypes: string[];
  suitableSlots: string[];
  recipeTypes: string[];
  dietaryFlags: string[];
  allergenFlags: string[];
  cuisines: string[];
  heatLevel: string | null;
  prepScore: number | null;
  fruitVegCount: number | null;
  isDivisible: boolean;
  isFreezerFriendly: boolean;
  sourceYield: string | null;
}

export interface SchemaJsonImportReview {
  sourceFingerprint: string;
  needsReview: boolean;
  issues: string[];
  confidenceByField: Record<string, number>;
  inferredData: Record<string, unknown>;
  reviewOverrides: Record<string, unknown>;
}

export interface SchemaJsonImportResult {
  recipe: FullRecipeInsertDTO;
  source: SchemaJsonImportSource;
  plannerProfile: SchemaJsonPlannerProfile;
  importReview: SchemaJsonImportReview;
}

interface NormalizeSchemaJsonOptions {
  sourceFilePath?: string;
  recipeId?: string;
  downloadImages?: boolean;
}

const CATEGORY_MAP: Record<string, RecipeCategory> = {
  breakfast: "Breakfast",
  brunch: "Breakfast",
  "morning meal": "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  supper: "Dinner",
  main: "Dinner",
  mains: "Dinner",
  entree: "Dinner",
  "main course": "Dinner",
  "main dish": "Dinner",
  snack: "Snack",
  snacks: "Snack",
  appetizer: "Snack",
  appetiser: "Snack",
  dessert: "Snack",
  starter: "Snack",
  side: "Snack",
  "side dish": "Snack",
};

const DIETARY_PATTERNS = [
  { tag: "gluten-free", regex: /gluten[\s-]?free/i },
  { tag: "dairy-free", regex: /dairy[\s-]?free/i },
  { tag: "egg-free", regex: /egg[\s-]?free/i },
  { tag: "nut-free", regex: /nut[\s-]?free/i },
  { tag: "soy-free", regex: /soy[\s-]?free/i },
  { tag: "vegan", regex: /\bvegan\b/i },
  { tag: "vegetarian", regex: /\bvegetarian\b/i },
  { tag: "pescatarian", regex: /\bpescatarian\b/i },
  { tag: "whole30", regex: /whole\s*30/i },
  { tag: "paleo", regex: /\bpaleo\b/i },
  { tag: "keto", regex: /\bketo(?:genic)?\b/i },
  { tag: "low-carb", regex: /low[\s-]?carb/i },
  { tag: "high-protein", regex: /high[\s-]?protein/i },
  { tag: "low-calorie", regex: /low[\s-]?calorie/i },
] as const;

const NON_CUISINE_VALUES = new Set([
  "healthy",
  "easy",
  "quick",
  "simple",
  "family",
  "family-friendly",
  "kid-friendly",
  "gluten-free",
  "whole30",
  "paleo",
  "low-carb",
  "dairy-free",
  "vegan",
  "vegetarian",
]);

const STRUCTURAL_RECIPE_TYPE_PATTERNS = [
  {
    value: "main",
    regex:
      /\b(main|mains|main course|main dish|entree|dinner|supper|meatballs?|patt(?:y|ies)|tacos?|enchiladas?|stir[\s-]?fry)\b/i,
  },
  { value: "breakfast", regex: /\b(breakfast|brunch|overnight oats|baked oatmeal)\b/i },
  { value: "side", regex: /\b(side|side dish|sides)\b/i },
  { value: "drink", regex: /\b(drink|drinks|cocktail|cocktails|smoothie|beverage)\b/i },
  { value: "dessert", regex: /\b(dessert|desserts|cake|cookie|cookies|brownie|pie|pudding)\b/i },
  {
    value: "starter",
    regex: /\b(starter|appetizer|appetizers|appetiser|appetisers|canape|canapes)\b/i,
  },
  { value: "snack", regex: /\b(snack|snacks|energy bites)\b/i },
] as const;

const FORMAT_RECIPE_TYPE_PATTERNS = [
  { value: "sheet-pan", regex: /sheet\s*pan|tray\s*bake/i },
  { value: "soup", regex: /\bsoup\b/i },
  { value: "salad", regex: /\bsalad\b/i },
  { value: "curry", regex: /\bcurry\b/i },
  { value: "stew", regex: /\bstew\b/i },
  { value: "bowl", regex: /\bbowl\b/i },
  { value: "burger", regex: /\bburger\b/i },
  { value: "pasta", regex: /\bpasta\b/i },
  { value: "bake", regex: /\bbake(?:d)?\b/i },
] as const;

const CONDIMENT_HINT_PATTERN =
  /\b(condiment|condiments|sauce|salsa|pesto|gravy|dressing|dip|spread|marinade|vinaigrette|chutney|relish)\b/i;

const CORE_NUTRITION_KEYS = new Set([
  "calories",
  "calorieContent",
  "fat",
  "fatContent",
  "carbs",
  "carbohydrateContent",
  "protein",
  "proteinContent",
  "servingSize",
]);

const SLOT_CATEGORY_PATTERNS = [
  { slot: "breakfast", regex: /\b(breakfast|brunch|morning meal)\b/i },
  { slot: "lunch", regex: /\b(lunch|lunch & dinner|lunch and dinner)\b/i },
  { slot: "dinner", regex: /\b(dinner|supper|main|mains|main course|main dish|entree)\b/i },
  { slot: "snack", regex: /\b(snack|snacks)\b/i },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function countSuspiciousCharacters(value: string): number {
  const suspiciousFragments = ["\u00c2", "\u00c3", "\u00e2", "\ufffd"];

  return suspiciousFragments.reduce(
    (count, fragment) => count + (value.split(fragment).length - 1),
    0
  );
}

function hasSuspiciousEncoding(value: unknown): boolean {
  try {
    const text = JSON.stringify(value);

    return /(?:Ãƒâ€š|ÃƒÆ’|ÃƒÂ¢|Ã¯Â¿Â½)/.test(text);
  } catch {
    return false;
  }
}

function repairLikelyMojibake(value: string): string {
  const suspiciousFragments = ["\u00c2", "\u00c3", "\u00e2"];

  if (!suspiciousFragments.some((fragment) => value.includes(fragment))) return value;

  try {
    const repaired = Buffer.from(value, "latin1").toString("utf8");

    if (countSuspiciousCharacters(repaired) < countSuspiciousCharacters(value)) {
      return repaired;
    }
  } catch {
    return value;
  }

  return value;
}

function cleanText(value: unknown, collapseWhitespace: boolean = true): string | null {
  if (value == null) return null;

  const source =
    typeof value === "string" ? value : typeof value === "number" ? String(value) : null;

  if (!source) return null;

  let cleaned = decode(source).replace(/\u00a0/g, " ");
  cleaned = repairLikelyMojibake(cleaned);
  cleaned = collapseWhitespace ? cleaned.replace(/\s+/g, " ") : cleaned;
  cleaned = cleaned.trim();

  return cleaned.length > 0 ? cleaned : null;
}

function readTextValue(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    return cleanText(value);
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const parsed = readTextValue(entry);

      if (parsed) return parsed;
    }

    return null;
  }

  if (isRecord(value)) {
    return (
      readTextValue(value.name) ??
      readTextValue(value.text) ??
      readTextValue(value["@value"]) ??
      readTextValue(value.caption)
    );
  }

  return null;
}

function normalizeTagName(value: string): string | null {
  const cleaned = cleanText(value);

  return cleaned ? cleaned.toLowerCase() : null;
}

function normalizeTextList(value: unknown, splitDelimited: boolean = false): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeTextList(entry, splitDelimited));
  }

  const cleaned = readTextValue(value);

  if (!cleaned) return [];

  if (!splitDelimited) return [cleaned];

  return cleaned
    .split(/[;,]/)
    .map((part) => cleanText(part))
    .filter((part): part is string => Boolean(part));
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value) continue;
    const key = value.toLowerCase();

    if (seen.has(key)) continue;

    seen.add(key);
    result.push(value);
  }

  return result;
}

function getSourceDomain(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    return new URL(url).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function parseMinutes(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === "string") {
    const cleaned = cleanText(value);

    if (!cleaned) return undefined;
    if (/^P/i.test(cleaned)) return parseIsoDuration(cleaned) ?? undefined;

    const parsed = parseNutritionValue(cleaned);

    return parsed != null ? Math.max(0, Math.round(parsed)) : undefined;
  }

  return undefined;
}

function buildSyntheticRecipeUrl(
  name: string,
  sourceFilePath?: string,
  sourceDomain?: string | null
): string {
  const stableSeed = sourceFilePath ?? name;
  const digest = createHash("sha1").update(stableSeed).digest("hex").slice(0, 16);
  const host = sourceDomain?.replace(/[^a-z0-9.-]+/gi, "-") || "local";

  return `schema-json-import://${host}/${digest}`;
}

function parseRecipeCategories(values: string[]): RecipeCategory[] {
  const categories = new Set<RecipeCategory>();

  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    const category = CATEGORY_MAP[normalized];

    if (category) {
      categories.add(category);
    }
  }

  return Array.from(categories);
}

function extractIngredientLines(
  input: Record<string, unknown>,
  raw: Record<string, unknown> | null
): string[] {
  const ingredientLines = normalizeTextList(input.ingredients, false);

  if (ingredientLines.length > 0) return ingredientLines;

  const rawIngredientLines = normalizeTextList(raw?.ingredients, false);

  if (rawIngredientLines.length > 0) return rawIngredientLines;

  const groups = [input.ingredient_groups, raw?.ingredient_groups];

  for (const groupSource of groups) {
    if (!Array.isArray(groupSource)) continue;

    const flattened = groupSource.flatMap((group) => {
      if (!isRecord(group)) return [];

      return normalizeTextList(group.ingredients, false);
    });

    if (flattened.length > 0) return flattened;
  }

  return [];
}

function extractIngredientGroups(
  input: Record<string, unknown>,
  raw: Record<string, unknown> | null
) {
  const groupSource = [input.ingredient_groups, raw?.ingredient_groups].find(Array.isArray);

  if (!Array.isArray(groupSource)) return [];

  return groupSource
    .map((group) => {
      if (!isRecord(group)) return null;

      const purpose =
        readTextValue(group.purpose) ?? readTextValue(group.name) ?? readTextValue(group.title);
      const ingredients = normalizeTextList(group.ingredients, false);

      if (!purpose && ingredients.length === 0) return null;

      return {
        purpose,
        ingredients,
      };
    })
    .filter((group): group is { purpose: string | null; ingredients: string[] } => Boolean(group));
}

function extractInstructionSource(
  input: Record<string, unknown>,
  raw: Record<string, unknown> | null
): unknown {
  const listCandidates = [input.instructions_list, raw?.instructions_list];

  for (const candidate of listCandidates) {
    const list = normalizeTextList(candidate, false);

    if (list.length > 0) return list;
  }

  const textCandidates = [input.instructions, raw?.instructions];

  for (const candidate of textCandidates) {
    const cleaned = cleanText(candidate, false);

    if (!cleaned) continue;

    const lines = cleaned
      .split(/\r?\n+/)
      .map((line) => cleanText(line))
      .filter((line): line is string => Boolean(line));

    if (lines.length > 0) return lines;
  }

  return [];
}

function extractNutritionRecord(
  input: Record<string, unknown>,
  raw: Record<string, unknown> | null
) {
  const candidate = [input.nutrients, raw?.nutrients, input.nutrition, raw?.nutrition].find(
    isRecord
  );

  if (!candidate) return {} as Record<string, string | number | null>;

  return Object.fromEntries(
    Object.entries(candidate).map(([key, value]) => [
      key,
      typeof value === "number" ? value : cleanText(value),
    ])
  );
}

function formatNutritionLabel(key: string): string {
  const trimmed = key.replace(/Content$/, "");
  const withSpaces = trimmed.replace(/([a-z])([A-Z])/g, "$1 $2");

  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function buildNutritionDetails(nutritionRecord: Record<string, string | number | null>) {
  const nutrients = Object.fromEntries(
    Object.entries(nutritionRecord)
      .filter(([key, value]) => !CORE_NUTRITION_KEYS.has(key) && value != null)
      .map(([key, value]) => {
        const normalized = normalizeNutritionMetricForStorage(key, value);

        return [
          key,
          {
            label: formatNutritionLabel(key),
            value: normalized.value,
            unit: normalized.unit,
            raw: normalized.raw,
          },
        ];
      })
  );

  const servingSize =
    typeof nutritionRecord.servingSize === "string" ? nutritionRecord.servingSize : null;

  if (Object.keys(nutrients).length === 0 && !servingSize) {
    return null;
  }

  return {
    servingSize,
    nutrients,
  };
}

function detectDietaryFlags(values: string[]): string[] {
  const corpus = values.join(" \n ");

  return DIETARY_PATTERNS.filter((pattern) => pattern.regex.test(corpus)).map(
    (pattern) => pattern.tag
  );
}

function detectHeatLevel(values: string[]): string | null {
  const corpus = values.join(" \n ").toLowerCase();

  if (!corpus) return null;
  if (/ghost pepper|scotch bonnet|habanero|very spicy|extra hot/.test(corpus)) return "hot";
  if (/spicy|jalapen|cayenne|harissa|sriracha|gochujang|chilli flakes|chili flakes/.test(corpus)) {
    return "medium";
  }
  if (/chilli|chili|pepper flakes|paprika/.test(corpus)) return "mild";

  return null;
}

function detectRecipeTypes(
  name: string,
  description: string | undefined,
  rawCategories: string[],
  keywordValues: string[]
): string[] {
  const structuralCorpus = [name, ...rawCategories, ...keywordValues].join(" \n ");
  const formatCorpus = [name, description ?? "", ...rawCategories, ...keywordValues].join(" \n ");
  const structuralTypes = STRUCTURAL_RECIPE_TYPE_PATTERNS.filter((pattern) =>
    pattern.regex.test(structuralCorpus)
  ).map((pattern) => pattern.value);
  const formatTypes = FORMAT_RECIPE_TYPE_PATTERNS.filter((pattern) =>
    pattern.regex.test(formatCorpus)
  ).map((pattern) => pattern.value);
  const hasMealIdentity = structuralTypes.some((value) =>
    ["main", "breakfast", "side", "drink", "dessert", "starter", "snack"].includes(value)
  );
  const hasDishFormatIdentity = formatTypes.some((value) =>
    ["sheet-pan", "soup", "salad", "curry", "stew", "bowl", "burger", "pasta", "bake"].includes(
      value
    )
  );
  const titleSuggestsCondiment =
    /^\s*(?:[\w&'-]+\s+){0,3}(?:sauce|salsa|pesto|gravy|dressing|dip|spread|marinade|vinaigrette|chutney|relish)\b/i.test(
      name
    ) ||
    /\b(?:sauce|salsa|pesto|gravy|dressing|dip|spread|marinade|vinaigrette|chutney|relish)\b$/i.test(
      name
    );
  const categoryOrKeywordSuggestsCondiment = CONDIMENT_HINT_PATTERN.test(
    [...rawCategories, ...keywordValues].join(" \n ")
  );

  return uniqueStrings([
    ...structuralTypes,
    ...(!hasMealIdentity &&
    !hasDishFormatIdentity &&
    (titleSuggestsCondiment || categoryOrKeywordSuggestsCondiment)
      ? ["condiment"]
      : []),
    ...formatTypes,
  ]);
}

function inferSuitableSlots(values: string[]): string[] {
  const corpus = values.join(" \n ");

  return uniqueStrings(
    SLOT_CATEGORY_PATTERNS.filter((pattern) => pattern.regex.test(corpus)).map(
      (pattern) => pattern.slot
    )
  );
}

function deriveSuitableSlots(recipeTypes: string[], inferredSuitableSlots: string[]): string[] {
  return uniqueStrings([
    ...inferredSuitableSlots,
    ...(recipeTypes.includes("soup") ? ["lunch", "dinner"] : []),
  ]);
}

function requiresPrimarySuitableSlot(recipeTypes: string[]): boolean {
  return !recipeTypes.includes("side");
}

function createSourceFingerprint(payload: unknown): string {
  return createHash("sha1").update(JSON.stringify(payload)).digest("hex");
}

function buildImportReview(
  payload: unknown,
  plannerProfile: SchemaJsonPlannerProfile,
  sourceYield: string | null,
  image: string | null,
  nutritionRecord: Record<string, string | number | null>,
  ingredientGroups: Array<{ purpose: string | null; ingredients: string[] }>
): SchemaJsonImportReview {
  const needsPrimarySlot = requiresPrimarySuitableSlot(plannerProfile.recipeTypes);
  const issues = uniqueStrings([
    !sourceYield ? "missing yield" : null,
    !image ? "missing image" : null,
    Object.keys(nutritionRecord).length === 0 ? "missing nutrition" : null,
    plannerProfile.recipeTypes.length === 0 ? "missing inferred recipe type" : null,
    needsPrimarySlot && plannerProfile.suitableSlots.length === 0
      ? "missing inferred suitable slot"
      : null,
    hasSuspiciousEncoding(payload) ? "possible encoding artifact" : null,
  ]);

  const confidenceByField: Record<string, number> = {
    recipeTypes:
      plannerProfile.recipeTypes.length > 0
        ? plannerProfile.recipeTypes.includes("condiment")
          ? 0.7
          : 0.9
        : 0,
    suitableSlots: !needsPrimarySlot
      ? 1
      : plannerProfile.suitableSlots.length > 0
        ? plannerProfile.recipeTypes.some((value) =>
            ["side", "condiment", "drink", "dessert"].includes(value)
          )
          ? 0.65
          : 0.85
        : 0,
    dietaryFlags: plannerProfile.dietaryFlags.length > 0 ? 0.9 : 0.4,
    cuisines: plannerProfile.cuisines.length > 0 ? 0.85 : 0.3,
    heatLevel: plannerProfile.heatLevel ? 0.7 : 0.4,
    sourceYield: sourceYield ? 1 : 0,
    ingredientGroups: ingredientGroups.length > 0 ? 1 : 0.2,
    nutrition: Object.keys(nutritionRecord).length > 0 ? 1 : 0,
  };

  const needsReview =
    issues.length > 0 ||
    confidenceByField.recipeTypes < 0.8 ||
    confidenceByField.suitableSlots < 0.75;

  return {
    sourceFingerprint: createSourceFingerprint(payload),
    needsReview,
    issues,
    confidenceByField,
    inferredData: {
      recipeTypes: plannerProfile.recipeTypes,
      suitableSlots: plannerProfile.suitableSlots,
      dietaryFlags: plannerProfile.dietaryFlags,
      cuisines: plannerProfile.cuisines,
      heatLevel: plannerProfile.heatLevel,
      sourceYield,
      ingredientGroups,
    },
    reviewOverrides: {},
  };
}

function extractCuisineData(values: string[]): { cuisines: string[]; extraTags: string[] } {
  const cuisines: string[] = [];
  const extraTags: string[] = [];

  for (const value of values) {
    const normalized = normalizeTagName(value);

    if (!normalized) continue;

    if (NON_CUISINE_VALUES.has(normalized)) {
      extraTags.push(normalized);
    } else {
      cuisines.push(normalized);
    }
  }

  return {
    cuisines: uniqueStrings(cuisines),
    extraTags: uniqueStrings(extraTags),
  };
}

export async function normalizeRecipeFromSchemaJson(
  payload: unknown,
  options: NormalizeSchemaJsonOptions = {}
): Promise<SchemaJsonImportResult> {
  if (!isRecord(payload)) {
    throw new Error("Schema JSON payload must be an object");
  }

  const raw = isRecord(payload.raw) ? payload.raw : null;
  const sourceUrl =
    readTextValue(payload.url) ??
    readTextValue(raw?.canonical_url) ??
    readTextValue(raw?.url) ??
    null;
  const sourceDomain =
    readTextValue(payload.source_domain) ??
    readTextValue(raw?.host) ??
    getSourceDomain(sourceUrl) ??
    null;
  const name =
    readTextValue(payload.title) ??
    readTextValue(raw?.title) ??
    readTextValue(payload.name) ??
    "Untitled recipe";
  const description =
    cleanText(payload.description, false) ?? cleanText(raw?.description, false) ?? undefined;
  const sourceYield =
    readTextValue(payload.yields) ??
    readTextValue(raw?.yields) ??
    readTextValue(payload.recipeYield) ??
    null;
  const servings = getServings(
    payload.yields ?? raw?.yields ?? payload.recipeYield ?? raw?.recipeYield
  );
  const prepMinutes = parseMinutes(
    payload.prep_time ?? raw?.prep_time ?? payload.prepTime ?? raw?.prepTime
  );
  const cookMinutes = parseMinutes(
    payload.cook_time ?? raw?.cook_time ?? payload.cookTime ?? raw?.cookTime
  );
  const totalMinutes = parseMinutes(
    payload.total_time ?? raw?.total_time ?? payload.totalTime ?? raw?.totalTime
  );
  const image = readTextValue(payload.image) ?? readTextValue(raw?.image) ?? null;
  const language =
    readTextValue(payload.language) ??
    readTextValue(raw?.language) ??
    readTextValue(raw?.inLanguage) ??
    null;
  const author = readTextValue(payload.author) ?? readTextValue(raw?.author) ?? null;
  const siteName =
    readTextValue(payload.site_name) ??
    readTextValue(raw?.site_name) ??
    readTextValue(raw?.publisher) ??
    sourceDomain;
  const recipeUrl =
    sourceUrl ?? buildSyntheticRecipeUrl(name, options.sourceFilePath, sourceDomain);

  const keywordValues = uniqueStrings([
    ...normalizeTextList(payload.keywords, true),
    ...normalizeTextList(raw?.keywords, true),
    ...normalizeTextList(payload.tags, true),
    ...normalizeTextList(raw?.tags, true),
  ]);
  const rawCategories = uniqueStrings([
    ...normalizeTextList(payload.category, true),
    ...normalizeTextList(raw?.category, true),
    ...normalizeTextList(payload.recipeCategory, true),
    ...normalizeTextList(raw?.recipeCategory, true),
  ]);
  const cuisineValues = uniqueStrings([
    ...normalizeTextList(payload.cuisine, true),
    ...normalizeTextList(raw?.cuisine, true),
  ]);
  const ingredientLines = extractIngredientLines(payload, raw);
  const ingredientGroups = extractIngredientGroups(payload, raw);
  const instructionSource = extractInstructionSource(payload, raw);
  const nutritionRecord = extractNutritionRecord(payload, raw);
  const nutritionDetails = buildNutritionDetails(nutritionRecord);

  if (ingredientLines.length === 0) {
    throw new Error("Recipe has no ingredient lines to import");
  }

  const units = await getUnits();
  const { ingredients, systemUsed } = parseIngredients({ ingredients: ingredientLines }, units);
  const recipeIngredients = ingredients.map((ingredient, index) => ({
    ...ingredient,
    rawLine: ingredientLines[index] ?? null,
  }));
  const { images, primaryImage } =
    options.downloadImages && options.recipeId && image
      ? await parseImages(image, options.recipeId)
      : { images: [], primaryImage: undefined };
  const steps = parseSteps(instructionSource, systemUsed);

  if (steps.length === 0) {
    throw new Error("Recipe has no instruction steps to import");
  }

  const calories = parseNutritionValue(nutritionRecord.calories ?? nutritionRecord.calorieContent);
  const fat = parseNutritionValue(nutritionRecord.fatContent ?? nutritionRecord.fat);
  const carbs = parseNutritionValue(nutritionRecord.carbohydrateContent ?? nutritionRecord.carbs);
  const protein = parseNutritionValue(nutritionRecord.proteinContent ?? nutritionRecord.protein);

  const mappedCategories = parseRecipeCategories(rawCategories);
  const categoryTags = rawCategories
    .map(normalizeTagName)
    .filter((value): value is string => Boolean(value));
  const { cuisines, extraTags: cuisineDescriptorTags } = extractCuisineData(cuisineValues);
  const detectedDietaryFlags = detectDietaryFlags([
    name,
    description ?? "",
    ...keywordValues,
    ...rawCategories,
    ...cuisineValues,
  ]);
  const dairyAdaptation = classifyDairyAdaptation({
    title: name,
    ingredientLines,
    explicitDairyFree: detectedDietaryFlags.includes("dairy-free"),
  });
  const dietaryFlags = uniqueStrings([
    ...detectedDietaryFlags,
    ...(dairyAdaptation.status === "contains-dairy" ? [] : ["dairy-free-possible"]),
  ]);
  const cookingMethodTags = getCanonicalCookingMethodTags([
    name,
    description ?? "",
    ...keywordValues,
    ...rawCategories,
  ]);
  const recipeTypes = detectRecipeTypes(name, description, rawCategories, keywordValues);
  const heatLevel = detectHeatLevel([
    name,
    description ?? "",
    ...ingredientLines,
    ...keywordValues,
  ]);
  const isFreezerFriendly = /freezer|freeze well|freezer-friendly/i.test(
    [
      description ?? "",
      ...normalizeTextList(payload.instructions, false),
      ...normalizeTextList(raw?.instructions, false),
    ].join(" \n ")
  );
  const tagNames = uniqueStrings(
    [
      ...keywordValues.map(normalizeTagName),
      ...categoryTags,
      ...cuisineDescriptorTags,
      ...cuisines,
      ...dietaryFlags,
      ...cookingMethodTags,
    ].filter((value): value is string => Boolean(value))
  );
  const mealTypes =
    mappedCategories.length > 0
      ? mappedCategories.map((category) => category.toLowerCase())
      : categoryTags;
  const inferredSuitableSlots = inferSuitableSlots([
    ...rawCategories,
    ...keywordValues,
    name,
    description ?? "",
  ]);
  const suitableSlots = deriveSuitableSlots(recipeTypes, inferredSuitableSlots);

  return {
    recipe: {
      name,
      description,
      notes: undefined,
      url: recipeUrl,
      image: primaryImage ?? image,
      servings,
      prepMinutes,
      cookMinutes,
      totalMinutes,
      calories: calories != null ? Math.round(calories) : null,
      fat: fat != null ? fat.toString() : null,
      carbs: carbs != null ? carbs.toString() : null,
      protein: protein != null ? protein.toString() : null,
      nutritionDetails,
      ingredientGroups,
      systemUsed,
      recipeIngredients,
      steps,
      tags: tagNames.map((tag) => ({ name: tag })),
      categories: mappedCategories,
      images,
      videos: [],
    },
    plannerProfile: {
      mealTypes,
      suitableSlots,
      recipeTypes,
      dietaryFlags,
      allergenFlags: [],
      cuisines,
      heatLevel,
      prepScore: null,
      fruitVegCount: null,
      isDivisible: true,
      isFreezerFriendly,
      sourceYield,
    },
    source: {
      sourceType: "schema_org",
      sourceUrl,
      sourceDomain,
      siteName,
      author,
      language,
      rawPayload: {
        importFormat: "schema_org_export_v1",
        importedAt: new Date().toISOString(),
        sourceFilePath: options.sourceFilePath ?? null,
        original: payload,
        normalized: {
          sourceUrl,
          sourceDomain,
          siteName,
          author,
          language,
          sourceYield,
          mappedCategories,
          mealTypes,
          suitableSlots,
          dietaryFlags,
          cuisines,
          recipeTypes,
          tags: tagNames,
          expandedNutrition: nutritionRecord,
          nutritionDetails,
          ingredientGroups,
        },
      },
    },
    importReview: buildImportReview(
      payload,
      {
        mealTypes,
        suitableSlots,
        recipeTypes,
        dietaryFlags,
        allergenFlags: [],
        cuisines,
        heatLevel,
        prepScore: null,
        fruitVegCount: null,
        isDivisible: true,
        isFreezerFriendly,
        sourceYield,
      },
      sourceYield,
      primaryImage ?? image,
      nutritionRecord,
      ingredientGroups
    ),
  };
}
