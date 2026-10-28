"use client";

import { Button } from "@/components/ui/button";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";

import { RECIPE_FILTER_PRESETS } from "@norish/shared-react/contexts";

export default function QuickFilterRow() {
  const { filters, setFilters, isHydrated } = useRecipesFiltersContext();

  return (
    <nav aria-label="Quick recipe filters" className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="flex min-w-max items-center gap-2">
        {RECIPE_FILTER_PRESETS.map((preset) => {
          const active = preset.isActive(filters);

          return (
            <Button
              key={preset.id}
              aria-pressed={active}
              className="h-8 shrink-0 px-3 text-xs"
              color={active ? "primary" : "default"}
              isDisabled={!isHydrated}
              radius="full"
              size="sm"
              variant={active ? "solid" : "flat"}
              onPress={() => setFilters(preset.apply(filters))}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
