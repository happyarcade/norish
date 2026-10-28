import { db } from "@norish/db/drizzle";

import { ensureHouseholdPeopleFromUsersTx } from "./household-people";
import { ensureHouseholdPlannerProfileTx } from "./household-planner-profiles";
import { seedDefaultPlannerSlotDefinitionsTx } from "./planner-slot-definitions";

export async function ensureHouseholdPlannerFoundation(householdId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await ensureHouseholdPlannerFoundationTx(tx, householdId);
  });
}

export async function ensureHouseholdPlannerFoundationTx(tx: any, householdId: string): Promise<void> {
  await ensureHouseholdPlannerProfileTx(tx, householdId);
  await ensureHouseholdPeopleFromUsersTx(tx, householdId);
  await seedDefaultPlannerSlotDefinitionsTx(tx, householdId);
}
