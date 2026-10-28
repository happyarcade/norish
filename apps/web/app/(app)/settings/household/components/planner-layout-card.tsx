"use client";

import { useMemo } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import { Separator, Spinner, Switch } from "@heroui-v3/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useHouseholdSettingsContext } from "../context";

const SLOT_ORDER = [
  "mid-am",
  "afternoon",
  "evening",
  "snack",
  "pre-workout",
  "post-workout",
] as const;

const FLEX_KEYS = new Set(["mid-am", "afternoon", "evening"]);
const WORKOUT_KEYS = new Set(["pre-workout", "post-workout"]);

function formatTargetMetric(value: number | null | undefined, suffix: string) {
  if (value == null || Number.isNaN(value)) return null;

  return `${Math.round(value)}${suffix}`;
}

export default function PlannerLayoutCard() {
  const { household } = useHouseholdSettingsContext();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    ...trpc.planner.getProfile.queryOptions(),
    enabled: Boolean(household),
  });
  const slotDefinitionsQuery = useQuery({
    ...trpc.planner.listSlotDefinitions.queryOptions({ enabledOnly: false }),
    enabled: Boolean(household),
  });

  const invalidatePlannerQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.planner.getProfile.queryKey() }),
      queryClient.invalidateQueries({
        queryKey: trpc.planner.listSlotDefinitions.queryKey({ enabledOnly: false }),
      }),
    ]);
  };

  const updateSlotDefinitionMutation = useMutation(
    trpc.planner.updateSlotDefinition.mutationOptions({
      onSuccess: invalidatePlannerQueries,
    })
  );
  const updateProfileMutation = useMutation(
    trpc.planner.updateProfile.mutationOptions({
      onSuccess: invalidatePlannerQueries,
    })
  );

  const orderedOptionalSlots = useMemo(() => {
    const definitions = slotDefinitionsQuery.data ?? [];

    return SLOT_ORDER.map((key) => definitions.find((definition) => definition.key === key)).filter(
      (definition): definition is NonNullable<(typeof definitions)[number]> => Boolean(definition)
    );
  }, [slotDefinitionsQuery.data]);

  const targetSummary = [
    profileQuery.data?.defaultCalorieTarget
      ? `${profileQuery.data.defaultCalorieTarget} kcal`
      : null,
    formatTargetMetric(profileQuery.data?.defaultProteinTarget ?? null, "P"),
    formatTargetMetric(profileQuery.data?.defaultCarbTarget ?? null, "C"),
    formatTargetMetric(profileQuery.data?.defaultFatTarget ?? null, "F"),
    formatTargetMetric(profileQuery.data?.defaultFibreTarget ?? null, " fibre"),
  ].filter((value): value is string => Boolean(value));

  if (!household) return null;

  const isLoading = profileQuery.isLoading || slotDefinitionsQuery.isLoading;
  const isSaving = updateSlotDefinitionMutation.isPending || updateProfileMutation.isPending;

  const handleToggle = async (slotId: string, nextEnabled: boolean) => {
    const slotDefinitions = slotDefinitionsQuery.data ?? [];
    const nextDefinitions = slotDefinitions.map((definition) =>
      definition.id === slotId ? { ...definition, isEnabled: nextEnabled } : definition
    );

    const enabledFlexCount = nextDefinitions.filter(
      (definition) => FLEX_KEYS.has(definition.key) && definition.isEnabled
    ).length;

    const snackEnabled = nextDefinitions.some(
      (definition) => definition.key === "snack" && definition.isEnabled
    );
    const preWorkoutEnabled = nextDefinitions.some(
      (definition) => definition.key === "pre-workout" && definition.isEnabled
    );
    const postWorkoutEnabled = nextDefinitions.some(
      (definition) => definition.key === "post-workout" && definition.isEnabled
    );

    await updateSlotDefinitionMutation.mutateAsync({
      id: slotId,
      data: {
        isEnabled: nextEnabled,
      },
    });

    await updateProfileMutation.mutateAsync({
      customMealCount: enabledFlexCount,
      snackCount: snackEnabled ? 1 : 0,
      preWorkoutEnabled,
      postWorkoutEnabled,
    });
  };

  return (
    <Card>
      <Card.Header className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
          <AdjustmentsHorizontalIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Planner layout</h2>
          <p className="text-default-500 mt-1 text-sm leading-relaxed">
            Main meals stay fixed. Use these toggles to reveal the optional slots you use most in
            the calendar.
          </p>
        </div>
      </Card.Header>
      <Card.Content className="gap-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <div className="text-default-400 text-[11px] tracking-[0.18em] uppercase">
                Main meals
              </div>
              <div className="flex flex-wrap gap-2">
                <Chip size="sm" variant="soft">
                  <Chip.Label>Breakfast</Chip.Label>
                </Chip>
                <Chip size="sm" variant="soft">
                  <Chip.Label>Lunch</Chip.Label>
                </Chip>
                <Chip size="sm" variant="soft">
                  <Chip.Label>Dinner</Chip.Label>
                </Chip>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-4">
              {orderedOptionalSlots.map((slot) => (
                <div key={slot.id} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-foreground font-medium">{slot.label}</div>
                    <div className="text-default-400 text-sm">
                      {FLEX_KEYS.has(slot.key)
                        ? "Optional extra meal slot"
                        : WORKOUT_KEYS.has(slot.key)
                          ? "Workout-specific meal slot"
                          : "Multi-snack section"}
                    </div>
                  </div>
                  <Switch
                    aria-label={`Toggle ${slot.label}`}
                    isDisabled={isSaving}
                    isSelected={slot.isEnabled}
                    size="sm"
                    onChange={(nextValue) => void handleToggle(slot.id, nextValue)}
                  >
                    <Switch.Content>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch.Content>
                  </Switch>
                </div>
              ))}
            </div>

            {targetSummary.length > 0 ? (
              <>
                <Separator />
                <div className="flex flex-col gap-2">
                  <div className="text-default-400 text-[11px] tracking-[0.18em] uppercase">
                    Current targets
                  </div>
                  <div className="text-default-500 flex flex-wrap gap-3 text-sm">
                    {targetSummary.map((metric) => (
                      <span key={metric}>{metric}</span>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </>
        )}
      </Card.Content>
    </Card>
  );
}
