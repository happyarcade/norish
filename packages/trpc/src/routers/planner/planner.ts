import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { RecipeCategory } from "@norish/shared/contracts";
import {
  createPlanSlotItem,
  dashboardRecipe,
  deletePlanSlot,
  deletePlanSlotItem,
  ensureHouseholdPlannerFoundation,
  getActiveHouseholdPortionUnits,
  getHouseholdPlannerProfileByHouseholdId,
  getPlannerSlotDefinitionById,
  getPlanSlotByHouseholdDateAndDefinition,
  getPlanSlotById,
  getPlanSlotItemById,
  getWeeklyPlannerRecipeCandidates,
  listHouseholdPeople,
  listHouseholdPeopleByIds,
  listPlannerSlotDefinitions,
  listPlanSlotItems,
  listPlanSlotItemsByPlanSlotIds,
  listPlanSlotPeopleByPlanSlotIds,
  listPlanSlotsByHouseholdAndDateRange,
  listRecipeIngredientSubstitutionCandidates,
  replacePlanSlotItems,
  replacePlanSlotPeople,
  updateHouseholdPlannerProfile,
  updatePlannerSlotDefinition,
  updatePlanSlotItem,
  upsertPlanSlot,
} from "@norish/db";
import { listPantryIngredientsByUserIds } from "@norish/db/repositories/pantry";
import {
  HouseholdPersonSelectBaseSchema,
  HouseholdPlannerProfileSelectBaseSchema,
  HouseholdPlannerProfileUpdateBaseSchema,
  PlannerSlotDefinitionSelectBaseSchema,
  PlannerSlotDefinitionUpdateBaseSchema,
  PlanSlotItemInsertBaseSchema,
  PlanSlotItemSelectBaseSchema,
  PlanSlotItemUpdateBaseSchema,
  PlanSlotSelectBaseSchema,
  planSlotStatuses,
  RecipeDashboardSchema,
} from "@norish/shared/contracts/zod";
import { suggestDairyFreeIngredientOverrides } from "@norish/shared/lib/dairy-free";
import { replaceMealIngredientOverrides } from "@norish/shared/lib/meal-adjustments";
import {
  buildWeeklyMealSuggestions,
  weeklyPlanningModes,
} from "@norish/shared/lib/weekly-meal-suggestions";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD date");

const PlannerRangeInputSchema = z
  .object({
    startDate: DateStringSchema,
    endDate: DateStringSchema,
    enabledOnly: z.boolean().default(true),
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "startDate must be on or before endDate",
    path: ["endDate"],
  });

const PlannerSuggestWeekInputSchema = z
  .object({
    startDate: DateStringSchema,
    endDate: DateStringSchema,
    today: DateStringSchema,
    mode: z.enum(weeklyPlanningModes).default("balanced"),
    scope: z.enum(["dinners", "lunch-dinner"]).default("dinners"),
    seed: z.number().int().nonnegative().max(10_000).default(0),
    targetDates: z.array(DateStringSchema).max(7).optional(),
    targetSlotDefinitionIds: z.array(z.uuid()).max(2).optional(),
    excludedRecipeIds: z.array(z.string().min(1).max(128)).max(50).default([]),
  })
  .refine(
    (value) => {
      const start = new Date(value.startDate + "T00:00:00Z").getTime();
      const end = new Date(value.endDate + "T00:00:00Z").getTime();

      return end >= start && end - start <= 6 * 86_400_000;
    },
    {
      message: "Weekly suggestions must cover no more than seven days",
      path: ["endDate"],
    }
  )
  .superRefine((value, ctx) => {
    for (const targetDate of value.targetDates ?? []) {
      if (targetDate < value.startDate || targetDate > value.endDate) {
        ctx.addIssue({
          code: "custom",
          message: "Target dates must be inside the requested week",
          path: ["targetDates"],
        });
        break;
      }
    }
  });

const PlannerSlotDefinitionsInputSchema = z.object({
  enabledOnly: z.boolean().default(false),
});

