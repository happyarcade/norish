import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { db, recipes, resetDbConnection } from "@norish/db";

type ScoredRecipe = {
  rank: number;
  filePath: string;
  sourceDomain: string;
  title: string;
  url: string;
  score: number;
  sodiumMg: number;
  cholesterolMg?: number | null;
  saturatedFatG?: number | null;
  proteinG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  calories: number | null;
  servings: number | null;
  totalTimeMinutes: number | null;
  quickMeal: boolean;
  dairyStatus: string;
  dairySwaps: string[];
  proteinStyle: string;
  mealStyle: "dinner" | "breakfast" | "light-meal" | "snack" | "other";
  baking?: boolean;
  explicitMealPrep: boolean;
  mealPrepFriendly?: boolean;
  slowCooker?: boolean;
  mediterranean: boolean;
  cuisineStyle?: string | null;
  sodiumSwapFriendly: boolean;
  reasons: string[];
};

const COMPONENT_TITLE_PATTERN =
  /\b(?:seasonings?|dry rub|mcdonald.?s|kfc|taco bell|burger king|dip)\b|\b(?:crescent|dinner|pull[\s-]?apart) rolls?\b|\+\s*snack\b|pat(?:e\b|\u00e9)|^(?:(?:homemade|fresh) pasta|(?:recipe|casserole|salad|soup|stew|smoothie|breakfast|dinner|lunch)\s*(?:#?\d+)?)$|\((?:gluten|none|null|undefined)\)/i;
const SUSPICIOUS_TITLE_ENCODING_PATTERN =
  /(?:\u00c3|\u00c2|\u00e2|\u00ef\u00bf\u00bd|\u00e1\u00ba|\u00cc)/;
const UNHEALTHY_DESSERT_TITLE_PATTERN = /\b(churros?|doughnuts?|donuts?|crullers?)\b/i;
const LOW_INFORMATION_TITLE_PATTERN =
  /^(?:spaghetti|pasta|noodles?|chicken|beef|pork|lamb|salmon|fish|soup|stew|salad|curry|rice|risotto)$/i;
const LOW_VALUE_TITLE_PATTERN = /\b(?:copycat|weight loss|cake batter balls?|pancake dippers?)\b/i;
const PROCESSED_MEAT_TITLE_PATTERN =
  /\b(?:bacon|ham|hot dogs?|pepperoni|salami|sausages?|smoked meat)\b/i;
const EXPLICIT_MEDITERRANEAN_TITLE_PATTERN =
  /\b(mediterranean|greek|levantine|middle eastern|lebanese|turkish|cypriot|palestinian|syrian|jordanian|israeli|tunisian|algerian|egyptian|italian|spanish|portuguese|moroccan|provencal|sicilian)\b/i;
const MEDITERRANEAN_CUISINES = new Set([
  "italian",
  "greek-turkish",
  "middle-eastern",
  "north-african",
  "spanish-portuguese",
  "french",
]);

type ShortlistReport = {
  generatedAt: string;
  mode: string;
  targetPath: string;
  configuration: {
    targetCount: number;
    maxPerSource: number;
    maxPerCuisine?: number;
    minRedMeatPercent: number;
    maxRedMeatPercent: number;
    minDinnerPercent: number;
    maxDinnerPercent: number;
    minBreakfastPercent: number;
    maxBreakfastPercent: number;
    minLightMealPercent: number;
    maxLightMealPercent: number;
    minSnackPercent: number;
    maxSnackPercent: number;
    minBakingPercent?: number;
    maxBakingPercent?: number;
    minMealPrepPercent?: number;
    [key: string]: unknown;
  };
  totals: Record<string, number>;
  selectedBreakdown: Record<string, unknown>;
  shortlist: ScoredRecipe[];
};

function readArg(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function positiveInteger(args: string[], name: string, fallback: number): number {
  const raw = readArg(args, name);
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return raw.trim().toLowerCase();
  }
}

function compareCandidates(left: ScoredRecipe, right: ScoredRecipe): number {
  return (
    right.score - left.score ||
    left.sodiumMg - right.sodiumMg ||
    left.title.localeCompare(right.title)
  );
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function isMealPrepFriendly(candidate: ScoredRecipe): boolean {
  return (
    candidate.mealPrepFriendly === true ||
    candidate.explicitMealPrep ||
    candidate.slowCooker === true ||
    candidate.reasons.includes("batch-friendly meal format")
  );
}

function isNamedMediterraneanRecipe(candidate: ScoredRecipe): boolean {
  return (
    (candidate.cuisineStyle != null && MEDITERRANEAN_CUISINES.has(candidate.cuisineStyle)) ||
    EXPLICIT_MEDITERRANEAN_TITLE_PATTERN.test(candidate.title)
  );
}

function isMediterraneanOrAdjacentRecipe(candidate: ScoredRecipe): boolean {
  return isNamedMediterraneanRecipe(candidate) || candidate.cuisineStyle == null;
}

function hasUnbalancedBraces(title: string): boolean {
  const openCount = title.split("{").length - 1;
  const closeCount = title.split("}").length - 1;
  return openCount !== closeCount;
}

function hasImplausiblyLowSavorySodium(candidate: ScoredRecipe): boolean {
  return (
    candidate.sodiumMg < 50 &&
    candidate.baking !== true &&
    candidate.mealStyle !== "snack" &&
    PROCESSED_MEAT_TITLE_PATTERN.test(candidate.title)
  );
}

function selectCandidates(
  candidates: ScoredRecipe[],
  target: number,
  configuration: ShortlistReport["configuration"]
) {
  const selected: ScoredRecipe[] = [];
  const selectedUrls = new Set<string>();
  const selectedTitles = new Set<string>();
  const sourceCounts = new Map<string, number>();
  const cuisineCounts = new Map<string, number>();
  const minRedMeat = Math.floor(target * (configuration.minRedMeatPercent / 100));
  const maxRedMeat = Math.floor(target * (configuration.maxRedMeatPercent / 100));
  const minDinner = Math.floor(target * (configuration.minDinnerPercent / 100));
  const maxDinner = Math.floor(target * (configuration.maxDinnerPercent / 100));
  const minBreakfast = Math.floor(target * (configuration.minBreakfastPercent / 100));
  const maxBreakfast = Math.floor(target * (configuration.maxBreakfastPercent / 100));
  const minLightMeal = Math.floor(target * (configuration.minLightMealPercent / 100));
  const maxLightMeal = Math.floor(target * (configuration.maxLightMealPercent / 100));
  const minSnack = Math.floor(target * (configuration.minSnackPercent / 100));
  const maxSnack = Math.floor(target * (configuration.maxSnackPercent / 100));
  const minBaking = Math.floor(target * ((configuration.minBakingPercent ?? 0) / 100));
  const maxBaking = Math.floor(target * ((configuration.maxBakingPercent ?? 100) / 100));
  const minMealPrep = Math.floor(target * ((configuration.minMealPrepPercent ?? 0) / 100));
  let redMeatCount = 0;
  let dinnerCount = 0;
  let breakfastCount = 0;
  let lightMealCount = 0;
  let snackCount = 0;
  let bakingCount = 0;
  let mealPrepCount = 0;

  function add(candidate: ScoredRecipe): void {
    if (
      selected.length >= target ||
      selectedUrls.has(candidate.url) ||
      selectedTitles.has(normalizeTitle(candidate.title))
    ) {
      return;
    }
    if ((sourceCounts.get(candidate.sourceDomain) ?? 0) >= configuration.maxPerSource) return;
    if (
      configuration.maxPerCuisine != null &&
      candidate.cuisineStyle &&
      (cuisineCounts.get(candidate.cuisineStyle) ?? 0) >= configuration.maxPerCuisine
    ) {
      return;
    }
    if (candidate.proteinStyle === "red-meat" && redMeatCount >= maxRedMeat) return;
    if (candidate.mealStyle === "dinner" && dinnerCount >= maxDinner) return;
    if (candidate.mealStyle === "breakfast" && breakfastCount >= maxBreakfast) return;
    if (candidate.mealStyle === "light-meal" && lightMealCount >= maxLightMeal) return;
    if (candidate.mealStyle === "snack" && snackCount >= maxSnack) return;
    if (candidate.baking && bakingCount >= maxBaking) return;

    selected.push(candidate);
    selectedUrls.add(candidate.url);
    selectedTitles.add(normalizeTitle(candidate.title));
    sourceCounts.set(candidate.sourceDomain, (sourceCounts.get(candidate.sourceDomain) ?? 0) + 1);
    if (candidate.cuisineStyle) {
      cuisineCounts.set(
        candidate.cuisineStyle,
        (cuisineCounts.get(candidate.cuisineStyle) ?? 0) + 1
      );
    }
    if (candidate.proteinStyle === "red-meat") redMeatCount += 1;
    if (candidate.mealStyle === "dinner") dinnerCount += 1;
    if (candidate.mealStyle === "breakfast") breakfastCount += 1;
    if (candidate.mealStyle === "light-meal") lightMealCount += 1;
    if (candidate.mealStyle === "snack") snackCount += 1;
    if (candidate.baking) bakingCount += 1;
    if (isMealPrepFriendly(candidate)) mealPrepCount += 1;
  }

  if (configuration.maxPerCuisine != null) {
    for (const candidate of candidates) {
      if (candidate.cuisineStyle && !cuisineCounts.has(candidate.cuisineStyle)) add(candidate);
    }
  }

  for (const candidate of candidates) {
    if (redMeatCount >= minRedMeat) break;
    if (candidate.proteinStyle === "red-meat") add(candidate);
  }
  for (const candidate of candidates) {
    if (mealPrepCount >= minMealPrep) break;
    if (isMealPrepFriendly(candidate)) add(candidate);
  }
  for (const candidate of candidates) {
    if (bakingCount >= minBaking) break;
    if (candidate.baking) add(candidate);
  }
  for (const [style, minimum] of [
    ["snack", minSnack],
    ["breakfast", minBreakfast],
    ["light-meal", minLightMeal],
    ["dinner", minDinner],
  ] as const) {
    for (const candidate of candidates) {
      const current =
        style === "dinner"
          ? dinnerCount
          : style === "breakfast"
            ? breakfastCount
            : style === "light-meal"
              ? lightMealCount
              : snackCount;
      if (current >= minimum) break;
      if (candidate.mealStyle === style) add(candidate);
    }
  }
  for (const candidate of candidates) add(candidate);

  if (selected.length < target) {
    throw new Error(
      "Only " + selected.length + " fresh recipes remain; " + target + " were requested"
    );
  }
  if (
    redMeatCount < minRedMeat ||
    dinnerCount < minDinner ||
    breakfastCount < minBreakfast ||
    lightMealCount < minLightMeal ||
    snackCount < minSnack ||
    bakingCount < minBaking ||
    mealPrepCount < minMealPrep
  ) {
    throw new Error("The fresh candidate pool could not preserve the requested meal-style balance");
  }

  return selected
    .sort(compareCandidates)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}
function countBy(values: string[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Object.fromEntries(Array.from(counts.entries()).sort((left, right) => right[1] - left[1]));
}

function buildBreakdown(selected: ScoredRecipe[], maxSodium: number) {
  return {
    dairyStatus: countBy(selected.map((recipe) => recipe.dairyStatus)),
    proteinStyle: countBy(selected.map((recipe) => recipe.proteinStyle)),
    mealStyle: countBy(selected.map((recipe) => recipe.mealStyle)),
    baking: selected.filter((recipe) => recipe.baking).length,
    reportedFiberAtLeast3g: selected.filter((recipe) => recipe.fiberG != null && recipe.fiberG >= 3)
      .length,
    reportedSugarAtMost15g: selected.filter(
      (recipe) => recipe.sugarG != null && recipe.sugarG <= 15
    ).length,
    explicitMealPrep: selected.filter((recipe) => recipe.explicitMealPrep).length,
    mealPrepFriendly: selected.filter(isMealPrepFriendly).length,
    slowCooker: selected.filter((recipe) => recipe.slowCooker).length,
    quickMeals: selected.filter((recipe) => recipe.quickMeal).length,
    quickDinners: selected.filter((recipe) => recipe.quickMeal && recipe.mealStyle === "dinner")
      .length,
    mediterranean: selected.filter((recipe) => recipe.mediterranean).length,
    cuisineStyle: countBy(
      selected.flatMap((recipe) => (recipe.cuisineStyle ? [recipe.cuisineStyle] : []))
    ),
    sodiumSwapFriendly: selected.filter((recipe) => recipe.sodiumSwapFriendly).length,
    sourceCount: new Set(selected.map((recipe) => recipe.sourceDomain)).size,
    sodium: {
      upTo350: selected.filter((recipe) => recipe.sodiumMg <= 350).length,
      from351To500: selected.filter((recipe) => recipe.sodiumMg > 350 && recipe.sodiumMg <= 500)
        .length,
      from501To600: selected.filter((recipe) => recipe.sodiumMg > 500 && recipe.sodiumMg <= 600)
        .length,
      swapBand: selected.filter((recipe) => recipe.sodiumMg > maxSodium).length,
    },
    cholesterol: {
      reported: selected.filter((recipe) => recipe.cholesterolMg != null).length,
      upTo25: selected.filter(
        (recipe) => recipe.cholesterolMg != null && recipe.cholesterolMg <= 25
      ).length,
      from26To50: selected.filter(
        (recipe) =>
          recipe.cholesterolMg != null && recipe.cholesterolMg > 25 && recipe.cholesterolMg <= 50
      ).length,
      above50: selected.filter(
        (recipe) => recipe.cholesterolMg != null && recipe.cholesterolMg > 50
      ).length,
    },
    saturatedFat: {
      reported: selected.filter((recipe) => recipe.saturatedFatG != null).length,
      upTo2g: selected.filter((recipe) => recipe.saturatedFatG != null && recipe.saturatedFatG <= 2)
        .length,
      from2To4g: selected.filter(
        (recipe) =>
          recipe.saturatedFatG != null && recipe.saturatedFatG > 2 && recipe.saturatedFatG <= 4
      ).length,
      above4g: selected.filter((recipe) => recipe.saturatedFatG != null && recipe.saturatedFatG > 4)
        .length,
    },
  };
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(selected: ScoredRecipe[]): string {
  const headers = [
    "rank",
    "score",
    "title",
    "source",
    "sodiumMg",
    "cholesterolMg",
    "saturatedFatG",
    "proteinG",
    "fiberG",
    "sugarG",
    "calories",
    "servings",
    "totalTimeMinutes",
    "quickMeal",
    "dairyStatus",
    "dairySwaps",
    "proteinStyle",
    "mealStyle",
    "baking",
    "mealPrep",
    "mealPrepFriendly",
    "slowCooker",
    "mediterranean",
    "cuisineStyle",
    "sodiumSwapFriendly",
    "reasons",
    "url",
    "filePath",
  ];
  const rows = selected.map((recipe) =>
    [
      recipe.rank,
      recipe.score,
      recipe.title,
      recipe.sourceDomain,
      recipe.sodiumMg,
      recipe.cholesterolMg,
      recipe.saturatedFatG,
      recipe.proteinG,
      recipe.fiberG,
      recipe.sugarG,
      recipe.calories,
      recipe.servings,
      recipe.totalTimeMinutes,
      recipe.quickMeal,
      recipe.dairyStatus,
      recipe.dairySwaps.join("; "),
      recipe.proteinStyle,
      recipe.mealStyle,
      recipe.baking,
      recipe.explicitMealPrep,
      isMealPrepFriendly(recipe),
      recipe.slowCooker,
      recipe.mediterranean,
      recipe.cuisineStyle,
      recipe.sodiumSwapFriendly,
      recipe.reasons.join("; "),
      recipe.url,
      recipe.filePath,
    ]
      .map(csvCell)
      .join(",")
  );

  return `${headers.map(csvCell).join(",")}\n${rows.join("\n")}\n`;
}

async function main() {
  const args = process.argv.slice(2);
  const input = readArg(args, "--input");
  if (!input) throw new Error("Missing required --input <report.json> argument");

  const includeAllFresh = args.includes("--all-fresh");
  const mediterraneanOnly = args.includes("--mediterranean-only");
  const mediterraneanAdjacent = args.includes("--mediterranean-adjacent");
  if (mediterraneanOnly && mediterraneanAdjacent) {
    throw new Error("Use either --mediterranean-only or --mediterranean-adjacent, not both");
  }
  const requestedTarget = positiveInteger(args, "--target", 250);
  const maxPerSourceOverride = readArg(args, "--max-per-source");
  const maxPerCuisineOverride = readArg(args, "--max-per-cuisine");
  const inputPath = path.resolve(input);
  const outputStem = path.join(path.dirname(inputPath), "recipe-corpus-shortlist");
  const reportPath = path.resolve(readArg(args, "--report") ?? `${outputStem}.json`);
  const csvPath = path.resolve(readArg(args, "--csv") ?? `${outputStem}.csv`);
  const report = JSON.parse(await readFile(inputPath, "utf8")) as ShortlistReport;
  const selectionConfiguration = {
    ...report.configuration,
    maxPerSource: maxPerSourceOverride
      ? positiveInteger(args, "--max-per-source", report.configuration.maxPerSource)
      : report.configuration.maxPerSource,
    maxPerCuisine: maxPerCuisineOverride
      ? positiveInteger(args, "--max-per-cuisine", report.configuration.maxPerCuisine ?? 50)
      : report.configuration.maxPerCuisine,
  };
  const existingRows = await db.select({ url: recipes.url, name: recipes.name }).from(recipes);
  const existingUrls = new Set(existingRows.flatMap(({ url }) => (url ? [normalizeUrl(url)] : [])));
  const existingTitles = new Set(existingRows.map(({ name }) => normalizeTitle(name)));
  const urlFreshCandidates = report.shortlist.filter(
    (candidate) => !existingUrls.has(normalizeUrl(candidate.url))
  );
  const excludedExistingUrl = report.shortlist.length - urlFreshCandidates.length;
  const nonExistingCandidates = urlFreshCandidates.filter(
    (candidate) => !existingTitles.has(normalizeTitle(candidate.title))
  );
  const excludedExistingTitle = urlFreshCandidates.length - nonExistingCandidates.length;
  const excludedExisting = excludedExistingUrl + excludedExistingTitle;
  const qualityCandidates = nonExistingCandidates.filter(
    (candidate) =>
      !COMPONENT_TITLE_PATTERN.test(candidate.title) &&
      !SUSPICIOUS_TITLE_ENCODING_PATTERN.test(candidate.title) &&
      !UNHEALTHY_DESSERT_TITLE_PATTERN.test(candidate.title) &&
      !LOW_INFORMATION_TITLE_PATTERN.test(candidate.title) &&
      !LOW_VALUE_TITLE_PATTERN.test(candidate.title) &&
      !hasUnbalancedBraces(candidate.title) &&
      !hasImplausiblyLowSavorySodium(candidate)
  );
  const componentTitlesExcluded = nonExistingCandidates.length - qualityCandidates.length;
  const freshCandidates = mediterraneanOnly
    ? qualityCandidates.filter(isNamedMediterraneanRecipe)
    : mediterraneanAdjacent
      ? qualityCandidates.filter(isMediterraneanOrAdjacentRecipe)
      : qualityCandidates;
  const outsideRequestedRegionExcluded = qualityCandidates.length - freshCandidates.length;
  const rankedFreshCandidates = freshCandidates.sort(compareCandidates);
  const selected = includeAllFresh
    ? rankedFreshCandidates.map((candidate, index) => ({ ...candidate, rank: index + 1 }))
    : selectCandidates(rankedFreshCandidates, requestedTarget, selectionConfiguration);
  const target = selected.length;
  const finalReport = {
    ...report,
    generatedAt: new Date().toISOString(),
    mode: "full-scan-existing-filtered",
    configuration: {
      ...selectionConfiguration,
      targetCount: target,
      regionFilter: mediterraneanOnly
        ? "mediterranean-only"
        : mediterraneanAdjacent
          ? "mediterranean-adjacent"
          : "all",
    },
    totals: {
      ...report.totals,
      expandedShortlist: report.shortlist.length,
      existingExcluded: excludedExisting,
      existingUrlExcluded: excludedExistingUrl,
      existingTitleExcluded: excludedExistingTitle,
      componentTitlesExcluded,
      outsideRequestedRegionExcluded,
      freshCandidates: freshCandidates.length,
      selected: selected.length,
    },
    selectedBreakdown: buildBreakdown(
      selected,
      typeof selectionConfiguration.maxSodium === "number" ? selectionConfiguration.maxSodium : 600
    ),
    shortlist: selected,
  };

  await writeFile(reportPath, `${JSON.stringify(finalReport, null, 2)}\n`, "utf8");
  await writeFile(csvPath, buildCsv(selected), "utf8");
  console.log(
    `Finalized ${selected.length} recipes; excluded ${excludedExisting} already in Norish from the expanded shortlist`
  );
  console.log(`Report: ${reportPath}`);
  console.log(`CSV: ${csvPath}`);
}

try {
  await main();
} finally {
  await resetDbConnection();
}
