import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { RecipeCategory, RecipeDashboardDTO } from "@norish/shared/contracts";

import type { CreateRecipeHooksOptions } from "../types";

export type RandomRecipeResult = {
  id: string;
  name: string;
  image: string | null;
  nutritionReview?: RecipeDashboardDTO["nutritionReview"];
} | null;

export type RandomRecipeFilters = {
  category?: RecipeCategory;
  recipeTypes?: string[];
  suitableSlots?: string[];
};

export function createUseRandomRecipe({ useTRPC }: CreateRecipeHooksOptions) {
  return function useRandomRecipe() {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const getRandomRecipe = useCallback(
      async (filters: RandomRecipeFilters = {}): Promise<RandomRecipeResult> => {
        return queryClient.fetchQuery({
          ...trpc.recipes.getRandomRecipe.queryOptions(filters),
          staleTime: 0,
          gcTime: 0,
        });
      },
      [queryClient, trpc.recipes.getRandomRecipe]
    );

    return { getRandomRecipe };
  };
}
