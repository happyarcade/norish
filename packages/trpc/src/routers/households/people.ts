import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createHouseholdPerson,
  deleteHouseholdPerson,
  getHouseholdPersonById,
  getHouseholdPersonByLinkedUserId,
  isUserHouseholdAdmin,
  listHouseholdPeople,
  updateHouseholdPerson,
} from "@norish/db";
import {
  HouseholdPersonInsertBaseSchema,
  HouseholdPersonSelectBaseSchema,
  HouseholdPersonUpdateBaseSchema,
} from "@norish/shared/contracts/zod";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

function requireHouseholdId(ctx: { household: { id: string; users: Array<{ id: string }> } | null }) {
  if (!ctx.household?.id) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Household people require an active household",
    });
  }

  return ctx.household.id;
}

async function requireHouseholdAdmin(
  ctx: { household: { id: string } | null; user: { id: string } }
) {
  const householdId = requireHouseholdId(ctx);
  const isAdmin = await isUserHouseholdAdmin(householdId, ctx.user.id);

  if (!isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the household admin can manage household people",
    });
  }

  return householdId;
}

function assertLinkedUserBelongsToHousehold(
  householdUsers: Array<{ id: string }>,
  linkedUserId: string | null | undefined
) {
  if (!linkedUserId) return;

  if (!householdUsers.some((user) => user.id === linkedUserId)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Linked user must be a current household member",
    });
  }
}

const upsertPersonInputSchema = z.object({
  id: z.uuid().optional(),
  data: z.union([
    HouseholdPersonInsertBaseSchema.omit({
      householdId: true,
      sortOrder: true,
    }),
    HouseholdPersonUpdateBaseSchema.omit({
      householdId: true,
      sortOrder: true,
    }),
  ]),
});

const deletePersonInputSchema = z.object({
  id: z.uuid(),
});

export const householdPeopleRouter = router({
  listPeople: authedProcedure.query(async ({ ctx }) => {
    const householdId = requireHouseholdId(ctx);

    return z
      .array(HouseholdPersonSelectBaseSchema)
      .parse(await listHouseholdPeople(householdId));
  }),

  upsertPerson: authedProcedure.input(upsertPersonInputSchema).mutation(async ({ ctx, input }) => {
    const householdId = await requireHouseholdAdmin(ctx);
    assertLinkedUserBelongsToHousehold(ctx.household?.users ?? [], input.data.linkedUserId);

    if (input.data.linkedUserId) {
      const existingLinkedPerson = await getHouseholdPersonByLinkedUserId(
        householdId,
        input.data.linkedUserId
      );

      if (existingLinkedPerson && existingLinkedPerson.id !== input.id) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `${existingLinkedPerson.displayName} is already linked to that household login. Edit the existing person instead.`,
        });
      }
    }

    if (input.id) {
      const existing = await getHouseholdPersonById(input.id);

      if (!existing || existing.householdId !== householdId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Household person not found",
        });
      }

      const updated = await updateHouseholdPerson(input.id, input.data);

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update household person",
        });
      }

      return HouseholdPersonSelectBaseSchema.parse(updated);
    }

    return HouseholdPersonSelectBaseSchema.parse(
      await createHouseholdPerson({
        householdId,
        displayName: input.data.displayName,
        kind: input.data.kind,
        portionFactor: input.data.portionFactor,
        isActive: input.data.isActive,
        linkedUserId: input.data.linkedUserId,
      })
    );
  }),

  deletePerson: authedProcedure.input(deletePersonInputSchema).mutation(async ({ ctx, input }) => {
    const householdId = await requireHouseholdAdmin(ctx);
    const existing = await getHouseholdPersonById(input.id);

    if (!existing || existing.householdId !== householdId) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Household person not found",
      });
    }

    if (existing.linkedUserId && (ctx.household?.users ?? []).some((user) => user.id === existing.linkedUserId)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Linked household members cannot be deleted while they are still in the household",
      });
    }

    await deleteHouseholdPerson(input.id);

    return { success: true };
  }),
});
