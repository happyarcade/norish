import { TRPCError } from "@trpc/server";

import { assertHouseholdAccess } from "@norish/auth/permissions";
import {
  addPantryIngredient,
  deletePantryIngredient,
  deletePantryIngredientsByIds,
  getPantryIngredientOwnerId,
  listPantryIngredientsByUserIds,
  reconcilePantryIngredients,
  updatePantryIngredient,
} from "@norish/db/repositories/pantry";
import { trpcLogger as log } from "@norish/shared-server/logger";
import {
  PantryIngredientAddSchema,
  PantryIngredientReconcileSchema,
  PantryIngredientRemoveManySchema,
  PantryIngredientRemoveSchema,
  PantryIngredientUpdateSchema,
} from "@norish/shared/contracts/zod";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { pantryEmitter } from "./emitter";

const list = authedProcedure.query(({ ctx }) => listPantryIngredientsByUserIds(ctx.userIds));

const add = authedProcedure.input(PantryIngredientAddSchema).mutation(async ({ ctx, input }) => {
  const { item, created } = await addPantryIngredient({
    userId: ctx.user.id,
    userIds: ctx.userIds,
    name: input.name,
  });

  if (created) {
    log.info({ userId: ctx.user.id, pantryIngredientId: item.id }, "Pantry ingredient added");
    pantryEmitter.emitToHousehold(ctx.householdKey, "added", { item });
  }

  return item;
});

const update = authedProcedure
  .input(PantryIngredientUpdateSchema)
  .mutation(async ({ ctx, input }) => {
    const item = await updatePantryIngredient({
      id: input.id,
      userIds: ctx.userIds,
      status: input.status,
      isStaple: input.isStaple,
      confirm: input.confirm,
    });

    if (!item) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Pantry ingredient not found" });
    }

    log.info({ userId: ctx.user.id, pantryIngredientId: item.id }, "Pantry ingredient updated");
    pantryEmitter.emitToHousehold(ctx.householdKey, "updated", { item });

    return item;
  });

const reconcile = authedProcedure
  .input(PantryIngredientReconcileSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const result = await reconcilePantryIngredients({
        userIds: ctx.userIds,
        items: input.items,
      });

      for (const item of result.updatedItems) {
        pantryEmitter.emitToHousehold(ctx.householdKey, "updated", { item });
      }

      for (const itemId of result.removedIds) {
        pantryEmitter.emitToHousehold(ctx.householdKey, "removed", { itemId });
      }

      log.info(
        {
          userId: ctx.user.id,
          updatedCount: result.updatedItems.length,
          removedCount: result.removedIds.length,
        },
        "Pantry ingredients reconciled after cooking"
      );

      return result;
    } catch (error) {
      log.error(
        { error, userId: ctx.user.id, pantryIngredientCount: input.items.length },
        "Failed to reconcile pantry ingredients"
      );

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: error instanceof Error ? error.message : "Failed to reconcile pantry ingredients",
      });
    }
  });

const remove = authedProcedure
  .input(PantryIngredientRemoveSchema)
  .mutation(async ({ ctx, input }) => {
    const ownerId = await getPantryIngredientOwnerId(input.id);

    if (!ownerId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Pantry ingredient not found" });
    }

    await assertHouseholdAccess(ctx.user.id, ownerId);

    if (await deletePantryIngredient(input.id)) {
      log.info({ userId: ctx.user.id, pantryIngredientId: input.id }, "Pantry ingredient removed");
      pantryEmitter.emitToHousehold(ctx.householdKey, "removed", { itemId: input.id });
    }

    return input.id;
  });

const removeMany = authedProcedure
  .input(PantryIngredientRemoveManySchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const itemIds = await deletePantryIngredientsByIds({
        ids: input.ids,
        userIds: ctx.userIds,
      });

      for (const itemId of itemIds) {
        pantryEmitter.emitToHousehold(ctx.householdKey, "removed", { itemId });
      }

      log.info(
        { userId: ctx.user.id, pantryIngredientCount: itemIds.length },
        "Pantry ingredients removed"
      );

      return itemIds;
    } catch (error) {
      log.error(
        { error, userId: ctx.user.id, pantryIngredientIds: input.ids },
        "Failed to remove pantry ingredients"
      );

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: error instanceof Error ? error.message : "Failed to remove pantry ingredients",
      });
    }
  });

export const pantryProcedures = router({ list, add, update, reconcile, remove, removeMany });
