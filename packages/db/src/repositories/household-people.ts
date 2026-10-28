import z from "zod";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { decrypt } from "@norish/auth/crypto";
import { db } from "@norish/db/drizzle";
import { householdPeople, householdUsers, users } from "@norish/db/schema";
import {
  HouseholdPersonInsertBaseSchema,
  HouseholdPersonSelectBaseSchema,
  HouseholdPersonUpdateBaseSchema,
} from "@norish/shared/contracts/zod/household-people";

export type HouseholdPersonDto = z.output<typeof HouseholdPersonSelectBaseSchema>;
export type HouseholdPersonInsertDto = z.input<typeof HouseholdPersonInsertBaseSchema>;
export type HouseholdPersonUpdateDto = z.input<typeof HouseholdPersonUpdateBaseSchema>;

type HouseholdPersonInsertRow = typeof householdPeople.$inferInsert;

function toPgNumeric(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value as null | undefined;
  if (typeof value === "number") return value.toString();
  if (typeof value === "string") return value;

  throw new Error("Invalid numeric household person value");
}

function normalizeHouseholdPersonInsert(input: HouseholdPersonInsertDto): HouseholdPersonInsertRow {
  return {
    ...input,
    portionFactor: toPgNumeric(input.portionFactor) ?? "1",
  };
}

function normalizeHouseholdPersonUpdate(input: HouseholdPersonUpdateDto) {
  const portionFactor = toPgNumeric(input.portionFactor);
  const next: Partial<HouseholdPersonInsertRow> = {};

  if (input.householdId !== undefined) next.householdId = input.householdId;
  if (input.linkedUserId !== undefined) next.linkedUserId = input.linkedUserId;
  if (input.displayName !== undefined) next.displayName = input.displayName;
  if (input.kind !== undefined) next.kind = input.kind;
  if (input.isActive !== undefined) next.isActive = input.isActive;
  if (input.sortOrder !== undefined) next.sortOrder = input.sortOrder;

  if (portionFactor !== undefined) {
    next.portionFactor = portionFactor ?? "1";
  }

  return next;
}

async function nextSortOrderTx(tx: any, householdId: string): Promise<number> {
  const rows = await tx
    .select({
      sortOrder: sql<number>`coalesce(max(${householdPeople.sortOrder}), -1)`,
    })
    .from(householdPeople)
    .where(eq(householdPeople.householdId, householdId));

  return Number(rows[0]?.sortOrder ?? -1) + 1;
}

export async function listHouseholdPeople(
  householdId: string,
  options: { activeOnly?: boolean } = {}
): Promise<HouseholdPersonDto[]> {
  const where = options.activeOnly
    ? and(eq(householdPeople.householdId, householdId), eq(householdPeople.isActive, true))
    : eq(householdPeople.householdId, householdId);

  const rows = await db
    .select()
    .from(householdPeople)
    .where(where)
    .orderBy(desc(householdPeople.isActive), asc(householdPeople.sortOrder), asc(householdPeople.createdAt));

  const parsed = z.array(HouseholdPersonSelectBaseSchema).safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse household people");

  return parsed.data;
}

export async function listHouseholdPeopleByIds(
  householdId: string,
  personIds: string[]
): Promise<HouseholdPersonDto[]> {
  if (personIds.length === 0) return [];

  const rows = await db
    .select()
    .from(householdPeople)
    .where(and(eq(householdPeople.householdId, householdId), inArray(householdPeople.id, personIds)))
    .orderBy(desc(householdPeople.isActive), asc(householdPeople.sortOrder), asc(householdPeople.createdAt));

  const parsed = z.array(HouseholdPersonSelectBaseSchema).safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse household people by ids");

  return parsed.data;
}

export async function getHouseholdPersonById(id: string): Promise<HouseholdPersonDto | null> {
  const [row] = await db.select().from(householdPeople).where(eq(householdPeople.id, id)).limit(1);
  const parsed = HouseholdPersonSelectBaseSchema.safeParse(row);

  return parsed.success ? parsed.data : null;
}

