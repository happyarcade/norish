"use client";

import type { FullRecipeDTO, RecipeCategory } from "@norish/shared/contracts";

import {
  BeakerIcon,
  BoltIcon,
  CakeIcon,
  FireIcon,
  QueueListIcon,
  RectangleStackIcon,
  SparklesIcon,
  SunIcon,
  SwatchIcon,
  Squares2X2Icon,
  MoonIcon,
} from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

import { PLANNER_RECIPE_TYPE_OPTIONS, formatPlannerProfileValue } from "./planner-profile-options";

type RecipeTypeSummaryProps = {
  categories: RecipeCategory[];
  plannerProfile?: FullRecipeDTO["plannerProfile"] | null;
};

export function RecipeTypeSummary({ categories, plannerProfile }: RecipeTypeSummaryProps) {
  const tForm = useTranslations("recipes.form");
  const recipeTypeLabels = new Map(PLANNER_RECIPE_TYPE_OPTIONS.map((option) => [option.key, option.label]));
  const visibleRecipeTypes = (plannerProfile?.recipeTypes ?? []).filter((value) =>
    recipeTypeLabels.has(value)
  );

  if (visibleRecipeTypes.length > 0) {
    const iconByType: Record<string, typeof SunIcon> = {
      main: RectangleStackIcon,
      side: Squares2X2Icon,
      soup: BeakerIcon,
      salad: QueueListIcon,
      breakfast: SunIcon,
      snack: BoltIcon,
      dessert: CakeIcon,
      drink: BeakerIcon,
      condiment: SwatchIcon,
      sauce: SwatchIcon,
      starter: SparklesIcon,
      bake: FireIcon,
    };

    return (
      <div className="text-default-500 flex flex-wrap items-center gap-x-4 gap-y-2 text-base">
        {visibleRecipeTypes.map((value) => {
          const IconComponent = iconByType[value] ?? RectangleStackIcon;

          return (
            <span key={value} className="flex items-center gap-1">
              <IconComponent className="h-4 w-4" />
              {recipeTypeLabels.get(value) ?? formatPlannerProfileValue(value)}
            </span>
          );
        })}
      </div>
    );
  }

  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="text-default-500 flex flex-wrap items-center gap-x-4 gap-y-2 text-base">
      {categories.map((category) => {
        const IconComponent =
          {
            Breakfast: FireIcon,
            Lunch: SunIcon,
            Dinner: MoonIcon,
            Snack: CakeIcon,
          }[category] || SunIcon;

        return (
          <span key={category} className="flex items-center gap-1">
            <IconComponent className="h-4 w-4" />
            {tForm(`category.${category.toLowerCase()}`)}
          </span>
        );
      })}
    </div>
  );
}
