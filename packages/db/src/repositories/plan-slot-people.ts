import z from "zod";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@norish/db/drizzle";
import { householdPeople, planSlotPeople } from "@norish/db/schema";
import {
  HouseholdPersonSelectBaseSchema,
  PlanSlotPersonInsertBaseSchema,
  PlanSlotPersonSelectBaseSchema,
} from "@norish/shared/contracts/zod";

export type PlanSlotPersonDto = z.output<typeof PlanSlotPersonSelectBaseSchema>;
export type PlanSlotPersonInsertDto = z.input<typeof PlanSlotPersonInsertBaseSchema>;

export async function listPlanSlotPeopleByPlanSlotIds(
  planSlotIds: string[]
): Promise<Record<string, z.output<typeof HouseholdPersonSelectBaseSchema>[]>> {
  if (planSlotIds.length === 0) return {};

  const rows = await db
    .select({
      planSlotId: planSlotPeople.planSlotId,
      person: householdPeople,
    })
    .from(planSlotPeople)
    .innerJoin(householdPeople, eq(planSlotPeople.householdPersonId, householdPeople.id))
    .where(inArray(planSlotPeople.planSlotId, planSlotIds))
    .orderBy(asc(planSlotPeople.planSlotId), asc(planSlotPeople.sortOrder));

  return rows.reduce<Record<string, z.output<typeof HouseholdPersonSelectBaseSchema>[]>>(
    (acc, row) => {
      const parsed = HouseholdPersonSelectBaseSchema.safeParse(row.person);

      if (!parsed.success) {
        throw new Error("Failed to parse plan slot participant");
      }

      const bucket = acc[row.planSlotId] ?? (acc[row.planSlotId] = []);
      bucket.push(parsed.data);

      return acc;
    },
    {}
  );
}

export async function replacePlanSlotPeople(
  planSlotId: string,
  householdPersonIds: string[]
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(planSlotPeople).where(eq(planSlotPeople.planSlotId, planSlotId));

    if (householdPersonIds.length === 0) return;

    const payload = householdPersonIds.map((householdPersonId, sortOrder) => ({
      planSlotId,
      householdPersonId,
      sortOrder,
    }));
    const parsed = z.array(PlanSlotPersonInsertBaseSchema).safeParse(payload);

    if (!parsed.success) throw new Error("Invalid plan slot participants");

    await tx.insert(planSlotPeople).values(parsed.data);
  });
}
