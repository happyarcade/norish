"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { addToast } from "@/lib/ui/toast";
import {
  ArrowLeftIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  ScaleIcon,
} from "@heroicons/react/16/solid";
import { Spinner } from "@heroui-v3/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const METRICS = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "sodium", label: "Sodium", unit: "mg" },
  { key: "cholesterol", label: "Cholesterol", unit: "mg" },
  { key: "saturatedFat", label: "Saturated fat", unit: "g" },
  { key: "fiber", label: "Fibre", unit: "g" },
] as const;

type NutritionValues = Record<(typeof METRICS)[number]["key"], number | null> & {
  transFat: number | null;
  sugar: number | null;
};

function formatValue(value: number | null, unit: string) {
  if (value == null) return "-";

  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${unit}`;
}

function confidenceColor(score: number) {
  if (score >= 0.75) return "success" as const;
  if (score >= 0.45) return "warning" as const;

  return "danger" as const;
}

function NutritionGrid({ label, values }: { label: string; values: NutritionValues }) {
  return (
    <div className="space-y-2">
      <div className="text-default-500 text-xs font-medium tracking-[0.12em] uppercase">
        {label}
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
        {METRICS.map((metric) => (
          <div key={metric.key} className="min-w-0">
            <div className="text-default-400 truncate text-xs">{metric.label}</div>
            <div className="text-sm font-semibold">
              {formatValue(values[metric.key], metric.unit)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type NutritionReviewPageProps = {
  initialSearch?: string;
};

export default function NutritionReviewPage({ initialSearch = "" }: NutritionReviewPageProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(initialSearch);
  const [includeMissing, setIncludeMissing] = useState(false);
  const [includeReviewed, setIncludeReviewed] = useState(false);
  const queryInput = useMemo(
    () => ({
      limit: 100,
      includeMissing,
      includeReviewed,
      search: search.trim() || undefined,
    }),
    [includeMissing, includeReviewed, search]
  );
  const { data, error, isLoading } = useQuery(
    trpc.recipes.listNutritionReview.queryOptions(queryInput, { staleTime: 10_000 })
  );
  const saveMutation = useMutation(
    trpc.recipes.saveNutritionReview.mutationOptions({
      onSuccess: async (_, variables) => {
        await queryClient.invalidateQueries({
          queryKey: [trpc.recipes.listNutritionReview.queryKey(queryInput)[0]],
        });
        await queryClient.invalidateQueries({ queryKey: [trpc.recipes.list.queryKey({})[0]] });

        addToast({
          title:
            variables.action === "divideByServings" ? "Nutrition corrected" : "Nutrition confirmed",
          description:
            variables.action === "divideByServings"
              ? "Whole-recipe values were converted to one serving."
              : "This nutrition record will remain trusted until its values change.",
          radius: "full",
          severity: "success",
        });
      },
    })
  );

  const handleSave = async (
    recipeId: string,
    action: "confirm" | "divideByServings",
    servings: number
  ) => {
    if (
      action === "divideByServings" &&
      !window.confirm(
        `Divide every stored nutrition value by ${servings} and save the result as per serving?`
      )
    ) {
      return;
    }

    await saveMutation.mutateAsync({ recipeId, action });
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
      <Link
        className="text-default-500 flex w-fit items-center gap-1 text-base hover:underline"
        href="/"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to recipes
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Review Recipe Nutrition</h1>
          <p className="text-default-500 max-w-2xl">
            Check unusual per-serving values and correct imports that contain whole-recipe totals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button as={Link} href="/recipes/review" radius="full" size="sm" variant="flat">
            Metadata
          </Button>
          <Button color="primary" radius="full" size="sm">
            Nutrition
          </Button>
        </div>
      </div>

      {data ? (
        <div className="border-default-200 grid grid-cols-2 gap-4 border-y py-4 sm:grid-cols-5">
          {[
            ["Library", data.summary.total],
            ["Credible", data.summary.credible],
            ["Needs review", data.summary.needsReview],
            ["Missing", data.summary.missing],
            ["Confirmed", data.summary.reviewed],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-xl font-semibold">{value}</div>
              <div className="text-default-500 text-xs tracking-[0.1em] uppercase">{label}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            color={includeMissing ? "primary" : "default"}
            radius="full"
            size="sm"
            variant={includeMissing ? "solid" : "flat"}
            onPress={() => setIncludeMissing((value) => !value)}
          >
            Include missing
          </Button>
          <Button
            color={includeReviewed ? "primary" : "default"}
            radius="full"
            size="sm"
            variant={includeReviewed ? "solid" : "flat"}
            onPress={() => setIncludeReviewed((value) => !value)}
          >
            Include confirmed
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
        <div className="flex items-center gap-3 border-y px-1 py-8">
          <Spinner size="sm" />
          <span className="text-default-500">Auditing recipe nutrition...</span>
        </div>
      ) : error ? (
        <div className="border-danger-200 bg-danger-50 text-danger-700 border-y px-1 py-5">
          Failed to load the nutrition review queue.
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="border-default-200 space-y-1 border-y py-12 text-center">
          <div className="text-lg font-semibold">No nutrition records need attention</div>
          <div className="text-default-500 text-sm">
            Try including missing or previously confirmed records.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {data.items.map((item) => {
            const saving =
              saveMutation.isPending && saveMutation.variables?.recipeId === item.recipeId;

            return (
              <Card key={item.recipeId} className="bg-content1 shadow-sm">
                <Card.Content className="gap-5 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 gap-4">
                      {item.image ? (
                        <img
                          alt={item.name}
                          className="h-20 w-20 shrink-0 rounded-lg object-cover"
                          src={item.image}
                        />
                      ) : (
                        <div className="bg-default-100 text-default-500 flex h-20 w-20 shrink-0 items-center justify-center rounded-lg text-xs">
                          No image
                        </div>
                      )}
                      <div className="min-w-0 space-y-2">
                        <div>
                          <h2 className="text-lg font-semibold">{item.name}</h2>
                          <div className="text-default-500 text-sm">{item.servings} servings</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Chip
                            color={confidenceColor(item.audit.confidenceScore)}
                            size="sm"
                            variant="flat"
                          >
                            {Math.round(item.audit.confidenceScore * 100)}% confidence
                          </Chip>
                          {item.reviewed ? (
                            <Chip color="success" size="sm" variant="flat">
                              Confirmed
                            </Chip>
                          ) : null}
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
                        as={Link}
                        href={`/recipes/edit/${item.recipeId}`}
                        radius="full"
                        size="sm"
                        variant="flat"
                      >
                        Edit values
                      </Button>
                      <Button
                        isLoading={saving && saveMutation.variables?.action === "confirm"}
                        radius="full"
                        size="sm"
                        startContent={<CheckIcon className="h-4 w-4" />}
                        variant="flat"
                        onPress={() => handleSave(item.recipeId, "confirm", item.servings)}
                      >
                        Confirm per serving
                      </Button>
                      {item.audit.suggestedAction === "divideByServings" ? (
                        <Button
                          color="primary"
                          isLoading={
                            saving && saveMutation.variables?.action === "divideByServings"
                          }
                          radius="full"
                          size="sm"
                          startContent={<ScaleIcon className="h-4 w-4" />}
                          onPress={() =>
                            handleSave(item.recipeId, "divideByServings", item.servings)
                          }
                        >
                          Divide by {item.servings}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {item.audit.issues.map((issue) => (
                      <Chip
                        key={`${item.recipeId}-${issue.code}-${issue.metric ?? "general"}`}
                        color={issue.severity === "critical" ? "danger" : "warning"}
                        size="sm"
                        variant="flat"
                      >
                        {issue.message}
                      </Chip>
                    ))}
                  </div>

                  <div
                    className={
                      item.suggestedNutrition
                        ? "grid gap-5 border-t pt-4 md:grid-cols-2"
                        : "border-t pt-4"
                    }
                  >
                    <NutritionGrid label="Stored per serving" values={item.nutrition} />
                    {item.suggestedNutrition ? (
                      <NutritionGrid
                        label="Suggested per serving"
                        values={item.suggestedNutrition}
                      />
                    ) : null}
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
