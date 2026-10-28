"use client";

import type { RecipeDashboardViewMode } from "@/hooks/use-recipe-dashboard-view-mode";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useRecipeDashboardViewMode } from "@/hooks/use-recipe-dashboard-view-mode";
import { ListBulletIcon, Squares2X2Icon } from "@heroicons/react/20/solid";
import { ButtonGroup } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

const viewModes: RecipeDashboardViewMode[] = ["grid", "list"];

const viewModeIcons = {
  grid: Squares2X2Icon,
  list: ListBulletIcon,
};

export default function RecipeViewModeToggle() {
  const t = useTranslations("recipes.dashboard.viewMode");
  const [viewMode, setViewMode] = useRecipeDashboardViewMode();

  return (
    <ButtonGroup aria-label={t("label")} className="shrink-0" size="sm">
      {viewModes.map((mode) => {
        const Icon = viewModeIcons[mode];
        const label = t(mode);
        const selected = viewMode === mode;

        return (
          <Tooltip key={mode} content={label} placement="bottom">
            <Button
              isIconOnly
              aria-label={label}
              aria-pressed={selected}
              className="min-w-8 px-2 sm:min-w-10"
              color={selected ? "primary" : "default"}
              title={label}
              variant={selected ? "solid" : "flat"}
              onPress={() => setViewMode(mode)}
            >
              <Icon className="h-4 w-4" />
            </Button>
          </Tooltip>
        );
      })}
    </ButtonGroup>
  );
}
