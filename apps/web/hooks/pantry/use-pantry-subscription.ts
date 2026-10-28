"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";

import { usePantryQuery } from "./use-pantry-query";

export function usePantrySubscription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { setItems } = usePantryQuery();
  const projectionQueryKey = trpc.groceries.projection.queryKey();

  useSubscription(
    trpc.pantry.onAdded.subscriptionOptions(undefined, {
      onData: ({ item }) => {
        setItems((previous) => {
          if (!previous) return [item];
          if (previous.some((candidate) => candidate.id === item.id)) return previous;

          return [...previous, item];
        });
        void queryClient.invalidateQueries({ queryKey: projectionQueryKey });
      },
    })
  );

  useSubscription(
    trpc.pantry.onUpdated.subscriptionOptions(undefined, {
      onData: ({ item }) => {
        setItems((previous) =>
          previous?.map((candidate) => (candidate.id === item.id ? item : candidate))
        );
        void queryClient.invalidateQueries({ queryKey: projectionQueryKey });
      },
    })
  );

  useSubscription(
    trpc.pantry.onRemoved.subscriptionOptions(undefined, {
      onData: ({ itemId }) => {
        setItems((previous) => previous?.filter((item) => item.id !== itemId));
        void queryClient.invalidateQueries({ queryKey: projectionQueryKey });
      },
    })
  );
}
