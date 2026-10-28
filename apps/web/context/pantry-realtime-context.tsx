"use client";

import type { ReactNode } from "react";

import { usePantrySubscription } from "@/hooks/pantry";

export function PantryRealtimeProvider({ children }: { children: ReactNode }) {
  usePantrySubscription();

  return <>{children}</>;
}
