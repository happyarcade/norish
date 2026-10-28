/**
 * Nutrition parsing utilities for JSON-LD recipe normalization.
 *
 * Extracts and normalizes nutrition information from Schema.org Recipe nodes.
 */

export interface ParsedNutrition {
  calories: number | null;
  fat: string | null;
  carbs: string | null;
  protein: string | null;
}

const SODIUM_MG_PER_GRAM_SALT = 393.4;

function normalizeNumericToken(token: string): string {
  if (token.includes(",") && token.includes(".")) {
    return token.replace(/,/g, "");
  }

  if (/^[+-]?\d{1,3}(?:,\d{3})+$/.test(token)) {
    return token.replace(/,/g, "");
  }

  return token.replace(",", ".");
}

/**
 * Parse a nutrition value from various formats.
 *
 * Handles:
 * - Numbers: 300
 * - Strings with units: "300 kcal", "25g", "25 grams"
 *
 * @param value - The raw nutrition value
 * @returns The parsed numeric value, or null if invalid
 */
export function parseNutritionValue(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    // Extract numeric portion (handles "300 kcal", "25g", "25 grams", etc.)
    const match = value.trim().match(/^[+-]?\d[\d.,]*/);

    if (match) {
      const parsed = parseFloat(normalizeNumericToken(match[0]));

      return Number.isFinite(parsed) ? parsed : null;
    }
  }

  return null;
}

function hasGramUnit(value: string): boolean {
  return /\b(?:g|gram|grams)\b/i.test(value);
}

function hasMilligramUnit(value: string): boolean {
  return /\b(?:mg|milligram|milligrams)\b/i.test(value);
}

function roundMetricValue(value: number, unit: string | null): number {
  if (unit === "mg") return Math.round(value);

  return Number(value.toFixed(2));
}

function getCanonicalNutritionUnit(key: string, rawValue: string): string | null {
  const text = `${key} ${rawValue}`.toLowerCase();

  if (/sodium|cholesterol/.test(text)) return "mg";
  if (/calorie|energy/.test(text)) return "kcal";
  if (/fat|carbohydrate|carb|sugar|fib(?:er|re)|protein/.test(text)) return "g";
  if (hasMilligramUnit(text)) return "mg";
  if (hasGramUnit(text)) return "g";

  return null;
}

function normalizeSodiumValue(value: number, rawValue: string): number {
  const text = rawValue.toLowerCase();

  if (hasGramUnit(text)) {
    return /\bsalt\b/.test(text) ? value * SODIUM_MG_PER_GRAM_SALT : value * 1000;
  }

  // Some UK recipe exports encode "salt: 1.23g" as "sodiumContent:
  // 1.23 milligram of sodium". Values this small would be unusably low
  // as real sodium mg, so treat them as source salt grams.
  if (/milligrams?\s+of\s+sodium/.test(text) && value > 0 && value <= 10) {
    return value * SODIUM_MG_PER_GRAM_SALT;
  }

  return value;
}

export function normalizeNutritionMetricForStorage(
  key: string,
  value: string | number | null
): { value: number | null; unit: string | null; raw: string | null } {
  const raw = typeof value === "string" ? value : value == null ? null : String(value);
  const parsed = parseNutritionValue(value);
  const unit = raw ? getCanonicalNutritionUnit(key, raw) : null;

  if (parsed == null) {
    return { value: null, unit, raw };
  }

  const normalizedValue = /sodium/i.test(key) && raw ? normalizeSodiumValue(parsed, raw) : parsed;

  return {
    value: roundMetricValue(normalizedValue, unit),
    unit,
    raw,
  };
}

/**
 * Extract nutrition information from a JSON-LD recipe node.
 *
 * Supports Schema.org NutritionInformation with fields like:
 * - calories / calorieContent
 * - fatContent / fat
 * - carbohydrateContent / carbs
 * - proteinContent / protein
 *
 * @param json - The JSON-LD recipe node
 * @returns Parsed nutrition object with all fields (null if not available)
 */
export function extractNutrition(json: unknown): ParsedNutrition {
  const defaultResult: ParsedNutrition = {
    calories: null,
    fat: null,
    carbs: null,
    protein: null,
  };

  if (!json || typeof json !== "object") return defaultResult;

  const node = json as Record<string, unknown>;
  const nutrition = node.nutrition;

  if (!nutrition || typeof nutrition !== "object") return defaultResult;

  const nutritionObj = nutrition as Record<string, unknown>;

  const calories = parseNutritionValue(nutritionObj.calories ?? nutritionObj.calorieContent);
  const fat = parseNutritionValue(nutritionObj.fatContent ?? nutritionObj.fat);
  const carbs = parseNutritionValue(nutritionObj.carbohydrateContent ?? nutritionObj.carbs);
  const protein = parseNutritionValue(nutritionObj.proteinContent ?? nutritionObj.protein);

  return {
    calories: calories != null ? Math.round(calories) : null,
    fat: fat != null ? fat.toString() : null,
    carbs: carbs != null ? carbs.toString() : null,
    protein: protein != null ? protein.toString() : null,
  };
}
