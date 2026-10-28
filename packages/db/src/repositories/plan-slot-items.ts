import z from "zod";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@norish/db/drizzle";
import { planSlotItems } from "@norish/db/schema";
import {
  PlanSlotItemInsertBaseSchema,
  PlanSlotItemSelectBaseSchema,
  PlanSlotItemUpdateBaseSchema,
} from "@norish/shared/contracts/zod/plan-slot-items";

const PlanSlotItemArraySchema = z.array(PlanSlotItemSelectBaseSchema);

export type PlanSlotItemDto = z.output<typeof PlanSlotItemSelectBaseSchema>;
export type PlanSlotItemInsertDto = z.input<typeof PlanSlotItemInsertBaseSchema>;
export type PlanSlotItemUpdateDto = z.input<typeof PlanSlotItemUpdateBaseSchema>;

export async function listPlanSlotItems(planSlotId: string): Promise<PlanSlotItemDto[]> {
  const rows = await db
    .select()
    .from(planSlotItems)
    .where(eq(planSlotItems.planSlotId, planSlotId))
    .orderBy(asc(planSlotItems.sortOrder));

  const parsed = PlanSlotItemArraySchema.safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse plan slot items");

  return parsed.data;
}

export async function listPlanSlotItemsByPlanSlotIds(
  planSlotIds: string[]
): Promise<Record<string, PlanSlotItemDto[]>> {
  if (planSlotIds.length === 0) return {};

  const rows = await db
    .select()
    .from(planSlotItems)
    .where(inArray(planSlotItems.planSlotId, planSlotIds))
    .orderBy(asc(planSlotItems.planSlotId), asc(planSlotItems.sortOrder));

  const parsed = PlanSlotItemArraySchema.safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse plan slot items");

  return parsed.data.reduce<Record<string, PlanSlotItemDto[]>>((acc, item) => {
    const bucket = acc[item.planSlotId] ?? (acc[item.planSlotId] = []);
    bucket.push(item);

    return acc;
  }, {});
}

export async function getPlanSlotItemById(id: string): Promise<PlanSlotItemDto | null> {
  const [row] = await db
    .select()
    .from(planSlotItems)
    .where(eq(planSlotItems.id, id))
    .limit(1);

  const parsed = PlanSlotItemSelectBaseSchema.safeParse(row);

  return parsed.success ? parsed.data : null;
}

export async function createPlanSlotItem(input: PlanSlotItemInsertDto): Promise<PlanSlotItemDto> {
  const parsed = PlanSlotItemInsertBaseSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid PlanSlotItemInsertDto");

  const [row] = await db.insert(planSlotItems).values(parsed.data).returning();
  const validated = PlanSlotItemSelectBaseSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to parse created plan slot item");

  return validated.data;
}

export async function updatePlanSlotItem(
  id: string,
  updates: PlanSlotItemUpdateDto
): Promise<PlanSlotItemDto | null> {
  const parsed = PlanSlotItemUpdateBaseSchema.safeParse(updates);

  if (!parsed.success) throw new Error("Invalid PlanSlotItemUpdateDto");

  const [row] = await db
    .update(planSlotItems)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(planSlotItems.id, id))
    .returning();

  const validated = PlanSlotItemSelectBaseSchema.safeParse(row);

  return validated.success ? validated.data : null;
}

export async function replacePlanSlotItems(
  planSlotId: string,
  inputs: PlanSlotItemInsertDto[]
): Promise<PlanSlotItemDto[]> {
  const parsed = z.array(PlanSlotItemInsertBaseSchema).safeParse(inputs);

  if (!parsed.success) throw new Error("Invalid PlanSlotItemInsertDto[]");

  return await db.transaction(async (tx) => {
    await tx.delete(planSlotItems).where(eq(planSlotItems.planSlotId, planSlotId));

    if (parsed.data.length === 0) return [];
    const rowsToInsert = parsed.data.map((item, index) => ({
      ...item,
      planSlotId,
      sortOrder: item.sortOrder ?? index,
    }));

    const rows = await tx.insert(planSlotItems).values(rowsToInsert).returning();
    const validated = PlanSlotItemArraySchema.safeParse(rows);

    if (!validated.success) throw new Error("Failed to parse replaced plan slot items");

    return validated.data.sort((a, b) => a.sortOrder - b.sortOrder);
  });
}

export async function deletePlanSlotItem(id: string): Promise<void> {
  await db.delete(planSlotItems).where(eq(planSlotItems.id, id));
}
