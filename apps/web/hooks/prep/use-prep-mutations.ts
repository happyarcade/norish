"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { PrepAddRecipeInput, PrepUpdateItemInput } from "./types";

import { useTRPC } from "@/app/providers/trpc-provider";

type UsePrepMutationsOptions = {
  queryKey: readonly unknown[];
};

export function usePrepMutations({ queryKey }: UsePrepMutationsOptions) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const addRecipeMutation = useMutation(
    trpc.prep.addRecipe.mutationOptions({
      onSuccess: invalidate,
    })
  );
  const updateItemMutation = useMutation(
    trpc.prep.updateItem.mutationOptions({
      onSuccess: invalidate,
    })
  );
  const deleteItemMutation = useMutation(
    trpc.prep.deleteItem.mutationOptions({
      onSuccess: invalidate,
    })
  );

  return {
    addRecipe: (input: PrepAddRecipeInput) => addRecipeMutation.mutateAsync(input),
    updateItem: (input: PrepUpdateItemInput) => updateItemMutation.mutateAsync(input),
    deleteItem: (id: string) => deleteItemMutation.mutateAsync({ id }),
    isSaving:
      addRecipeMutation.isPending ||
      updateItemMutation.isPending ||
      deleteItemMutation.isPending,
  };
}
