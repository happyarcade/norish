import z from "zod";
import { eq } from "drizzle-orm";
import { db } from "@norish/db/drizzle";
import { householdPlannerProfiles } from "@norish/db/schema";
import {
  HouseholdPlannerProfileInsertBaseSchema,
  HouseholdPlannerProfileSelectBaseSchema,
  HouseholdPlannerProfileUpdateBaseSchema,
} from "@norish/shared/contracts/zod/household-planner-profiles";

export type HouseholdPlannerProfileDto = z.output<typeof HouseholdPlannerProfileSelectBaseSchema>;
export type HouseholdPlannerProfileInsertDto = z.input<typeof HouseholdPlannerProfileInsertBaseSchema>;
export type HouseholdPlannerProfileUpdateDto = z.input<typeof HouseholdPlannerProfileUpdateBaseSchema>;

type HouseholdPlannerProfileInsertRow = typeof householdPlannerProfiles.$inferInsert;

export const DEFAULT_HOUSEHOLD_PLANNER_PROFILE = {
  planningGoal: null,
  eatingPattern: null,
  snackCount: 1,
  customMealCount: null,
  preWorkoutEnabled: false,
  postWorkoutEnabled: false,
  shoppingWindowDays: 28,
  defaultCalorieTarget: null,
  defaultProteinTarget: null,
  defaultCarbTarget: null,
  defaultFatTarget: null,
  defaultFibreTarget: null,
} as const;

function toPgNumeric(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value as null | undefined;
  if (typeof value === "number") return value.toString();
  if (typeof value === "string") return value;

  throw new Error("Invalid numeric planner profile value");
}

function normalizeHouseholdPlannerProfileInsert(
  input: HouseholdPlannerProfileInsertDto
): HouseholdPlannerProfileInsertRow {
  return {
    ...input,
    defaultProteinTarget: toPgNumeric(input.defaultProteinTarget),
    defaultCarbTarget: toPgNumeric(input.defaultCarbTarget),
    defaultFatTarget: toPgNumeric(input.defaultFatTarget),
    defaultFibreTarget: toPgNumeric(input.defaultFibreTarget),
  };
}

function normalizeHouseholdPlannerProfileUpdate(input: HouseholdPlannerProfileUpdateDto) {
  return {
    ...input,
    defaultProteinTarget: toPgNumeric(input.defaultProteinTarget),
    defaultCarbTarget: toPgNumeric(input.defaultCarbTarget),
    defaultFatTarget: toPgNumeric(input.defaultFatTarget),
    defaultFibreTarget: toPgNumeric(input.defaultFibreTarget),
  };
}

export async function getHouseholdPlannerProfileByHouseholdId(
  householdId: string
): Promise<HouseholdPlannerProfileDto | null> {
  const [row] = await db
    .select()
    .from(householdPlannerProfiles)
    .where(eq(householdPlannerProfiles.householdId, householdId))
    .limit(1);

  const parsed = HouseholdPlannerProfileSelectBaseSchema.safeParse(row);

  return parsed.success ? parsed.data : null;
}

export async function upsertHouseholdPlannerProfile(
  input: HouseholdPlannerProfileInsertDto
): Promise<HouseholdPlannerProfileDto> {
  const parsed = HouseholdPlannerProfileInsertBaseSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid HouseholdPlannerProfileInsertDto");

  const values = normalizeHouseholdPlannerProfileInsert(parsed.data);

  const [row] = await db
    .insert(householdPlannerProfiles)
    .values(values)
    .onConflictDoUpdate({
      target: householdPlannerProfiles.householdId,
      set: { ...normalizeHouseholdPlannerProfileUpdate(parsed.data), updatedAt: new Date() },
    })
    .returning();

  const validated = HouseholdPlannerProfileSelectBaseSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to parse upserted household planner profile");

  return validated.data;
}

export async function updateHouseholdPlannerProfile(
  householdId: string,
  updates: HouseholdPlannerProfileUpdateDto
): Promise<HouseholdPlannerProfileDto | null> {
  const parsed = HouseholdPlannerProfileUpdateBaseSchema.safeParse(updates);

  if (!parsed.success) throw new Error("Invalid HouseholdPlannerProfileUpdateDto");

  const [row] = await db
    .update(householdPlannerProfiles)
    .set({ ...normalizeHouseholdPlannerProfileUpdate(parsed.data), updatedAt: new Date() })
    .where(eq(householdPlannerProfiles.householdId, householdId))
    .returning();

  const validated = HouseholdPlannerProfileSelectBaseSchema.safeParse(row);

  return validated.success ? validated.data : null;
}

export async function ensureHouseholdPlannerProfileTx(
  tx: any,
  householdId: string
): Promise<HouseholdPlannerProfileDto> {
  const values = normalizeHouseholdPlannerProfileInsert({
    householdId,
    ...DEFAULT_HOUSEHOLD_PLANNER_PROFILE,
  });

  await tx.insert(householdPlannerProfiles).values(values).onConflictDoNothing();

  const [row] = await tx
    .select()
    .from(householdPlannerProfiles)
    .where(eq(householdPlannerProfiles.householdId, householdId))
    .limit(1);

  const parsed = HouseholdPlannerProfileSelectBaseSchema.safeParse(row);

  if (!parsed.success) throw new Error("Failed to ensure household planner profile");

  return parsed.data;
}
