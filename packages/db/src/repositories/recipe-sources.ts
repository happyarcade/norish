import z from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@norish/db/drizzle";
import { recipeSources } from "@norish/db/schema";
import {
  RecipeSourceInsertBaseSchema,
  RecipeSourceSelectBaseSchema,
  RecipeSourceUpdateBaseSchema,
} from "@norish/shared/contracts/zod/recipe-sources";

const RecipeSourceArraySchema = z.array(RecipeSourceSelectBaseSchema);

export type RecipeSourceDto = z.output<typeof RecipeSourceSelectBaseSchema>;
export type RecipeSourceInsertDto = z.input<typeof RecipeSourceInsertBaseSchema>;
export type RecipeSourceUpdateDto = z.input<typeof RecipeSourceUpdateBaseSchema>;

export async function listRecipeSourcesByRecipeId(recipeId: string): Promise<RecipeSourceDto[]> {
  const rows = await db
    .select()
    .from(recipeSources)
    .where(eq(recipeSources.recipeId, recipeId))
    .orderBy(desc(recipeSources.createdAt));

  const parsed = RecipeSourceArraySchema.safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse recipe sources");

  return parsed.data;
}

export async function getLatestRecipeSourceByRecipeId(recipeId: string): Promise<RecipeSourceDto | null> {
  const [row] = await db
    .select()
    .from(recipeSources)
    .where(eq(recipeSources.recipeId, recipeId))
    .orderBy(desc(recipeSources.createdAt))
    .limit(1);

  const parsed = RecipeSourceSelectBaseSchema.safeParse(row);

  return parsed.success ? parsed.data : null;
}

export async function createRecipeSource(input: RecipeSourceInsertDto): Promise<RecipeSourceDto> {
  return db.transaction(async (tx) => createRecipeSourceTx(tx, input));
}

export async function createRecipeSourceTx(tx: any, input: RecipeSourceInsertDto): Promise<RecipeSourceDto> {
  const parsed = RecipeSourceInsertBaseSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid RecipeSourceInsertDto");

  const [row] = await tx.insert(recipeSources).values(parsed.data).returning();
  const validated = RecipeSourceSelectBaseSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to parse created recipe source");

  return validated.data;
}

export async function updateRecipeSource(
  id: string,
  updates: RecipeSourceUpdateDto
): Promise<RecipeSourceDto | null> {
  const parsed = RecipeSourceUpdateBaseSchema.safeParse(updates);

  if (!parsed.success) throw new Error("Invalid RecipeSourceUpdateDto");

  const [row] = await db
    .update(recipeSources)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(recipeSources.id, id))
    .returning();

  const validated = RecipeSourceSelectBaseSchema.safeParse(row);

  return validated.success ? validated.data : null;
}

export async function deleteRecipeSourcesByRecipeId(recipeId: string): Promise<void> {
  await db.delete(recipeSources).where(eq(recipeSources.recipeId, recipeId));
}
