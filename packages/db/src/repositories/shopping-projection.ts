import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import z from "zod";

import { db } from "@norish/db/drizzle";
import {
  householdPeople,
  ingredients,
  plannerSlotDefinitions,
  planSlotItems,
  planSlotPeople,
  planSlots,
  prepSessionItems,
  prepSessions,
  recipeIngredients,
  recipePlannerProfiles,
  recipes,
} from "@norish/db/schema";
import {
  shoppingProjectionDayCountOptions,
  ShoppingProjectionDayCountSchema,
  ShoppingProjectionItemSchema,
  ShoppingProjectionResponseSchema,
} from "@norish/shared/contracts/zod";
import { normalizeIngredientNameForGrouping } from "@norish/shared/lib/grocery-grouping";

export const SHOPPING_WINDOW_OPTIONS = shoppingProjectionDayCountOptions;
export const DEFAULT_SHOPPING_WINDOW_DAYS = 28;

export type ShoppingProjectionItem = z.output<typeof ShoppingProjectionItemSchema>;
export type ShoppingProjectionResult = z.output<typeof ShoppingProjectionResponseSchema>;

type ShoppingAisle = z.infer<typeof ShoppingProjectionItemSchema>["aisle"];
type ShoppingLifecycle = z.infer<typeof ShoppingProjectionItemSchema>["lifecycle"];

type RecipeAggregateInput = {
  recipeId: string;
  recipeName: string;
  sourceYield: string | null;
  isDivisible: boolean;
  recipeTypes: string[];
  ingredients: Array<{
    recipeIngredientId: string;
    ingredientName: string;
    amount: number | null;
    unit: string | null;
    rawLine: string | null;
  }>;
};

type IngredientInput = {
  name: string;
  qty: number;
  unit: string;
  aisle: ShoppingAisle;
  isUnmeasured?: boolean;
  isServingExtra?: boolean;
  displayQualifier?: string;
};

type AccumulatedProjectionSource = {
  id: string;
  sourceKind: "planner" | "prep";
  recipeId: string;
  recipeName: string;
  contextLabel: string;
  itemName: string;
  qty: number;
  unit: string;
  date: string;
  weekIndex: number;
  role?: string;
};

type ProjectionSourceBase = {
  idPrefix: string;
  sourceKind: "planner" | "prep";
  recipeId: string;
  recipeName: string;
  contextLabel: string;
  date: string;
  weekIndex: number;
  role?: string;
};

type ProjectionAccumulator = ShoppingProjectionItem & {
  dedupName: string;
  sources: AccumulatedProjectionSource[];
};

type BuildShoppingProjectionParams = {
  householdId: string;
  dayCount: number;
  windowStart?: string;
};

type ShoppingIngredientOverride = {
  recipeIngredientId: string;
  replacementName: string | null;
  action: "replace" | "omit";
};

export function applyPlanSlotIngredientOverrides<
  TIngredient extends { recipeIngredientId: string; ingredientName: string },
>(
  ingredientsToAdjust: TIngredient[],
  _dairyFree: boolean,
  overrides: ShoppingIngredientOverride[]
): TIngredient[] {
  if (overrides.length === 0) return ingredientsToAdjust;

  const overrideByRecipeIngredientId = new Map(
    overrides.map((override) => [override.recipeIngredientId, override])
  );

  return ingredientsToAdjust.flatMap((ingredient) => {
    const override = overrideByRecipeIngredientId.get(ingredient.recipeIngredientId);

    if (override?.action === "omit") return [];
    if (override?.action !== "replace" || !override.replacementName) return [ingredient];

    return [{ ...ingredient, ingredientName: override.replacementName }];
  });
}

const STABLE_AISLES = new Set<ShoppingAisle>(["Pantry"]);
const AISLE_ORDER: ShoppingAisle[] = ["Produce", "Protein", "Dairy", "Pantry", "Bakery", "General"];

const UNIT_ALIASES: Record<string, string> = {
  gramme: "g",
  gram: "g",
  grams: "g",
  grammes: "g",
  kilograms: "kg",
  kilogram: "kg",
  kilos: "kg",
  kilo: "kg",
  milliliters: "ml",
  milliliter: "ml",
  millilitres: "ml",
  millilitre: "ml",
  liters: "l",
  litres: "l",
  litre: "l",
  pounds: "lb",
  pound: "lb",
  lbs: "lb",
  ozs: "oz",
  ounces: "oz",
  ounce: "oz",
  "fluid ounce": "fl oz",
  "fluid ounces": "fl oz",
  "fl. oz": "fl oz",
  "fl oz": "fl oz",
  tablespoons: "tbsp",
  tablespoon: "tbsp",
  "tbsp.": "tbsp",
  tbsps: "tbsp",
  tbs: "tbsp",
  teaspoons: "tsp",
  teaspoon: "tsp",
  "tsp.": "tsp",
  tsps: "tsp",
  cups: "cup",
  cupsful: "cup",
  c: "cup",
  cans: "can",
  can: "can",
  tins: "can",
  tin: "can",
  jar: "jar",
  jars: "jar",
  carton: "carton",
  cartons: "carton",
  bottle: "bottle",
  bottles: "bottle",
  bag: "bag",
  bags: "bag",
  box: "box",
  boxes: "box",
  block: "block",
  blocks: "block",
  packet: "pack",
  packets: "pack",
  pack: "pack",
  packs: "pack",
  package: "pack",
  packages: "pack",
  pkg: "pack",
  pkgs: "pack",
  heads: "head",
  head: "head",
  bulbs: "bulb",
  bulb: "bulb",
  bunches: "bunch",
  bunch: "bunch",
  cloves: "clove",
  fillets: "fillet",
  fillet: "fillet",
  filets: "fillet",
  filet: "fillet",
  breasts: "breast",
  breast: "breast",
  thighs: "thigh",
  thigh: "thigh",
  links: "link",
  link: "link",
  sticks: "stick",
  stick: "stick",
  ears: "ear",
  ear: "ear",
  slices: "slice",
  slice: "slice",
  wedges: "wedge",
  wedge: "wedge",
  pieces: "piece",
  piece: "piece",
  stalks: "stalk",
  stalk: "stalk",
  spears: "spear",
  spear: "spear",
  sprigs: "sprig",
  sprig: "sprig",
  handfuls: "handful",
  handful: "handful",
  pinches: "pinch",
  pinch: "pinch",
  dashes: "dash",
  dash: "dash",
};

const VOL_TO_TSP: Record<string, number> = {
  tsp: 1,
  tbsp: 3,
  "fl oz": 6,
  cup: 48,
  ml: 0.202884,
  l: 202.884,
};

const WEIGHT_TO_G: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.35,
  lb: 453.6,
};