const PlannerSlotDefinitionUpdateInputSchema = z.object({
  id: z.uuid(),
  data: PlannerSlotDefinitionUpdateBaseSchema.omit({
    householdId: true,
    key: true,
    isDefault: true,
  }),
});

const PlannerSlotUpsertInputSchema = z.object({
  date: DateStringSchema,
  plannerSlotDefinitionId: z.uuid(),
  status: z.enum(planSlotStatuses).optional(),
  isLocked: z.boolean().optional(),
  batchMultiplier: z.number().int().min(1).optional(),
  headcountOverride: z.number().int().min(1).nullable().optional(),
});

const PlannerSetSlotParticipantsInputSchema = z.object({
  date: DateStringSchema,
  plannerSlotDefinitionId: z.uuid(),
  householdPersonIds: z.array(z.uuid()),
});

const PlannerSlotItemReplaceInputSchema = PlanSlotItemInsertBaseSchema.omit({ planSlotId: true })
  .extend({
    recipeId: z.uuid().nullable().optional(),
    title: z.string().trim().nullable().optional(),
  })
  .refine((item) => (item.itemKind ?? "recipe") !== "recipe" || Boolean(item.recipeId), {
    message: "recipeId is required for recipe items",
    path: ["recipeId"],
  })
  .refine((item) => (item.itemKind ?? "recipe") !== "note" || Boolean(item.title?.trim()), {
    message: "title is required for note items",
    path: ["title"],
  });

const PlannerReplaceSlotItemsInputSchema = z.object({
  date: DateStringSchema,
  plannerSlotDefinitionId: z.uuid(),
  items: z.array(PlannerSlotItemReplaceInputSchema),
});

const PlannerSlotItemUpdateInputSchema = z.object({
  id: z.uuid(),
  data: PlanSlotItemUpdateBaseSchema.omit({
    planSlotId: true,
  }).extend({
    recipeId: z.uuid().nullable().optional(),
    title: z.string().trim().nullable().optional(),
  }),
});

const PlannerSetSlotItemDairyFreeInputSchema = z.object({
  id: z.uuid(),
  enabled: z.boolean(),
});

const PlannerDeleteSlotItemInputSchema = z.object({
  id: z.uuid(),
});

const PlannerRelocateSlotItemInputSchema = z.object({
  id: z.uuid(),
  date: DateStringSchema,
  plannerSlotDefinitionId: z.uuid(),
});

const PlannerClearSlotInputSchema = z.object({
  date: DateStringSchema,
  plannerSlotDefinitionId: z.uuid(),
});

const PlannerSlotItemWithRecipeSchema = PlanSlotItemSelectBaseSchema.extend({
  recipe: RecipeDashboardSchema.nullable(),
});

const PlannerDaySlotSchema = z.object({
  definition: PlannerSlotDefinitionSelectBaseSchema,
  planSlot: PlanSlotSelectBaseSchema.nullable(),
  items: z.array(PlannerSlotItemWithRecipeSchema),
  participantOverrides: z.array(HouseholdPersonSelectBaseSchema),
  usesWholeHousehold: z.boolean(),
  effectivePortionUnits: z.number().nonnegative(),
});

const PlannerDaySchema = z.object({
  date: DateStringSchema,
  slots: z.array(PlannerDaySlotSchema),
});

const PlannerRangeResponseSchema = z.object({
  profile: HouseholdPlannerProfileSelectBaseSchema,
  householdPeople: z.array(HouseholdPersonSelectBaseSchema),
  defaultPortionUnits: z.number().nonnegative(),
  slotDefinitions: z.array(PlannerSlotDefinitionSelectBaseSchema),
  days: z.array(PlannerDaySchema),
});

const PlannerSuggestedMealSchema = z.object({
  date: DateStringSchema,
  plannerSlotDefinitionId: z.uuid(),
  slotKey: z.string().min(1),
  slotLabel: z.string().min(1),
  recipe: z.object({
    id: z.uuid(),
    name: z.string(),
    image: z.string().nullable(),
    protein: z.number().nullable(),
    sodium: z.number().nullable(),
    totalMinutes: z.number().nullable(),
    cuisines: z.array(z.string()),
    pantryIngredientNames: z.array(z.string()),
    additionalIngredientNames: z.array(z.string()),
  }),
  reasons: z.array(z.string()),
  score: z.number(),
});

