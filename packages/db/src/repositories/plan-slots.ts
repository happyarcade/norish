import z from "zod";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@norish/db/drizzle";
import { planSlots } from "@norish/db/schema";
import {
  PlanSlotInsertBaseSchema,
  PlanSlotSelectBaseSchema,
  PlanSlotUpdateBaseSchema,
} from "@norish/shared/contracts/zod/plan-slots";

const PlanSlotArraySchema = z.array(PlanSlotSelectBaseSchema);

export type PlanSlotDto = z.output<typeof PlanSlotSelectBaseSchema>;
export type PlanSlotInsertDto = z.input<typeof PlanSlotInsertBaseSchema>;
export type PlanSlotUpdateDto = z.input<typeof PlanSlotUpdateBaseSchema>;

export async function listPlanSlotsByHouseholdAndDateRange(
  householdId: string,
  startDate: string,
  endDate: string
): Promise<PlanSlotDto[]> {
  const rows = await db
    .select()
    .from(planSlots)
    .where(
      and(
        eq(planSlots.householdId, householdId),
        gte(planSlots.date, startDate),
        lte(planSlots.date, endDate)
      )
    )
    .orderBy(asc(planSlots.date), asc(planSlots.plannerSlotDefinitionId));

  const parsed = PlanSlotArraySchema.safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse plan slots");

  return parsed.data;
}

export async function getPlanSlotById(id: string): Promise<PlanSlotDto | null> {
  const [row] = await db.select().from(planSlots).where(eq(planSlots.id, id)).limit(1);
  const parsed = PlanSlotSelectBaseSchema.safeParse(row);

  return parsed.success ? parsed.data : null;
}

export async function getPlanSlotByHouseholdDateAndDefinition(
  householdId: string,
  date: string,
  plannerSlotDefinitionId: string
): Promise<PlanSlotDto | null> {
  const [row] = await db
    .select()
    .from(planSlots)
    .where(
      and(
        eq(planSlots.householdId, householdId),
        eq(planSlots.date, date),
        eq(planSlots.plannerSlotDefinitionId, plannerSlotDefinitionId)
      )
    )
    .limit(1);

  const parsed = PlanSlotSelectBaseSchema.safeParse(row);

  return parsed.success ? parsed.data : null;
}

export async function upsertPlanSlot(input: PlanSlotInsertDto): Promise<PlanSlotDto> {
  const parsed = PlanSlotInsertBaseSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid PlanSlotInsertDto");

  const [row] = await db
    .insert(planSlots)
    .values(parsed.data)
    .onConflictDoUpdate({
      target: [planSlots.householdId, planSlots.date, planSlots.plannerSlotDefinitionId],
      set: {
        status: parsed.data.status,
        isLocked: parsed.data.isLocked,
        batchMultiplier: parsed.data.batchMultiplier,
        headcountOverride: parsed.data.headcountOverride,
        updatedAt: new Date(),
      },
    })
    .returning();

  const validated = PlanSlotSelectBaseSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to parse upserted plan slot");

  return validated.data;
}

export async function updatePlanSlot(
  id: string,
  updates: PlanSlotUpdateDto
): Promise<PlanSlotDto | null> {
  const parsed = PlanSlotUpdateBaseSchema.safeParse(updates);

  if (!parsed.success) throw new Error("Invalid PlanSlotUpdateDto");

  const [row] = await db
    .update(planSlots)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(planSlots.id, id))
    .returning();

  const validated = PlanSlotSelectBaseSchema.safeParse(row);

  return validated.success ? validated.data : null;
}

export async function deletePlanSlot(id: string): Promise<void> {
  await db.delete(planSlots).where(eq(planSlots.id, id));
}
