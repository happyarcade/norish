"use client";

import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@norish/trpc/client";

type PlannerOutputs = inferRouterOutputs<AppRouter>["planner"];
type PlannerInputs = inferRouterInputs<AppRouter>["planner"];

export type PlannerRangeResult = PlannerOutputs["getRange"];
export type PlannerProfileResult = PlannerOutputs["getProfile"];
export type PlannerSuggestedWeekResult = PlannerOutputs["suggestWeek"];
export type PlannerSuggestedMeal = PlannerSuggestedWeekResult["suggestions"][number];
export type PlannerSlotDefinitionsResult = PlannerOutputs["listSlotDefinitions"];
export type PlannerDayResult = PlannerRangeResult["days"][number];
export type PlannerDaySlotResult = PlannerDayResult["slots"][number];
export type PlannerSlotItemResult = PlannerDaySlotResult["items"][number];

export type PlannerRangeInput = PlannerInputs["getRange"];
export type PlannerSuggestWeekInput = PlannerInputs["suggestWeek"];
export type PlannerPlanningMode = NonNullable<PlannerSuggestWeekInput["mode"]>;
export type PlannerSuggestionScope = NonNullable<PlannerSuggestWeekInput["scope"]>;
export type PlannerUpsertSlotInput = PlannerInputs["upsertSlot"];
export type PlannerSetSlotParticipantsInput = PlannerInputs["setSlotParticipants"];
export type PlannerReplaceSlotItemsInput = PlannerInputs["replaceSlotItems"];
export type PlannerUpdateSlotItemInput = PlannerInputs["updateSlotItem"];
export type PlannerSetSlotItemDairyFreeInput = PlannerInputs["setSlotItemDairyFree"];
export type PlannerClearSlotInput = PlannerInputs["clearSlot"];
export type PlannerRelocateSlotItemInput = PlannerInputs["moveSlotItem"];
