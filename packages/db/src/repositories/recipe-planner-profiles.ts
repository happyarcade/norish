import z from "zod";
import { eq } from "drizzle-orm";
import { db } from "@norish/db/drizzle";
import { recipePlannerProfiles } from "@norish/db/schema";
import {
  RecipePlannerProfileInsertBaseSchema,
  RecipePlannerProfileSelectBaseSchema,
  RecipePlannerProfileUpdateBaseSchema,
} from "@norish/shared/contracts/zod/recipe-planner-profiles";

export type RecipePlannerProfileDto = z.output<typeof RecipePlannerProfileSelectBaseSchema>;
export type RecipePlannerProfileInsertDto = z.input<typeof RecipePlannerProfileInsertBaseSchema>;
export type RecipePlannerProfileUpdateDto = z.input<typeof RecipePlannerProfileUpdateBaseSchema>;

type RecipePlannerProfileInsertRow = typeof recipePlannerProfiles.$inferInsert;

function toPgNumeric(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value as null | undefined;
  if (typeof value === "number") return value.toString();
  if (typeof value === "string") return value;

  throw new Error("Invalid numeric recipe planner profile value");
}

function normalizeRecipePlannerProfileInsert(input: RecipePlannerProfileInsertDto): RecipePlannerProfileInsertRow {
  return {
    ...input,
    fruitVegCount: toPgNumeric(input.fruitVegCount),
  };
}

function normalizeRecipePlannerProfileUpdate(input: RecipePlannerProfileUpdateDto) {
  return {
    ...input,
    fruitVegCount: toPgNumeric(input.fruitVegCount),
  };
}

export async function getRecipePlannerProfileByRecipeId(
  recipeId: string
): Promise<RecipePlannerProfileDto | null> {
  const [row] = await db
    .select()
    .from(recipePlannerProfiles)
    .where(eq(recipePlannerProfiles.recipeId, recipeId))
    .limit(1);

  const parsed = RecipePlannerProfileSelectBaseSchema.safeParse(row);

  return parsed.success ? parsed.data : null;
}

export async function upsertRecipePlannerProfile(
  input: RecipePlannerProfileInsertDto
): Promise<RecipePlannerProfileDto> {
  return db.transaction(async (tx) => upsertRecipePlannerProfileTx(tx, input));
}

export async function upsertRecipePlannerProfileTx(
  tx: any,
  input: RecipePlannerProfileInsertDto
): Promise<RecipePlannerProfileDto> {
  const parsed = RecipePlannerProfileInsertBaseSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid RecipePlannerProfileInsertDto");

  const values = normalizeRecipePlannerProfileInsert(parsed.data);

  const [row] = await tx
    .insert(recipePlannerProfiles)
    .values(values)
    .onConflictDoUpdate({
      target: recipePlannerProfiles.recipeId,
      set: { ...normalizeRecipePlannerProfileUpdate(parsed.data), updatedAt: new Date() },
    })
    .returning();

  const validated = RecipePlannerProfileSelectBaseSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to parse upserted recipe planner profile");

  return validated.data;
}

export async function updateRecipePlannerProfile(
  recipeId: string,
  updates: RecipePlannerProfileUpdateDto
): Promise<RecipePlannerProfileDto | null> {
  const parsed = RecipePlannerProfileUpdateBaseSchema.safeParse(updates);

  if (!parsed.success) throw new Error("Invalid RecipePlannerProfileUpdateDto");

  const [row] = await db
    .update(recipePlannerProfiles)
    .set({ ...normalizeRecipePlannerProfileUpdate(parsed.data), updatedAt: new Date() })
    .where(eq(recipePlannerProfiles.recipeId, recipeId))
    .returning();

  const validated = RecipePlannerProfileSelectBaseSchema.safeParse(row);

  return validated.success ? validated.data : null;
}
