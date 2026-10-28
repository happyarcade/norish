import { randomUUID } from "crypto";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@norish/db/drizzle";
import { createRecipeWithRefs } from "@norish/db/repositories";
import { recipes, users } from "@norish/db/schema";

type BasicAddIn = {
  slug: string;
  name: string;
  description: string;
  ingredientLine: string;
  ingredientName: string;
  amount: number;
  unit: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  cholesterol: number;
  saturatedFat?: number;
  transFat?: number;
};

function decimalString(value: number): string {
  return value.toString();
}

const COMMON_SLOTS = ["breakfast", "mid-morning", "snack", "afternoon", "post-workout"];

const BASIC_ADD_INS: BasicAddIn[] = [
  {
    slug: "banana",
    name: "Banana",
    description: "A simple one-banana fibre boost for breakfasts, snacks, and quick add-ins.",
    ingredientLine: "1 medium banana",
    ingredientName: "banana",
    amount: 1,
    unit: "medium",
    calories: 105,
    carbs: 27,
    protein: 1.3,
    fat: 0.4,
    fiber: 3.1,
    sugar: 14.4,
    sodium: 1,
    cholesterol: 0,
    saturatedFat: 0.1,
    transFat: 0,
  },
  {
    slug: "apple",
    name: "Apple",
    description: "One medium apple. Handy for lifting fibre without adding much sodium.",
    ingredientLine: "1 medium apple",
    ingredientName: "apple",
    amount: 1,
    unit: "medium",
    calories: 95,
    carbs: 25.1,
    protein: 0.5,
    fat: 0.3,
    fiber: 4.4,
    sugar: 18.9,
    sodium: 2,
    cholesterol: 0,
    saturatedFat: 0.1,
    transFat: 0,
  },
  {
    slug: "pear",
    name: "Pear",
    description: "One medium pear. A strong fibre-first snack that stays gentle on sodium and cholesterol.",
    ingredientLine: "1 medium pear",
    ingredientName: "pear",
    amount: 1,
    unit: "medium",
    calories: 101,
    carbs: 27.1,
    protein: 0.6,
    fat: 0.2,
    fiber: 5.5,
    sugar: 17.4,
    sodium: 2,
    cholesterol: 0,
    saturatedFat: 0,
    transFat: 0,
  },
  {
    slug: "orange",
    name: "Orange",
    description: "One medium orange for a light snack or a simple breakfast add-on.",
    ingredientLine: "1 medium orange",
    ingredientName: "orange",
    amount: 1,
    unit: "medium",
    calories: 62,
    carbs: 15.4,
    protein: 1.2,
    fat: 0.2,
    fiber: 3.1,
    sugar: 12.2,
    sodium: 0,
    cholesterol: 0,
    saturatedFat: 0,
    transFat: 0,
  },
  {
    slug: "blueberries",
    name: "Blueberries",
    description: "A cup of blueberries for breakfast bowls, oats, or a fresh snack.",
    ingredientLine: "1 cup blueberries",
    ingredientName: "blueberries",
    amount: 1,
    unit: "cup",
    calories: 84,
    carbs: 21.4,
    protein: 1.1,
    fat: 0.5,
    fiber: 3.6,
    sugar: 14.7,
    sodium: 1,
    cholesterol: 0,
    saturatedFat: 0,
    transFat: 0,
  },
  {
    slug: "strawberries",
    name: "Strawberries",
    description: "A cup of strawberries for yoghurt bowls, oats, and easy higher-fibre snacks.",
    ingredientLine: "1 cup strawberries",
    ingredientName: "strawberries",
    amount: 1,
    unit: "cup",
    calories: 49,
    carbs: 11.7,
    protein: 1,
    fat: 0.5,
    fiber: 3,
    sugar: 7.4,
    sodium: 2,
    cholesterol: 0,
    saturatedFat: 0,
    transFat: 0,
  },
  {
    slug: "raspberries",
    name: "Raspberries",
    description: "A cup of raspberries. One of the easiest ways to lift fibre on a low-fibre day.",
    ingredientLine: "1 cup raspberries",
    ingredientName: "raspberries",
    amount: 1,
    unit: "cup",
    calories: 64,
    carbs: 14.7,
    protein: 1.5,
    fat: 0.8,
    fiber: 8,
    sugar: 5.4,
    sodium: 1,
    cholesterol: 0,
    saturatedFat: 0,
    transFat: 0,
  },
];

