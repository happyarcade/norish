import { readdir, readFile, writeFile } from "fs/promises";
import path from "path";

import {
  normalizeNutritionMetricForStorage,
  parseNutritionValue,
} from "@norish/api/parser/parsers/nutrition";

type CliOptions = {
  targetPath: string;
  reportPath: string;
  csvPath: string;
  targetCount: number;
  maxPerSource: number;
  maxSodium: number;
  swapMaxSodium: number;
  maxCholesterol: number;
  maxSaturatedFat: number;
  minRedMeatRatio: number;
  maxRedMeatRatio: number;
  minDinnerRatio: number;
  maxDinnerRatio: number;
  minBreakfastRatio: number;
  maxBreakfastRatio: number;
  minLightMealRatio: number;
  maxLightMealRatio: number;
  minSnackRatio: number;
  maxSnackRatio: number;
  maxSnackSodium: number;
  minBakingRatio: number;
  maxBakingRatio: number;
  minMealPrepRatio: number;
  maxBakingSodium: number;
  maxPerCuisine: number;
  includeSnacks: boolean;
  includeBaking: boolean;
  minScore: number;
  focus: "all" | "prep-or-slow-cooker" | "cuisine-variety" | "mediterranean";
  limit?: number;
};

type CorpusRecipe = Record<string, unknown>;

type DairyStatus = "explicit-dairy-free" | "likely-dairy-free" | "swap-friendly" | "dairy-heavy";
type ProteinStyle = "vegetarian" | "lean-protein" | "red-meat" | "other";
type MealStyle = "dinner" | "breakfast" | "light-meal" | "snack" | "other";
type CuisineStyle =
  | "japanese"
  | "korean"
  | "vietnamese"
  | "thai"
  | "chinese"
  | "filipino"
  | "indonesian-malaysian"
  | "indian-sri-lankan"
  | "middle-eastern"
  | "north-african"
  | "sub-saharan-african"
  | "caribbean"
  | "latin-american"
  | "spanish-portuguese"
  | "french"
  | "greek-turkish"
  | "eastern-european"
  | "nordic"
  | "italian"
  | "mexican-central-american"
  | "cajun-creole"
  | "british-irish"
  | "german-austrian"
  | "australian-new-zealand";

type ScoredRecipe = {
  filePath: string;
  sourceDomain: string;
  title: string;
  url: string;
  score: number;
  sodiumMg: number;
  cholesterolMg: number | null;
  saturatedFatG: number | null;
  proteinG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  calories: number | null;
  servings: number | null;
  totalTimeMinutes: number | null;
  quickMeal: boolean;
  dairyStatus: DairyStatus;
  dairySwaps: string[];
  proteinStyle: ProteinStyle;
  mealStyle: MealStyle;
  baking: boolean;
  explicitMealPrep: boolean;
  mealPrepFriendly: boolean;
  slowCooker: boolean;
  mediterranean: boolean;
  cuisineStyle: CuisineStyle | null;
  sodiumSwapFriendly: boolean;
  reasons: string[];
};

type ScanCounters = {
  files: number;
  candidates: number;
  invalidJson: number;
  missingCoreContent: number;
  nonMeals: number;
  insufficientMealProtein: number;
  unhealthySnacks: number;
  unhealthyBaking: number;
  unhealthyNutrition: number;
  missingSodium: number;
  implausibleSodium: number;
  aboveSodiumRange: number;
  aboveCholesterolRange: number;
  aboveSaturatedFatRange: number;
  dairyHeavy: number;
  outsideFocus: number;
  belowMinimumScore: number;
  eligible: number;
};

