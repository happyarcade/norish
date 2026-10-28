"use client";

import type { QueryKey } from "@tanstack/react-query";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { PrepRangeInput, PrepRangeResult } from "./types";

import { useTRPC } from "@/app/providers/trpc-provider";

export type PrepRangeQueryResult = {
  data: PrepRangeResult | undefined;
  isLoading: boolean;
  error: unknown;
  queryKey: QueryKey;
  invalidate: () => void;
};

type PrepRangeQueryOptions = {
  enabled?: boolean;
};

export function usePrepRangeQuery(
  input: PrepRangeInput,
  options: PrepRangeQueryOptions = {}
): PrepRangeQueryResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.prep.getRange.queryKey(input);
  const { data, isLoading, error } = useQuery(
    trpc.prep.getRange.queryOptions(input, {
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