async function resolveUserId(): Promise<string> {
  const [firstUser] = await db.select({ id: users.id }).from(users).orderBy(asc(users.createdAt)).limit(1);

  if (!firstUser) {
    throw new Error("No users exist yet. Create/sign in to a Norish account before seeding add-ins.");
  }

  return firstUser.id;
}

async function findExistingRecipeId(userId: string, recipeUrl: string): Promise<string | null> {
  const [row] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.userId, userId), eq(recipes.url, recipeUrl)))
    .limit(1);

  return row?.id ?? null;
}

function buildNutritionDetails(item: BasicAddIn) {
  return {
    servingSize: "1 serving",
    nutrients: {
      fiberContent: {
        label: "Fiber",
        value: item.fiber,
        unit: "g",
        raw: `${item.fiber} g`,
      },
      sugarContent: {
        label: "Sugar",
        value: item.sugar,
        unit: "g",
        raw: `${item.sugar} g`,
      },
      sodiumContent: {
        label: "Sodium",
        value: item.sodium,
        unit: "mg",
        raw: `${item.sodium} mg`,
      },
      cholesterolContent: {
        label: "Cholesterol",
        value: item.cholesterol,
        unit: "mg",
        raw: `${item.cholesterol} mg`,
      },
      saturatedFatContent: {
        label: "Saturated Fat",
        value: item.saturatedFat ?? 0,
        unit: "g",
        raw: `${item.saturatedFat ?? 0} g`,
      },
      transFatContent: {
        label: "Trans Fat",
        value: item.transFat ?? 0,
        unit: "g",
        raw: `${item.transFat ?? 0} g`,
      },
    },
  };
}

async function main() {
  const userId = await resolveUserId();
  let imported = 0;
  let skipped = 0;

  for (const item of BASIC_ADD_INS) {
    const url = `https://norish.local/basic-addins/${item.slug}`;
    const existingId = await findExistingRecipeId(userId, url);

    if (existingId) {
      skipped += 1;
      continue;
    }

    await createRecipeWithRefs(
      randomUUID(),
      userId,
      {
        name: item.name,
        description: item.description,
        url,
        image: null,
        servings: 1,
        prepMinutes: 1,
        cookMinutes: 0,
        totalMinutes: 1,
        notes: null,
        systemUsed: "metric",
        calories: item.calories,
        fat: decimalString(item.fat),
        carbs: decimalString(item.carbs),
        protein: decimalString(item.protein),
        nutritionDetails: buildNutritionDetails(item),
        ingredientGroups: [
          {
            purpose: null,
            ingredients: [item.ingredientLine],
          },
        ],
        recipeIngredients: [
          {
            amount: item.amount,
            unit: item.unit,
            order: 0,
            ingredientName: item.ingredientName,
            ingredientId: null,
            rawLine: item.ingredientLine,
          },
        ],
        tags: [
          { name: "fruit" },
          { name: "fibre boost" },
          { name: "simple add-in" },
        ],
        categories: ["Snack"],
        steps: [
          {
            order: 0,
            step: item.unit === "cup" ? "Wash and serve." : "Prepare and eat.",
            systemUsed: "metric",
            images: [],
          },
        ],
        images: [],
        videos: [],
        plannerProfile: {
          mealTypes: ["snack"],
          suitableSlots: COMMON_SLOTS,
          recipeTypes: ["snack"],
          dietaryFlags: ["vegan", "vegetarian", "gluten-free", "dairy-free"],
          allergenFlags: [],
          cuisines: [],
          heatLevel: null,
          prepScore: 1,
          fruitVegCount: 1,
          isDivisible: true,
          isFreezerFriendly: false,
          sourceYield: "1 serving",
        },
      },
      {
        source: {
          sourceType: "manual",
          sourceUrl: url,
          sourceDomain: "norish.local",
          siteName: "Norish Basics",
          author: "Norish",
          language: "en-GB",
          rawPayload: {
            source: "norish-basic-addin-seed",
            slug: item.slug,
          },
        },
      }
    );

    imported += 1;
  }

  console.log(`Seeded ${imported} fruit add-in recipe(s); skipped ${skipped} existing recipe(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
