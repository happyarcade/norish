import z from "zod";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@norish/db/drizzle";
import { prepSessionItems } from "@norish/db/schema";
import {
  PrepSessionItemInsertBaseSchema,
  PrepSessionItemSelectBaseSchema,
  PrepSessionItemUpdateBaseSchema,
} from "@norish/shared/contracts/zod/prep-session-items";

const PrepSessionItemArraySchema = z.array(PrepSessionItemSelectBaseSchema);

export type PrepSessionItemDto = z.output<typeof PrepSessionItemSelectBaseSchema>;
export type PrepSessionItemInsertDto = z.input<typeof PrepSessionItemInsertBaseSchema>;
export type PrepSessionItemUpdateDto = z.input<typeof PrepSessionItemUpdateBaseSchema>;

export async function listPrepSessionItems(prepSessionId: string): Promise<PrepSessionItemDto[]> {
  const rows = await db
    .select()
    .from(prepSessionItems)
    .where(eq(prepSessionItems.prepSessionId, prepSessionId))
    .orderBy(asc(prepSessionItems.sortOrder));

  const parsed = PrepSessionItemArraySchema.safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse prep session items");

  return parsed.data;
}

export async function listPrepSessionItemsByPrepSessionIds(
  prepSessionIds: string[]
): Promise<Record<string, PrepSessionItemDto[]>> {
  if (prepSessionIds.length === 0) return {};

  const rows = await db
    .select()
    .from(prepSessionItems)
    .where(inArray(prepSessionItems.prepSessionId, prepSessionIds))
    .orderBy(asc(prepSessionItems.prepSessionId), asc(prepSessionItems.sortOrder));

  const parsed = PrepSessionItemArraySchema.safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse prep session items");

  return parsed.data.reduce<Record<string, PrepSessionItemDto[]>>((acc, item) => {
    const bucket = acc[item.prepSessionId] ?? (acc[item.prepSessionId] = []);
    bucket.push(item);

    return acc;
  }, {});
}

export async function getPrepSessionItemById(id: string): Promise<PrepSessionItemDto | null> {
  const [row] = await db.select().from(prepSessionItems).where(eq(prepSessionItems.id, id)).limit(1);
  const parsed = PrepSessionItemSelectBaseSchema.safeParse(row);

  return parsed.success ? parsed.data : null;
}

export async function createPrepSessionItem(
  input: PrepSessionItemInsertDto
): Promise<PrepSessionItemDto> {
  const parsed = PrepSessionItemInsertBaseSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid PrepSessionItemInsertDto");

  const [row] = await db.insert(prepSessionItems).values(parsed.data).returning();
  const validated = PrepSessionItemSelectBaseSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to parse created prep session item");

  return validated.data;
}

export async function updatePrepSessionItem(
  id: string,
  updates: PrepSessionItemUpdateDto
): Promise<PrepSessionItemDto | null> {
  const parsed = PrepSessionItemUpdateBaseSchema.safeParse(updates);

  if (!parsed.success) throw new Error("Invalid PrepSessionItemUpdateDto");

  const [row] = await db
    .update(prepSessionItems)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(prepSessionItems.id, id))
    .returning();

  const validated = PrepSessionItemSelectBaseSchema.safeParse(row);

  return validated.success ? validated.data : null;
}

export async function replacePrepSessionItems(
  prepSessionId: string,
  inputs: PrepSessionItemInsertDto[]
): Promise<PrepSessionItemDto[]> {
  const parsed = z.array(PrepSessionItemInsertBaseSchema).safeParse(inputs);

  if (!parsed.success) throw new Error("Invalid PrepSessionItemInsertDto[]");

  return await db.transaction(async (tx) => {
    await tx.delete(prepSessionItems).where(eq(prepSessionItems.prepSessionId, prepSessionId));

    if (parsed.data.length === 0) return [];

    const rowsToInsert = parsed.data.map((item, index) => ({
      ...item,
      prepSessionId,
      sortOrder: item.sortOrder ?? index,
    }));

    const rows = await tx.insert(prepSessionItems).values(rowsToInsert).returning();
    const validated = PrepSessionItemArraySchema.safeParse(rows);

    if (!validated.success) throw new Error("Failed to parse replaced prep session items");

    return validated.data.sort((a, b) => a.sortOrder - b.sortOrder);
  });
}

export async function deletePrepSessionItem(id: string): Promise<void> {
  await db.delete(prepSessionItems).where(eq(prepSessionItems.id, id));
}
