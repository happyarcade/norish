"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
  PlannerClearSlotInput,
  PlannerRangeResult,
  PlannerRelocateSlotItemInput,
  PlannerReplaceSlotItemsInput,
  PlannerSetSlotItemDairyFreeInput,
  PlannerSetSlotParticipantsInput,
  PlannerUpdateSlotItemInput,
  PlannerUpsertSlotInput,
} from "./types";

type UsePlannerMutationsOptions = {
  queryKey: readonly unknown[];
};

export function usePlannerMutations({ queryKey }: UsePlannerMutationsOptions) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const roleOrder: Record<"main" | "side" | "drink" | "note", number> = {
    main: 0,
    side: 1,
    drink: 2,
    note: 3,
  };

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({
        queryKey: [trpc.groceries.projection.queryKey({ dayCount: 28 })[0]],
      }),
    ]);

  const replaceSlotItemsMutation = useMutation(
    trpc.planner.replaceSlotItems.mutationOptions({
      onSuccess: invalidate,
    })
  );

  const upsertSlotMutation = useMutation(
    trpc.planner.upsertSlot.mutationOptions({
      onSuccess: invalidate,
    })
  );

  const clearSlotMutation = useMutation(
    trpc.planner.clearSlot.mutationOptions({
      onSuccess: invalidate,
    })
  );

  const updateSlotItemMutation = useMutation(
    trpc.planner.updateSlotItem.mutationOptions({
      onSuccess: invalidate,
    })
  );

  const setSlotItemDairyFreeMutation = useMutation(
    trpc.planner.setSlotItemDairyFree.mutationOptions({
      onSuccess: invalidate,
    })
  );

  const setSlotParticipantsMutation = useMutation(
    trpc.planner.setSlotParticipants.mutationOptions({
      onSuccess: invalidate,
    })
  );

  const deleteSlotItemMutation = useMutation(
    trpc.planner.deleteSlotItem.mutationOptions({
      onSuccess: invalidate,
    })
  );

  const moveSlotItemMutation = useMutation(
    trpc.planner.moveSlotItem.mutationOptions({
      onSuccess: invalidate,
    })
  );

  const duplicateSlotItemMutation = useMutation(
    trpc.planner.duplicateSlotItem.mutationOptions({
      onSuccess: invalidate,
    })
  );

  const markCookedMutation = useMutation(
    trpc.recipes.markCooked.mutationOptions({
      onSuccess: () => {
        invalidate();
        queryClient.invalidateQueries({ queryKey: [trpc.recipes.list.queryKey({})[0]] });
      },
    })
  );

  const buildReplaceItems = (
    date: string,
    plannerSlotDefinitionId: string,
    recipeId: string,
    options?: {
      append?: boolean;
      role?: "main" | "side" | "drink";
    }
  ): PlannerReplaceSlotItemsInput => {
    const append = options?.append ?? false;
    const role = options?.role ?? "main";
    const snapshot = queryClient.getQueryData<PlannerRangeResult>(queryKey);
    const existingSlot = snapshot?.days
      .find((day) => day.date === date)
      ?.slots.find((slot) => slot.definition.id === plannerSlotDefinitionId);
    const existingItems = existingSlot?.items ?? [];
    const preservedItems =
      role === "main" && !append
        ? existingItems.filter((item) => item.role !== "main")
        : existingItems;
    const nextItems = [
      ...(role === "main" && !append ? [] : preservedItems),
      {
        itemKind: "recipe" as const,
        role,
        recipeId,
        title: null,
        isConsumer: false,
        dairyFree: false,
        ingredientOverrides: [],
        sortOrder: 0,
      },
      ...(role === "main" && !append ? preservedItems : []),
    ];
    const normalizedItems = nextItems
      .map((item, index) => ({
        item,
        index,
      }))
      .sort(
        (left, right) =>
          (roleOrder[left.item.role] ?? 99) - (roleOrder[right.item.role] ?? 99) ||
          left.index - right.index
      )
      .map(({ item }, index) => ({
        itemKind: item.itemKind,
        role: item.role,
        recipeId: item.recipeId,
        title: item.title,
        isConsumer: item.isConsumer,
        dairyFree: item.dairyFree,
        ingredientOverrides: item.ingredientOverrides,
        sortOrder: index,
      }));

    return {
      date,
      plannerSlotDefinitionId,
      items: normalizedItems,
    };
  };

  return {
    assignRecipe: (date: string, plannerSlotDefinitionId: string, recipeId: string) =>
      replaceSlotItemsMutation.mutateAsync(
        buildReplaceItems(date, plannerSlotDefinitionId, recipeId, {
          append: false,
          role: "main",
        })
      ),
    addRecipeToSlot: (
      date: string,
      plannerSlotDefinitionId: string,
      recipeId: string,
      options?: {
        append?: boolean;
        role?: "main" | "side" | "drink";
      }
    ) =>
      replaceSlotItemsMutation.mutateAsync({
        ...buildReplaceItems(date, plannerSlotDefinitionId, recipeId, options),
      }),
    saveSlotState: (input: PlannerUpsertSlotInput) => upsertSlotMutation.mutateAsync(input),
    clearSlot: (input: PlannerClearSlotInput) => clearSlotMutation.mutateAsync(input),
    updateSlotItem: (input: PlannerUpdateSlotItemInput) =>
      updateSlotItemMutation.mutateAsync(input),
    setSlotItemDairyFree: (input: PlannerSetSlotItemDairyFreeInput) =>
      setSlotItemDairyFreeMutation.mutateAsync(input),
    setSlotParticipants: (input: PlannerSetSlotParticipantsInput) =>
      setSlotParticipantsMutation.mutateAsync(input),
    deleteSlotItem: (id: string) => deleteSlotItemMutation.mutateAsync({ id }),
    moveSlotItem: (input: PlannerRelocateSlotItemInput) => moveSlotItemMutation.mutateAsync(input),
    duplicateSlotItem: (input: PlannerRelocateSlotItemInput) =>
      duplicateSlotItemMutation.mutateAsync(input),
    markSlotItemCooked: (input: { cookedAt?: Date; planSlotItemId: string; recipeId: string }) =>
      markCookedMutation.mutateAsync({
        cookedAt: input.cookedAt,
        planSlotItemId: input.planSlotItemId,
        recipeId: input.recipeId,
        source: "planner",
      }),
    isSaving:
      replaceSlotItemsMutation.isPending ||
      upsertSlotMutation.isPending ||
      clearSlotMutation.isPending ||
      updateSlotItemMutation.isPending ||
      setSlotItemDairyFreeMutation.isPending ||
      setSlotParticipantsMutation.isPending ||
      deleteSlotItemMutation.isPending ||
      moveSlotItemMutation.isPending ||
      duplicateSlotItemMutation.isPending ||
      markCookedMutation.isPending,
  };
}
