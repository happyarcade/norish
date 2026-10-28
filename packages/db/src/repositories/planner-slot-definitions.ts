import z from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@norish/db/drizzle";
import { plannerSlotDefinitions } from "@norish/db/schema";
import {
  PlannerSlotDefinitionInsertBaseSchema,
  PlannerSlotDefinitionSelectBaseSchema,
  PlannerSlotDefinitionUpdateBaseSchema,
} from "@norish/shared/contracts/zod/planner-slot-definitions";

const PlannerSlotDefinitionArraySchema = z.array(PlannerSlotDefinitionSelectBaseSchema);

export type PlannerSlotDefinitionDto = z.output<typeof PlannerSlotDefinitionSelectBaseSchema>;
export type PlannerSlotDefinitionInsertDto = z.input<typeof PlannerSlotDefinitionInsertBaseSchema>;
export type PlannerSlotDefinitionUpdateDto = z.input<typeof PlannerSlotDefinitionUpdateBaseSchema>;

export function buildDefaultPlannerSlotDefinitions(
  householdId: string
): PlannerSlotDefinitionInsertDto[] {
  return [
    {
      householdId,
      key: "breakfast",
      label: "Breakfast",
      category: "primary",
      slotGroup: "meal",
      sortOrder: 0,
      isEnabled: true,
      isDefault: true,
      allowMultiple: false,
    },
    {
      householdId,
      key: "mid-am",
      label: "Mid-Morning",
      category: "primary",
      slotGroup: "meal",
      sortOrder: 1,
      isEnabled: false,
      isDefault: false,
      allowMultiple: false,
    },
    {
      householdId,
      key: "lunch",
      label: "Lunch",
      category: "primary",
      slotGroup: "meal",
      sortOrder: 2,
      isEnabled: true,
      isDefault: true,
      allowMultiple: false,
    },
    {
      householdId,
      key: "afternoon",
      label: "Afternoon",
      category: "primary",
      slotGroup: "meal",
      sortOrder: 3,
      isEnabled: false,
      isDefault: false,
      allowMultiple: false,
    },
    {
      householdId,
      key: "dinner",
      label: "Dinner",
      category: "primary",
      slotGroup: "meal",
      sortOrder: 4,
      isEnabled: true,
      isDefault: true,
      allowMultiple: false,
    },
    {
      householdId,
      key: "evening",
      label: "Evening",
      category: "primary",
      slotGroup: "meal",
      sortOrder: 5,
      isEnabled: false,
      isDefault: false,
      allowMultiple: false,
    },
    {
      householdId,
      key: "pre-workout",
      label: "Pre-Workout",
      category: "optional",
      slotGroup: "workout",
      sortOrder: 6,
      isEnabled: false,
      isDefault: false,
      allowMultiple: false,
    },
    {
      householdId,
      key: "post-workout",
      label: "Post-Workout",
      category: "optional",
      slotGroup: "workout",
      sortOrder: 7,
      isEnabled: false,
      isDefault: false,
      allowMultiple: false,
    },
    {
      householdId,
      key: "snack",
      label: "Snack",
      category: "optional",
      slotGroup: "snack",
      sortOrder: 8,
      isEnabled: true,
      isDefault: true,
      allowMultiple: true,
    },
  ];
}

export async function listPlannerSlotDefinitions(
  householdId: string,
  enabledOnly: boolean = false
): Promise<PlannerSlotDefinitionDto[]> {
  const rows = await db
    .select()
    .from(plannerSlotDefinitions)
    .where(
      enabledOnly
        ? and(
            eq(plannerSlotDefinitions.householdId, householdId),
            eq(plannerSlotDefinitions.isEnabled, true)
          )
        : eq(plannerSlotDefinitions.householdId, householdId)
    )
    .orderBy(asc(plannerSlotDefinitions.sortOrder));

  const parsed = PlannerSlotDefinitionArraySchema.safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse planner slot definitions");

  return parsed.data;
}

export async function getPlannerSlotDefinitionById(
  id: string
): Promise<PlannerSlotDefinitionDto | null> {
  const [row] = await db
    .select()
    .from(plannerSlotDefinitions)
    .where(eq(plannerSlotDefinitions.id, id))
    .limit(1);

  const parsed = PlannerSlotDefinitionSelectBaseSchema.safeParse(row);

  return parsed.success ? parsed.data : null;
}

export async function createPlannerSlotDefinition(
  input: PlannerSlotDefinitionInsertDto
): Promise<PlannerSlotDefinitionDto> {
  const parsed = PlannerSlotDefinitionInsertBaseSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid PlannerSlotDefinitionInsertDto");

  const [row] = await db.insert(plannerSlotDefinitions).values(parsed.data).returning();
  const validated = PlannerSlotDefinitionSelectBaseSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to parse created planner slot definition");

  return validated.data;
}

export async function updatePlannerSlotDefinition(
  id: string,
  updates: PlannerSlotDefinitionUpdateDto
): Promise<PlannerSlotDefinitionDto | null> {
  const parsed = PlannerSlotDefinitionUpdateBaseSchema.safeParse(updates);

  if (!parsed.success) throw new Error("Invalid PlannerSlotDefinitionUpdateDto");

  const [row] = await db
    .update(plannerSlotDefinitions)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(plannerSlotDefinitions.id, id))
    .returning();

  const validated = PlannerSlotDefinitionSelectBaseSchema.safeParse(row);

  return validated.success ? validated.data : null;
}

export async function seedDefaultPlannerSlotDefinitionsTx(
  tx: any,
  householdId: string
): Promise<PlannerSlotDefinitionDto[]> {
  const defaults = buildDefaultPlannerSlotDefinitions(householdId);

  await tx.insert(plannerSlotDefinitions).values(defaults).onConflictDoNothing();

  const rows = await tx
    .select()
    .from(plannerSlotDefinitions)
    .where(eq(plannerSlotDefinitions.householdId, householdId))
    .orderBy(asc(plannerSlotDefinitions.sortOrder));

  const parsed = PlannerSlotDefinitionArraySchema.safeParse(rows);

  if (!parsed.success) throw new Error("Failed to seed planner slot definitions");

  return parsed.data;
}
