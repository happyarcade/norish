import z from "zod";
import { and, count, desc, eq, inArray, max } from "drizzle-orm";
import { db } from "@norish/db/drizzle";
import { recipeCookEvents } from "@norish/db/schema";
import {
  RecipeCookEventInsertBaseSchema,
  RecipeCookEventSelectBaseSchema,
} from "@norish/shared/contracts/zod/recipe-cook-events";

export type RecipeCookEventDto = z.output<typeof RecipeCookEventSelectBaseSchema>;
export type RecipeCookEventInsertDto = z.input<typeof RecipeCookEventInsertBaseSchema>;

export type RecipeCookStats = {
  lastCookedAt: Date | null;
  cookCount: number;
};

const RecipeCookEventArraySchema = z.array(RecipeCookEventSelectBaseSchema);

export async function markRecipeCooked(
  input: RecipeCookEventInsertDto
): Promise<RecipeCookEventDto> {
  const parsed = RecipeCookEventInsertBaseSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid RecipeCookEventInsertDto");

  const [row] = await db.insert(recipeCookEvents).values(parsed.data).returning();
  const validated = RecipeCookEventSelectBaseSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to parse created recipe cook event");

  return validated.data;
}

export async function deleteLatestRecipeCookEvent(
  householdId: string,
  recipeId: string
): Promise<RecipeCookEventDto | null> {
  const [latest] = await db
    .select()
    .from(recipeCookEvents)
    .where(
      and(eq(recipeCookEvents.householdId, householdId), eq(recipeCookEvents.recipeId, recipeId))
    )
    .orderBy(desc(recipeCookEvents.cookedAt), desc(recipeCookEvents.createdAt))
    .limit(1);

  if (!latest) return null;

  const [deleted] = await db
    .delete(recipeCookEvents)
    .where(eq(recipeCookEvents.id, latest.id))
    .returning();

  const validated = RecipeCookEventSelectBaseSchema.safeParse(deleted);

  if (!validated.success) throw new Error("Failed to parse deleted recipe cook event");

  return validated.data;
}

export async function getRecipeCookEvents(
  householdId: string,
  recipeId: string,
  limit: number = 10
): Promise<RecipeCookEventDto[]> {
  const rows = await db
    .select()
    .from(recipeCookEvents)
    .where(
      and(eq(recipeCookEvents.householdId, householdId), eq(recipeCookEvents.recipeId, recipeId))
    )
    .orderBy(desc(recipeCookEvents.cookedAt))
    .limit(limit);

  const parsed = RecipeCookEventArraySchema.safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse recipe cook events");

  return parsed.data;
}

export async function getRecipeCookStats(
  householdId: string,
  recipeId: string
): Promise<RecipeCookStats> {
  const rows = await db
    .select({
      lastCookedAt: max(recipeCookEvents.cookedAt),
      cookCount: count(recipeCookEvents.id),
    })
    .from(recipeCookEvents)
    .where(
      and(eq(recipeCookEvents.householdId, householdId), eq(recipeCookEvents.recipeId, recipeId))
    );

  const row = rows[0];

  return {
    lastCookedAt: row?.lastCookedAt ?? null,
    cookCount: Number(row?.cookCount ?? 0),
  };
}

export async function getRecipeCookStatsByRecipeIds(
  householdId: string,
  recipeIds: string[]
): Promise<Record<string, RecipeCookStats>> {
  if (recipeIds.length === 0) return {};

  const rows = await db
    .select({
      recipeId: recipeCookEvents.recipeId,
      lastCookedAt: max(recipeCookEvents.cookedAt),
      cookCount: count(recipeCookEvents.id),
    })
    .from(recipeCookEvents)
    .where(
      and(eq(recipeCookEvents.householdId, householdId), inArray(recipeCookEvents.recipeId, recipeIds))
    )
    .groupBy(recipeCookEvents.recipeId);

  return rows.reduce<Record<string, RecipeCookStats>>((acc, row) => {
    acc[row.recipeId] = {
      lastCookedAt: row.lastCookedAt ?? null,
      cookCount: Number(row.cookCount ?? 0),
    };

    return acc;
  }, {});
}
