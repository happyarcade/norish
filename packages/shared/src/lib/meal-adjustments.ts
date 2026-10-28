export type MealIngredientAdjustmentSource = "dairy-free" | "lower-sodium" | "manual";

export type MealIngredientCandidate = {
  recipeIngredientId: string;
  ingredientName: string;
  rawLine: string | null;
};

export type MealIngredientOverride = {
  recipeIngredientId: string;
  originalName: string;
  replacementName: string | null;
  action: "replace" | "omit";
  reason: string;
  source?: MealIngredientAdjustmentSource;
};

const ALREADY_LOWER_SODIUM_PATTERN =
  /\b(?:(?:low|lower|reduced)[\s-]*(?:sodium|salt)|no[\s-]*(?:added[\s-]*)?salt|salt[\s-]*free|sodium[\s-]*free|unsalted)\b/i;
const MSG_PATTERN = /\b(?:msg|monosodium glutamate)\b/i;
const SOY_SAUCE_PATTERN = /\b(?:soy sauce|tamari|shoyu|liquid aminos)\b/i;
const STOCK_PATTERN = /\b(?:stock|broth|bouillon|consomme)\b/i;
const CANNED_PATTERN = /\b(?:canned|tinned|cans?|tins?)\b/i;
const CANNED_PRODUCE_PATTERN = /\b(?:beans?|chickpeas?|lentils?|tomatoes|tomato)\b/i;
const SALTY_SEASONING_PATTERN =
  /\b(?:taco|fajita|cajun|creole|jerk|seasoned)\s+(?:seasoning(?: blend)?|salt)\b/i;
const SALT_AND_PEPPER_PATTERN =
  /\b(?:salt\s*(?:and|&|\/)\s*(?:(?:freshly\s+)?ground\s+)?(?:black\s+)?pepper|(?:black\s+)?pepper\s*(?:and|&|\/)\s*salt)\b/i;
const ADDED_SALT_PATTERN = /\bsalt\b/i;

function buildLowerSodiumOverride(
  ingredient: MealIngredientCandidate,
  replacementName: string | null,
  reason: string
): MealIngredientOverride {
  return {
    recipeIngredientId: ingredient.recipeIngredientId,
    originalName: ingredient.ingredientName,
    replacementName,
    action: replacementName === null ? "omit" : "replace",
    reason,
    source: "lower-sodium",
  };
}

export function getMealIngredientOverrideSource(
  override: MealIngredientOverride,
  dairyFree = false
): MealIngredientAdjustmentSource {
  return override.source ?? (dairyFree ? "dairy-free" : "manual");
}

export function replaceMealIngredientOverrides(
  current: MealIngredientOverride[],
  suggested: MealIngredientOverride[],
  source: MealIngredientAdjustmentSource,
  dairyFree = false
): MealIngredientOverride[] {
  const preserved = current.filter(
    (override) => getMealIngredientOverrideSource(override, dairyFree) !== source
  );
  const preservedIngredientIds = new Set(preserved.map((override) => override.recipeIngredientId));

  return [
    ...preserved,
    ...suggested.filter((override) => !preservedIngredientIds.has(override.recipeIngredientId)),
  ];
}

export function suggestLowerSodiumIngredientOverrides(
  ingredients: MealIngredientCandidate[]
): MealIngredientOverride[] {
  return ingredients.flatMap((ingredient) => {
    const name = ingredient.ingredientName.trim();
    const searchable = `${name} ${ingredient.rawLine ?? ""}`;

    if (!name || ALREADY_LOWER_SODIUM_PATTERN.test(searchable)) return [];

    if (MSG_PATTERN.test(name)) {
      return [
        buildLowerSodiumOverride(
          ingredient,
          null,
          "Leave out added MSG and rely on the recipe's other seasonings"
        ),
      ];
    }

    if (SALT_AND_PEPPER_PATTERN.test(name)) {
      return [
        buildLowerSodiumOverride(
          ingredient,
          "black pepper",
          "Keep the pepper and leave out the added salt"
        ),
      ];
    }

    if (SOY_SAUCE_PATTERN.test(name)) {
      const replacementName = /\btamari\b/i.test(name)
        ? "reduced-sodium tamari"
        : "reduced-sodium soy sauce";

      return [
        buildLowerSodiumOverride(
          ingredient,
          replacementName,
          "Use a reduced-sodium version of the original seasoning"
        ),
      ];
    }

    if (STOCK_PATTERN.test(name)) {
      const baseName = name.replace(/^(?:regular|standard|full[\s-]?sodium)\s+/i, "");

      return [
        buildLowerSodiumOverride(
          ingredient,
          `low-sodium ${baseName}`,
          "Choose a lower-sodium stock, broth, or bouillon"
        ),
      ];
    }

    if (CANNED_PATTERN.test(searchable) && CANNED_PRODUCE_PATTERN.test(name)) {
      const baseName = name
        .replace(/^(?:canned|tinned)\s+/i, "")
        .replace(/^(?:cans?|tins?)\s+(?:of\s+)?/i, "")
        .trim();

      return [
        buildLowerSodiumOverride(
          ingredient,
          `no-salt-added ${baseName}`,
          "Choose a no-salt-added version, or rinse canned beans before using"
        ),
      ];
    }

    if (SALTY_SEASONING_PATTERN.test(name)) {
      const replacementName = /\bseasoned salt\b/i.test(name)
        ? "salt-free seasoning"
        : `salt-free ${name}`;

      return [
        buildLowerSodiumOverride(
          ingredient,
          replacementName,
          "Use a seasoning blend without added salt"
        ),
      ];
    }

    if (ADDED_SALT_PATTERN.test(name)) {
      return [
        buildLowerSodiumOverride(
          ingredient,
          null,
          "Leave out added salt and adjust the seasoning after cooking"
        ),
      ];
    }

    return [];
  });
}
