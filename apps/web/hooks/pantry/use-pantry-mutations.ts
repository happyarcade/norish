"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { usePantryQuery } from "./use-pantry-query";

export function usePantryMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { setItems, invalidate } = usePantryQuery();
  const projectionQueryKey = trpc.groceries.projection.queryKey();
  const addMutation = useMutation(trpc.pantry.add.mutationOptions());
  const updateMutation = useMutation(trpc.pantry.update.mutationOptions());
  const reconcileMutation = useMutation(trpc.pantry.reconcile.mutationOptions());
  const removeMutation = useMutation(trpc.pantry.remove.mutationOptions());
  const removeManyMutation = useMutation(trpc.pantry.removeMany.mutationOptions());

  const addPantryIngredient = async (name: string) => {
    const item = await addMutation.mutateAsync({ name });

    setItems((previous) => {
      if (!previous) return [item];
      if (previous.some((candidate) => candidate.id === item.id)) return previous;

      return [...previous, item];
    });
    void queryClient.invalidateQueries({ queryKey: projectionQueryKey });
  };

  const removePantryIngredient = async (id: string) => {
    setItems((previous) => previous?.filter((item) => item.id !== id));

    try {
      await removeMutation.mutateAsync({ id });
      void queryClient.invalidateQueries({ queryKey: projectionQueryKey });
    } catch (error) {
      invalidate();
      throw error;
    }
  };

  const updatePantryIngredient = async (
    id: string,
    changes: { status?: "on_hand" | "low"; isStaple?: boolean; confirm?: boolean }
  ) => {
    const item = await updateMutation.mutateAsync({ id, ...changes });

    setItems((previous) =>
      previous?.map((candidate) => (candidate.id === item.id ? item : candidate))
    );
    void queryClient.invalidateQueries({ queryKey: projectionQueryKey });

    return item;
  };

  const removePantryIngredients = async (ids: string[]) => {
    const removedIds = await removeManyMutation.mutateAsync({ ids });
    const removedIdSet = new Set(removedIds);

    setItems((previous) => previous?.filter((item) => !removedIdSet.has(item.id)));
    void queryClient.invalidateQueries({ queryKey: projectionQueryKey });

    return removedIds;
  };

  const reconcilePantryIngredients = async (
    items: { id: string; outcome: "on_hand" | "low" | "used_up" }[]
  ) => {
    const result = await reconcileMutation.mutateAsync({ items });
    const updatedById = new Map(result.updatedItems.map((item) => [item.id, item]));
    const removedIds = new Set(result.removedIds);

    setItems((previous) =>
      previous
        ?.filter((item) => !removedIds.has(item.id))
        .map((item) => updatedById.get(item.id) ?? item)
    );
    void queryClient.invalidateQueries({ queryKey: projectionQueryKey });

    return result;
  };

  return {
    addPantryIngredient,
    updatePantryIngredient,
    reconcilePantryIngredients,
    removePantryIngredient,
    removePantryIngredients,
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isReconciling: reconcileMutation.isPending,
    isRemoving: removeMutation.isPending || removeManyMutation.isPending,
  };
}