const COUNT_UNITS = new Set([
  "unit",
  "large",
  "medium",
  "small",
  "clove",
  "piece",
  "slice",
  "stalk",
  "spear",
  "sprig",
  "bunch",
  "can",
  "jar",
  "carton",
  "bottle",
  "bag",
  "box",
  "block",
  "pack",
  "head",
  "bulb",
  "fillet",
  "breast",
  "thigh",
  "link",
  "stick",
  "ear",
  "wedge",
  "handful",
  "pinch",
  "dash",
]);

const VOL_CANONICAL = "__vol_tsp__";
const WEIGHT_CANONICAL = "__weight_g__";

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

export function thisMondayISO(): string {
  const today = new Date();
  const utc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const day = utc.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  utc.setUTCDate(utc.getUTCDate() + diff);

  return utc.toISOString().slice(0, 10);
}

function normalizeShoppingWindowDays(value: number | undefined): number {
  const parsed = ShoppingProjectionDayCountSchema.safeParse(value ?? DEFAULT_SHOPPING_WINDOW_DAYS);

  return parsed.success ? parsed.data : DEFAULT_SHOPPING_WINDOW_DAYS;
}

function parseSourceYieldNumber(sourceYield: string | null | undefined): number {
  if (!sourceYield) return 1;
  const match = sourceYield.match(/(\d+)/);

  return match ? parseInt(match[1] ?? "1", 10) : 1;
}

function computeProductionScale(
  requestedServings: number,
  sourceYield: string | null | undefined,
  isDivisible = true
): number {
  const safeRequestedServings = Math.max(1, requestedServings);
  const baseYield = Math.max(1, parseSourceYieldNumber(sourceYield));

  if (isDivisible) {
    return safeRequestedServings / baseYield;
  }

  return Math.max(1, Math.ceil(safeRequestedServings / baseYield));
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatShortDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function inferAisle(name: string): ShoppingAisle {
  const normalized = normalizeText(name).toLowerCase();

  if (
    /\b(green bean|green beans|snap pea|snap peas|sugar snap pea|sugar snap peas|mangetout|edamame|spinach|kale|lettuce|rocket|arugula|mixed greens?|onion|red onion|yellow onion|white onion|garlic|carrot|potato|sweet potato|bell pepper|red pepper|yellow pepper|green pepper|capsicum|mushroom|leek|celery|cucumber|courgette|zucchini|broccoli|cauliflower|asparagus|peas?\b|corn|avocado|lime|lemon|orange|apple|banana|berry|berries|blueberry|blueberries|strawberry|strawberries|raspberry|raspberries|grape|grapes|tomato|tomatoes|cherry tomato|cherry tomatoes|salad|fresh herb|fresh chilli|fresh chili|chilli|chili|jalapeno|jalapeño|spring onion|green onion|shallot|aubergine|eggplant|artichoke|cabbage|radish|beetroot|beet|ginger root)\b/.test(
      normalized
    )
  ) {
    return "Produce";
  }
  if (
    /\b(chicken|beef|pork|turkey|lamb|fish|salmon|tuna|cod|haddock|prawn|prawns|shrimp|tofu|mince|steak|thigh|breast|meatball|meatballs|sausage|sausages|bacon|ham|prosciutto|chorizo|pepperoni)\b/.test(
      normalized
    )
  ) {
    return "Protein";
  }
  if (
    /\b(egg|eggs|milk|butter|cream|cheese|feta|mozzarella|cheddar|parmesan|yogurt|yoghurt|cr[eè]me fra[iî]che|sour cream)\b/.test(
      normalized
    )
  ) {
    return "Dairy";
  }
  if (/\b(stock|broth|bouillon)\b|stock cube|stock powder|stock paste/.test(normalized)) {
    return "Pantry";
  }
  if (/bread|roll|wrap|tortilla|muffin|bun|pitta|flatbread|bagel|loaf/.test(normalized)) {
    return "Bakery";
  }
  if (
    /\b(salt|pepper|paprika|cumin|oregano|thyme|basil|parsley|spice|seasoning|garlic powder|onion powder|chili powder|chilli powder|sugar|flour|rice|oats|pasta|quinoa|lentils|breadcrumbs|noodles|oil|olive oil|vinegar|sauce|mustard|tamari|soy|honey|syrup|paste|coconut milk|beans|chickpeas|garbanzo|black beans?|kidney beans?|cannellini beans?|white beans?|butter beans?|tinned|canned|jarred|passata|tomato paste|tahini|peanut butter|almond butter|broth|stock|capers|olives)\b/.test(
      normalized
    )
  ) {
    return "Pantry";
  }

  return "General";
}

function inferShoppingAisle(name: string): ShoppingAisle {
  const normalized = normalizeText(name).toLowerCase();

  const producePattern =
    /\b(green bean|green beans|snap pea|snap peas|sugar snap pea|sugar snap peas|mangetout|edamame|spinach|kale|lettuce|romaine|cos lettuce|rocket|arugula|mixed greens?|onion|red onion|yellow onion|white onion|garlic|carrot|potato|sweet potato|russet potato|brussels? sprouts?|brussel sprouts?|bell pepper|red pepper|yellow pepper|green pepper|capsicum|mushroom|leek|celery|cucumber|courgette|zucchini|broccoli|broccolini|cauliflower|asparagus|peas?\b|corn|avocado|lime|lemon|orange|apple|banana|berry|berries|blueberry|blueberries|strawberry|strawberries|raspberry|raspberries|grape|grapes|tomato|tomatoes|cherry tomato|cherry tomatoes|salad|fresh herb|fresh chilli|fresh chili|chilli|chili|jalapeno|scallion|spring onion|green onion|shallot|aubergine|eggplant|artichoke|cabbage|radish|beetroot|beet|ginger|chives|mint|cilantro|coriander)\b/;
  const proteinPattern =
    /\b(chicken|beef|pork|turkey|lamb|fish|salmon|tuna|cod|haddock|prawn|prawns|shrimp|tofu|mince|steak|roast|thigh|breast|meatball|meatballs|sausage|sausages|bacon|ham|prosciutto|chorizo|pepperoni)\b/;
  const dairyPattern =
    /\b(egg|eggs|milk|butter|cream|cheese|feta|mozzarella|cheddar|parmesan|pecorino|romano|yogurt|yoghurt|creme fraiche|sour cream)\b/;
  const bakeryPattern = /\b(bread|roll|wrap|tortilla|muffin|bun|pitta|flatbread|bagel|loaf)\b/;
  const pantryPattern =
    /\b(salt|pepper|paprika|cumin|oregano|thyme|dried basil|dried parsley|spice|seasoning|garlic powder|onion powder|chili powder|chilli powder|sugar|flour|rice|oats|pasta|orzo|couscous|quinoa|lentils|breadcrumbs|noodles|oil|olive oil|vinegar|sauce|mustard|tamari|soy|honey|syrup|paste|coconut milk|beans|chickpeas|garbanzo|black beans?|kidney beans?|cannellini beans?|white beans?|butter beans?|tinned|canned|jarred|cans?|tins?|jars?|cartons?|passata|tomato paste|tomato sauce|tahini|peanut butter|almond butter|cashew butter|nut butter|broth|stock|bouillon|capers|olives|chia seeds?|hemp seeds?|pumpkin seeds?|cereal|vanilla extract|cocoa powder|protein powder)\b/;
  const freshHerbPattern =
    /\b(fresh|chopped fresh)\s+(parsley|basil|cilantro|coriander|mint|chives|dill|thyme)\b/;
  const packagedPantryPattern =
    /\b(canned|tinned|jarred|cans?|tins?|jars?|passata|tomato paste|tomato sauce)\b/;
  const shelfPantryPattern =
    /\b(oil|vinegar|sauce|mustard|tamari|soy|honey|syrup|paste|coconut milk|tahini|peanut butter|almond butter|cashew butter|nut butter|oats|pasta|orzo|couscous|quinoa|rice|lentils|breadcrumbs|noodles|flour|sugar|cereal|vanilla extract|cocoa powder|chia seeds?|hemp seeds?|pumpkin seeds?|protein powder|salt|black pepper|pepper flakes|chili flakes|chilli flakes|paprika|cumin|oregano|basil|dried basil|dried parsley|ground cilantro|ground coriander|ground turmeric|garlic powder|onion powder|chili powder|chilli powder|spice|seasoning|baking powder|bay (?:leaf|leaves)|cinnamon|chocolate chips?|italian herbs?|olive medley|olives?)\b/;
  const produceFallbackPattern =
    /\b(carrots?|mushrooms?|spring onions?|green onions?|scallions?|sweet potatoes?|russet potatoes?|flat leaf parsley|parsley|ginger)\b/;

  if (/\b(stock|broth|bouillon)\b|stock cube|stock powder|stock paste/.test(normalized)) {
    return "Pantry";
  }
  if (freshHerbPattern.test(normalized)) return "Produce";
  if (packagedPantryPattern.test(normalized) || shelfPantryPattern.test(normalized))
    return "Pantry";
  if (proteinPattern.test(normalized)) return "Protein";
  if (producePattern.test(normalized)) return "Produce";
  if (
    produceFallbackPattern.test(normalized) &&
    !/\b(dried|ground|powder|seasoning)\b/.test(normalized)
  ) {
    return "Produce";
  }
  if (bakeryPattern.test(normalized)) return "Bakery";
  if (/\b(peanut|almond|cashew|nut)\s+butter\b/.test(normalized)) return "Pantry";
  if (dairyPattern.test(normalized)) return "Dairy";
  if (pantryPattern.test(normalized)) return "Pantry";

  return "General";
}

function isUnmeasuredPantryStaple(name: string, aisle: ShoppingAisle): boolean {
  if (aisle !== "Pantry") return false;

  return /\b(salt|pepper|paprika|cumin|oregano|thyme|basil|parsley|spice|seasoning|garlic powder|onion powder|chili powder|oil|vinegar)\b/.test(
    normalizeText(name).toLowerCase()
  );
}

function getUnmeasuredServingExtraQualifier(
  name: string,
  rawLine: string | null | undefined,
  hasExplicitAmount: boolean
): string | null {
  if (hasExplicitAmount) return null;

  const normalized = normalizeText(`${name} ${rawLine ?? ""}`).toLowerCase();

  if (/\b(for serving|to serve)\b/.test(normalized)) return "for serving";
  if (/\b(for garnish|to garnish)\b/.test(normalized)) return "for garnish";
  if (/\boptional\b/.test(normalized)) return "optional";
  if (/\bto taste\b/.test(normalized)) return "to taste";
  if (/\b(as needed|as desired)\b/.test(normalized)) return "as needed";
  if (/\bplus more\b/.test(normalized)) return "extra";

  return null;
}

function canonicalUnit(unit: string): string {
  const normalized = normalizeText(unit).toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");

  return UNIT_ALIASES[normalized] ?? normalized;
}

function isRecognizedShoppingUnit(unit: string): boolean {
  const canonical = canonicalUnit(unit);

  return Boolean(
    canonical && (VOL_TO_TSP[canonical] || WEIGHT_TO_G[canonical] || COUNT_UNITS.has(canonical))
  );
}

const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  chickpea: "Chickpeas",
  oats: "Oats",
  "brussels sprout": "Brussels Sprouts",
  "green bean": "Green Beans",
  "salt pepper": "Salt & Pepper",
  "salt and pepper": "Salt & Pepper",
};

