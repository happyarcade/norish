import { and, asc, eq, inArray, sql } from "drizzle-orm";
import z from "zod";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import { db } from "@norish/db/drizzle";
import { groceries, pantryIngredients } from "@norish/db/schema";
import { PantryIngredientSelectSchema } from "@norish/shared/contracts/zod";
import { normalizeGroceryName } from "@norish/shared/lib/normalized-name";

const PantryIngredientsSchema = z.array(PantryIngredientSelectSchema);

function parsePantryIngredients(rows: unknown[]): PantryIngredientDto[] {
  const parsed = PantryIngredientsSchema.safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse pantry ingredients");

  return parsed.data;
}

export async function listPantryIngredientsByUserIds(
  userIds: string[]
): Promise<PantryIngredientDto[]> {
  if (userIds.length === 0) return [];

  const rows = await db
    .select()
    .from(pantryIngredients)
    .where(inArray(pantryIngredients.userId, userIds))
    .orderBy(asc(pantryIngredients.normalizedName), asc(pantryIngredients.createdAt));

  return parsePantryIngredients(rows);
}

export async function addPantryIngredient(input: {
  userId: string;
  userIds: string[];
  name: string;
}): Promise<{ item: PantryIngredientDto; created: boolean }> {
  const name = input.name.trim();
  const normalizedName = normalizeGroceryName(name);

  if (!normalizedName) throw new Error("A pantry ingredient needs a name");

  return db.transaction(async (tx) => {
    const householdLockKey = [...input.userIds].sort().join(",");

    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`pantry:${householdLockKey}:${normalizedName}`}::text))`
    );

    const [existing] = await tx
      .select()
      .from(pantryIngredients)
      .where(
        and(
          inArray(pantryIngredients.userId, input.userIds),
          eq(pantryIngredients.normalizedName, normalizedName)
        )
      )
      .limit(1);

    if (existing) {
      const [item] = parsePantryIngredients([existing]);

      if (!item) throw new Error("Failed to parse pantry ingredient");

      return { item, created: false };
    }

    const [created] = await tx
      .insert(pantryIngredients)
      .values({ userId: input.userId, name, normalizedName })
      .returning();

    const [item] = parsePantryIngredients(created ? [created] : []);

    if (!item) throw new Error("Failed to create pantry ingredient");

    return { item, created: true };
  });
}

export async function updatePantryIngredient(input: {
  id: string;
  userIds: string[];
  status?: "on_hand" | "low";
  isStaple?: boolean;
  confirm?: boolean;
}): Promise<PantryIngredientDto | null> {
  if (input.userIds.length === 0) return null;

  const now = new Date();
  const changes: Partial<typeof pantryIngredients.$inferInsert> = {
    updatedAt: now,
  };

  if (input.status !== undefined) changes.status = input.status;
  if (input.isStaple !== undefined) changes.isStaple = input.isStaple;
  if (input.confirm) changes.lastConfirmedAt = now;

  const rows = await db
    .update(pantryIngredients)
    .set(changes)
    .where(
      and(eq(pantryIngredients.id, input.id), inArray(pantryIngredients.userId, input.userIds))
    )
    .returning();
  const [item] = parsePantryIngredients(rows);

  return item ?? null;
}

export type PantryReconciliationOutcome = "on_hand" | "low" | "used_up";

export type ReconcilePantryIngredientsResult = {
  updatedItems: PantryIngredientDto[];
  removedIds: string[];
};

export async function reconcilePantryIngredients(input: {
  userIds: string[];
  items: { id: string; outcome: PantryReconciliationOutcome }[];
}): Promise<ReconcilePantryIngredientsResult> {
  const itemIds = input.items.map((item) => item.id);

  if (itemIds.length === 0 || input.userIds.length === 0) {
    throw new Error("At least one household pantry ingredient is required");
  }

  if (new Set(itemIds).size !== itemIds.length) {
    throw new Error("Each pantry ingredient can only be reconciled once");
  }

  return db.transaction(async (tx) => {
    const matchingRows = await tx
      .select({ id: pantryIngredients.id })
      .from(pantryIngredients)
      .where(
        and(
          inArray(pantryIngredients.id, itemIds),
          inArray(pantryIngredients.userId, input.userIds)
        )
      )
      .for("update");

    if (matchingRows.length !== itemIds.length) {
      throw new Error("Some pantry ingredients are no longer available");
    }

    const now = new Date();
    const updatedRows: (typeof pantryIngredients.$inferSelect)[] = [];

    for (const status of ["on_hand", "low"] as const) {
      const ids = input.items.filter((item) => item.outcome === status).map((item) => item.id);

      if (ids.length === 0) continue;

      const rows = await tx
        .update(pantryIngredients)
        .set({ status, lastConfirmedAt: now, updatedAt: now })
        .where(
          and(inArray(pantryIngredients.id, ids), inArray(pantryIngredients.userId, input.userIds))
        )
        .returning();

      updatedRows.push(...rows);
    }

    const usedUpIds = input.items
      .filter((item) => item.outcome === "used_up")
      .map((item) => item.id);
    const removedRows = usedUpIds.length
      ? await tx
          .delete(pantryIngredients)
          .where(
            and(
              inArray(pantryIngredients.id, usedUpIds),
              inArray(pantryIngredients.userId, input.userIds)
            )
          )
          .returning({ id: pantryIngredients.id })
      : [];

    if (updatedRows.length + removedRows.length !== itemIds.length) {
      throw new Error("Some pantry ingredients could not be updated");
    }

    return {
      updatedItems: parsePantryIngredients(updatedRows),
      removedIds: removedRows.map((item) => item.id),
    };
  });
}

export type MoveDoneGroceriesToPantryResult = {
  groceryIds: string[];
  pantryItems: PantryIngredientDto[];
  createdItems: PantryIngredientDto[];
};

export async function moveDoneGroceriesToPantry(input: {
  userId: string;
  userIds: string[];
  groceryIds: string[];
}): Promise<MoveDoneGroceriesToPantryResult> {
  const groceryIds = [...new Set(input.groceryIds)];

  if (groceryIds.length === 0 || input.userIds.length === 0) {
    throw new Error("At least one completed grocery is required");
  }

  return db.transaction(async (tx) => {
    const groceryRows = await tx
      .select({
        id: groceries.id,
        isDone: groceries.isDone,
        name: groceries.name,
      })
      .from(groceries)
      .where(and(inArray(groceries.id, groceryIds), inArray(groceries.userId, input.userIds)))
      .for("update");

    if (groceryRows.length !== groceryIds.length || groceryRows.some((item) => !item.isDone)) {
      throw new Error("Only completed household groceries can be moved to the pantry");
    }

    const namesByNormalizedName = new Map<string, string>();

    for (const grocery of groceryRows) {
      const name = grocery.name?.trim() ?? "";
      const normalizedName = normalizeGroceryName(name);

      if (!normalizedName) {
        throw new Error("Every grocery needs a name before it can be moved to the pantry");
      }

      if (!namesByNormalizedName.has(normalizedName)) {
        namesByNormalizedName.set(normalizedName, name);
      }
    }

    const normalizedNames = [...namesByNormalizedName.keys()].sort();
    const householdLockKey = [...input.userIds].sort().join(",");

    for (const normalizedName of normalizedNames) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`pantry:${householdLockKey}:${normalizedName}`}::text))`
      );
    }

    const existingRows = await tx
      .select()
      .from(pantryIngredients)
      .where(
        and(
          inArray(pantryIngredients.userId, input.userIds),
          inArray(pantryIngredients.normalizedName, normalizedNames)
        )
      );
    const existingNormalizedNames = new Set(existingRows.map((item) => item.normalizedName));
    const valuesToCreate = normalizedNames
      .filter((normalizedName) => !existingNormalizedNames.has(normalizedName))
      .map((normalizedName) => ({
        userId: input.userId,
        name: namesByNormalizedName.get(normalizedName)!,
        normalizedName,
      }));
    const createdRows = valuesToCreate.length
      ? await tx.insert(pantryIngredients).values(valuesToCreate).returning()
      : [];
    const refreshedRows = existingRows.length
      ? await tx
          .update(pantryIngredients)
          .set({ status: "on_hand", lastConfirmedAt: new Date(), updatedAt: new Date() })
          .where(
            inArray(
              pantryIngredients.id,
              existingRows.map((item) => item.id)
            )
          )
          .returning()
      : [];
    const deletedRows = await tx
      .delete(groceries)
      .where(
        and(
          inArray(groceries.id, groceryIds),
          inArray(groceries.userId, input.userIds),
          eq(groceries.isDone, true)
        )
      )
      .returning({ id: groceries.id });

    if (deletedRows.length !== groceryIds.length) {
      throw new Error("Some groceries changed before they could be moved to the pantry");
    }

    return {
      groceryIds: deletedRows.map((item) => item.id),
      pantryItems: parsePantryIngredients([...refreshedRows, ...createdRows]),
      createdItems: parsePantryIngredients(createdRows),
    };
  });
}

