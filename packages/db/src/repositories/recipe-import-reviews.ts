import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import z from "zod";
import { db } from "@norish/db/drizzle";
import { recipeImportReviews, recipes } from "@norish/db/schema";
import {
  RecipeImportReviewInsertBaseSchema,
  RecipeImportReviewSelectBaseSchema,
  RecipeImportReviewUpdateBaseSchema,
  RecipeMetadataReviewItemSchema,
  RecipeMetadataReviewListInputSchema,
  RecipeNutritionReviewItemSchema,
  RecipeNutritionReviewListInputSchema,
  RecipeNutritionReviewResponseSchema,
} from "@norish/shared/contracts/zod/recipe-import-reviews";
import {
  auditRecipeNutrition,
  divideRecipeNutritionByServings,
  getNutritionAuditValues,
} from "@norish/shared/lib/nutrition-quality";

export type RecipeImportReviewDto = z.output<typeof RecipeImportReviewSelectBaseSchema>;
export type RecipeImportReviewInsertDto = z.input<typeof RecipeImportReviewInsertBaseSchema>;
export type RecipeImportReviewUpdateDto = z.input<typeof RecipeImportReviewUpdateBaseSchema>;
export type RecipeMetadataReviewItemDto = z.output<typeof RecipeMetadataReviewItemSchema>;
export type RecipeNutritionReviewItemDto = z.output<typeof RecipeNutritionReviewItemSchema>;
export type RecipeNutritionReviewResponseDto = z.output<typeof RecipeNutritionReviewResponseSchema>;

type RecipeMetadataReviewContext = {
  userId: string;
  householdUserIds: string[] | null;
  isServerAdmin: boolean;
};

const SLOT_OPTIONAL_TYPES = new Set(["side", "condiment", "drink"]);

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function needsPrimarySuitableSlot(recipeTypes: string[]) {
  return !recipeTypes.some((value) => SLOT_OPTIONAL_TYPES.has(value));
}

function buildViewPolicyCondition(ctx: RecipeMetadataReviewContext) {
  if (ctx.isServerAdmin) {
    return undefined;
  }

  if (ctx.householdUserIds && ctx.householdUserIds.length > 0) {
    const userIds = ctx.householdUserIds.includes(ctx.userId)
      ? ctx.householdUserIds
      : [...ctx.householdUserIds, ctx.userId];

    return or(inArray(recipes.userId, userIds), sql`${recipes.userId} IS NULL`);
  }

  return or(eq(recipes.userId, ctx.userId), sql`${recipes.userId} IS NULL`);
}

export async function getRecipeImportReviewByRecipeId(
  recipeId: string
): Promise<RecipeImportReviewDto | null> {
  const [row] = await db
    .select()
    .from(recipeImportReviews)
    .where(eq(recipeImportReviews.recipeId, recipeId))
    .limit(1);

  const parsed = RecipeImportReviewSelectBaseSchema.safeParse(row);

  return parsed.success ? parsed.data : null;
}

export async function upsertRecipeImportReview(
  input: RecipeImportReviewInsertDto
): Promise<RecipeImportReviewDto> {
  return db.transaction(async (tx) => upsertRecipeImportReviewTx(tx, input));
}

export async function upsertRecipeImportReviewTx(
  tx: any,
  input: RecipeImportReviewInsertDto
): Promise<RecipeImportReviewDto> {
  const parsed = RecipeImportReviewInsertBaseSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid RecipeImportReviewInsertDto");

  const [row] = await tx
    .insert(recipeImportReviews)
    .values(parsed.data)
    .onConflictDoUpdate({
      target: recipeImportReviews.recipeId,
      set: { ...parsed.data, updatedAt: new Date() },
    })
    .returning();

  const validated = RecipeImportReviewSelectBaseSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to parse upserted recipe import review");

  return validated.data;
}

