"use client";

import type { QueryKey } from "@tanstack/react-query";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { PlannerRangeInput, PlannerRangeResult } from "./types";

import { useTRPC } from "@/app/providers/trpc-provider";

export type PlannerRangeQueryResult = {
  data: PlannerRangeResult | undefined;
  isLoading: boolean;
  error: unknown;
  queryKey: QueryKey;
  invalidate: () => void;
};

type UsePlannerRangeQueryOptions = {
  enabled?: boolean;
};

export function usePlannerRangeQuery(
  input: PlannerRangeInput,
  options: UsePlannerRangeQueryOptions = {}
): PlannerRangeQueryResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const queryKey = trpc.planner.getRange.queryKey(input);
  const { data, isLoading, error } = useQuery(
    trpc.planner.getRange.queryOptions(input, {
      enabled: options.enabled ?? true,
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