export async function getPantryIngredientOwnerId(id: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: pantryIngredients.userId })
    .from(pantryIngredients)
    .where(eq(pantryIngredients.id, id))
    .limit(1);

  return row?.userId ?? null;
}

export async function deletePantryIngredient(id: string): Promise<boolean> {
  const deleted = await db
    .delete(pantryIngredients)
    .where(eq(pantryIngredients.id, id))
    .returning({ id: pantryIngredients.id });

  return deleted.length > 0;
}

export async function deletePantryIngredientsByIds(input: {
  ids: string[];
  userIds: string[];
}): Promise<string[]> {
  const ids = [...new Set(input.ids)];

  if (ids.length === 0 || input.userIds.length === 0) return [];

  return db.transaction(async (tx) => {
    const matchingRows = await tx
      .select({ id: pantryIngredients.id })
      .from(pantryIngredients)
      .where(
        and(inArray(pantryIngredients.id, ids), inArray(pantryIngredients.userId, input.userIds))
      )
      .for("update");

    if (matchingRows.length !== ids.length) {
      throw new Error("Some pantry ingredients are no longer available");
    }

    const deletedRows = await tx
      .delete(pantryIngredients)
      .where(
        and(inArray(pantryIngredients.id, ids), inArray(pantryIngredients.userId, input.userIds))
      )
      .returning({ id: pantryIngredients.id });

    if (deletedRows.length !== ids.length) {
      throw new Error("Some pantry ingredients could not be removed");
    }

    return deletedRows.map((item) => item.id);
  });
}
