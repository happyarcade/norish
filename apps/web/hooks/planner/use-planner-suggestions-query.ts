"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { PlannerSuggestWeekInput } from "./types";

type PlannerSuggestionsQueryOptions = {
  enabled?: boolean;
};

export function usePlannerSuggestionsQuery(
  input: PlannerSuggestWeekInput,
  options: PlannerSuggestionsQueryOptions = {}
) {
  const trpc = useTRPC();

  return useQuery(
    trpc.planner.suggestWeek.queryOptions(input, {
      enabled: options.enabled ?? true,
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false,
    })
  );
}

export function usePlannerSuggestionsFetcher() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return (input: PlannerSuggestWeekInput) =>
    queryClient.fetchQuery(
      trpc.planner.suggestWeek.queryOptions(input, {
        staleTime: 0,
      })
    );
}
