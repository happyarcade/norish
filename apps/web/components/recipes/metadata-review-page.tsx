"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, MagnifyingGlassIcon } from "@heroicons/react/16/solid";
import { Spinner } from "@heroui-v3/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  formatPlannerProfileValue,
  PLANNER_RECIPE_TYPE_OPTIONS,
  SUITABLE_SLOT_OPTIONS,
} from "./planner-profile-options";

import { useTRPC } from "@/app/providers/trpc-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { addToast } from "@/lib/ui/toast";


type DraftState = {
  recipeTypes: string[];
  suitableSlots: string[];
};

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

export default function MetadataReviewPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [showAllRecipes, setShowAllRecipes] = useState(false);
  const [search, setSearch] = useState("");

  const reviewQueryInput = useMemo(
    () => ({
      limit: 100,
      includeAll: showAllRecipes,
      search: search.trim() || undefined,
    }),
    [search, showAllRecipes]
  );

  const { data, isLoading, error } = useQuery(
    trpc.recipes.listMetadataReview.queryOptions(reviewQueryInput, {
      staleTime: 10_000,
    })
  );

  useEffect(() => {
    if (!data) return;

    setDrafts((current) => {
      const next = { ...current };

      for (const item of data) {
        next[item.recipeId] = current[item.recipeId] ?? {
          recipeTypes: item.recipeTypes.length > 0 ? item.recipeTypes : item.inferredRecipeTypes,
          suitableSlots:
            item.suitableSlots.length > 0 ? item.suitableSlots : item.inferredSuitableSlots,
        };
      }

      return next;
    });
  }, [data]);

  const saveMutation = useMutation(
    trpc.recipes.saveMetadataReview.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: [trpc.recipes.listMetadataReview.queryKey(reviewQueryInput)[0]],
        });
        await queryClient.invalidateQueries({ queryKey: [trpc.recipes.list.queryKey({})[0]] });
      },
    })
  );

  const pendingIds = useMemo(() => new Set(data?.map((item) => item.recipeId) ?? []), [data]);

  const handleDraftChange = (recipeId: string, update: Partial<DraftState>) => {
    setDrafts((current) => ({
      ...current,
      [recipeId]: {
        ...(current[recipeId] ?? { recipeTypes: [], suitableSlots: [] }),
        ...update,
      },
    }));
  };

  const handleSave = async (recipeId: string) => {
    const draft = drafts[recipeId];

    if (!draft) return;

    await saveMutation.mutateAsync({
      recipeId,
      recipeTypes: draft.recipeTypes,
      suitableSlots: draft.suitableSlots,
    });

    addToast({
      title: "Metadata saved",
      description: "Recipe planner metadata has been updated.",
      radius: "full",
      severity: "success",
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
      <div className="w-fit">
        <Link
          className="text-default-500 flex items-center gap-1 text-base hover:underline"
          href="/"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to recipes
        </Link>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Review Recipe Metadata</h1>
          <p className="text-default-500">
            Bulk edit recipe types and suitable slots across your library.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button color="primary" radius="full" size="sm">
            Metadata
          </Button>
          <Button as={Link} href="/recipes/review/nutrition" radius="full" size="sm" variant="flat">
            Nutrition
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Button
            color={!showAllRecipes ? "primary" : "default"}
            radius="full"
            size="sm"
            variant={!showAllRecipes ? "solid" : "flat"}
            onPress={() => setShowAllRecipes(false)}
          >
            Needs review
          </Button>
          <Button
            color={showAllRecipes ? "primary" : "default"}
            radius="full"
            size="sm"
            variant={showAllRecipes ? "solid" : "flat"}
            onPress={() => setShowAllRecipes(true)}
          >
            All recipes
          </Button>
        </div>

        <Input
          className="max-w-md"
          placeholder="Search recipes..."
          radius="full"
          startContent={<MagnifyingGlassIcon className="text-default-400 h-4 w-4" />}
          value={search}
          onValueChange={setSearch}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 rounded-2xl border px-5 py-6">
          <Spinner size="sm" />
          <span className="text-default-500">Loading metadata editor...</span>
        </div>
      ) : error ? (
        <div className="border-danger-200 bg-danger-50 text-danger-700 rounded-2xl border px-5 py-4">
          Failed to load the review queue.
        </div>
      ) : !data || data.length === 0 ? (
        <Card className="bg-content1 rounded-2xl shadow-md">
          <Card.Content className="items-center gap-3 py-12 text-center">
            <div className="text-xl font-semibold">All recipe metadata looks good</div>
            <div className="text-default-500 max-w-xl">
              {showAllRecipes
                ? "No recipes matched the current filters."
                : "There are no recipes currently flagged for planner-profile review."}
            </div>
          </Card.Content>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.map((item) => {
            const draft = drafts[item.recipeId] ?? {
              recipeTypes:
                item.recipeTypes.length > 0 ? item.recipeTypes : item.inferredRecipeTypes,
              suitableSlots:
                item.suitableSlots.length > 0 ? item.suitableSlots : item.inferredSuitableSlots,
            };
            const isDirty =
              !arraysEqual(draft.recipeTypes, item.recipeTypes) ||
              !arraysEqual(draft.suitableSlots, item.suitableSlots);
            const saving =
              saveMutation.isPending && saveMutation.variables?.recipeId === item.recipeId;

            return (
              <Card key={item.recipeId} className="bg-content1 rounded-2xl shadow-md">
                <Card.Content className="gap-5 p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex gap-4">
                      {item.image ? (
                        <img
                          alt={item.name}
                          className="h-20 w-20 rounded-xl object-cover"
                          src={item.image}
                        />
                      ) : (
                        <div className="bg-default-100 text-default-500 flex h-20 w-20 items-center justify-center rounded-xl text-xs">
                          No image
                        </div>
                      )}
                      <div className="space-y-2">
                        <div>
                          <h2 className="text-lg font-semibold">{item.name}</h2>
                          {item.description ? (
                            <p className="text-default-500 line-clamp-2 text-sm">
                              {item.description}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(item.issues.length > 0 ? item.issues : ["planner metadata review"]).map(
                            (issue) => (
                              <Chip key={issue} color="warning" size="sm" variant="flat">
                                {issue}
                              </Chip>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        as={Link}
                        href={`/recipes/${item.recipeId}`}
                        radius="full"
                        size="sm"
                        variant="flat"
                      >
                        Open recipe
                      </Button>
                      <Button
                        color="primary"
                        isDisabled={!pendingIds.has(item.recipeId) || !isDirty}
                        isLoading={saving}
                        radius="full"
                        size="sm"
                        onPress={() => handleSave(item.recipeId)}
                      >
                        Save
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-medium">Recipe type</div>
                    <div className="flex flex-wrap gap-2">
                      {PLANNER_RECIPE_TYPE_OPTIONS.map((option) => {
                        const active = draft.recipeTypes.includes(option.key);

                        return (
                          <Chip
                            key={`${item.recipeId}-${option.key}`}
                            className="h-8 cursor-pointer px-3 text-sm"
                            color={active ? "primary" : "default"}
                            radius="full"
                            variant={active ? "solid" : "flat"}
                            onClick={() =>
                              handleDraftChange(item.recipeId, {
                                recipeTypes: toggleValue(draft.recipeTypes, option.key),
                              })
                            }
                          >
                            {option.label}
                          </Chip>
                        );
                      })}
                    </div>
                    {item.inferredRecipeTypes.length > 0 && (
                      <div className="text-default-500 flex flex-wrap items-center gap-2 text-sm">
                        <span>Suggested:</span>
                        {item.inferredRecipeTypes.map((value) => (
                          <Chip
                            key={`${item.recipeId}-suggested-type-${value}`}
                            size="sm"
                            variant="flat"
                          >
                            {formatPlannerProfileValue(value)}
                          </Chip>
                        ))}
                        <Button
                          radius="full"
                          size="sm"
                          variant="light"
                          onPress={() =>
                            handleDraftChange(item.recipeId, {
                              recipeTypes: item.inferredRecipeTypes,
                            })
                          }
                        >
                          Use suggested
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-medium">Suitable slots</div>
                    <div className="flex flex-wrap gap-2">
                      {SUITABLE_SLOT_OPTIONS.map((option) => {
                        const active = draft.suitableSlots.includes(option.key);

                        return (
                          <Chip
                            key={`${item.recipeId}-slot-${option.key}`}
                            className="h-8 cursor-pointer px-3 text-sm"
                            color={active ? "primary" : "default"}
                            radius="full"
                            variant={active ? "solid" : "flat"}
                            onClick={() =>
                              handleDraftChange(item.recipeId, {
                                suitableSlots: toggleValue(draft.suitableSlots, option.key),
                              })
                            }
                          >
                            {option.label}
                          </Chip>
                        );
                      })}
                    </div>
                    {item.inferredSuitableSlots.length > 0 && (
                      <div className="text-default-500 flex flex-wrap items-center gap-2 text-sm">
                        <span>Suggested:</span>
                        {item.inferredSuitableSlots.map((value) => (
                          <Chip
                            key={`${item.recipeId}-suggested-slot-${value}`}
                            size="sm"
                            variant="flat"
                          >
                            {formatPlannerProfileValue(value)}
                          </Chip>
                        ))}
                        <Button
                          radius="full"
                          size="sm"
                          variant="light"
                          onPress={() =>
                            handleDraftChange(item.recipeId, {
                              suitableSlots: item.inferredSuitableSlots,
                            })
                          }
                        >
                          Use suggested
                        </Button>
                      </div>
                    )}
                  </div>
                </Card.Content>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
