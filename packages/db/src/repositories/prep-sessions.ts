import z from "zod";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@norish/db/drizzle";
import { prepSessions } from "@norish/db/schema";
import {
  PrepSessionInsertBaseSchema,
  PrepSessionSelectBaseSchema,
  PrepSessionUpdateBaseSchema,
} from "@norish/shared/contracts/zod/prep-sessions";

const PrepSessionArraySchema = z.array(PrepSessionSelectBaseSchema);

export type PrepSessionDto = z.output<typeof PrepSessionSelectBaseSchema>;
export type PrepSessionInsertDto = z.input<typeof PrepSessionInsertBaseSchema>;
export type PrepSessionUpdateDto = z.input<typeof PrepSessionUpdateBaseSchema>;

export async function listPrepSessionsByHouseholdAndDateRange(
  householdId: string,
  startDate: string,
  endDate: string
): Promise<PrepSessionDto[]> {
  const rows = await db
    .select()
    .from(prepSessions)
    .where(
      and(
        eq(prepSessions.householdId, householdId),
        gte(prepSessions.date, startDate),
        lte(prepSessions.date, endDate)
      )
    )
    .orderBy(asc(prepSessions.date), asc(prepSessions.createdAt));

  const parsed = PrepSessionArraySchema.safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse prep sessions");

  return parsed.data;
}

export async function getPrepSessionById(id: string): Promise<PrepSessionDto | null> {
  const [row] = await db.select().from(prepSessions).where(eq(prepSessions.id, id)).limit(1);
  const parsed = PrepSessionSelectBaseSchema.safeParse(row);

  return parsed.success ? parsed.data : null;
}

export async function getPrepSessionByHouseholdAndDate(
  householdId: string,
  date: string
): Promise<PrepSessionDto | null> {
  const [row] = await db
    .select()
    .from(prepSessions)
    .where(and(eq(prepSessions.householdId, householdId), eq(prepSessions.date, date)))
    .orderBy(asc(prepSessions.createdAt))
    .limit(1);
  const parsed = PrepSessionSelectBaseSchema.safeParse(row);

  return parsed.success ? parsed.data : null;
}

export async function createPrepSession(input: PrepSessionInsertDto): Promise<PrepSessionDto> {
  const parsed = PrepSessionInsertBaseSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid PrepSessionInsertDto");

  const [row] = await db.insert(prepSessions).values(parsed.data).returning();
  const validated = PrepSessionSelectBaseSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to parse created prep session");

  return validated.data;
}

export async function updatePrepSession(
  id: string,
  updates: PrepSessionUpdateDto
): Promise<PrepSessionDto | null> {
  const parsed = PrepSessionUpdateBaseSchema.safeParse(updates);

  if (!parsed.success) throw new Error("Invalid PrepSessionUpdateDto");

  const [row] = await db
    .update(prepSessions)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(prepSessions.id, id))
    .returning();

  const validated = PrepSessionSelectBaseSchema.safeParse(row);

  return validated.success ? validated.data : null;
}

export async function deletePrepSession(id: string): Promise<void> {
  await db.delete(prepSessions).where(eq(prepSessions.id, id));
}
