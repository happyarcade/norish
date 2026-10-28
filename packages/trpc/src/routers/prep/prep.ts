import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createPrepSession,
  createPrepSessionItem,
  dashboardRecipe,
  deletePrepSession,
  deletePrepSessionItem,
  getPrepSessionByHouseholdAndDate,
  getPrepSessionById,
  getPrepSessionItemById,
  listPrepSessionItems,
  listPrepSessionItemsByPrepSessionIds,
  listPrepSessionsByHouseholdAndDateRange,
  updatePrepSessionItem,
} from "@norish/db";
import {
  PrepSessionItemSelectBaseSchema,
  PrepSessionItemUpdateBaseSchema,
  PrepSessionSelectBaseSchema,
  RecipeDashboardSchema,
} from "@norish/shared/contracts/zod";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD date");

const PrepRangeInputSchema = z
  .object({
    startDate: DateStringSchema,
    endDate: DateStringSchema,
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "startDate must be on or before endDate",
    path: ["endDate"],
  });

const PrepAddRecipeInputSchema = z.object({
  date: DateStringSchema,
  recipeId: z.uuid(),
  batchCount: z.number().int().min(1).max(99).default(1),
  isFreezerBatch: z.boolean().default(false),
  notes: z.string().trim().nullable().optional(),
});

const PrepUpdateItemInputSchema = z.object({
  id: z.uuid(),
  data: PrepSessionItemUpdateBaseSchema.omit({
    prepSessionId: true,
    recipeId: true,
  }).extend({
    batchCount: z.number().int().min(1).max(99).optional(),
    isFreezerBatch: z.boolean().optional(),
    notes: z.string().trim().nullable().optional(),
  }),
});

const PrepDeleteItemInputSchema = z.object({
  id: z.uuid(),
});

const PrepSessionItemWithRecipeSchema = PrepSessionItemSelectBaseSchema.extend({
  recipe: RecipeDashboardSchema.nullable(),
});

const PrepSessionWithItemsSchema = PrepSessionSelectBaseSchema.extend({
  items: z.array(PrepSessionItemWithRecipeSchema),
});

const PrepRangeResponseSchema = z.object({
  sessions: z.array(PrepSessionWithItemsSchema),
});

function requireHouseholdId(ctx: { household: { id: string } | null }): string {
  if (!ctx.household?.id) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Prep Table requires an active household",
    });
  }

  return ctx.household.id;
}

async function assertPrepSessionAccess(householdId: string, prepSessionId: string) {
  const session = await getPrepSessionById(prepSessionId);

  if (!session || session.householdId !== householdId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Prep session not found",
    });
  }

  return session;
}

async function assertPrepSessionItemAccess(householdId: string, prepSessionItemId: string) {
  const item = await getPrepSessionItemById(prepSessionItemId);

  if (!item) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Prep item not found",
    });
  }

  const session = await assertPrepSessionAccess(householdId, item.prepSessionId);

  return { item, session };
}

async function getOrCreatePrepSession(householdId: string, date: string) {
  const existing = await getPrepSessionByHouseholdAndDate(householdId, date);

  if (existing) return existing;

  return createPrepSession({
    householdId,
    date,
    title: null,
    notes: null,
  });
}

async function deleteSessionIfEmpty(prepSessionId: string) {
  const remainingItems = await listPrepSessionItems(prepSessionId);

  if (remainingItems.length === 0) {
    await deletePrepSession(prepSessionId);
  }
}

export const prepProcedures = router({
  getRange: authedProcedure.input(PrepRangeInputSchema).query(async ({ ctx, input }) => {
    const householdId = requireHouseholdId(ctx);
    const sessions = await listPrepSessionsByHouseholdAndDateRange(
      householdId,
      input.startDate,
      input.endDate
    );
    const itemsBySessionId = await listPrepSessionItemsByPrepSessionIds(
      sessions.map((session) => session.id)
    );
    const recipeIds = [
      ...new Set(
        Object.values(itemsBySessionId)
          .flat()
          .map((item) => item.recipeId)
      ),
    ];
    const recipes = await Promise.all(recipeIds.map((recipeId) => dashboardRecipe(recipeId)));
    const recipeById = recipes.reduce<Record<string, z.infer<typeof RecipeDashboardSchema>>>(
      (acc, recipe) => {
        if (recipe) acc[recipe.id] = RecipeDashboardSchema.parse(recipe);

        return acc;
      },
      {}
    );

    return PrepRangeResponseSchema.parse({
      sessions: sessions.map((session) => ({
        ...session,
        items: (itemsBySessionId[session.id] ?? []).map((item) => ({
          ...item,
          recipe: recipeById[item.recipeId] ?? null,
        })),
      })),
    });
  }),

  addRecipe: authedProcedure.input(PrepAddRecipeInputSchema).mutation(async ({ ctx, input }) => {
    const householdId = requireHouseholdId(ctx);
    const recipe = await dashboardRecipe(input.recipeId);

    if (!recipe) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Recipe not found",
      });
    }

    const session = await getOrCreatePrepSession(householdId, input.date);
    const existingItems = await listPrepSessionItems(session.id);
    const item = await createPrepSessionItem({
      prepSessionId: session.id,
      recipeId: input.recipeId,
      batchCount: input.batchCount,
      sortOrder: existingItems.length,
      notes: input.notes ?? null,
      isFreezerBatch: input.isFreezerBatch,
    });

    return PrepSessionItemSelectBaseSchema.parse(item);
  }),

  updateItem: authedProcedure.input(PrepUpdateItemInputSchema).mutation(async ({ ctx, input }) => {
    const householdId = requireHouseholdId(ctx);
    await assertPrepSessionItemAccess(householdId, input.id);

    const updated = await updatePrepSessionItem(input.id, input.data);

    if (!updated) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update prep item",
      });
    }

    return PrepSessionItemSelectBaseSchema.parse(updated);
  }),

  deleteItem: authedProcedure.input(PrepDeleteItemInputSchema).mutation(async ({ ctx, input }) => {
    const householdId = requireHouseholdId(ctx);
    const { session } = await assertPrepSessionItemAccess(householdId, input.id);

    await deletePrepSessionItem(input.id);
    await deleteSessionIfEmpty(session.id);

    return { success: true };
  }),
});
