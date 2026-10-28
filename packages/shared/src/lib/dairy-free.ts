import type { MealIngredientCandidate, MealIngredientOverride } from "./meal-adjustments";

export type DairyAdaptationStatus = "dairy-free" | "dairy-free-possible" | "contains-dairy";

export type DairyAdaptationResult = {
  status: DairyAdaptationStatus;
  substitutions: string[];
};

export type DairyFreeIngredientCandidate = MealIngredientCandidate;
export type DairyFreeIngredientOverride = MealIngredientOverride;

type DairyPattern = {
  pattern: RegExp;
  suggestion: string;
  replacementName: string;
  reason: string;
  heavy?: boolean;
  omitWhenOptional?: boolean;
};

const NON_DAIRY_INGREDIENT_PATTERN =
  /\b(?:(?:dairy[\s-]?free|vegan|plant[\s-]?based)\s+(?:milk|cream|yogurt|yoghurt|cheese|butter|spread)|(?:coconut|almond|oat|soy|cashew|pea|rice)\s+(?:milk|cream|yogurt|yoghurt)|butter beans?|peanut butter|almond butter|cashew butter|apple butter|cocoa butter)\b/gi;
const DAIRY_CENTRED_TITLE_PATTERN =
  /\b(cheesecake|ice cream|milkshake|queso|alfredo|mac(?:aroni)? (?:and|&) cheese|cheese fondue|cream pie|creme brulee)\b/i;
const OPTIONAL_SERVING_PATTERN =
  /\b(optional|for serving|to serve|serving suggestion|as a topping|for topping|to garnish|garnish)\b/i;

const DAIRY_PATTERNS: DairyPattern[] = [
  {
    pattern: /\b(sour cream|creme fraiche|cr\u00e8me fra\u00eeche)\b/i,
    suggestion: "Use plant-based sour cream or unsweetened dairy-free yoghurt",
    replacementName: "plant-based sour cream",
    reason: "Swap the cultured dairy for a plant-based equivalent",
    omitWhenOptional: true,
  },
  {
    pattern: /\b(yogurt|yoghurt)\b/i,
    suggestion: "Use unsweetened dairy-free yoghurt",
    replacementName: "unsweetened dairy-free yoghurt",
    reason: "Use an unsweetened plant-based yoghurt",
  },
  {
    pattern:
      /\b(heavy cream|double cream|single cream|whipping cream|cooking cream|half[\s-]?and[\s-]?half)\b|(?<!sour )(?<!ice )\bcream\b(?!\s+cheese)/i,
    suggestion: "Use a plant-based cooking cream",
    replacementName: "plant-based cooking cream",
    reason: "Use a plant-based cream with a similar richness",
  },
  {
    pattern: /\b(buttermilk)\b/i,
    suggestion: "Use dairy-free buttermilk",
    replacementName: "dairy-free buttermilk",
    reason: "Use a dairy-free buttermilk alternative",
  },
  {
    pattern: /\b(cow'?s? milk|whole milk|skim(?:med)? milk|evaporated milk|milk)\b/i,
    suggestion: "Use an unsweetened dairy-free milk",
    replacementName: "unsweetened dairy-free milk",
    reason: "Use an unsweetened plant-based milk",
  },
  {
    pattern:
      /\b(cheddar|mozzarella|parmesan|pecorino|feta|halloumi|ricotta|mascarpone|brie|camembert|gouda|gruyere|cream cheese|cottage cheese|paneer|quark|cheese)\b/i,
    suggestion: "Use a dairy-free cheese or omit when it is a topping",
    replacementName: "dairy-free cheese",
    reason: "Use a dairy-free cheese with a similar style",
    omitWhenOptional: true,
  },
  {
    pattern: /\b(butter|ghee)\b/i,
    suggestion: "Use olive oil or a dairy-free spread",
    replacementName: "dairy-free spread",
    reason: "Use a dairy-free spread to preserve the recipe quantity",
  },
  {
    pattern: /\b(condensed milk)\b/i,
    suggestion: "Use a dairy-free equivalent",
    replacementName: "dairy-free condensed milk",
    reason: "Use a dairy-free condensed milk equivalent",
    heavy: true,
  },
  {
    pattern: /\b(milk powder|whey|casein)\b/i,
    suggestion: "Use a dairy-free equivalent",
    replacementName: "dairy-free equivalent",
    reason: "This ingredient needs a specialist dairy-free equivalent",
    heavy: true,
  },
  {
    pattern: /\b(ice cream|custard|dulce de leche|milk chocolate)\b/i,
    suggestion: "Use a dairy-free equivalent",
    replacementName: "dairy-free equivalent",
    reason: "Use the matching dairy-free product",
    heavy: true,
  },
  {
    pattern: /\b(ranch dressing|blue cheese dressing|whipped topping|cool whip)\b/i,
    suggestion: "Use a dairy-free dressing or topping",
    replacementName: "dairy-free dressing or topping",
    reason: "Use the matching dairy-free dressing or topping",
    omitWhenOptional: true,
  },
];

function withoutKnownNonDairyIngredients(value: string): string {
  return value.replace(NON_DAIRY_INGREDIENT_PATTERN, " ");
}

export function classifyDairyAdaptation(input: {
  title: string;
  ingredientLines: string[];
  explicitDairyFree?: boolean;
}): DairyAdaptationResult {
  if (input.explicitDairyFree) return { status: "dairy-free", substitutions: [] };
  if (input.ingredientLines.length === 0) return { status: "contains-dairy", substitutions: [] };

  const matches = input.ingredientLines.flatMap((line) => {
    const lineWithoutAlternatives = withoutKnownNonDairyIngredients(line);

    return DAIRY_PATTERNS.filter(({ pattern }) => pattern.test(lineWithoutAlternatives)).map(
      (pattern) => ({
        line,
        ...pattern,
      })
    );
  });

  if (matches.length === 0) return { status: "dairy-free-possible", substitutions: [] };

  const dairyLines = new Set(matches.map(({ line }) => line));
  const isDairyCentred = DAIRY_CENTRED_TITLE_PATTERN.test(input.title);
  const hasHeavyDairy = matches.some(({ heavy }) => heavy);
  const substitutions = Array.from(new Set(matches.map(({ suggestion }) => suggestion)));

  return {
    status:
      isDairyCentred || hasHeavyDairy || dairyLines.size > 2
        ? "contains-dairy"
        : "dairy-free-possible",
    substitutions,
  };
}

export function suggestDairyFreeIngredientOverrides(
  ingredients: DairyFreeIngredientCandidate[]
): DairyFreeIngredientOverride[] {
  return ingredients.flatMap((ingredient) => {
    const searchable = withoutKnownNonDairyIngredients(
      `${ingredient.ingredientName} ${ingredient.rawLine ?? ""}`
    );
    const matchingRules = DAIRY_PATTERNS.filter(({ pattern }) => pattern.test(searchable));
    const rule = matchingRules.find(({ heavy }) => heavy) ?? matchingRules[0];

    if (!rule) return [];

    const canOmit = rule.omitWhenOptional && OPTIONAL_SERVING_PATTERN.test(searchable);

    return [
      {
        recipeIngredientId: ingredient.recipeIngredientId,
        originalName: ingredient.ingredientName,
        replacementName: canOmit ? null : rule.replacementName,
        action: canOmit ? "omit" : "replace",
        reason: canOmit ? "Optional dairy topping can be left out" : rule.reason,
        source: "dairy-free",
      },
    ];
  });
}