function stripPackageAndPrepNoise(name: string): string {
  return normalizeIngredientNameForGrouping(name)
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+-\s+.*$/g, "")
    .replace(
      /\b\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*(?:fl\s*oz|fluid ounces?|ounces?|ounce|oz|grams?|gram|g|kilograms?|kg|pounds?|lbs?|lb|millilit(?:er|re)s?|ml|lit(?:er|re)s?|l)\b/g,
      " "
    )
    .replace(
      /\b(?:x\s*)?\d+(?:\.\d+)?\s*(?:g|kg|oz|ml|l)\s*(?:cans?|tins?|jars?|cartons?|bottles?|packs?|packets?|bags?|boxes?)\b/g,
      " "
    )
    .replace(
      /\b(?:cans?|tins?|jars?|cartons?|bottles?|packs?|packets?|packages?|bags?|boxes?)\s+(?:of\s+)?/g,
      " "
    )
    .replace(/\bcanned\b/g, " ")
    .replace(/\b(?:drained|rinsed|undrained|reserved|patted dry)\b/g, " ")
    .replace(/\b(?:cut|sliced|chopped|diced)\s+into\b.*$/g, " ")
    .replace(/,\s*into\b.*$/g, " ")
    .replace(
      /\b(?:divided|optional|to taste|plus more|for garnish|for serving|if needed|as needed|of choice)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIngredientNamePart(name: string): string {
  return stripPackageAndPrepNoise(name)
    .replace(/^[,\s-]+/g, "")
    .replace(/^(?:and|or|to)\s+/g, "")
    .replace(/^(fresh|dried|frozen)\s+/i, "")
    .replace(/\bextra virgin\b/g, "")
    .replace(/\bto taste\b/g, "")
    .replace(/\bplus more\b/g, "")
    .replace(/\bfor serving\b/g, "")
    .replace(/\bfinely\b/g, "")
    .replace(/\broughly\b/g, "")
    .replace(/\bthinly\b/g, "")
    .replace(/\bcoarsely\b/g, "")
    .replace(/\bchopped\b/g, "")
    .replace(/\bdiced\b(?!\s+tomato)/g, "")
    .replace(/\bsliced\b/g, "")
    .replace(/\bminced\b/g, "")
    .replace(/\bcrushed\b(?!\s+tomato)/g, "")
    .replace(/\bcrumbled\b/g, "")
    .replace(/\bgrated\b/g, "")
    .replace(/\bsmashed\b/g, "")
    .replace(/\bdrained\b/g, "")
    .replace(/\brinsed\b/g, "")
    .replace(/\bhalved\b/g, "")
    .replace(/\bquartered\b/g, "")
    .replace(/\bpeeled\b/g, "")
    .replace(/\bseeded\b/g, "")
    .replace(/\bcooked\b/g, "")
    .replace(/\bcooled\b/g, "")
    .replace(/\braw\b/g, "")
    .replace(/\byoghurt\b/g, "yogurt")
    .replace(/\bcoriander\b/g, "cilantro")
    .replace(/\bgarbanzo beans?\b/g, "chickpea")
    .replace(/\bchick[\s-]?peas\b/g, "chickpea")
    .replace(/\bchickpeas\b/g, "chickpea")
    .replace(/\bscallions?\b/g, "green onion")
    .replace(/\bspring onions?\b/g, "green onion")
    .replace(/\bcapsicums?\b/g, "bell pepper")
    .replace(/\bcourgettes?\b/g, "zucchini")
    .replace(/\baubergines?\b/g, "eggplant")
    .replace(/\bchillies\b/g, "chili")
    .replace(/\bchilies\b/g, "chili")
    .replace(/\bjalapeños\b/g, "jalapeno")
    .replace(/\bgluten[-\s]?free\s+(?:old[-\s]?fashioned\s+|rolled\s+)?oats\b/g, "oats")
    .replace(/\bold[-\s]?fashioned\s+(?:rolled\s+)?oats\b/g, "oats")
    .replace(/\brolled\s+oats\b/g, "oats")
    .replace(/\bquick(?:[-\s]?cooking|[-\s]?cook|[-\s]?rolled)?\s+oats\b/g, "oats")
    .replace(/\bporridge\s+oats\b/g, "oats")
    .replace(/\bwhole\s+oats\b/g, "oats")
    .replace(/\bcloves?\s+of\s+garlic\b/g, "garlic")
    .replace(/\bjuice of (?:\d+\/\d+\s+)?lemons?\b/g, "lemon")
    .replace(/\bzest of lemons?\b/g, "lemon")
    .replace(/\blemon of (?:\d+\/\d+\s+)?lemon\b/g, "lemon")
    .replace(/\bsalt\s*(?:&|\+|and)\s*pepper\b/g, "salt pepper")
    .replace(/\bbrussel sprouts\b/g, "brussels sprout")
    .replace(/\bbrussels sprouts\b/g, "brussels sprout")
    .replace(/\beggs\b/g, "egg")
    .replace(/\bcarrots\b/g, "carrot")
    .replace(/\btomatoes\b/g, "tomato")
    .replace(/\bonions\b/g, "onion")
    .replace(/\bpotatoes\b/g, "potato")
    .replace(/\bbananas\b/g, "banana")
    .replace(/\bripe banana\b/g, "banana")
    .replace(/\bmashed banana\b/g, "banana")
    .replace(/\b(?:small|medium|large)\s+red onion\b/g, "red onion")
    .replace(/\brusset potato,\s*and large\b/g, "russet potato")
    .replace(/\bgreen beans\b/g, "green bean")
    .replace(/\bberries\b/g, "berry")
    .replace(/\bcloves garlic\b/g, "garlic")
    .replace(/\bgarlic cloves?\b/g, "garlic")
    .replace(/\blemon juice\b/g, "lemon")
    .replace(/\blime juice\b/g, "lime")
    .replace(/\blemon zest\b/g, "lemon")
    .replace(/\blime zest\b/g, "lime")
    .replace(/\blemon of (?:\d+\/\d+\s+)?lemon\b/g, "lemon")
    .replace(/\bsea salt\b/g, "salt")
    .replace(/\bkosher salt\b/g, "salt")
    .replace(/\bflaky sea salt\b/g, "salt")
    .replace(/\bflaky salt\b/g, "salt")
    .replace(/\bblack pepper\b/g, "pepper")
    .replace(/\bfreshly ground pepper\b/g, "pepper")
    .replace(/\bground pepper\b/g, "pepper")
    .replace(/\s+/g, " ")
    .replace(/^\s*(?:and|or|to)\s+/g, "")
    .replace(/,\s*(?:and|or|to)\s*$/g, "")
    .replace(/\s*,+\s*$/g, "")
    .replace(/,?\s+(?:and|or|to)$/g, "")
    .replace(/\s*,+\s*$/g, "")
    .trim();
}

function toDisplayCase(name: string): string {
  return name.replace(/\b\w+/g, (word) => {
    if (["and", "or", "of"].includes(word)) return word;

    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

function canonicalizeIngredientName(name: string): { dedupName: string; displayName: string } {
  const dedupName = normalizeIngredientNamePart(name);

  return {
    dedupName,
    displayName: DISPLAY_NAME_OVERRIDES[dedupName] ?? toDisplayCase(dedupName),
  };
}

function tspToDisplay(totalTsp: number): { qty: number; unit: string } {
  if (totalTsp < 3) return { qty: Math.round(totalTsp * 100) / 100, unit: "tsp" };
  if (totalTsp < 48) return { qty: Math.round((totalTsp / 3) * 100) / 100, unit: "tbsp" };

  return { qty: Math.round((totalTsp / 48) * 100) / 100, unit: "cup" };
}

function gToDisplay(totalG: number): { qty: number; unit: string } {
  if (totalG >= 1000) return { qty: Math.round((totalG / 1000) * 10) / 10, unit: "kg" };

  return { qty: Math.round(totalG), unit: "g" };
}

function normalizeProjectionAmount(totalQty: number, unit: string): { qty: number; unit: string } {
  if (unit === VOL_CANONICAL) {
    return tspToDisplay(totalQty);
  }

  if (unit === WEIGHT_CANONICAL) {
    return gToDisplay(totalQty);
  }

  if (COUNT_UNITS.has(unit)) {
    return { qty: Math.ceil(totalQty), unit };
  }

  return { qty: Math.round(totalQty * 1000) / 1000, unit };
}

function parseRawIngredientLine(
  rawLine: string | null | undefined
): { qty: number; unit: string } | null {
  if (!rawLine) return null;

  const normalized = normalizeText(rawLine);
  const spaceMatch = normalized.match(/^([\d.]+)\s+([a-zA-Z%]+(?:\s+[a-zA-Z%]+)?)/);
  const compactMatch = normalized.match(/^([\d.]+)([a-zA-Z%]+)/);

  if (spaceMatch) {
    return {
      qty: Number.parseFloat(spaceMatch[1] ?? "1"),
      unit: spaceMatch[2] ?? "unit",
    };
  }

  if (compactMatch) {
    return {
      qty: Number.parseFloat(compactMatch[1] ?? "1"),
      unit: compactMatch[2] ?? "unit",
    };
  }

  return /^[\d.]+$/.test(normalized)
    ? {
        qty: Number.parseFloat(normalized),
        unit: "unit",
      }
    : null;
}

function inferCountUnitFromName(name: string): string | null {
  const normalized = normalizeText(name).toLowerCase();
  const match = normalized.match(
    /\b(cloves?|fillets?|filets?|breasts?|thighs?|links?|sticks?|ears?|slices?|wedges?|pieces?|stalks?|spears?|sprigs?|bunches?|heads?|bulbs?)\b/
  );

  return match?.[1] ? canonicalUnit(match[1]) : null;
}

function normalizeContainerUnit(value: string): string | null {
  const canonical = canonicalUnit(value);

  if (["can", "jar", "carton", "bottle", "bag", "box", "pack"].includes(canonical)) {
    return canonical;
  }

  return null;
}

function findContainerUnit(
  name: string,
  rawLine: string | null | undefined,
  unit: string
): string | null {
  const text = `${rawLine ?? ""} ${name}`.toLowerCase();
  const directMatch = text.match(
    /\b(cans?|tins?|jars?|cartons?|bottles?|bags?|boxes?|packs?|packets?|packages?)\b/
  );

  if (directMatch?.[1]) {
    return normalizeContainerUnit(directMatch[1]);
  }

  const canonical = canonicalUnit(unit);

  if (
    /\bcanned\b/.test(text) &&
    (canonical === "oz" ||
      canonical === "g" ||
      canonical === "kg" ||
      canonical === "ml" ||
      canonical === "l")
  ) {
    return "can";
  }

  return null;
}

function parseContainerCount(rawLine: string | null | undefined): number | null {
  if (!rawLine) return null;

  const normalized = normalizeText(rawLine.replace(/[\u2013\u2014]/g, "-").toLowerCase());
  const sizeUnit =
    "(?:fl\\s*oz|fluid ounces?|ounces?|ounce|oz|grams?|gram|g|kilograms?|kg|pounds?|lbs?|lb|millilit(?:er|re)s?|ml|lit(?:er|re)s?|l)";
  const container =
    "(?:cans?|tins?|jars?|cartons?|bottles?|bags?|boxes?|packs?|packets?|packages?)";
  const patterns = [
    new RegExp(
      `^\\s*(\\d+(?:\\.\\d+)?)\\s*[-x]?\\s*\\(?\\s*\\d+(?:\\.\\d+)?\\s*${sizeUnit}\\)?\\s*${container}\\b`
    ),
    new RegExp(
      `^\\s*(\\d+(?:\\.\\d+)?)\\s*\\(\\s*\\d+(?:\\.\\d+)?\\s*${sizeUnit}\\s*\\)\\s*${container}\\b`
    ),
    new RegExp(`^\\s*(\\d+(?:\\.\\d+)?)\\s+${container}\\b`),
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const count = Number.parseFloat(match?.[1] ?? "");

    if (Number.isFinite(count) && count > 0) return count;
  }

  return null;
}

function normalizePackagedIngredient(
  input: Omit<RecipeAggregateInput["ingredients"][number], "recipeIngredientId">,
  qty: number,
  unit: string
): { qty: number; unit: string } | null {
  const containerUnit = findContainerUnit(input.ingredientName, input.rawLine, unit);

  if (!containerUnit) return null;

  const canonical = canonicalUnit(unit);
  const countFromRawLine = parseContainerCount(input.rawLine);
  const countFromUnit = canonical === containerUnit ? qty : null;
  const countFromName =
    input.amount !== null &&
    !unit.trim() &&
    /\b(cans?|tins?|jars?|cartons?|bottles?|bags?|boxes?|packs?|packets?|packages?)\b/i.test(
      input.ingredientName
    )
      ? qty
      : null;
  const count =
    countFromRawLine ??
    countFromUnit ??
    (countFromName && countFromName <= 12 ? countFromName : null) ??
    1;

  return {
    qty: Number.isFinite(count) && count > 0 ? count : 1,
    unit: containerUnit,
  };
}

function toIngredientInput(
  input: Omit<RecipeAggregateInput["ingredients"][number], "recipeIngredientId">
): IngredientInput | null {
  const name = normalizeText(input.ingredientName);

  if (!name) return null;

  const shoppingName = normalizeIngredientNamePart(name);

  if (["water", "boiling water", "hot water"].includes(shoppingName)) return null;

  const fallback = parseRawIngredientLine(input.rawLine);
  const hasExplicitAmount = input.amount !== null || fallback !== null;
  const qty = input.amount ?? fallback?.qty ?? 1;
  const inferredCountUnit = inferCountUnitFromName(name);
  const explicitUnit = input.unit?.trim();
  const explicitCanonicalUnit = explicitUnit ? canonicalUnit(explicitUnit) : "";
  const preferredExplicitUnit =
    explicitUnit &&
    !(["large", "medium", "small"].includes(explicitCanonicalUnit) && inferredCountUnit)
      ? explicitUnit
      : null;
  const fallbackUnit = fallback?.unit?.trim();
  const unit =
    preferredExplicitUnit ||
    (fallbackUnit && isRecognizedShoppingUnit(fallbackUnit) ? fallbackUnit : null) ||
    inferredCountUnit ||
    "unit";
  const packaged = normalizePackagedIngredient(input, qty, unit);
  const aisle = packaged ? "Pantry" : inferShoppingAisle(stripPackageAndPrepNoise(name) || name);

  const servingExtraQualifier = getUnmeasuredServingExtraQualifier(
    name,
    input.rawLine,
    hasExplicitAmount
  );

  if (servingExtraQualifier) {
    return {
      name,
      qty: 0,
      unit: "",
      aisle,
      isUnmeasured: true,
      isServingExtra: true,
      displayQualifier: servingExtraQualifier,
    };
  }

  if (!hasExplicitAmount && isUnmeasuredPantryStaple(name, aisle)) {
    return {
      name,
      qty: 0,
      unit: "",
      aisle,
      isUnmeasured: true,
    };
  }

  return {
    name,
    qty: packaged?.qty ?? (Number.isFinite(qty) && qty > 0 ? qty : 1),
    unit: packaged?.unit ?? unit,
    aisle,
  };
}

export function previewShoppingProjectionIngredient(input: {
  ingredientName: string;
  amount: number | null;
  unit: string | null;
  rawLine: string | null;
}): {
  displayName: string;
  dedupName: string;
  qty: number;
  unit: string;
  aisle: ShoppingAisle;
} | null {
  const ingredient = toIngredientInput(input);

  if (!ingredient) return null;

  const canonicalName = canonicalizeIngredientName(ingredient.name);
  const qualifierKey = ingredient.displayQualifier
    ? normalizeIngredientNameForGrouping(ingredient.displayQualifier).replace(/\s+/g, "-")
    : null;
  const dedupName =
    ingredient.isServingExtra && qualifierKey
      ? `${canonicalName.dedupName}::${qualifierKey}`
      : canonicalName.dedupName;
  const displayName =
    ingredient.isServingExtra && ingredient.displayQualifier
      ? `${canonicalName.displayName} (${ingredient.displayQualifier})`
      : canonicalName.displayName;

  return {
    displayName,
    dedupName,
    qty: ingredient.qty,
    unit: ingredient.unit,
    aisle: ingredient.aisle,
  };
}

function sortProjectionItems(items: ShoppingProjectionItem[]): ShoppingProjectionItem[] {
  return items.sort((left, right) => {
    const aisleOrder = AISLE_ORDER.indexOf(left.aisle) - AISLE_ORDER.indexOf(right.aisle);

    if (aisleOrder !== 0) return aisleOrder;

    return left.name.localeCompare(right.name);
  });
}

async function listRecipeAggregateInputs(
  recipeIds: string[]
): Promise<Map<string, RecipeAggregateInput>> {
  if (recipeIds.length === 0) return new Map();

  const [recipeRows, ingredientRows] = await Promise.all([
    db
      .select({
        recipeId: recipes.id,
        recipeName: recipes.name,
        sourceYield: recipePlannerProfiles.sourceYield,
        recipeTypes: recipePlannerProfiles.recipeTypes,
        isDivisible: recipePlannerProfiles.isDivisible,
      })
      .from(recipes)
      .leftJoin(recipePlannerProfiles, eq(recipePlannerProfiles.recipeId, recipes.id))
      .where(inArray(recipes.id, recipeIds)),
    db
      .select({
        recipeId: recipeIngredients.recipeId,
        recipeIngredientId: recipeIngredients.id,
        ingredientName: ingredients.name,
        amount: recipeIngredients.amount,
        unit: recipeIngredients.unit,
        rawLine: recipeIngredients.rawLine,
      })
      .from(recipeIngredients)
      .innerJoin(ingredients, eq(recipeIngredients.ingredientId, ingredients.id))
      .where(inArray(recipeIngredients.recipeId, recipeIds))
      .orderBy(asc(recipeIngredients.recipeId), asc(recipeIngredients.order)),
  ]);

  const ingredientsByRecipeId = ingredientRows.reduce<
    Record<
      string,
      Array<{
        recipeIngredientId: string;
        ingredientName: string;
        amount: number | null;
        unit: string | null;
        rawLine: string | null;
      }>
    >
  >((acc, row) => {
    const bucket = acc[row.recipeId] ?? (acc[row.recipeId] = []);
    bucket.push({
      recipeIngredientId: row.recipeIngredientId,
      ingredientName: row.ingredientName,
      amount: row.amount === null ? null : Number(row.amount),
      unit: row.unit,
      rawLine: row.rawLine,
    });

    return acc;
  }, {});

  return new Map(
    recipeRows.map((row) => [
      row.recipeId,
      {
        recipeId: row.recipeId,
        recipeName: row.recipeName,
        sourceYield: row.sourceYield,
        isDivisible: row.isDivisible ?? true,
        recipeTypes: row.recipeTypes ?? [],
        ingredients: ingredientsByRecipeId[row.recipeId] ?? [],
      },
    ])
  );
}

export async function buildShoppingProjection(
  params: BuildShoppingProjectionParams
): Promise<ShoppingProjectionResult> {
  const dayCount = normalizeShoppingWindowDays(params.dayCount);
  const windowStart = params.windowStart ?? thisMondayISO();
  const windowEnd = addDays(windowStart, dayCount - 1);
  const weekCount = Math.ceil(dayCount / 7);
  const weekStarts = Array.from({ length: weekCount }, (_, index) =>
    addDays(windowStart, index * 7)
  );

  const planSlotRows = await db
    .select()
    .from(planSlots)
    .where(
      and(
        eq(planSlots.householdId, params.householdId),
        gte(planSlots.date, windowStart),
        lte(planSlots.date, windowEnd)
      )
    )
    .orderBy(asc(planSlots.date), asc(planSlots.plannerSlotDefinitionId));

  const planSlotIds = planSlotRows.map((slot) => slot.id);
  const slotDefinitionIds = [...new Set(planSlotRows.map((slot) => slot.plannerSlotDefinitionId))];
  const planSlotItemRows =
    planSlotIds.length === 0
      ? []
      : await db
          .select()
          .from(planSlotItems)
          .where(inArray(planSlotItems.planSlotId, planSlotIds))
          .orderBy(asc(planSlotItems.planSlotId), asc(planSlotItems.sortOrder));
  const slotDefinitionRows =
    slotDefinitionIds.length === 0
      ? []
      : await db
          .select({
            id: plannerSlotDefinitions.id,
            label: plannerSlotDefinitions.label,
          })
          .from(plannerSlotDefinitions)
          .where(inArray(plannerSlotDefinitions.id, slotDefinitionIds));

  const prepSessionRows = await db
    .select()
    .from(prepSessions)
    .where(
      and(
        eq(prepSessions.householdId, params.householdId),
        gte(prepSessions.date, windowStart),
        lte(prepSessions.date, windowEnd)
      )
    )
    .orderBy(asc(prepSessions.date), asc(prepSessions.createdAt));

  const prepSessionIds = prepSessionRows.map((session) => session.id);
  const prepSessionItemRows =
    prepSessionIds.length === 0
      ? []
      : await db
          .select()
          .from(prepSessionItems)
          .where(inArray(prepSessionItems.prepSessionId, prepSessionIds))
          .orderBy(asc(prepSessionItems.prepSessionId), asc(prepSessionItems.sortOrder));

  const recipeIds = [
    ...new Set(
      [...planSlotItemRows, ...prepSessionItemRows]
        .map((item) => ("recipeId" in item ? item.recipeId : null))
        .filter((recipeId): recipeId is string => Boolean(recipeId))
    ),
  ];

  const recipeMap = await listRecipeAggregateInputs(recipeIds);
  const householdPeopleRows = await db
    .select()
    .from(householdPeople)
    .where(eq(householdPeople.householdId, params.householdId))
    .orderBy(
      desc(householdPeople.isActive),
      asc(householdPeople.sortOrder),
      asc(householdPeople.createdAt)
    );
  const activeHouseholdPeople = householdPeopleRows.filter((person) => person.isActive);
  const activePeopleCount = activeHouseholdPeople.length;
  const defaultHouseholdPortionUnits =
    Math.round(
      activeHouseholdPeople.reduce((sum, person) => sum + Number(person.portionFactor ?? 0), 0) *
        100
    ) / 100;
  const planSlotParticipantRows =
    planSlotIds.length === 0
      ? []
      : await db
          .select({
            planSlotId: planSlotPeople.planSlotId,
            personId: householdPeople.id,
            portionFactor: householdPeople.portionFactor,
          })
          .from(planSlotPeople)
          .innerJoin(householdPeople, eq(planSlotPeople.householdPersonId, householdPeople.id))
          .where(inArray(planSlotPeople.planSlotId, planSlotIds))
          .orderBy(asc(planSlotPeople.planSlotId), asc(planSlotPeople.sortOrder));
  const slotItemsByPlanSlotId = planSlotItemRows.reduce<Record<string, typeof planSlotItemRows>>(
    (acc, row) => {
      const bucket = acc[row.planSlotId] ?? (acc[row.planSlotId] = []);
      bucket.push(row);

      return acc;
    },
    {}
  );
  const prepItemsBySessionId = prepSessionItemRows.reduce<
    Record<string, typeof prepSessionItemRows>
  >((acc, row) => {
    const bucket = acc[row.prepSessionId] ?? (acc[row.prepSessionId] = []);
    bucket.push(row);

    return acc;
  }, {});
  const slotParticipantsByPlanSlotId = planSlotParticipantRows.reduce<
    Record<string, Array<{ personId: string; portionFactor: number }>>
  >((acc, row) => {
    const bucket = acc[row.planSlotId] ?? (acc[row.planSlotId] = []);
    bucket.push({
      personId: row.personId,
      portionFactor: Number(row.portionFactor ?? 0),
    });

    return acc;
  }, {});

  const projectionMap = new Map<string, ProjectionAccumulator>();
  const batchProducerScales = new Map<string, number>();
  const slotDefinitionMap = new Map(slotDefinitionRows.map((row) => [row.id, row.label]));

  function findAccumulatorByName(
    dedupName: string,
    lifecycle: ShoppingLifecycle,
    weekIndex: number,
    predicate?: (accumulator: ProjectionAccumulator) => boolean
  ) {
    for (const accumulator of projectionMap.values()) {
      if (
        accumulator.dedupName === dedupName &&
        accumulator.lifecycle === lifecycle &&
        accumulator.weekIndex === weekIndex &&
        (!predicate || predicate(accumulator))
      ) {
        return accumulator;
      }
    }

    return null;
  }

  function resolveWeekIndex(date: string): number {
    for (let index = 0; index < weekStarts.length; index += 1) {
      const weekStart = weekStarts[index];

      if (!weekStart) continue;

      const weekEnd = addDays(weekStart, 6);

      if (date >= weekStart && date <= weekEnd) {
        return index;
      }
    }

    return -1;
  }

  function accumulateIngredients(
    ingredientsToAccumulate: IngredientInput[],
    scale: number,
    weekIndex: number,
    sourceBase: ProjectionSourceBase,
    forceStable = false
  ) {
    for (const [ingredientIndex, ingredient] of ingredientsToAccumulate.entries()) {
      const canonical = canonicalUnit(ingredient.unit);
      const volumeFactor = VOL_TO_TSP[canonical];
      const weightFactor = WEIGHT_TO_G[canonical];
      const isCount = COUNT_UNITS.has(canonical);
      const isStable = forceStable || STABLE_AISLES.has(ingredient.aisle);
      const lifecycle: ShoppingLifecycle = isStable ? "stable" : "perishable";
      const effectiveWeekIndex = isStable ? 0 : weekIndex;

      let normalizedQty = ingredient.qty;
      let dedupUnit = canonical || "unit";

      if (volumeFactor !== undefined) {
        normalizedQty = ingredient.qty * volumeFactor;
        dedupUnit = VOL_CANONICAL;
      } else if (weightFactor !== undefined) {
        normalizedQty = ingredient.qty * weightFactor;
        dedupUnit = WEIGHT_CANONICAL;
      } else if (isCount) {
        dedupUnit = canonical || "unit";
      }

      const canonicalName = canonicalizeIngredientName(ingredient.name);
      const qualifierKey = ingredient.displayQualifier
        ? normalizeIngredientNameForGrouping(ingredient.displayQualifier).replace(/\s+/g, "-")
        : null;
      const dedupName =
        ingredient.isServingExtra && qualifierKey
          ? `${canonicalName.dedupName}::${qualifierKey}`
          : canonicalName.dedupName;
      const displayName =
        ingredient.isServingExtra && ingredient.displayQualifier
          ? `${canonicalName.displayName} (${ingredient.displayQualifier})`
          : canonicalName.displayName;
      const matchingByName = findAccumulatorByName(dedupName, lifecycle, effectiveWeekIndex);

      if (ingredient.isUnmeasured) {
        const unmeasuredSource: AccumulatedProjectionSource = {
          id: `${sourceBase.idPrefix}::${ingredientIndex}`,
          sourceKind: sourceBase.sourceKind,
          recipeId: sourceBase.recipeId,
          recipeName: sourceBase.recipeName,
          contextLabel: sourceBase.contextLabel,
          itemName: displayName,
          qty: 0,
          unit: "",
          date: sourceBase.date,
          weekIndex: sourceBase.weekIndex,
          role: sourceBase.role,
        };

        if (matchingByName) {
          matchingByName.sources.push(unmeasuredSource);
          continue;
        }

        const unmeasuredKey =
          lifecycle === "stable"
            ? `stable::${dedupName}::__unmeasured__`
            : `perish::${effectiveWeekIndex}::${dedupName}::__unmeasured__`;

        projectionMap.set(unmeasuredKey, {
          id: unmeasuredKey,
          dedupName,
          name: displayName,
          qty: 0,
          unit: "",
          aisle: ingredient.aisle,
          lifecycle,
          weekIndex: effectiveWeekIndex,
          coversUntil: lifecycle === "stable" && weekCount > 1 ? windowEnd : undefined,
          sources: [unmeasuredSource],
        });
        continue;
      }

      const dedupKey =
        lifecycle === "stable"
          ? `stable::${dedupName}::${dedupUnit}`
          : `perish::${effectiveWeekIndex}::${dedupName}::${dedupUnit}`;
      const sourceContribution: AccumulatedProjectionSource = {
        id: `${sourceBase.idPrefix}::${ingredientIndex}`,
        sourceKind: sourceBase.sourceKind,
        recipeId: sourceBase.recipeId,
        recipeName: sourceBase.recipeName,
        contextLabel: sourceBase.contextLabel,
        itemName: displayName,
        qty: Math.round(normalizedQty * scale * 1000) / 1000,
        unit: dedupUnit,
        date: sourceBase.date,
        weekIndex: sourceBase.weekIndex,
        role: sourceBase.role,
      };

      const existing = projectionMap.get(dedupKey);
      const existingUnmeasured =
        matchingByName && matchingByName.unit === "" && matchingByName.qty === 0
          ? matchingByName
          : null;

      if (existing) {
        existing.qty = Math.round((existing.qty + normalizedQty * scale) * 1000) / 1000;
        existing.sources.push(sourceContribution);

        if (existingUnmeasured && existingUnmeasured.id !== existing.id) {
          existing.sources.push(...existingUnmeasured.sources);
          projectionMap.delete(existingUnmeasured.id);
        }
        continue;
      }

      const nextSources = existingUnmeasured
        ? [...existingUnmeasured.sources, sourceContribution]
        : [sourceContribution];

      projectionMap.set(dedupKey, {
        id: dedupKey,
        dedupName,
        name: displayName,
        qty: Math.round(normalizedQty * scale * 1000) / 1000,
        unit: dedupUnit,
        aisle: ingredient.aisle,
        lifecycle,
        weekIndex: effectiveWeekIndex,
        coversUntil: lifecycle === "stable" && weekCount > 1 ? windowEnd : undefined,
        sources: nextSources,
      });

      if (existingUnmeasured) {
        projectionMap.delete(existingUnmeasured.id);
      }
    }
  }

  for (const slot of planSlotRows) {
    const weekIndex = resolveWeekIndex(slot.date);

    if (weekIndex === -1) continue;

    const participantOverrides = slotParticipantsByPlanSlotId[slot.id] ?? [];
    const overridePortionUnits = participantOverrides.reduce(
      (sum, participant) => sum + participant.portionFactor,
      0
    );
    const basePortionUnits =
      participantOverrides.length > 0
        ? overridePortionUnits
        : (slot.headcountOverride ?? defaultHouseholdPortionUnits);
    const requestedServings = Math.max(0, basePortionUnits) * slot.batchMultiplier;
    const slotItems = slotItemsByPlanSlotId[slot.id] ?? [];

    for (const item of slotItems) {
      if (item.itemKind !== "recipe" || !item.recipeId || item.isConsumer) continue;

      const recipe = recipeMap.get(item.recipeId);

      if (!recipe) continue;

      const ingredientsToAccumulate = applyPlanSlotIngredientOverrides(
        recipe.ingredients,
        item.dairyFree,
        item.ingredientOverrides
      )
        .map(toIngredientInput)
        .filter((value): value is IngredientInput => value !== null);

      if (ingredientsToAccumulate.length === 0) continue;
      if (requestedServings <= 0) continue;

      const scale = computeProductionScale(
        requestedServings,
        recipe.sourceYield,
        recipe.isDivisible
      );
      const primaryRecipeType = recipe.recipeTypes[0] ?? "Main";
      const useFirstIn =
        item.role === "side" ||
        primaryRecipeType === "Baking" ||
        primaryRecipeType === "Dessert" ||
        primaryRecipeType === "Condiment" ||
        primaryRecipeType === "Side";
      const forceStable = primaryRecipeType === "Condiment";
      const slotLabel = slotDefinitionMap.get(slot.plannerSlotDefinitionId) ?? "Meal";
      const sourceBase: ProjectionSourceBase = {
        idPrefix: `planner::${slot.id}::${item.id}`,
        sourceKind: "planner",
        recipeId: recipe.recipeId,
        recipeName: recipe.recipeName,
        contextLabel: `${slotLabel} · ${formatShortDate(slot.date)}`,
        date: slot.date,
        weekIndex,
        role: item.role,
      };

      if (useFirstIn) {
        const batchKey = `${weekIndex}::${item.recipeId}`;
        const previousScale = batchProducerScales.get(batchKey) ?? 0;

        if (scale > previousScale) {
          batchProducerScales.set(batchKey, scale);
          accumulateIngredients(
            ingredientsToAccumulate,
            scale - previousScale,
            weekIndex,
            sourceBase,
            forceStable
          );
        }

        continue;
      }

      accumulateIngredients(ingredientsToAccumulate, scale, weekIndex, sourceBase, forceStable);
    }
  }

  for (const session of prepSessionRows) {
    const weekIndex = resolveWeekIndex(session.date);

    if (weekIndex === -1) continue;

    const sessionItems = prepItemsBySessionId[session.id] ?? [];

    for (const item of sessionItems) {
      const recipe = recipeMap.get(item.recipeId);

      if (!recipe) continue;

      const ingredientsToAccumulate = recipe.ingredients
        .map(toIngredientInput)
        .filter((value): value is IngredientInput => value !== null);

      if (ingredientsToAccumulate.length === 0) continue;

      const requestedServings = recipe.isDivisible
        ? parseSourceYieldNumber(recipe.sourceYield) * item.batchCount
        : item.batchCount;
      const scale = computeProductionScale(
        requestedServings,
        recipe.sourceYield,
        recipe.isDivisible
      );
      const primaryRecipeType = recipe.recipeTypes[0] ?? "Main";
      const forceStable = primaryRecipeType === "Condiment";
      const sourceBase: ProjectionSourceBase = {
        idPrefix: `prep::${session.id}::${item.id}`,
        sourceKind: "prep",
        recipeId: recipe.recipeId,
        recipeName: recipe.recipeName,
        contextLabel: `${session.title ? `${session.title} · ` : "Prep · "}${formatShortDate(session.date)}`,
        date: session.date,
        weekIndex,
      };

      accumulateIngredients(ingredientsToAccumulate, scale, weekIndex, sourceBase, forceStable);
    }
  }

  const normalizedItems = Array.from(projectionMap.values()).map((item) => {
    const normalizedAmount = normalizeProjectionAmount(item.qty, item.unit);

    return {
      ...item,
      qty: normalizedAmount.qty,
      unit: normalizedAmount.unit,
      sources: item.sources.map((source) => {
        const normalizedSourceAmount = normalizeProjectionAmount(source.qty, source.unit);

        return {
          ...source,
          qty: normalizedSourceAmount.qty,
          unit: normalizedSourceAmount.unit,
        };
      }),
    };
  });

  const stableItems = sortProjectionItems(
    normalizedItems.filter((item) => item.lifecycle === "stable")
  );
  const currentWeekItems = sortProjectionItems(
    normalizedItems.filter((item) => item.lifecycle === "perishable" && item.weekIndex === 0)
  );
  const upcomingWeeks = Array.from({ length: Math.max(weekCount - 1, 0) }, (_, index) => {
    const weekIndex = index + 1;
    const weekStart = weekStarts[weekIndex] ?? addDays(windowStart, weekIndex * 7);

    return {
      weekIndex,
      weekStart,
      weekEnd: addDays(weekStart, 6),
      items: sortProjectionItems(
        normalizedItems.filter(
          (item) => item.lifecycle === "perishable" && item.weekIndex === weekIndex
        )
      ),
    };
  }).filter((week) => week.items.length > 0);

  return ShoppingProjectionResponseSchema.parse({
    hasHousehold: true,
    householdId: params.householdId,
    householdPortionUnits: defaultHouseholdPortionUnits,
    activePeopleCount,
    dayCount: ShoppingProjectionDayCountSchema.parse(dayCount),
    windowStart,
    windowEnd,
    stableItems,
    currentWeekItems,
    upcomingWeeks,
    totalItemCount:
      stableItems.length +
      currentWeekItems.length +
      upcomingWeeks.reduce((sum, week) => sum + week.items.length, 0),
  });
}