const PlannerSuggestWeekResponseSchema = z.object({
  suggestions: z.array(PlannerSuggestedMealSchema),
  openMealCount: z.number().int().nonnegative(),
  candidateCount: z.number().int().nonnegative(),
});

function roundPortionUnits(value: number): number {
  return Math.round(value * 100) / 100;
}

function requireHouseholdId(ctx: { household: { id: string } | null }): string {
  if (!ctx.household?.id) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Planner requires an active household",
    });
  }

  return ctx.household.id;
}

async function ensurePlannerContext(householdId: string) {
  await ensureHouseholdPlannerFoundation(householdId);

  const profile = await getHouseholdPlannerProfileByHouseholdId(householdId);

  if (!profile) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to load household planner profile",
    });
  }

  return profile;
}

async function assertPlannerSlotDefinitionAccess(
  householdId: string,
  plannerSlotDefinitionId: string
) {
  const definition = await getPlannerSlotDefinitionById(plannerSlotDefinitionId);

  if (!definition || definition.householdId !== householdId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Planner slot definition not found",
    });
  }

  return definition;
}

async function assertPlanSlotAccess(householdId: string, planSlotId: string) {
  const planSlot = await getPlanSlotById(planSlotId);

  if (!planSlot || planSlot.householdId !== householdId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Plan slot not found",
    });
  }

  return planSlot;
}

async function assertPlanSlotItemAccess(householdId: string, planSlotItemId: string) {
  const item = await getPlanSlotItemById(planSlotItemId);

  if (!item) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Plan slot item not found",
    });
  }

  const planSlot = await assertPlanSlotAccess(householdId, item.planSlotId);

  return { item, planSlot };
}

async function getOrCreatePlanSlot(
  householdId: string,
  date: string,
  plannerSlotDefinitionId: string
) {
  const existing = await getPlanSlotByHouseholdDateAndDefinition(
    householdId,
    date,
    plannerSlotDefinitionId
  );

  if (existing) return existing;

  return upsertPlanSlot({
    householdId,
    date,
    plannerSlotDefinitionId,
    status: "neutral",
    isLocked: false,
    batchMultiplier: 1,
    headcountOverride: null,
  });
}

async function createCopiedSlotItem(
  householdId: string,
  sourceItem: z.infer<typeof PlanSlotItemSelectBaseSchema>,
  date: string,
  plannerSlotDefinitionId: string
) {
  await assertPlannerSlotDefinitionAccess(householdId, plannerSlotDefinitionId);

  const destinationPlanSlot = await getOrCreatePlanSlot(householdId, date, plannerSlotDefinitionId);
  const destinationItems = await listPlanSlotItems(destinationPlanSlot.id);

  const copiedItem = await createPlanSlotItem({
    planSlotId: destinationPlanSlot.id,
    itemKind: sourceItem.itemKind,
    role: sourceItem.role,
    sortOrder: destinationItems.length,
    recipeId: sourceItem.recipeId,
    title: sourceItem.title,
    isConsumer: sourceItem.isConsumer,
    dairyFree: sourceItem.dairyFree,
    ingredientOverrides: sourceItem.ingredientOverrides,
  });

  return {
    destinationPlanSlot,
    copiedItem,
  };
}

function enumerateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