export async function updateRecipeImportReview(
  recipeId: string,
  updates: RecipeImportReviewUpdateDto
): Promise<RecipeImportReviewDto | null> {
  const parsed = RecipeImportReviewUpdateBaseSchema.safeParse(updates);

  if (!parsed.success) throw new Error("Invalid RecipeImportReviewUpdateDto");

  const [row] = await db
    .update(recipeImportReviews)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(recipeImportReviews.recipeId, recipeId))
    .returning();

  const validated = RecipeImportReviewSelectBaseSchema.safeParse(row);

  return validated.success ? validated.data : null;
}

export async function listRecipeMetadataReviewItems(
  ctx: RecipeMetadataReviewContext,
  input: z.input<typeof RecipeMetadataReviewListInputSchema>
): Promise<RecipeMetadataReviewItemDto[]> {
  const parsedInput = RecipeMetadataReviewListInputSchema.parse(input);
  const policyCondition = buildViewPolicyCondition(ctx);
  const searchCondition = parsedInput.search
    ? or(
        ilike(recipes.name, `%${parsedInput.search}%`),
        ilike(recipes.description, `%${parsedInput.search}%`)
      )
    : undefined;
  const whereCondition =
    policyCondition && searchCondition
      ? and(policyCondition, searchCondition)
      : (policyCondition ?? searchCondition ?? undefined);
  const rows = await db.query.recipes.findMany({
    columns: {
      id: true,
      name: true,
      description: true,
      image: true,
      categories: true,
      updatedAt: true,
    },
    with: {
      plannerProfiles: {
        columns: {
          recipeTypes: true,
          suitableSlots: true,
        },
      },
      importReviews: {
        columns: {
          needsReview: true,
          issues: true,
          confidenceByField: true,
          inferredData: true,
          reviewedAt: true,
        },
      },
    },
    where: whereCondition,
    orderBy: [desc(recipes.updatedAt)],
    limit: parsedInput.limit,
  });

  const items = rows
    .map((row) => {
      const plannerProfile = row.plannerProfiles?.[0];
      const importReview = row.importReviews?.[0];
      const recipeTypes = plannerProfile?.recipeTypes ?? [];
      const suitableSlots = plannerProfile?.suitableSlots ?? [];
      const inferredRecipeTypes = toStringArray(importReview?.inferredData?.recipeTypes);
      const inferredSuitableSlots = toStringArray(importReview?.inferredData?.suitableSlots);
      const reviewedAt = importReview?.reviewedAt ?? null;
      const thinSlots = needsPrimarySuitableSlot(recipeTypes) && suitableSlots.length === 0;
      const lowConfidenceSlots =
        !reviewedAt &&
        typeof importReview?.confidenceByField?.suitableSlots === "number" &&
        importReview.confidenceByField.suitableSlots < 0.75;
      const requiresAttention =
        Boolean(importReview?.needsReview) || (!reviewedAt && (thinSlots || lowConfidenceSlots));

      if (!parsedInput.includeAll && !requiresAttention) {
        return null;
      }

      return {
        recipeId: row.id,
        name: row.name,
        description: row.description,
        image: row.image,
        categories: row.categories ?? [],
        recipeTypes,
        suitableSlots,
        inferredRecipeTypes,
        inferredSuitableSlots,
        issues: importReview?.issues ?? [],
        confidenceByField: importReview?.confidenceByField ?? {},
        needsReview: importReview?.needsReview ?? (thinSlots || lowConfidenceSlots),
        reviewedAt,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const validated = z.array(RecipeMetadataReviewItemSchema).safeParse(items);

  if (!validated.success) {
    throw new Error("Failed to parse recipe metadata review items");
  }

  return validated.data;
}

export function getNutritionReviewFingerprint(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;

  const fingerprint = (value as Record<string, unknown>).fingerprint;

  return typeof fingerprint === "string" ? fingerprint : null;
}

export async function listRecipeNutritionReviewItems(
  ctx: RecipeMetadataReviewContext,
  input: z.input<typeof RecipeNutritionReviewListInputSchema>
): Promise<RecipeNutritionReviewResponseDto> {
  const parsedInput = RecipeNutritionReviewListInputSchema.parse(input);
  const policyCondition = buildViewPolicyCondition(ctx);
  const searchCondition = parsedInput.search
    ? or(
        ilike(recipes.name, `%${parsedInput.search}%`),
        ilike(recipes.description, `%${parsedInput.search}%`)
      )
    : undefined;
  const whereCondition =
    policyCondition && searchCondition
      ? and(policyCondition, searchCondition)
      : (policyCondition ?? searchCondition ?? undefined);
  const rows = await db.query.recipes.findMany({
    columns: {
      id: true,
      name: true,
      description: true,
      image: true,
      servings: true,
      calories: true,
      fat: true,
      carbs: true,
      protein: true,
      nutritionDetails: true,
      updatedAt: true,
    },
    with: {
      importReviews: {
        columns: {
          reviewOverrides: true,
        },
      },
    },
    where: whereCondition,
    orderBy: [desc(recipes.updatedAt)],
  });

  const summary = {
    total: rows.length,
    credible: 0,
    needsReview: 0,
    missing: 0,
    reviewed: 0,
  };
  const items: RecipeNutritionReviewItemDto[] = [];

  for (const row of rows) {
    const nutritionRecipe = {
      servings: row.servings,
      calories: row.calories,
      fat: row.fat,
      carbs: row.carbs,
      protein: row.protein,
      nutritionDetails: row.nutritionDetails,
    };
    const audit = auditRecipeNutrition(nutritionRecipe);
    const storedFingerprint = getNutritionReviewFingerprint(
      row.importReviews?.[0]?.reviewOverrides?.nutritionAudit
    );
    const reviewed = storedFingerprint === audit.fingerprint;

    if (audit.status === "missing") summary.missing += 1;
    else if (audit.status === "credible") summary.credible += 1;
    else if (reviewed) summary.reviewed += 1;
    else summary.needsReview += 1;

    if (audit.status === "credible") continue;
    if (audit.status === "missing" && !parsedInput.includeMissing) continue;
    if (reviewed && !parsedInput.includeReviewed) continue;

    const suggestedRecipe =
      audit.suggestedAction === "divideByServings"
        ? divideRecipeNutritionByServings(nutritionRecipe)
        : null;

    items.push({
      recipeId: row.id,
      name: row.name,
      description: row.description,
      image: row.image,
      servings: row.servings,
      nutrition: getNutritionAuditValues(nutritionRecipe),
      suggestedNutrition: suggestedRecipe ? getNutritionAuditValues(suggestedRecipe) : null,
      audit: {
        status: audit.status,
        confidence: audit.confidence,
        confidenceScore: audit.confidenceScore,
        issues: audit.issues,
        suggestedAction: audit.suggestedAction,
      },
      reviewed,
    });
  }

  const visibleItems = items
    .sort((left, right) => {
      const suggestedCorrectionDifference =
        Number(right.audit.suggestedAction === "divideByServings") -
        Number(left.audit.suggestedAction === "divideByServings");

      if (suggestedCorrectionDifference !== 0) return suggestedCorrectionDifference;

      const criticalIssueDifference =
        right.audit.issues.filter((issue) => issue.severity === "critical").length -
        left.audit.issues.filter((issue) => issue.severity === "critical").length;

      if (criticalIssueDifference !== 0) return criticalIssueDifference;

      return left.audit.confidenceScore - right.audit.confidenceScore;
    })
    .slice(0, parsedInput.limit);
  const validated = RecipeNutritionReviewResponseSchema.safeParse({
    items: visibleItems,
    summary,
  });

  if (!validated.success) {
    throw new Error("Failed to parse recipe nutrition review items");
  }

  return validated.data;
}
