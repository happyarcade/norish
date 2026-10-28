"use client";

import type { QueryKey } from "@tanstack/react-query";
import type { PantryIngredientDto } from "@norish/shared/contracts";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";


export type PantryData = PantryIngredientDto[];

export function usePantryQuery() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey: QueryKey = trpc.pantry.list.queryKey();
  const { data, error, isLoading } = useQuery(trpc.pantry.list.queryOptions());

  const setItems = (updater: (previous: PantryData | undefined) => PantryData | undefined) => {
    queryClient.setQueryData<PantryData>(queryKey, updater);
  };

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey });
  };

  return { items: data ?? [], error, isLoading, queryKey, setItems, invalidate };
}
