"use client";

import { useMemo, useState } from "react";
import { useRecipeContext } from "@/app/(app)/recipes/[id]/context";
import AIActionButton from "@/components/shared/ai-action-button";
import { Card } from "@/components/ui/card";
import { usePermissionsContext } from "@/context/permissions-context";
import {
  BeakerIcon,
  BoltIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  FireIcon,
  HeartIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/16/solid";
import { Separator, Skeleton } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

import NutritionPortionControl from "./nutrition-portion-control";

const MACROS = [
  {
    key: "calories",
    labelKey: "calories",
    unit: "kcal",
    icon: FireIcon,
    color: "text-orange-500",
    bg: "bg-orange-100 dark:bg-orange-900/30",
  },
  {
    key: "fat",
    labelKey: "fat",
    unit: "g",
    icon: BeakerIcon,
    color: "text-yellow-500",
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
  },
  {
    key: "carbs",
    labelKey: "carbs",
    unit: "g",
    icon: CubeIcon,
    color: "text-blue-500",
    bg: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    key: "protein",
    labelKey: "protein",
    unit: "g",
    icon: BoltIcon,
    color: "text-rose-500",
    bg: "bg-rose-100 dark:bg-rose-900/30",
  },
] as const;

type NutrientStyle = {
  icon: typeof FireIcon;
  color: string;
  bg: string;
};

const EXTENDED_NUTRIENT_STYLES: Array<{ pattern: RegExp; style: NutrientStyle }> = [
  {
    pattern: /fib(?:er|re)/i,
    style: { icon: BeakerIcon, color: "text-green-500", bg: "bg-green-100 dark:bg-green-900/30" },
  },
  {
    pattern: /sugar/i,
    style: { icon: CubeIcon, color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-900/30" },
  },
  {
    pattern: /sodium/i,
    style: {
      icon: BeakerIcon,
      color: "text-violet-500",
      bg: "bg-violet-100 dark:bg-violet-900/30",
    },
  },
  {
    pattern: /trans\s*fat/i,
    style: {
      icon: ExclamationTriangleIcon,
      color: "text-red-500",
      bg: "bg-red-100 dark:bg-red-900/30",
    },
  },
  {
    pattern: /unsaturated/i,
    style: { icon: HeartIcon, color: "text-teal-500", bg: "bg-teal-100 dark:bg-teal-900/30" },
  },
  {
    pattern: /saturated/i,
    style: {
      icon: ExclamationTriangleIcon,
      color: "text-red-400",
      bg: "bg-red-100 dark:bg-red-900/30",
    },
  },
  {
    pattern: /cholesterol/i,
    style: {
      icon: ShieldExclamationIcon,
      color: "text-slate-500",
      bg: "bg-slate-100 dark:bg-slate-900/30",
    },
  },
];

const DEFAULT_NUTRIENT_STYLE: NutrientStyle = {
  icon: BeakerIcon,
  color: "text-default-400",
  bg: "bg-default-100 dark:bg-default-800/30",
};

function matchNutrientStyle(key: string, label?: string | null): NutrientStyle {
  const text = `${key} ${label ?? ""}`.toLowerCase();

  return (
    EXTENDED_NUTRIENT_STYLES.find(({ pattern }) => pattern.test(text))?.style ??
    DEFAULT_NUTRIENT_STYLE
  );
}

function formatMetricValue(
  metric: { value?: number | null; unit?: string | null; raw?: string | null },
  portions: number
) {
  if (metric.value != null) {
    const scaledValue = metric.value * portions;
    const formattedValue = Number.isInteger(scaledValue)
      ? String(scaledValue)
      : scaledValue.toFixed(1).replace(/\.0$/, "");

    return metric.unit ? `${formattedValue} ${metric.unit}` : formattedValue;
  }

  return metric.raw ?? null;
}

function NutritionDisplay({ inCard = true }: { inCard?: boolean }) {
  const { recipe, isEstimatingNutrition, estimateNutrition } = useRecipeContext();
  const { isAIEnabled } = usePermissionsContext();
  const t = useTranslations("recipes.nutrition");
  // Independent portion state - defaults to 1 (per serving)
  const [portions, setPortions] = useState(1);

  const nutritionData = useMemo(() => {
    if (!recipe) return null;

    const parsedFat = typeof recipe.fat === "string" ? parseFloat(recipe.fat) : recipe.fat;
    const parsedCarbs = typeof recipe.carbs === "string" ? parseFloat(recipe.carbs) : recipe.carbs;
    const parsedProtein =
      typeof recipe.protein === "string" ? parseFloat(recipe.protein) : recipe.protein;

    const hasData =
      recipe.calories != null || parsedFat != null || parsedCarbs != null || parsedProtein != null;

    if (!hasData && !isAIEnabled) return null;

    return {
      hasData,
      values: {
        // Values are stored per-serving, multiply by portions to scale
        calories: recipe.calories != null ? recipe.calories * portions : null,
        fat: parsedFat != null ? parsedFat * portions : null,
        carbs: parsedCarbs != null ? parsedCarbs * portions : null,
        protein: parsedProtein != null ? parsedProtein * portions : null,
      },
      extras: Object.entries(recipe.nutritionDetails?.nutrients ?? {})
        .map(([key, metric]) => ({
          key,
          label: metric.label ?? key,
          value: formatMetricValue(metric, portions),
        }))
        .filter((metric) => metric.value != null),
      servingSize: recipe.nutritionDetails?.servingSize ?? null,
    };
  }, [recipe, portions, isAIEnabled]);

  if (!nutritionData) return null;

  const content = (
    <>
      <div className={`flex items-center justify-between ${inCard ? "mb-3" : ""}`}>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        {nutritionData.hasData && !isEstimatingNutrition && (
          <NutritionPortionControl portions={portions} onChange={setPortions} />
        )}
      </div>
      {isEstimatingNutrition ? (
        <div className="space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-16 rounded-md" />
              </div>
              <Skeleton className="h-4 w-12 rounded-md" />
            </div>
          ))}
        </div>
      ) : nutritionData.hasData ? (
        <>
          <div className="divide-default-100 divide-y">
            {MACROS.map(({ key, labelKey, unit, icon: Icon, color, bg }) => {
              const value = nutritionData.values[key];

              if (value == null) return null;

              return (
                <div key={key} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${bg}`}>
                      <Icon className={`h-4 w-4 ${color}`} />
                    </div>
                    <span className="text-base">{t(labelKey)}</span>
                  </div>
                  <span className="text-foreground text-base font-semibold">
                    {Math.round(value)}
                    <span className="text-default-500 ml-1 font-normal">{unit}</span>
                  </span>
                </div>
              );
            })}
          </div>
          {nutritionData.extras.length > 0 && (
            <>
              <div className="text-default-400 mt-4 mb-1 text-[11px] tracking-[0.18em] uppercase">
                Additional Nutrition
              </div>
              <div className="divide-default-100 divide-y">
                {nutritionData.extras.map((metric) => {
                  const style = matchNutrientStyle(metric.key, metric.label);
                  const Icon = style.icon;

                  return (
                    <div key={metric.key} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full ${style.bg}`}
                        >
                          <Icon className={`h-4 w-4 ${style.color}`} />
                        </div>
                        <span className="text-base">{metric.label}</span>
                      </div>
                      <span className="text-foreground text-base font-semibold">
                        {metric.value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {nutritionData.servingSize && (
            <p className="text-default-400 mt-3 text-center text-xs">
              Serving size: {nutritionData.servingSize}
            </p>
          )}
          {portions !== 1 && (
            <p className="text-default-400 mt-2 text-center text-xs">
              {t("showingPortions", { count: portions })}
            </p>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 py-2">
          <p className="text-default-500 text-base">{t("noInfo")}</p>
          {isAIEnabled && (
            <AIActionButton
              isLoading={isEstimatingNutrition}
              label={t("estimateWithAI")}
              onPress={estimateNutrition}
            />
          )}
        </div>
      )}
    </>
  );

  return inCard ? (
    <Card className="bg-content1 rounded-2xl shadow-md">
      <Card.Content className="p-5">{content}</Card.Content>
    </Card>
  ) : (
    <>
      <Separator />
      <div className="space-y-2">{content}</div>
    </>
  );
}

export function NutritionSection() {
  return <NutritionDisplay inCard={false} />;
}

export default function NutritionCard() {
  return <NutritionDisplay inCard={true} />;
}