const MEAL_PATTERN =
  /\b(breakfast|brunch|lunch|dinner|main|entree|meal|oatmeal|porridge|frittata|omelette|scramble|pot pie|shepherd'?s pie|cottage pie|fish pie|quiche|bowl|salad|soup|stew|curry|chili|chilli|pasta|noodles?|risotto|tacos?|burritos?|sandwich|wrap|burger|casserole|tray\s*bake|sheet[\s-]?pan|roast|stir[\s-]?fry)\b/i;
const NON_MEAL_PATTERN =
  /\b(cocktail|mocktail|smoothie|juice|drink|dessert|cake|cookie|brownie|pudding|candy|pie|bars?|truffles?|ice cream|cupcakes?|pastr(?:y|ies)|bread|frosting|sauce|dip|hummus|spread|dressing|marinade|appetizer|appetiser|starter|snack|side dish)\b/i;
const HARD_NON_MEAL_PATTERN =
  /\b(dessert|cakes?|cookies?|brownies?|pudding|candy|truffles?|ice cream|cupcakes?|pastr(?:y|ies)|frosting|granola bark|seasonings?|dry rub|tarts?|mousse|pop tarts?|macaroons?|hot cross buns?|hamburger buns?|cheesecakes?|biscotti|croissants?|scones?|croquettes?|fritters?|latkes?|peanut butter cups?|fig newtons?|dog treats?|cadbury|reese.?s|andes mints?|blossoms?|hershey.?s|white chocolate|muddy buddies|snickers?|bunny bait|profiteroles?|danish(?:es)?|sweet .*empanadas?|custard|red bean buns?|tarte tatin|sesame twists?|fried pickles?|cheese twists?|pizza puffs?|apple pie|peanut butter slice|mcdonald.?s|kfc|taco bell|burger king)\b|pat(?:e\b|\u00e9)/i;
const LOW_QUALITY_TITLE_PATTERN =
  /^(?:recipe|casserole|salad|soup|stew|smoothie|breakfast|dinner|lunch)\s*(?:#?\d+)?$|\((?:gluten|none|null|undefined)\)/i;
const UNHEALTHY_DESSERT_TITLE_PATTERN = /\b(churros?|doughnuts?|donuts?|crullers?)\b/i;
const COLLECTION_PATTERN = /\b\d+\+?\s+.*recipes?\b/i;
const COMPONENT_RECIPE_PATTERN =
  /^(?:how to (?:make|cook|prepare) (?:fresh )?(?:pasta|rice|quinoa|couscous)\b|(?:homemade|fresh) pasta$)/i;
const BREAKFAST_STYLE_PATTERN =
  /\b(breakfast|brunch|oatmeal|overnight oats?|porridge|pancakes?|waffles?|muffins?|granola|frittata|omelette|scramble|quick bread|banana bread|pumpkin bread|zucchini bread|craisin bread|cottage cheese bread|yogurt(?: chocolate chip)? bread|(?:banana|pumpkin|zucchini|fruit)(?: marble)? loaf)\b/i;
const LIGHT_MEAL_STYLE_PATTERN =
  /\b(lunch|salads?|sandwich(?:es)?|wraps?|toast|grain bowl|mason jar)\b/i;
const SNACK_STYLE_PATTERN =
  /\b(snacks?|smoothies?|hummus|energy bites?|energy balls?|protein balls?|protein bites?|date bites?|nut butter balls?|trail mix|granola bars?|protein bars?|roasted chickpeas?|roasted nuts?|roasted seeds?|fruit skewers?|yogurt bark|yoghurt bark|yogurt bowls?|yoghurt bowls?|hard boiled eggs?|deviled eggs?|devilled eggs?|guacamole|egg bites?|spinach dip|bean dip|yogurt dip|yoghurt dip|apple chips?|kale chips?|fruit leather|edamame)\b/i;
const WHOLE_FOOD_SNACK_PATTERN =
  /\b(fruit|berries|apple|banana|orange|pear|peach|melon|nuts?|almonds?|walnuts?|seeds?|hummus|chickpeas?|edamame|oats?|yogurt|yoghurt|avocado|vegetables?|carrots?|cucumber)\b/i;
const UNHEALTHY_SNACK_TITLE_PATTERN =
  /\b(doughnuts?|donuts?|croissants?|shortbread|scones?|fruitcake|fried dough|fritters?|croquettes?|latkes?|peanut butter cups?|chocolate bark|macaroons?)\b/i;
const BAKING_STYLE_PATTERN =
  /\b(muffins?|quick bread|banana bread|pumpkin bread|zucchini bread|courgette bread|fruit bread|tea bread|loaf cake|loaf|cookies?|biscuits?|cakes?|cupcakes?|brownies?|blondies?|pies?|tarts?|scones?|baked oats?|granola bars?|oat bars?|breakfast bars?|flapjacks?|fruit crumble|fruit crisp|cobbler)\b/i;
const WHOLE_FOOD_BAKING_PATTERN =
  /\b(oats?|whole[ -]?wheat|wholemeal|spelt|rye|bran|banana|apple|pear|berries|blueberries|raspberries|pumpkin|zucchini|courgette|carrot|dates?|raisins?|nuts?|almonds?|walnuts?|seeds?|flax|chia|yogurt|yoghurt)\b/i;
const UNHEALTHY_BAKING_TITLE_PATTERN =
  /\b(deep[ -]?fried|fried dough|frosted|frosting|buttercream|fudge|candy|reese.?s|hershey.?s|snickers?|oreo|nutella|cookie dough|triple chocolate|death by chocolate|millionaire.?s|dump cake)\b/i;
const NON_BAKING_CONTEXT_PATTERN =
  /\b(smoothies?|shakes?|ice cream|french toast|energy bites?|energy balls?|protein balls?|protein bites?|salmon cakes?|fish cakes?|crab cakes?|tuna cakes?|cod cakes?|shrimp cakes?|prawn cakes?)\b/i;
const SAVOURY_BAKING_DINNER_PATTERN =
  /\b(pot pie|shepherd'?s pie|cottage pie|fish pie|chicken pie|turkey pie|beef pie|steak pie|quiche)\b/i;
const DINNER_STYLE_PATTERN =
  /\b(dinner|supper|main dish|main course|entree|soups?|quiche|stews?|curr(?:y|ies)|chili|chilli|casserole|roast|sheet[\s-]?pan|tray\s*bake|one[\s-]?pot|skillet|pasta|lasagna|meatballs?|pot pie|shepherd'?s pie|cottage pie|fish pie|risotto|tacos?|burritos?|enchiladas?|fajitas?|burgers?|kabobs?|kebabs?|tagine|paella|stir[\s-]?fry|chicken|turkey|beef|steak|pork|lamb|salmon|cod|fish|shrimp|prawns?|tofu|tempeh)\b/i;
const EXPLICIT_MEAL_PREP_PATTERN =
  /\b(meal[\s-]?prep|make[\s-]?ahead|batch[\s-]?(?:cook|cooking)|freezer[\s-]?friendly|freezes? well|reheats? well)\b/i;
const SLOW_COOKER_PATTERN = /\b(?:slow[\s-]?cooker|crock[\s-]?pot)\b/i;
const DURABLE_MEAL_PATTERN =
  /\b(soup|stew|curry|chili|chilli|casserole|bake|bowl|pasta|lasagna|meatballs?|sheet[\s-]?pan|tray\s*bake|roast)\b/i;
const VEGETARIAN_PATTERN =
  /\b(?:vegan|vegetarian|plant[\s-]?based|meatless)\b|(?<!white[\s-])(?<!red[\s-])\bmeat[\s-]?free\b/i;
const RED_MEAT_PATTERN =
  /\b(beef|steak|veal|lamb|mutton|pork|bacon|ham|prosciutto|salami|pepperoni|chorizo|sausage|brisket|pot roast|short ribs?|ground beef|beef mince|pork mince)\b/i;
const LEAN_PROTEIN_PATTERN =
  /\b(chicken breast|chicken|turkey|salmon|cod|haddock|tuna|tilapia|trout|white fish|prawns?|shrimp)\b/i;
const ANIMAL_PROTEIN_PATTERN =
  /\b(chicken|turkey|beef|steak|veal|lamb|mutton|pork|bacon|ham|prosciutto|salami|pepperoni|chorizo|fish|salmon|cod|haddock|tuna|tilapia|trout|prawns?|shrimp|anchov(?:y|ies)|sardines?)\b/i;
const EXPLICIT_MEDITERRANEAN_PATTERN =
  /\b(mediterranean|greek|levantine|middle eastern|lebanese|turkish|cypriot)\b/i;
const BROAD_MEDITERRANEAN_PATTERN = /\b(italian|spanish|moroccan|provencal|sicilian)\b/i;
const ADDED_SALT_PATTERN =
  /\b(salt|seasoning salt|garlic salt|onion salt|celery salt|kosher salt|sea salt|table salt)\b/i;
const STRONG_SODIUM_SWAP_PATTERN =
  /\b(soy sauce|tamari|stock|broth|bouillon|canned beans?|tinned beans?|feta|olives?(?!\s+oil)|capers?|miso|fish sauce|oyster sauce|teriyaki|bbq sauce|barbecue sauce|msg|monosodium glutamate)\b/i;
const CUISINE_PATTERNS: Array<{ style: CuisineStyle; pattern: RegExp }> = [
  {
    style: "japanese",
    pattern:
      /\b(japanese|teriyaki|yakitori|ramen|udon|soba|donburi|oyakodon|katsu|gyudon|okonomiyaki)\b/i,
  },
  { style: "korean", pattern: /\b(korean|bibimbap|bulgogi|gochujang|kimchi|japchae)\b/i },
  { style: "vietnamese", pattern: /\b(vietnamese|pho|banh mi|bun cha)\b/i },
  { style: "thai", pattern: /\b(thai|pad thai|tom yum|tom kha|larb|massaman)\b/i },
  {
    style: "chinese",
    pattern: /\b(chinese|szechuan|sichuan|cantonese|kung pao|mapo|char siu|chow mein)\b/i,
  },
  { style: "filipino", pattern: /\b(filipino|adobo|sinigang|tinola|pancit)\b/i },
  {
    style: "indonesian-malaysian",
    pattern: /\b(indonesian|malaysian|nasi goreng|rendang|satay|laksa)\b/i,
  },
  {
    style: "indian-sri-lankan",
    pattern:
      /\b(indian|sri lankan|tikka|tandoori|dal|dhal|biryani|korma|vindaloo|saag|chana masala)\b/i,
  },
  { style: "north-african", pattern: /\b(moroccan|north african|tagine|harissa)\b/i },
  { style: "greek-turkish", pattern: /\b(greek|turkish|cypriot|souvlaki|moussaka|menemen)\b/i },
  {
    style: "middle-eastern",
    pattern:
      /\b(levantine|lebanese|middle eastern|persian|iranian|israeli|shawarma|kofta|falafel|mujadara)\b/i,
  },
  {
    style: "sub-saharan-african",
    pattern:
      /\b(nigerian|ghanaian|senegalese|ethiopian|eritrean|kenyan|south african|jollof|injera|doro wat)\b/i,
  },
  {
    style: "caribbean",
    pattern: /\b(caribbean|jamaican|haitian|trinidadian|jerk chicken|rice and peas)\b/i,
  },
  {
    style: "latin-american",
    pattern:
      /\b(peruvian|brazilian|argentinian|colombian|venezuelan|cuban|chilean|latin american|ceviche|feijoada|ropa vieja|picadillo)\b/i,
  },
  { style: "spanish-portuguese", pattern: /\b(spanish|portuguese|paella|caldo verde)\b/i },
  {
    style: "french",
    pattern:
      /\b(french(?!['\u2019]s|\s+toast)|provencal|ratatouille|coq au vin|cassoulet|bouillabaisse)\b/i,
  },
  {
    style: "eastern-european",
    pattern: /\b(polish|ukrainian|hungarian|romanian|serbian|croatian|borscht|goulash)\b/i,
  },
  { style: "nordic", pattern: /\b(swedish|norwegian|danish|finnish|icelandic|scandinavian)\b/i },
  {
    style: "italian",
    pattern: /\b(italian|tuscan|sicilian|calabrian|bolognese|milanese|puttanesca|cacciatore)\b/i,
  },
  {
    style: "mexican-central-american",
    pattern:
      /\b(mexican|oaxacan|yucatan|guatemalan|salvadoran|costa rican|honduran|nicaraguan|pupusas?|pozole|mole poblano)\b/i,
  },
  {
    style: "cajun-creole",
    pattern: /\b(cajun|creole|gumbo|jambalaya|etouffee|étouffée)\b/i,
  },
  {
    style: "british-irish",
    pattern: /\b(british|english|scottish|welsh|irish|cornish)\b/i,
  },
  {
    style: "german-austrian",
    pattern: /\b(german|austrian|bavarian|schnitzel|spaetzle|spätzle)\b/i,
  },
  {
    style: "australian-new-zealand",
    pattern: /\b(australian|new zealand|aussie|kiwi cuisine)\b/i,
  },
];

const DAIRY_PATTERNS: Array<{ pattern: RegExp; swap: string; heavy?: boolean }> = [
  {
    pattern:
      /\b(?:cheese|queso|cheddar|mozzarella|parmesan|pecorino|feta|halloumi|ricotta|mascarpone|brie|camembert|gouda|gruyere|monterey jack|colby|swiss cheese|provolone|cream cheese|cottage cheese)\b/i,
    swap: "Use a dairy-free cheese or omit where the recipe still works",
    heavy: true,
  },
  {
    pattern: /\b(?:yogurt|yoghurt)\b/i,
    swap: "Use an unsweetened dairy-free yoghurt",
  },
  {
    pattern: /\b(?:cream|double cream|heavy cream|single cream|sour cream|creme fraiche)\b/i,
    swap: "Use oat, soy or cashew cream",
    heavy: true,
  },
  {
    pattern:
      /\b(?:milk|cow'?s? milk|whole milk|skim(?:med)? milk|buttermilk|evaporated milk|condensed milk)\b/i,
    swap: "Use an unsweetened dairy-free milk",
  },
  {
    pattern: /\bbutter\b/i,
    swap: "Use olive oil or a dairy-free spread",
  },
  {
    pattern: /\b(?:whey|casein)\b/i,
    swap: "Use a plant-based equivalent",
    heavy: true,
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readArgValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);

  return index === -1 ? undefined : args[index + 1];
}

function readPositiveNumber(args: string[], name: string, fallback: number): number {
  const raw = readArgValue(args, name);
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be a positive number`);

  return parsed;
}

function parseArgs(args: string[]): CliOptions {
  const targetPath = readArgValue(args, "--dir") ?? readArgValue(args, "--path");
  if (!targetPath) throw new Error("Missing required --dir <path> argument");

  const outputStem = path.join(process.cwd(), "recipe-corpus-shortlist");
  const limitRaw = readArgValue(args, "--limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  const includeSnacks = args.includes("--include-snacks");
  const includeBaking = args.includes("--include-baking");
  const focus = readArgValue(args, "--focus") ?? "all";

  if (
    focus !== "all" &&
    focus !== "prep-or-slow-cooker" &&
    focus !== "cuisine-variety" &&
    focus !== "mediterranean"
  ) {
    throw new Error("--focus must be all, prep-or-slow-cooker, cuisine-variety, or mediterranean");
  }
  const minRedMeatPercent = readPositiveNumber(args, "--min-red-meat-percent", 8);
  const maxRedMeatPercent = readPositiveNumber(args, "--max-red-meat-percent", 12);
  const minDinnerPercent = readPositiveNumber(args, "--min-dinner-percent", 65);
  const maxDinnerPercent = readPositiveNumber(args, "--max-dinner-percent", 100);
  const minBreakfastPercent = readPositiveNumber(args, "--min-breakfast-percent", 0);
  const maxBreakfastPercent = readPositiveNumber(args, "--max-breakfast-percent", 15);
  const minLightMealPercent = readPositiveNumber(args, "--min-light-meal-percent", 0);
  const maxLightMealPercent = readPositiveNumber(args, "--max-light-meal-percent", 20);
  const minSnackPercent = readPositiveNumber(args, "--min-snack-percent", includeSnacks ? 10 : 0);
  const maxSnackPercent = readPositiveNumber(args, "--max-snack-percent", includeSnacks ? 20 : 0);
  const minBakingPercent = readPositiveNumber(args, "--min-baking-percent", includeBaking ? 10 : 0);
  const maxBakingPercent = readPositiveNumber(args, "--max-baking-percent", includeBaking ? 20 : 0);
  const minMealPrepPercent = readPositiveNumber(args, "--min-meal-prep-percent", 0);

  if (limitRaw && (!Number.isFinite(limit) || !limit || limit <= 0)) {
    throw new Error("--limit must be a positive integer");
  }

  if (maxRedMeatPercent > 100) throw new Error("--max-red-meat-percent cannot exceed 100");
  if (minRedMeatPercent > maxRedMeatPercent) {
    throw new Error("--min-red-meat-percent cannot exceed --max-red-meat-percent");
  }
  for (const [name, value] of [
    ["--min-dinner-percent", minDinnerPercent],
    ["--max-dinner-percent", maxDinnerPercent],
    ["--min-breakfast-percent", minBreakfastPercent],
    ["--max-breakfast-percent", maxBreakfastPercent],
    ["--min-light-meal-percent", minLightMealPercent],
    ["--max-light-meal-percent", maxLightMealPercent],
    ["--min-snack-percent", minSnackPercent],
    ["--max-snack-percent", maxSnackPercent],
    ["--min-baking-percent", minBakingPercent],
    ["--max-baking-percent", maxBakingPercent],
  ] as const) {
    if (value > 100) throw new Error(name + " cannot exceed 100");
  }
  if (minDinnerPercent > maxDinnerPercent) {
    throw new Error("--min-dinner-percent cannot exceed --max-dinner-percent");
  }
  if (minBreakfastPercent > maxBreakfastPercent) {
    throw new Error("--min-breakfast-percent cannot exceed --max-breakfast-percent");
  }
  if (minLightMealPercent > maxLightMealPercent) {
    throw new Error("--min-light-meal-percent cannot exceed --max-light-meal-percent");
  }
  if (minSnackPercent > maxSnackPercent) {
    throw new Error("--min-snack-percent cannot exceed --max-snack-percent");
  }
  if (minBakingPercent > maxBakingPercent) {
    throw new Error("--min-baking-percent cannot exceed --max-baking-percent");
  }
  if (minMealPrepPercent > 100) {
    throw new Error("--min-meal-prep-percent cannot exceed 100");
  }
  if (minDinnerPercent + minBreakfastPercent + minLightMealPercent + minSnackPercent > 100) {
    throw new Error("Minimum meal-style percentages cannot total more than 100");
  }

  return {
    targetPath: path.resolve(targetPath),
    reportPath: path.resolve(readArgValue(args, "--report") ?? `${outputStem}.json`),
    csvPath: path.resolve(readArgValue(args, "--csv") ?? `${outputStem}.csv`),
    targetCount: Math.floor(readPositiveNumber(args, "--target", 250)),
    maxPerSource: Math.floor(readPositiveNumber(args, "--max-per-source", 10)),
    maxSodium: readPositiveNumber(args, "--max-sodium", 600),
    swapMaxSodium: readPositiveNumber(args, "--swap-max-sodium", 850),
    maxCholesterol: readPositiveNumber(args, "--max-cholesterol", 75),
    maxSaturatedFat: readPositiveNumber(args, "--max-saturated-fat", 6),
    minRedMeatRatio: minRedMeatPercent / 100,
    maxRedMeatRatio: maxRedMeatPercent / 100,
    minDinnerRatio: minDinnerPercent / 100,
    maxDinnerRatio: maxDinnerPercent / 100,
    minBreakfastRatio: minBreakfastPercent / 100,
    maxBreakfastRatio: maxBreakfastPercent / 100,
    minLightMealRatio: minLightMealPercent / 100,
    maxLightMealRatio: maxLightMealPercent / 100,
    minSnackRatio: minSnackPercent / 100,
    maxSnackRatio: maxSnackPercent / 100,
    maxSnackSodium: readPositiveNumber(args, "--max-snack-sodium", 300),
    minBakingRatio: minBakingPercent / 100,
    maxBakingRatio: maxBakingPercent / 100,
    minMealPrepRatio: minMealPrepPercent / 100,
    maxBakingSodium: readPositiveNumber(args, "--max-baking-sodium", 500),
    maxPerCuisine: Math.floor(readPositiveNumber(args, "--max-per-cuisine", 50)),
    includeSnacks,
    includeBaking,
    minScore: readPositiveNumber(args, "--min-score", 10),
    focus,
    limit,
  };
}

function toTextList(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/[,|]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => toTextList(entry));
}

function getText(recipe: CorpusRecipe, ...keys: string[]): string {
  return keys.flatMap((key) => toTextList(recipe[key])).join(" \n ");
}

function getIngredients(recipe: CorpusRecipe): string[] {
  return toTextList(recipe.ingredients ?? recipe.recipeIngredient);
}

function getInstructions(recipe: CorpusRecipe): string[] {
  return toTextList(recipe.instructions_list ?? recipe.instructions ?? recipe.recipeInstructions);
}

function getNutrition(recipe: CorpusRecipe): Record<string, unknown> {
  const value = recipe.nutrients ?? recipe.nutrition;

  return isRecord(value) ? value : {};
}

function getSodiumMg(recipe: CorpusRecipe): number | null {
  const nutrition = getNutrition(recipe);
  const raw = nutrition.sodiumContent ?? nutrition.sodium;
  if (typeof raw !== "string" && typeof raw !== "number") return null;

  return normalizeNutritionMetricForStorage("sodiumContent", raw).value;
}

function getMetric(recipe: CorpusRecipe, ...keys: string[]): number | null {
  const nutrition = getNutrition(recipe);

  for (const key of keys) {
    const parsed = parseNutritionValue(nutrition[key]);
    if (parsed != null) return parsed;
  }

  return null;
}

function getServings(recipe: CorpusRecipe): number | null {
  const raw = recipe.yields ?? recipe.recipeYield ?? recipe.servings;
  if (typeof raw === "number") return raw > 0 ? raw : null;
  if (typeof raw !== "string") return null;

  const match = raw.match(/\d+(?:\.\d+)?/);
  if (!match) return null;

  const parsed = Number(match[0]);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getPositiveNumber(recipe: CorpusRecipe, ...keys: string[]): number | null {
  for (const key of keys) {
    const raw = recipe[key];
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
    if (typeof raw !== "string") continue;

    const match = raw.match(/\d+(?:\.\d+)?/);
    if (!match) continue;

    const parsed = Number(match[0]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
}

function getSourceDomain(recipe: CorpusRecipe, filePath: string): string {
  const explicit = getText(recipe, "source_domain").trim();
  if (explicit) return explicit.replace(/^www\./, "").toLowerCase();

  const url = getText(recipe, "url").trim();
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return path.basename(path.dirname(filePath)).toLowerCase();
  }
}

function classifyDairy(ingredients: string[], metadata: string) {
  const dairyLines = ingredients.filter((line) =>
    DAIRY_PATTERNS.some(
      ({ pattern }) =>
        pattern.test(line) &&
        !/\b(coconut|almond|oat|soy|cashew|peanut|nut butter|apple butter|cocoa butter|plant[\s-]?based|vegan|dairy[\s-]?free)\b/i.test(
          line
        )
    )
  );

  if (dairyLines.length === 0) {
    const status: DairyStatus = /\b(dairy[\s-]?free|vegan)\b/i.test(metadata)
      ? "explicit-dairy-free"
      : "likely-dairy-free";

    return { status, swaps: [] };
  }

  const swaps = Array.from(
    new Set(
      dairyLines.flatMap((line) =>
        DAIRY_PATTERNS.filter(({ pattern }) => pattern.test(line)).map(({ swap }) => swap)
      )
    )
  );
  const heavyMatches = dairyLines.filter((line) =>
    DAIRY_PATTERNS.some(({ pattern, heavy }) => heavy && pattern.test(line))
  ).length;
  const status: DairyStatus =
    dairyLines.length <= 2 && heavyMatches <= 1 ? "swap-friendly" : "dairy-heavy";

  return { status, swaps };
}
function classifyProtein(metadata: string, ingredientText: string): ProteinStyle {
  if (VEGETARIAN_PATTERN.test(metadata) && !ANIMAL_PROTEIN_PATTERN.test(ingredientText)) {
    return "vegetarian";
  }

  if (RED_MEAT_PATTERN.test(ingredientText)) return "red-meat";
  if (LEAN_PROTEIN_PATTERN.test(ingredientText)) return "lean-protein";
  if (
    !ANIMAL_PROTEIN_PATTERN.test(ingredientText) &&
    /\b(beans?|lentils?|chickpeas?|tofu|tempeh|eggs?)\b/i.test(ingredientText)
  ) {
    return "vegetarian";
  }

  return "other";
}

function classifyCuisine(
  contextualMetadata: string,
  declaredCuisines: string[],
  title: string
): CuisineStyle | null {
  const contextualMatch = CUISINE_PATTERNS.find(({ pattern }) => pattern.test(contextualMetadata));
  if (contextualMatch) return contextualMatch.style;

  if (/\b(american|tex[\s-]?mex)\b/i.test(title)) return null;
  if (declaredCuisines.length !== 1) return null;

  return (
    CUISINE_PATTERNS.find(({ pattern }) => pattern.test(declaredCuisines[0] ?? ""))?.style ?? null
  );
}

function hasOnlyNonMealCategories(categories: string[]): boolean {
  const hasMealCategory = categories.some((category) =>
    /\b(breakfast|brunch|lunch|dinner|main course|main dish|entree)\b/i.test(category)
  );
  const hasNonMealCategory = categories.some((category) =>
    /\b(dessert|appetizer|appetiser|starter|side dish|snack|drink|cocktail|mocktail)\b/i.test(
      category
    )
  );

  return hasNonMealCategory && !hasMealCategory;
}
function hasMediterraneanPattern(metadata: string, ingredientText: string): boolean {
  if (EXPLICIT_MEDITERRANEAN_PATTERN.test(metadata) || BROAD_MEDITERRANEAN_PATTERN.test(metadata))
    return true;

  const signals = [
    /\bolive oil\b/i,
    /\b(tomato|tomatoes)\b/i,
    /\b(chickpeas?|lentils?|white beans?|cannellini)\b/i,
    /\b(salmon|cod|tuna|sardines?|anchov(?:y|ies)|prawns?|shrimp)\b/i,
    /\b(lemon|parsley|oregano|basil|mint|dill|thyme)\b/i,
    /\b(couscous|bulgur|farro|barley|whole[\s-]?grain)\b/i,
    /\b(aubergine|eggplant|courgette|zucchini|peppers?|spinach|artichoke)\b/i,
  ].filter((pattern) => pattern.test(ingredientText)).length;

  return /\bolive oil\b/i.test(ingredientText) && signals >= 4;
}

function isBakingRecipe(title: string): boolean {
  return BAKING_STYLE_PATTERN.test(title) && !NON_BAKING_CONTEXT_PATTERN.test(title);
}

function isLikelyMeal(
  title: string,
  metadata: string,
  explicitMealPrep: boolean,
  includeSnacks: boolean,
  includeBaking: boolean
): boolean {
  const titleMealSignal = MEAL_PATTERN.test(title);
  const primaryMealSignal =
    /\b(breakfast|brunch|lunch|dinner|main course|main dish|entree)\b/i.test(metadata);
  const titleNonMealSignal = NON_MEAL_PATTERN.test(title);
  const snackSignal = includeSnacks && SNACK_STYLE_PATTERN.test(title);
  const bakingSignal = includeBaking && isBakingRecipe(title);

  if (
    COLLECTION_PATTERN.test(title) ||
    COMPONENT_RECIPE_PATTERN.test(title) ||
    LOW_QUALITY_TITLE_PATTERN.test(title) ||
    UNHEALTHY_DESSERT_TITLE_PATTERN.test(title)
  ) {
    return false;
  }
  if (HARD_NON_MEAL_PATTERN.test(title) && !bakingSignal) return false;
  if (snackSignal) return true;
  if (bakingSignal) return true;
  if (titleNonMealSignal && !titleMealSignal) return false;

  return (
    titleMealSignal || primaryMealSignal || explicitMealPrep || DURABLE_MEAL_PATTERN.test(title)
  );
}

function classifyMealStyle(title: string, metadata: string, baking: boolean): MealStyle {
  if (BREAKFAST_STYLE_PATTERN.test(title)) return "breakfast";
  if (LIGHT_MEAL_STYLE_PATTERN.test(title)) return "light-meal";
  if (baking) {
    if (SAVOURY_BAKING_DINNER_PATTERN.test(title)) return "dinner";
    return SNACK_STYLE_PATTERN.test(title) ? "snack" : "other";
  }
  if (
    DINNER_STYLE_PATTERN.test(title) ||
    /\b(dinner|supper|main course|main dish|entree)\b/i.test(metadata)
  ) {
    return "dinner";
  }
  if (SNACK_STYLE_PATTERN.test(title)) return "snack";

  return "other";
}
function scoreRecipe(
  recipe: CorpusRecipe,
  filePath: string,
  options: CliOptions,
  counters: ScanCounters
): ScoredRecipe | null {
  counters.candidates += 1;

  const title = getText(recipe, "title", "name").trim();
  const url = getText(recipe, "url").trim();
  const ingredients = getIngredients(recipe);
  const instructions = getInstructions(recipe);
  if (!title || !url || ingredients.length === 0 || instructions.length === 0) {
    counters.missingCoreContent += 1;
    return null;
  }

  const metadata = getText(
    recipe,
    "title",
    "description",
    "category",
    "recipeCategory",
    "cuisine",
    "keywords",
    "tags"
  );
  const ingredientText = ingredients.join(" \n ");
  const categories = toTextList(recipe.category ?? recipe.recipeCategory);
  const cuisineMetadata = getText(recipe, "title", "keywords", "tags");
  const cuisineStyle = classifyCuisine(cuisineMetadata, toTextList(recipe.cuisine), title);
  const mediterranean = hasMediterraneanPattern(metadata, ingredientText);
  const explicitMealPrep = EXPLICIT_MEAL_PREP_PATTERN.test(
    `${metadata} ${getText(recipe, "instructions", "instructions_list")}`
  );
  const slowCooker = SLOW_COOKER_PATTERN.test(`${metadata} ${instructions.join(" \n ")}`);

  if (options.focus === "prep-or-slow-cooker" && !explicitMealPrep && !slowCooker) {
    counters.outsideFocus += 1;
    return null;
  }
  if (options.focus === "cuisine-variety" && cuisineStyle == null) {
    counters.outsideFocus += 1;
    return null;
  }
  if (options.focus === "mediterranean" && !mediterranean) {
    counters.outsideFocus += 1;
    return null;
  }
  if (options.focus === "cuisine-variety" && hasOnlyNonMealCategories(categories)) {
    counters.nonMeals += 1;
    return null;
  }
  if (
    !isLikelyMeal(title, metadata, explicitMealPrep, options.includeSnacks, options.includeBaking)
  ) {
    counters.nonMeals += 1;
    return null;
  }
  const baking = options.includeBaking && isBakingRecipe(title);
  const mealStyle = classifyMealStyle(title, metadata, baking);

  const sodiumMg = getSodiumMg(recipe);
  if (sodiumMg == null) {
    counters.missingSodium += 1;
    return null;
  }

  if (sodiumMg < 10) {
    counters.implausibleSodium += 1;
    return null;
  }

  const sodiumLimit =
    mealStyle === "snack"
      ? options.maxSnackSodium
      : baking
        ? options.maxBakingSodium
        : options.maxSodium;
  const addedSaltSwapLimit = Math.min(options.swapMaxSodium, sodiumLimit + 350);
  const sodiumSwapFriendly =
    mealStyle !== "snack" &&
    sodiumMg > sodiumLimit &&
    ((sodiumMg <= options.swapMaxSodium && STRONG_SODIUM_SWAP_PATTERN.test(ingredientText)) ||
      (sodiumMg <= addedSaltSwapLimit && ADDED_SALT_PATTERN.test(ingredientText)));
  if (sodiumMg > sodiumLimit && !sodiumSwapFriendly) {
    counters.aboveSodiumRange += 1;
    return null;
  }

  const dairy = classifyDairy(ingredients, metadata);
  if (dairy.status === "dairy-heavy") {
    counters.dairyHeavy += 1;
    return null;
  }

  const proteinText = `${title} ${ingredientText}`;
  const proteinStyle = classifyProtein(metadata, proteinText);
  const servings = getServings(recipe);
  const mealPrepFriendly =
    explicitMealPrep ||
    slowCooker ||
    (DURABLE_MEAL_PATTERN.test(`${title} ${metadata}`) && (servings == null || servings >= 4));
  const proteinG = getMetric(recipe, "proteinContent", "protein");
  const fiberG = getMetric(recipe, "fiberContent", "fiber");
  const sugarG = getMetric(recipe, "sugarContent", "sugar");
  const calories = getMetric(recipe, "calories", "calorieContent");
  const cholesterolMg = getMetric(recipe, "cholesterolContent", "cholesterol");
  const saturatedFatG = getMetric(recipe, "saturatedFatContent", "saturatedFat", "saturated_fat");
  const totalTimeMinutes = getPositiveNumber(recipe, "total_time", "totalTime");
  const quickMeal = totalTimeMinutes != null && totalTimeMinutes <= 45;
  const sugarLimit = baking
    ? 35
    : mealStyle === "breakfast"
      ? 30
      : mealStyle === "light-meal"
        ? 35
        : 40;
  if ((calories != null && calories > 1_000) || (sugarG != null && sugarG > sugarLimit)) {
    counters.unhealthyNutrition += 1;
    return null;
  }
  if (cholesterolMg != null && cholesterolMg > options.maxCholesterol) {
    counters.aboveCholesterolRange += 1;
    return null;
  }
  if (saturatedFatG != null && saturatedFatG > options.maxSaturatedFat) {
    counters.aboveSaturatedFatRange += 1;
    return null;
  }
  const hasProteinIngredient =
    /\b(chicken|turkey|beef|steak|veal|lamb|pork|fish|salmon|cod|haddock|tuna|prawns?|shrimp|eggs?|beans?|lentils?|chickpeas?|tofu|tempeh|edamame|seitan|quinoa)\b/i.test(
      proteinText
    );
  if (baking) {
    const hasBakingNutrition =
      (proteinG != null && proteinG >= 3) ||
      (fiberG != null && fiberG >= 2) ||
      WHOLE_FOOD_BAKING_PATTERN.test(`${metadata} ${ingredientText}`);
    const sensibleBakingCalories = calories == null || calories <= 500;
    if (
      !hasBakingNutrition ||
      !sensibleBakingCalories ||
      UNHEALTHY_BAKING_TITLE_PATTERN.test(title)
    ) {
      counters.unhealthyBaking += 1;
      return null;
    }
  } else if (mealStyle === "snack") {
    const hasSnackNutrition =
      (proteinG != null && proteinG >= 3) ||
      (fiberG != null && fiberG >= 2) ||
      WHOLE_FOOD_SNACK_PATTERN.test(metadata + " " + ingredientText);
    const sensibleSnackCalories = calories == null || (calories >= 50 && calories <= 400);
    const sensibleSnackSugar = sugarG == null || sugarG <= 30;
    const healthySnackTitle = !UNHEALTHY_SNACK_TITLE_PATTERN.test(title);
    if (!hasSnackNutrition || !sensibleSnackCalories || !sensibleSnackSugar || !healthySnackTitle) {
      counters.unhealthySnacks += 1;
      return null;
    }
  } else if ((proteinG == null || proteinG < 8) && !hasProteinIngredient) {
    counters.insufficientMealProtein += 1;
    return null;
  }

  const reasons: string[] = [];
  let score = 0;

  if (sodiumMg <= 350) {
    score += 5;
    reasons.push("very low reported sodium");
  } else if (sodiumMg <= 500) {
    score += 4;
    reasons.push("lower reported sodium");
  } else if (sodiumMg <= sodiumLimit) {
    score += 3;
    reasons.push("within sodium target");
  } else {
    score += 1;
    reasons.push("sodium-reduction swap available");
  }

  if (cholesterolMg != null) {
    if (cholesterolMg <= 25) {
      score += 3;
      reasons.push("very low reported cholesterol");
    } else if (cholesterolMg <= 50) {
      score += 2;
      reasons.push("low reported cholesterol");
    } else {
      score += 1;
      reasons.push("within cholesterol target");
    }
  }

  if (saturatedFatG != null) {
    if (saturatedFatG <= 2) {
      score += 3;
      reasons.push("very low reported saturated fat");
    } else if (saturatedFatG <= 4) {
      score += 2;
      reasons.push("low reported saturated fat");
    } else {
      score += 1;
      reasons.push("within saturated-fat target");
    }
  }

  if (dairy.status === "explicit-dairy-free") {
    score += 4;
    reasons.push("explicitly dairy-free");
  } else if (dairy.status === "likely-dairy-free") {
    score += 3;
    reasons.push("no obvious dairy ingredients");
  } else {
    score += 1;
    reasons.push("simple dairy swap available");
  }

  if (explicitMealPrep) {
    score += 5;
    reasons.push("explicit meal-prep or make-ahead signal");
  } else if (mealPrepFriendly) {
    score += 3;
    reasons.push("batch-friendly meal format");
  } else if (servings != null && servings >= 4) {
    score += 1;
    reasons.push("makes at least four servings");
  }

  if (slowCooker) {
    score += 5;
    reasons.push("slow-cooker or crockpot method");
  }

  if (options.includeSnacks) {
    if (mealStyle === "snack") {
      score += 3;
      reasons.push("nutritionally screened snack");
    } else if (mealStyle !== "other") {
      score += 2;
      reasons.push("balanced meal-style allocation");
    }
  } else if (mealStyle === "dinner") {
    score += 4;
    reasons.push("dinner-style main meal");
  } else if (mealStyle === "breakfast") {
    score -= 2;
    reasons.push("breakfast-style meal");
  } else if (mealStyle === "light-meal") {
    score -= 1;
    reasons.push("lighter lunch-style meal");
  }

  if (baking) {
    score += 3;
    reasons.push("nutritionally screened baking recipe");
  }

  if (fiberG != null && fiberG >= 5) {
    score += 2;
    reasons.push("at least 5 g reported fibre");
  } else if (fiberG != null && fiberG >= 3) {
    score += 1;
    reasons.push("at least 3 g reported fibre");
  }
  if (mealStyle === "snack" && calories != null && calories >= 100 && calories <= 350) {
    score += 2;
    reasons.push("sensible reported snack calories");
  }
  if (mealStyle === "snack" && sugarG != null && sugarG <= 15) {
    score += 1;
    reasons.push("moderate reported snack sugar");
  }
  if (proteinStyle === "vegetarian") {
    score += 4;
    reasons.push("vegetarian or plant-based protein");
  } else if (proteinStyle === "lean-protein") {
    score += 3;
    reasons.push("lean protein");
  } else if (proteinStyle === "red-meat") {
    score += 1;
    reasons.push("controlled red-meat allocation");
  }

  if (proteinG != null && proteinG >= 25) {
    score += 2;
    reasons.push("at least 25 g reported protein");
  } else if (proteinG != null && proteinG >= 15) {
    score += 1;
    reasons.push("at least 15 g reported protein");
  }

  if (mediterranean) {
    score += EXPLICIT_MEDITERRANEAN_PATTERN.test(metadata) ? 4 : 2;
    reasons.push("Mediterranean-style signal");
  }

  if (cuisineStyle != null) {
    score += 5;
    reasons.push(`targeted ${cuisineStyle.replaceAll("-", " ")} cuisine`);
  }

  if (quickMeal && mealStyle === "dinner") {
    score += 4;
    reasons.push("45-minute-or-less dinner");
  } else if (quickMeal) {
    score += 1;
    reasons.push("45 minutes or less");
  }

  if (recipe.image) score += 0.5;
  if (recipe.description) score += 0.5;

  if (score < options.minScore) {
    counters.belowMinimumScore += 1;
    return null;
  }

  counters.eligible += 1;

  return {
    filePath,
    sourceDomain: getSourceDomain(recipe, filePath),
    title,
    url,
    score,
    sodiumMg,
    cholesterolMg,
    saturatedFatG,
    proteinG,
    fiberG,
    sugarG,
    calories,
    servings,
    totalTimeMinutes,
    quickMeal,
    dairyStatus: dairy.status,
    dairySwaps: dairy.swaps,
    proteinStyle,
    mealStyle,
    baking,
    explicitMealPrep,
    mealPrepFriendly,
    slowCooker,
    mediterranean,
    cuisineStyle,
    sodiumSwapFriendly,
    reasons,
  };
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

function addToSourcePool(
  pools: Map<string, ScoredRecipe[]>,
  candidate: ScoredRecipe,
  poolSize: number
): void {
  const pool = pools.get(candidate.sourceDomain) ?? [];
  pool.push(candidate);
  pool.sort(compareCandidates);
  if (pool.length > poolSize) pool.length = poolSize;
  pools.set(candidate.sourceDomain, pool);
}

async function* walkJsonFiles(rootPath: string): AsyncGenerator<string> {
  const entries = await readdir(rootPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      yield* walkJsonFiles(fullPath);
    } else if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".json") &&
      entry.name !== "site-names.json"
    ) {
      yield fullPath;
    }
  }
}

function expandCandidates(parsed: unknown): CorpusRecipe[] {
  if (isRecord(parsed) && isRecord(parsed.recipes)) {
    return Object.values(parsed.recipes).filter(isRecord);
  }

  return isRecord(parsed) ? [parsed] : [];
}

async function processFile(
  filePath: string,
  options: CliOptions,
  counters: ScanCounters
): Promise<ScoredRecipe[]> {
  counters.files += 1;

  try {
    const raw = (await readFile(filePath, "utf8")).replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw) as unknown;

    return expandCandidates(parsed)
      .map((recipe) => scoreRecipe(recipe, filePath, options, counters))
      .filter((candidate): candidate is ScoredRecipe => candidate != null);
  } catch {
    counters.invalidJson += 1;
    return [];
  }
}

function selectShortlist(candidates: ScoredRecipe[], options: CliOptions): ScoredRecipe[] {
  const rankedCandidates = candidates.sort(compareCandidates);
  const selected: ScoredRecipe[] = [];
  const selectedUrls = new Set<string>();
  const selectedTitles = new Set<string>();
  const sourceCounts = new Map<string, number>();
  const cuisineCounts = new Map<CuisineStyle, number>();
  const minRedMeat = Math.floor(options.targetCount * options.minRedMeatRatio);
  const maxRedMeat = Math.floor(options.targetCount * options.maxRedMeatRatio);
  const minDinner = Math.floor(options.targetCount * options.minDinnerRatio);
  const maxDinner = Math.floor(options.targetCount * options.maxDinnerRatio);
  const minBreakfast = Math.floor(options.targetCount * options.minBreakfastRatio);
  const maxBreakfast = Math.floor(options.targetCount * options.maxBreakfastRatio);
  const minLightMeal = Math.floor(options.targetCount * options.minLightMealRatio);
  const maxLightMeal = Math.floor(options.targetCount * options.maxLightMealRatio);
  const minSnack = Math.floor(options.targetCount * options.minSnackRatio);
  const maxSnack = Math.floor(options.targetCount * options.maxSnackRatio);
  const minBaking = Math.floor(options.targetCount * options.minBakingRatio);
  const maxBaking = Math.floor(options.targetCount * options.maxBakingRatio);
  const minMealPrep = Math.floor(options.targetCount * options.minMealPrepRatio);
  let redMeatCount = 0;
  let dinnerCount = 0;
  let breakfastCount = 0;
  let lightMealCount = 0;
  let snackCount = 0;
  let bakingCount = 0;
  let mealPrepCount = 0;

  function trySelect(candidate: ScoredRecipe): boolean {
    if (selected.length >= options.targetCount) return false;
    if (selectedUrls.has(candidate.url) || selectedTitles.has(normalizeTitle(candidate.title))) {
      return false;
    }
    if ((sourceCounts.get(candidate.sourceDomain) ?? 0) >= options.maxPerSource) return false;
    if (
      options.focus === "cuisine-variety" &&
      candidate.cuisineStyle != null &&
      (cuisineCounts.get(candidate.cuisineStyle) ?? 0) >= options.maxPerCuisine
    ) {
      return false;
    }
    if (candidate.proteinStyle === "red-meat" && redMeatCount >= maxRedMeat) return false;
    if (candidate.mealStyle === "dinner" && dinnerCount >= maxDinner) return false;
    if (candidate.mealStyle === "breakfast" && breakfastCount >= maxBreakfast) return false;
    if (candidate.mealStyle === "light-meal" && lightMealCount >= maxLightMeal) return false;
    if (candidate.mealStyle === "snack" && snackCount >= maxSnack) return false;
    if (candidate.baking && bakingCount >= maxBaking) return false;

    selected.push(candidate);
    selectedUrls.add(candidate.url);
    selectedTitles.add(normalizeTitle(candidate.title));
    sourceCounts.set(candidate.sourceDomain, (sourceCounts.get(candidate.sourceDomain) ?? 0) + 1);
    if (candidate.cuisineStyle != null) {
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
    if (candidate.mealPrepFriendly) mealPrepCount += 1;

    return true;
  }

  for (const candidate of rankedCandidates) {
    if (redMeatCount >= minRedMeat) break;
    if (candidate.proteinStyle === "red-meat") trySelect(candidate);
  }
  for (const candidate of rankedCandidates) {
    if (mealPrepCount >= minMealPrep) break;
    if (candidate.mealPrepFriendly) trySelect(candidate);
  }
  for (const candidate of rankedCandidates) {
    if (bakingCount >= minBaking) break;
    if (candidate.baking) trySelect(candidate);
  }
  for (const [style, minimum] of [
    ["snack", minSnack],
    ["breakfast", minBreakfast],
    ["light-meal", minLightMeal],
    ["dinner", minDinner],
  ] as const) {
    for (const candidate of rankedCandidates) {
      const current =
        style === "dinner"
          ? dinnerCount
          : style === "breakfast"
            ? breakfastCount
            : style === "light-meal"
              ? lightMealCount
              : snackCount;
      if (current >= minimum) break;
      if (candidate.mealStyle === style) trySelect(candidate);
    }
  }
  for (const candidate of rankedCandidates) {
    if (selected.length >= options.targetCount) break;
    trySelect(candidate);
  }

  if (selected.length < options.targetCount) {
    throw new Error(
      "Only " + selected.length + " recipes satisfy the requested shortlist constraints"
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
    throw new Error(
      [
        "The candidate pool could not satisfy the requested balance:",
        `red meat ${redMeatCount}/${minRedMeat}`,
        `dinner ${dinnerCount}/${minDinner}`,
        `breakfast ${breakfastCount}/${minBreakfast}`,
        `light meal ${lightMealCount}/${minLightMeal}`,
        `snack ${snackCount}/${minSnack}`,
        `baking ${bakingCount}/${minBaking}`,
        `meal prep ${mealPrepCount}/${minMealPrep}`,
      ].join(", ")
    );
  }

  return selected.sort(compareCandidates);
}
function countBy<T extends string>(values: T[]): Record<T, number> {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);

  return Object.fromEntries(
    Array.from(counts.entries()).sort((left, right) => right[1] - left[1])
  ) as Record<T, number>;
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
    "slowCooker",
    "mediterranean",
    "cuisineStyle",
    "sodiumSwapFriendly",
    "reasons",
    "url",
    "filePath",
  ];
  const rows = selected.map((recipe, index) =>
    [
      index + 1,
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
  const options = parseArgs(process.argv.slice(2));
  const counters: ScanCounters = {
    files: 0,
    candidates: 0,
    invalidJson: 0,
    missingCoreContent: 0,
    nonMeals: 0,
    insufficientMealProtein: 0,
    unhealthySnacks: 0,
    unhealthyBaking: 0,
    unhealthyNutrition: 0,
    missingSodium: 0,
    implausibleSodium: 0,
    aboveSodiumRange: 0,
    aboveCholesterolRange: 0,
    aboveSaturatedFatRange: 0,
    dairyHeavy: 0,
    outsideFocus: 0,
    belowMinimumScore: 0,
    eligible: 0,
  };
  const sourcePools = new Map<string, ScoredRecipe[]>();
  const poolSize = Math.max(options.maxPerSource * 10, 250);
  const batchSize = 128;
  let batch: string[] = [];

  console.log(`Scanning recipe corpus: ${options.targetPath}`);

  async function flushBatch() {
    const results = await Promise.all(
      batch.map((filePath) => processFile(filePath, options, counters))
    );
    for (const candidate of results.flat()) addToSourcePool(sourcePools, candidate, poolSize);
    batch = [];

    if (counters.files % 5_000 < batchSize) {
      console.log(`Scanned ${counters.files} files; ${counters.eligible} eligible candidates`);
    }
  }

  for await (const filePath of walkJsonFiles(options.targetPath)) {
    if (options.limit && counters.files + batch.length >= options.limit) break;
    batch.push(filePath);
    if (batch.length >= batchSize) await flushBatch();
  }

  if (batch.length > 0) await flushBatch();

  const pooledCandidates = Array.from(sourcePools.values()).flat();
  const selected = selectShortlist(pooledCandidates, options);
  const ranked = selected.map((recipe, index) => ({ rank: index + 1, ...recipe }));
  const report = {
    generatedAt: new Date().toISOString(),
    mode: options.limit ? "sample" : "full-scan",
    targetPath: options.targetPath,
    configuration: {
      targetCount: options.targetCount,
      maxPerSource: options.maxPerSource,
      maxSodium: options.maxSodium,
      swapMaxSodium: options.swapMaxSodium,
      maxCholesterol: options.maxCholesterol,
      maxSaturatedFat: options.maxSaturatedFat,
      minRedMeatPercent: options.minRedMeatRatio * 100,
      maxRedMeatPercent: options.maxRedMeatRatio * 100,
      minDinnerPercent: options.minDinnerRatio * 100,
      maxDinnerPercent: options.maxDinnerRatio * 100,
      minBreakfastPercent: options.minBreakfastRatio * 100,
      maxBreakfastPercent: options.maxBreakfastRatio * 100,
      minLightMealPercent: options.minLightMealRatio * 100,
      maxLightMealPercent: options.maxLightMealRatio * 100,
      minSnackPercent: options.minSnackRatio * 100,
      maxSnackPercent: options.maxSnackRatio * 100,
      maxSnackSodium: options.maxSnackSodium,
      minBakingPercent: options.minBakingRatio * 100,
      maxBakingPercent: options.maxBakingRatio * 100,
      minMealPrepPercent: options.minMealPrepRatio * 100,
      maxBakingSodium: options.maxBakingSodium,
      maxPerCuisine: options.maxPerCuisine,
      includeSnacks: options.includeSnacks,
      includeBaking: options.includeBaking,
      minScore: options.minScore,
      focus: options.focus,
      limit: options.limit ?? null,
    },
    totals: {
      ...counters,
      pooledCandidates: pooledCandidates.length,
      selected: selected.length,
    },
    selectedBreakdown: {
      dairyStatus: countBy(selected.map((recipe) => recipe.dairyStatus)),
      proteinStyle: countBy(selected.map((recipe) => recipe.proteinStyle)),
      mealStyle: countBy(selected.map((recipe) => recipe.mealStyle)),
      baking: selected.filter((recipe) => recipe.baking).length,
      reportedFiberAtLeast3g: selected.filter(
        (recipe) => recipe.fiberG != null && recipe.fiberG >= 3
      ).length,
      reportedSugarAtMost15g: selected.filter(
        (recipe) => recipe.sugarG != null && recipe.sugarG <= 15
      ).length,
      explicitMealPrep: selected.filter((recipe) => recipe.explicitMealPrep).length,
      mealPrepFriendly: selected.filter((recipe) => recipe.mealPrepFriendly).length,
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
        swapBand: selected.filter((recipe) => recipe.sodiumMg > options.maxSodium).length,
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
        from51ToLimit: selected.filter(
          (recipe) => recipe.cholesterolMg != null && recipe.cholesterolMg > 50
        ).length,
      },
      saturatedFat: {
        reported: selected.filter((recipe) => recipe.saturatedFatG != null).length,
        upTo2g: selected.filter(
          (recipe) => recipe.saturatedFatG != null && recipe.saturatedFatG <= 2
        ).length,
        from2To4g: selected.filter(
          (recipe) =>
            recipe.saturatedFatG != null && recipe.saturatedFatG > 2 && recipe.saturatedFatG <= 4
        ).length,
        from4gToLimit: selected.filter(
          (recipe) => recipe.saturatedFatG != null && recipe.saturatedFatG > 4
        ).length,
      },
    },
    shortlist: ranked,
  };

  await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(options.csvPath, buildCsv(selected), "utf8");

  console.log(
    `Scan complete. Files: ${counters.files}, Eligible: ${counters.eligible}, Selected: ${selected.length}`
  );
  console.log(`Report: ${options.reportPath}`);
  console.log(`CSV: ${options.csvPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
