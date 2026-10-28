"use client";

import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@norish/trpc/client";

type PrepOutputs = inferRouterOutputs<AppRouter>["prep"];
type PrepInputs = inferRouterInputs<AppRouter>["prep"];

export type PrepRangeResult = PrepOutputs["getRange"];
export type PrepSessionResult = PrepRangeResult["sessions"][number];
export type PrepSessionItemResult = PrepSessionResult["items"][number];
export type PrepRangeInput = PrepInputs["getRange"];
export type PrepAddRecipeInput = PrepInputs["addRecipe"];
export type PrepUpdateItemInput = PrepInputs["updateItem"];
