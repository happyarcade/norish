"use client";

import type { QueryKey } from "@tanstack/react-query";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ShoppingProjectionResponseSchema } from "@norish/shared/contracts/zod";

import { useTRPC } from "@/app/providers/trpc-provider";

export type ComputedShoppingProjectionResult = z.infer<typeof ShoppingProjectionResponseSchema>;

export type ComputedShoppingQueryResult = {
  data: ComputedShoppingProjectionResult | undefined;
  isLoading: boolean;
  error: unknown;
  queryKey: QueryKey;
  invalidate: () => void;
};

export function useComputedShoppingQuery(input: {
  dayCount: 7 | 14 | 28;
  windowStart?: string;
}): ComputedShoppingQueryResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.groceries.projection.queryKey(input);
  const { data, isLoading, error } = useQuery(
    trpc.groceries.projection.queryOptions(input, {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
    })
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    data,
    isLoading,
    error,
    queryKey,
    invalidate,
  };
}
