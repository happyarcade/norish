"use client";

import { useMemo, useState } from "react";
import { CheckIcon } from "@heroicons/react/20/solid";
import { formatAmount } from "@norish/shared/lib/format-amount";

import { useRecipeContextRequired } from "../context";

import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import { useAmountDisplayPreference } from "@/hooks/use-amount-display-preference";
import { useUnitFormatter } from "@/hooks/use-unit-formatter";

function normalizeIngredientMatch(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim().toLowerCase() ?? null;
}

function normalizeIngredientNameOnly(value: string | null | undefined) {
  if (!value) return null;

  return value
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildIngredientMatchCandidates(item: {
  ingredientName: string;
  rawLine?: string | null;
}) {
  return new Set(
    [
      normalizeIngredientMatch(item.rawLine),
      normalizeIngredientMatch(item.ingredientName),
      normalizeIngredientNameOnly(item.ingredientName),
    ].filter((value): value is string => Boolean(value))
  );
}

function buildGroupMatchCandidates(line: string) {
  return new Set(
    [
      normalizeIngredientMatch(line),
      normalizeIngredientNameOnly(line),
    ].filter((value): value is string => Boolean(value))
  );
}

type RenderItem =
  | {
      type: "heading";
      id: string;
      text: string;
    }
  | {
      type: "ingredient";
      id: string;
      item: {
        ingredientName: string;
        rawLine?: string | null;
        amount: number | null;
        order: number;
        systemUsed: string;
        unit: string | null;
      };
      checkIndex: number;
    };


export default function IngredientsList() {
  const { adjustedIngredients, recipe } = useRecipeContextRequired();
  const [checked, setChecked] = useState<Set<number>>(() => new Set());
  const { mode } = useAmountDisplayPreference();
  const { formatUnitOnly } = useUnitFormatter();

  // Use adjustedIngredients directly, fall back to recipe ingredients only if empty
  const display = adjustedIngredients?.length > 0 ? adjustedIngredients : recipe.recipeIngredients;
  const filteredDisplay = useMemo(
    () =>
      display
        .filter((it) => it.systemUsed === recipe.systemUsed)
        .sort((a, b) => a.order - b.order),
    [display, recipe.systemUsed]
  );

  const renderItems = useMemo<RenderItem[]>(() => {
    if (!recipe.ingredientGroups.length) {
      return filteredDisplay.map((item, idx) => ({
        type: "ingredient",
        id: `ingredient-${item.order}-${idx}`,
        item,
        checkIndex: idx,
      }));
    }

    const groupCandidates = recipe.ingredientGroups.map((group) => ({
      purpose: group.purpose?.trim() || null,
      ingredientSets: group.ingredients.map((line) => buildGroupMatchCandidates(line)),
    }));
    const shownHeadings = new Set<number>();

    return filteredDisplay.flatMap((item, idx) => {
      const candidates = buildIngredientMatchCandidates(item);
      const matchedGroupIndex = groupCandidates.findIndex((group) =>
        group.ingredientSets.some((ingredientSet) =>
          Array.from(ingredientSet).some((candidate) => candidates.has(candidate))
        )
      );
      const items: RenderItem[] = [];

      if (
        matchedGroupIndex >= 0 &&
        groupCandidates[matchedGroupIndex]?.purpose &&
        !shownHeadings.has(matchedGroupIndex)
      ) {
        shownHeadings.add(matchedGroupIndex);
        items.push({
          type: "heading",
          id: `heading-${matchedGroupIndex}`,
          text: groupCandidates[matchedGroupIndex]!.purpose!,
        });
      }

      items.push({
        type: "ingredient",
        id: `ingredient-${item.order}-${idx}`,
        item,
        checkIndex: idx,
      });

      return items;
    });
  }, [filteredDisplay, recipe.ingredientGroups]);

  const toggle = (idx: number) => {
    setChecked((prev) => {
      const next = new Set(prev);

      if (next.has(idx)) next.delete(idx);
      else next.add(idx);

      return next;
    });
  };

  const onKeyToggle = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(idx);
    }
  };

  return (
    <ul className="space-y-2">
      {renderItems.map((entry) => {
        if (entry.type === "heading") {
          return (
            <li key={entry.id} className="list-none">
              <div className="px-3 pt-3 pb-1">
                <h3 className="text-foreground/80 text-xs font-semibold tracking-[0.2em] uppercase">
                  {entry.text}
                </h3>
              </div>
            </li>
          );
        }

        const { item: it, checkIndex } = entry;
        const isHeading = it.ingredientName.trim().startsWith("#");

        if (isHeading) {
          const headingText = it.ingredientName.trim().replace(/^#+\s*/, "");

          return (
            <li key={entry.id} className="list-none">
              <div className="px-3 pt-3 pb-1">
                <h3 className="text-foreground/80 text-xs font-semibold tracking-[0.2em] uppercase">
                  {headingText}
                </h3>
              </div>
            </li>
          );
        }

        const amount = formatAmount(it.amount, mode);
        // Format unit with locale-aware display
        const unit = it.unit ? formatUnitOnly(it.unit, it.amount) : "";
        const isChecked = checked.has(checkIndex);

        return (
          <li key={entry.id}>
            <div
              aria-pressed={isChecked}
              className={`group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 select-none ${
                isChecked
                  ? "bg-default-100/50 dark:bg-default-100/5"
                  : "hover:bg-default-100 dark:hover:bg-default-100/10"
              }`}
              role="button"
              tabIndex={0}
              onClick={() => toggle(checkIndex)}
              onKeyDown={(e) => onKeyToggle(e, checkIndex)}
            >
              {/* Checkbox */}
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 ${
                  isChecked
                    ? "border-success bg-success"
                    : "border-default-300 group-hover:border-primary-400 dark:border-default-600"
                }`}
              >
                {isChecked && <CheckIcon className="h-3.5 w-3.5 text-white" />}
              </div>

              {/* Ingredient content */}
              <div
                className={`flex flex-1 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 transition-opacity duration-200 ${
                  isChecked ? "opacity-50" : ""
                }`}
              >
                {amount !== "" && (
                  <span
                    className={`text-base font-bold tabular-nums ${isChecked ? "text-default-500 line-through" : "text-foreground"}`}
                  >
                    {amount}
                  </span>
                )}
                {unit && (
                  <span
                    className={`text-base font-bold ${isChecked ? "text-default-400 line-through" : "text-primary-600 dark:text-primary-400"}`}
                  >
                    {unit}
                  </span>
                )}
                <span
                  className={`text-base ${isChecked ? "text-default-400 line-through" : "text-base"}`}
                >
                  <SmartMarkdownRenderer disableLinks={isChecked} text={it.ingredientName} />
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