export async function getHouseholdPersonByLinkedUserId(
  householdId: string,
  linkedUserId: string
): Promise<HouseholdPersonDto | null> {
  const [row] = await db
    .select()
    .from(householdPeople)
    .where(
      and(
        eq(householdPeople.householdId, householdId),
        eq(householdPeople.linkedUserId, linkedUserId)
      )
    )
    .limit(1);
  const parsed = HouseholdPersonSelectBaseSchema.safeParse(row);

  return parsed.success ? parsed.data : null;
}

export async function createHouseholdPerson(
  input: HouseholdPersonInsertDto
): Promise<HouseholdPersonDto> {
  const parsed = HouseholdPersonInsertBaseSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid HouseholdPersonInsertDto");

  return db.transaction(async (tx) => {
    const sortOrder =
      parsed.data.sortOrder ?? (await nextSortOrderTx(tx, parsed.data.householdId));
    const [row] = await tx
      .insert(householdPeople)
      .values({ ...normalizeHouseholdPersonInsert(parsed.data), sortOrder })
      .returning();

    const validated = HouseholdPersonSelectBaseSchema.safeParse(row);

    if (!validated.success) throw new Error("Failed to parse created household person");

    return validated.data;
  });
}

export async function updateHouseholdPerson(
  id: string,
  updates: HouseholdPersonUpdateDto
): Promise<HouseholdPersonDto | null> {
  const parsed = HouseholdPersonUpdateBaseSchema.safeParse(updates);

  if (!parsed.success) throw new Error("Invalid HouseholdPersonUpdateDto");

  const [row] = await db
    .update(householdPeople)
    .set({ ...normalizeHouseholdPersonUpdate(parsed.data), updatedAt: new Date() })
    .where(eq(householdPeople.id, id))
    .returning();

  const validated = HouseholdPersonSelectBaseSchema.safeParse(row);

  return validated.success ? validated.data : null;
}

export async function deleteHouseholdPerson(id: string): Promise<void> {
  await db.delete(householdPeople).where(eq(householdPeople.id, id));
}

export async function getActiveHouseholdPortionUnits(householdId: string): Promise<number> {
  const people = await listHouseholdPeople(householdId, { activeOnly: true });

  return Math.round(
    people.reduce((sum, person) => sum + person.portionFactor, 0) * 100
  ) / 100;
}

export async function ensureLinkedHouseholdPersonTx(
  tx: any,
  input: {
    householdId: string;
    linkedUserId: string;
    displayName: string;
  }
): Promise<void> {
  const [existing] = await tx
    .select()
    .from(householdPeople)
    .where(
      and(
        eq(householdPeople.householdId, input.householdId),
        eq(householdPeople.linkedUserId, input.linkedUserId)
      )
    )
    .limit(1);

  if (existing) {
    await tx
      .update(householdPeople)
      .set({
        isActive: true,
        linkedUserId: input.linkedUserId,
        displayName: existing.displayName?.trim() ? existing.displayName : input.displayName,
        updatedAt: new Date(),
      })
      .where(eq(householdPeople.id, existing.id));

    return;
  }

  const sortOrder = await nextSortOrderTx(tx, input.householdId);

  await tx.insert(householdPeople).values({
    householdId: input.householdId,
    linkedUserId: input.linkedUserId,
    displayName: input.displayName,
    kind: "adult",
    portionFactor: "1",
    isActive: true,
    sortOrder,
  });
}

export async function deactivateLinkedHouseholdPersonTx(
  tx: any,
  householdId: string,
  linkedUserId: string
): Promise<void> {
  await tx
    .update(householdPeople)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(householdPeople.householdId, householdId),
        eq(householdPeople.linkedUserId, linkedUserId)
      )
    );
}

export async function ensureHouseholdPeopleFromUsersTx(tx: any, householdId: string): Promise<void> {
  const members = await tx
    .select({
      userId: householdUsers.userId,
      encryptedName: users.name,
    })
    .from(householdUsers)
    .innerJoin(users, eq(householdUsers.userId, users.id))
    .where(eq(householdUsers.householdId, householdId));

  for (const member of members) {
    await ensureLinkedHouseholdPersonTx(tx, {
      householdId,
      linkedUserId: member.userId,
      displayName: member.encryptedName ? decrypt(member.encryptedName) : "Household member",
    });
  }
}