export const plannerProcedures = router({
  getProfile: authedProcedure.query(async ({ ctx }) => {
    const householdId = requireHouseholdId(ctx);

    return ensurePlannerContext(householdId);
  }),

  updateProfile: authedProcedure
    .input(
      HouseholdPlannerProfileUpdateBaseSchema.omit({
        householdId: true,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const householdId = requireHouseholdId(ctx);
      await ensurePlannerContext(householdId);

      const updated = await updateHouseholdPlannerProfile(householdId, input);

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update household planner profile",
        });
      }

      return HouseholdPlannerProfileSelectBaseSchema.parse(updated);
    }),

  listSlotDefinitions: authedProcedure
    .input(PlannerSlotDefinitionsInputSchema)
    .query(async ({ ctx, input }) => {
      const householdId = requireHouseholdId(ctx);
      await ensurePlannerContext(householdId);

      return z
        .array(PlannerSlotDefinitionSelectBaseSchema)
        .parse(await listPlannerSlotDefinitions(householdId, input.enabledOnly));
    }),

  updateSlotDefinition: authedProcedure
    .input(PlannerSlotDefinitionUpdateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const householdId = requireHouseholdId(ctx);

      await ensurePlannerContext(householdId);
      await assertPlannerSlotDefinitionAccess(householdId, input.id);

      const updated = await updatePlannerSlotDefinition(input.id, input.data);

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update planner slot definition",
        });
      }

      return PlannerSlotDefinitionSelectBaseSchema.parse(updated);
    }),

  suggestWeek: authedProcedure
    .input(PlannerSuggestWeekInputSchema)
    .query(async ({ ctx, input }) => {
      const householdId = requireHouseholdId(ctx);
      const profile = await ensurePlannerContext(householdId);
      const [slotDefinitions, planSlots, pantryIngredients] = await Promise.all([
        listPlannerSlotDefinitions(householdId, true),
        listPlanSlotsByHouseholdAndDateRange(householdId, input.startDate, input.endDate),
        listPantryIngredientsByUserIds(ctx.userIds),
      ]);
      const requestedSlotKeys =
        input.scope === "lunch-dinner" ? (["lunch", "dinner"] as const) : (["dinner"] as const);
      const targetSlotDefinitionIds = input.targetSlotDefinitionIds
        ? new Set(input.targetSlotDefinitionIds)
        : null;
      const suggestionDefinitions = requestedSlotKeys.flatMap((slotKey) => {
        const labelPattern =
          slotKey === "lunch" ? /\b(?:lunch|midday)\b/i : /\b(?:dinner|supper)\b/i;
        const definition =
          slotDefinitions.find((candidate) => candidate.key === slotKey) ??
          slotDefinitions.find(
            (candidate) => candidate.slotGroup === "meal" && labelPattern.test(candidate.label)
          ) ??
          null;

        if (
          !definition ||
          (targetSlotDefinitionIds && !targetSlotDefinitionIds.has(definition.id))
        ) {
          return [];
        }

        return [{ definition, slotKey }];
      });

      if (suggestionDefinitions.length === 0) {
        return PlannerSuggestWeekResponseSchema.parse({
          suggestions: [],
          openMealCount: 0,
          candidateCount: 0,
        });
      }

      const slotItemsByPlanSlotId = await listPlanSlotItemsByPlanSlotIds(
        planSlots.map((slot) => slot.id)
      );
      const planSlotByDateAndDefinition = new Map(
        planSlots.map((slot) => [slot.date + ":" + slot.plannerSlotDefinitionId, slot])
      );
      const existingRecipeIds = Array.from(
        new Set([
          ...Object.values(slotItemsByPlanSlotId)
            .flat()
            .map((item) => item.recipeId)
            .filter((recipeId): recipeId is string => Boolean(recipeId)),
          ...input.excludedRecipeIds,
        ])
      );
      const targetDates = input.targetDates ? new Set(input.targetDates) : null;
      const targets = enumerateDateRange(input.startDate, input.endDate)
        .filter((date) => date >= input.today && (!targetDates || targetDates.has(date)))
        .flatMap((date) =>
          suggestionDefinitions.flatMap(({ definition, slotKey }) => {
            const planSlot = planSlotByDateAndDefinition.get(date + ":" + definition.id);

            if (
              planSlot?.isLocked ||
              (planSlot && (slotItemsByPlanSlotId[planSlot.id] ?? []).length > 0)
            ) {
              return [];
            }

            return [
              {
                date,
                plannerSlotDefinitionId: definition.id,
                slotKey,
                slotLabel: definition.label,
              },
            ];
          })
        );

      if (targets.length === 0) {
        return PlannerSuggestWeekResponseSchema.parse({
          suggestions: [],
          openMealCount: 0,
          candidateCount: 0,
        });
      }

      const candidateCategories: RecipeCategory[] = suggestionDefinitions.map(({ slotKey }) =>
        slotKey === "lunch" ? "Lunch" : "Dinner"
      );
      const candidates = await getWeeklyPlannerRecipeCandidates(
        {
          userId: ctx.user.id,
          householdUserIds: ctx.householdUserIds,
          householdId,
          isServerAdmin: ctx.isServerAdmin,
        },
        candidateCategories
      );
      const suggestions = buildWeeklyMealSuggestions(candidates, targets, {
        existingRecipeIds,
        mode: input.mode,
        proteinTarget: profile.defaultProteinTarget,
        seed: input.seed,
        today: input.today,
        pantryIngredientNames: pantryIngredients
          .filter((ingredient) => ingredient.status === "on_hand")
          .map((ingredient) => ingredient.normalizedName),
      });

      return PlannerSuggestWeekResponseSchema.parse({
        suggestions,
        openMealCount: targets.length,
        candidateCount: candidates.length,
      });
    }),

  getRange: authedProcedure.input(PlannerRangeInputSchema).query(async ({ ctx, input }) => {
    const householdId = requireHouseholdId(ctx);
    const profile = await ensurePlannerContext(householdId);
    const householdPeople = await listHouseholdPeople(householdId);
    const activeHouseholdPeople = householdPeople.filter((person) => person.isActive);
    const defaultPortionUnits = await getActiveHouseholdPortionUnits(householdId);
    const slotDefinitions = await listPlannerSlotDefinitions(householdId, input.enabledOnly);
    const planSlots = await listPlanSlotsByHouseholdAndDateRange(
      householdId,
      input.startDate,
      input.endDate
    );
    const planSlotIds = planSlots.map((slot) => slot.id);
    const slotItemsByPlanSlotId = await listPlanSlotItemsByPlanSlotIds(planSlotIds);
    const planSlotPeopleByPlanSlotId = await listPlanSlotPeopleByPlanSlotIds(planSlotIds);
    const recipeIds = [
      ...new Set(
        Object.values(slotItemsByPlanSlotId)
          .flat()
          .map((item) => item.recipeId)
          .filter((recipeId): recipeId is string => Boolean(recipeId))
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

    const slotByKey = new Map(
      planSlots.map((slot) => [`${slot.date}:${slot.plannerSlotDefinitionId}`, slot] as const)
    );

    const days = enumerateDateRange(input.startDate, input.endDate).map((date) => ({
      date,
      slots: slotDefinitions.map((definition) => {
        const planSlot = slotByKey.get(`${date}:${definition.id}`) ?? null;
        const participantOverrides = planSlot
          ? (planSlotPeopleByPlanSlotId[planSlot.id] ?? [])
          : [];
        const items = planSlot
          ? (slotItemsByPlanSlotId[planSlot.id] ?? []).map((item) => ({
              ...item,
              recipe: item.recipeId ? (recipeById[item.recipeId] ?? null) : null,
            }))
          : [];
        const overridePortionUnits = participantOverrides.reduce(
          (sum, person) => sum + person.portionFactor,
          0
        );
        const effectivePortionUnits = roundPortionUnits(
          participantOverrides.length > 0
            ? overridePortionUnits
            : (planSlot?.headcountOverride ?? defaultPortionUnits)
        );

        return {
          definition,
          planSlot,
          items,
          participantOverrides,
          usesWholeHousehold: participantOverrides.length === 0,
          effectivePortionUnits,
        };
      }),
    }));

    return PlannerRangeResponseSchema.parse({
      profile,
      householdPeople,
      defaultPortionUnits,
      slotDefinitions,
      days,
    });
  }),

  upsertSlot: authedProcedure
    .input(PlannerSlotUpsertInputSchema)
    .mutation(async ({ ctx, input }) => {
      const householdId = requireHouseholdId(ctx);

      await ensurePlannerContext(householdId);
      await assertPlannerSlotDefinitionAccess(householdId, input.plannerSlotDefinitionId);

      const existing = await getPlanSlotByHouseholdDateAndDefinition(
        householdId,
        input.date,
        input.plannerSlotDefinitionId
      );

      return PlanSlotSelectBaseSchema.parse(
        await upsertPlanSlot({
          householdId,
          date: input.date,
          plannerSlotDefinitionId: input.plannerSlotDefinitionId,
          status: input.status ?? existing?.status ?? "neutral",
          isLocked: input.isLocked ?? existing?.isLocked ?? false,
          batchMultiplier: input.batchMultiplier ?? existing?.batchMultiplier ?? 1,
          headcountOverride:
            input.headcountOverride !== undefined
              ? input.headcountOverride
              : (existing?.headcountOverride ?? null),
        })
      );
    }),

  setSlotParticipants: authedProcedure
    .input(PlannerSetSlotParticipantsInputSchema)
    .mutation(async ({ ctx, input }) => {
      const householdId = requireHouseholdId(ctx);

      await ensurePlannerContext(householdId);
      await assertPlannerSlotDefinitionAccess(householdId, input.plannerSlotDefinitionId);

      const selectedPeople = await listHouseholdPeopleByIds(householdId, input.householdPersonIds);

      if (selectedPeople.length !== input.householdPersonIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or more selected participants do not belong to this household",
        });
      }

      const activeHouseholdPeople = (await listHouseholdPeople(householdId, { activeOnly: true }))
        .map((person) => person.id)
        .sort();
      const selectedIds = [...selectedPeople.map((person) => person.id)].sort();
      const shouldUseWholeHousehold =
        selectedIds.length === 0 ||
        (selectedIds.length === activeHouseholdPeople.length &&
          selectedIds.every((id, index) => id === activeHouseholdPeople[index]));
      const existing = await getPlanSlotByHouseholdDateAndDefinition(
        householdId,
        input.date,
        input.plannerSlotDefinitionId
      );

      if (!existing && shouldUseWholeHousehold) {
        return {
          success: true,
          usesWholeHousehold: true,
        };
      }

      const planSlot =
        existing ??
        (await getOrCreatePlanSlot(householdId, input.date, input.plannerSlotDefinitionId));

      await replacePlanSlotPeople(
        planSlot.id,
        shouldUseWholeHousehold ? [] : selectedPeople.map((person) => person.id)
      );

      return {
        success: true,
        usesWholeHousehold: shouldUseWholeHousehold,
      };
    }),

  replaceSlotItems: authedProcedure
    .input(PlannerReplaceSlotItemsInputSchema)
    .mutation(async ({ ctx, input }) => {
      const householdId = requireHouseholdId(ctx);

      await ensurePlannerContext(householdId);
      await assertPlannerSlotDefinitionAccess(householdId, input.plannerSlotDefinitionId);

      const planSlot = await getOrCreatePlanSlot(
        householdId,
        input.date,
        input.plannerSlotDefinitionId
      );
      const items = await replacePlanSlotItems(
        planSlot.id,
        input.items.map((item, index) => ({
          ...item,
          planSlotId: planSlot.id,
          sortOrder: item.sortOrder ?? index,
        }))
      );

      return z
        .object({
          planSlot: PlanSlotSelectBaseSchema,
          items: z.array(PlanSlotItemSelectBaseSchema),
        })
        .parse({
          planSlot,
          items,
        });
    }),

  updateSlotItem: authedProcedure
    .input(PlannerSlotItemUpdateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const householdId = requireHouseholdId(ctx);

      await ensurePlannerContext(householdId);
      await assertPlanSlotItemAccess(householdId, input.id);

      const updated = await updatePlanSlotItem(input.id, input.data);

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update plan slot item",
        });
      }

      return PlanSlotItemSelectBaseSchema.parse(updated);
    }),

  setSlotItemDairyFree: authedProcedure
    .input(PlannerSetSlotItemDairyFreeInputSchema)
    .mutation(async ({ ctx, input }) => {
      const householdId = requireHouseholdId(ctx);

      await ensurePlannerContext(householdId);
      const { item } = await assertPlanSlotItemAccess(householdId, input.id);

      if (!item.recipeId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Dairy-free adjustments require a recipe item",
        });
      }

      const suggestedOverrides = input.enabled
        ? suggestDairyFreeIngredientOverrides(
            await listRecipeIngredientSubstitutionCandidates(item.recipeId)
          )
        : [];
      const ingredientOverrides = replaceMealIngredientOverrides(
        item.ingredientOverrides,
        suggestedOverrides,
        "dairy-free",
        item.dairyFree
      );
      const updated = await updatePlanSlotItem(input.id, {
        dairyFree: input.enabled,
        ingredientOverrides,
      });

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update dairy-free adjustments",
        });
      }

      return PlanSlotItemSelectBaseSchema.parse(updated);
    }),

  deleteSlotItem: authedProcedure
    .input(PlannerDeleteSlotItemInputSchema)
    .mutation(async ({ ctx, input }) => {
      const householdId = requireHouseholdId(ctx);

      await ensurePlannerContext(householdId);
      const { planSlot } = await assertPlanSlotItemAccess(householdId, input.id);
      await deletePlanSlotItem(input.id);

      const remainingItems = await listPlanSlotItems(planSlot.id);

      if (remainingItems.length === 0) {
        await deletePlanSlot(planSlot.id);
      }

      return { success: true };
    }),

  moveSlotItem: authedProcedure
    .input(PlannerRelocateSlotItemInputSchema)
    .mutation(async ({ ctx, input }) => {
      const householdId = requireHouseholdId(ctx);

      await ensurePlannerContext(householdId);

      const { item, planSlot } = await assertPlanSlotItemAccess(householdId, input.id);
      const sourceSlot = await assertPlanSlotAccess(householdId, item.planSlotId);

      if (
        sourceSlot.date === input.date &&
        sourceSlot.plannerSlotDefinitionId === input.plannerSlotDefinitionId
      ) {
        return {
          item: PlanSlotItemSelectBaseSchema.parse(item),
        };
      }

      const { copiedItem } = await createCopiedSlotItem(
        householdId,
        item,
        input.date,
        input.plannerSlotDefinitionId
      );

      await deletePlanSlotItem(item.id);

      const remainingItems = await listPlanSlotItems(planSlot.id);

      if (remainingItems.length === 0) {
        await deletePlanSlot(planSlot.id);
      }

      return {
        item: PlanSlotItemSelectBaseSchema.parse(copiedItem),
      };
    }),

  duplicateSlotItem: authedProcedure
    .input(PlannerRelocateSlotItemInputSchema)
    .mutation(async ({ ctx, input }) => {
      const householdId = requireHouseholdId(ctx);

      await ensurePlannerContext(householdId);

      const { item } = await assertPlanSlotItemAccess(householdId, input.id);
      const { copiedItem } = await createCopiedSlotItem(
        householdId,
        item,
        input.date,
        input.plannerSlotDefinitionId
      );

      return {
        item: PlanSlotItemSelectBaseSchema.parse(copiedItem),
      };
    }),

  clearSlot: authedProcedure.input(PlannerClearSlotInputSchema).mutation(async ({ ctx, input }) => {
    const householdId = requireHouseholdId(ctx);

    await ensurePlannerContext(householdId);
    await assertPlannerSlotDefinitionAccess(householdId, input.plannerSlotDefinitionId);

    const existing = await getPlanSlotByHouseholdDateAndDefinition(
      householdId,
      input.date,
      input.plannerSlotDefinitionId
    );

    if (existing) {
      await deletePlanSlot(existing.id);
    }

    return { success: true };
  }),
});
