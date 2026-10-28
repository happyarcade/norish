"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { usePantryMutations, usePantryQuery } from "@/hooks/pantry";
import {
  ArrowTrendingDownIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ShoppingCartIcon,
  StarIcon,
  XMarkIcon,
} from "@heroicons/react/16/solid";
import { FieldError, Input, TextField } from "@heroui-v3/react";
import { useLocale, useTranslations } from "next-intl";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import { PANTRY_INGREDIENT_NAME_MAX_LENGTH } from "@norish/shared/contracts/zod";
import { normalizeGroceryName } from "@norish/shared/lib/normalized-name";
import {
  isPantryIngredientStale,
  pantryIngredientFor,
  sortPantryIngredients,
} from "@norish/shared/lib/pantry";

type PantryContentProps = {
  groceryNames?: readonly string[];
  open: boolean;
  onAddToGroceries?: (item: PantryIngredientDto) => Promise<void>;
  variant?: "page" | "panel";
};

type PantryGroups = {
  low: PantryIngredientDto[];
  check: PantryIngredientDto[];
  staples: PantryIngredientDto[];
  onHand: PantryIngredientDto[];
};

export function groupPantryItems(
  items: readonly PantryIngredientDto[],
  locale: string,
  query = "",
  now = new Date()
): PantryGroups {
  const normalizedQuery = normalizeGroceryName(query);
  const matchingItems = sortPantryIngredients(items, locale).filter(
    (item) => !normalizedQuery || item.normalizedName.includes(normalizedQuery)
  );

  return {
    low: matchingItems.filter((item) => item.status === "low"),
    check: matchingItems.filter((item) => isPantryIngredientStale(item, now)),
    staples: matchingItems.filter(
      (item) => item.status === "on_hand" && item.isStaple && !isPantryIngredientStale(item, now)
    ),
    onHand: matchingItems.filter(
      (item) => item.status === "on_hand" && !item.isStaple && !isPantryIngredientStale(item, now)
    ),
  };
}

export function isPantryIngredientQueued(
  item: Pick<PantryIngredientDto, "normalizedName">,
  groceryNames: readonly string[]
) {
  return groceryNames.some((name) => normalizeGroceryName(name) === item.normalizedName);
}

export function PantryContent({
  groceryNames = [],
  open,
  onAddToGroceries,
  variant = "panel",
}: PantryContentProps) {
  const t = useTranslations("groceries.pantry");
  const tGroceries = useTranslations("groceries");
  const locale = useLocale();
  const { items, isLoading } = usePantryQuery();
  const { addPantryIngredient, updatePantryIngredient, removePantryIngredient, isAdding } =
    usePantryMutations();
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [addFailed, setAddFailed] = useState(false);
  const [inventoryFailed, setInventoryFailed] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [groceryPendingId, setGroceryPendingId] = useState<string | null>(null);
  const [groceryFailedId, setGroceryFailedId] = useState<string | null>(null);
  const [groceryAddedIds, setGroceryAddedIds] = useState<Set<string>>(() => new Set());
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setDraft("");
      setSearch("");
      setAddFailed(false);
      setInventoryFailed(false);
      setGroceryFailedId(null);
      setGroceryAddedIds(new Set());
    }
  }, [open]);

  const normalizedDraft = normalizeGroceryName(draft);
  const isDuplicate = normalizedDraft !== "" && pantryIngredientFor(items, draft) !== null;
  const groups = groupPantryItems(items, locale, search);
  const onHandCount = items.filter((item) => item.status === "on_hand").length;
  const lowCount = items.length - onHandCount;
  const staleCount = items.filter((item) => isPantryIngredientStale(item)).length;
  const matchingCount = Object.values(groups).reduce((count, group) => count + group.length, 0);

  const update = async (
    id: string,
    changes: { status?: "on_hand" | "low"; isStaple?: boolean; confirm?: boolean }
  ) => {
    if (pendingId) return;

    setPendingId(id);
    setInventoryFailed(false);

    try {
      await updatePantryIngredient(id, changes);
    } catch {
      setInventoryFailed(true);
    } finally {
      setPendingId(null);
    }
  };

  const add = async () => {
    if (!normalizedDraft || isDuplicate || isAdding) return;

    setAddFailed(false);

    try {
      await addPantryIngredient(draft.trim());
      setDraft("");
      field.current?.focus();
    } catch {
      setAddFailed(true);
    }
  };

  const remove = async (id: string) => {
    if (pendingId) return;

    setPendingId(id);
    setInventoryFailed(false);

    try {
      await removePantryIngredient(id);
    } catch {
      setInventoryFailed(true);
    } finally {
      setPendingId(null);
    }
  };

  const addToGroceries = async (item: PantryIngredientDto) => {
    if (!onAddToGroceries || groceryPendingId) return;

    setGroceryPendingId(item.id);
    setGroceryFailedId(null);

    try {
      await onAddToGroceries(item);
      setGroceryAddedIds((current) => new Set(current).add(item.id));
    } catch {
      setGroceryFailedId(item.id);
    } finally {
      setGroceryPendingId(null);
    }
  };

  const addControls = (
    <div className="flex min-w-0 items-start gap-2">
      <TextField
        aria-label={t("add")}
        className="min-w-0 flex-1"
        isInvalid={isDuplicate || addFailed}
        value={draft}
        onChange={(value) => {
          setDraft(value);
          setAddFailed(false);
        }}
      >
        <Input
          ref={field}
          className="min-h-10 text-base"
          maxLength={PANTRY_INGREDIENT_NAME_MAX_LENGTH}
          placeholder={t("namePlaceholder")}
          variant="secondary"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void add();
            }
          }}
        />
        {(isDuplicate || addFailed) && (
          <FieldError>{isDuplicate ? t("duplicate") : t("failed")}</FieldError>
        )}
      </TextField>
      <Button
        isIconOnly
        aria-label={t("add")}
        className="mt-0.5 h-10 w-10 min-w-10 shrink-0 touch-manipulation"
        isDisabled={!normalizedDraft || isDuplicate}
        isPending={isAdding}
        size="sm"
        variant={variant === "page" ? "primary" : "tertiary"}
        onPress={() => void add()}
      >
        <PlusIcon className="h-4 w-4" />
      </Button>
    </div>
  );

  const inventory = (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {isLoading ? (
        <div aria-live="polite" className="text-muted py-8 text-center text-sm" role="status">
          {t("loading")}
        </div>
      ) : items.length === 0 ? (
        <div className="text-muted py-8 text-center text-sm">{t("empty")}</div>
      ) : matchingCount === 0 ? (
        <div className="text-muted py-8 text-center text-sm">{t("noMatches")}</div>
      ) : (
        <div className="flex flex-col gap-4">
          <div
            aria-live="polite"
            className="bg-default-100/70 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-3 py-2 text-xs"
          >
            <span className="text-default-600">{t("onHandCount", { count: onHandCount })}</span>
            <span className="text-warning-700">{t("lowCount", { count: lowCount })}</span>
            {staleCount > 0 ? (
              <span className="text-default-500">{t("checkCount", { count: staleCount })}</span>
            ) : null}
          </div>

          {inventoryFailed ? (
            <p className="text-danger text-sm" role="alert">
              {t("failed")}
            </p>
          ) : null}

          <div className={variant === "page" ? "grid gap-5 lg:grid-cols-2" : "space-y-4"}>
            {groups.low.length > 0 ? (
              <PantryGroup
                id="low"
                items={groups.low}
                label={t("low")}
                groceryAddedIds={groceryAddedIds}
                groceryFailedId={groceryFailedId}
                groceryNames={groceryNames}
                groceryPendingId={groceryPendingId}
                pendingId={pendingId}
                onAddToGroceries={onAddToGroceries ? addToGroceries : undefined}
                onRemove={remove}
                onUpdate={update}
              />
            ) : null}

            {groups.check.length > 0 ? (
              <PantryGroup
                id="check"
                items={groups.check}
                label={t("checkStockGroup")}
                pendingId={pendingId}
                onRemove={remove}
                onUpdate={update}
              />
            ) : null}

            {groups.staples.length > 0 ? (
              <PantryGroup
                id="staples"
                items={groups.staples}
                label={t("staples")}
                pendingId={pendingId}
                onRemove={remove}
                onUpdate={update}
              />
            ) : null}

            {groups.onHand.length > 0 ? (
              <PantryGroup
                id="on-hand"
                items={groups.onHand}
                label={t("onHand")}
                pendingId={pendingId}
                onRemove={remove}
                onUpdate={update}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {variant === "page" ? (
        <div className="grid shrink-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
          <TextField
            aria-label={t("search")}
            className="relative"
            value={search}
            onChange={setSearch}
          >
            <MagnifyingGlassIcon className="text-default-400 pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2" />
            <Input
              className="min-h-10 pl-9 text-base"
              placeholder={t("searchPlaceholder")}
              variant="secondary"
            />
          </TextField>
          {addControls}
        </div>
      ) : null}

      {inventory}

      {variant === "panel" ? (
        <div className="border-default-200/60 shrink-0 border-t pt-4">{addControls}</div>
      ) : null}
    </div>
  );
}

type PantryGroupProps = {
  id: string;
  items: PantryIngredientDto[];
  label: string;
  groceryAddedIds?: ReadonlySet<string>;
  groceryFailedId?: string | null;
  groceryNames?: readonly string[];
  groceryPendingId?: string | null;
  pendingId: string | null;
  onAddToGroceries?: (item: PantryIngredientDto) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onUpdate: (
    id: string,
    changes: { status?: "on_hand" | "low"; isStaple?: boolean; confirm?: boolean }
  ) => Promise<void>;
};

function PantryGroup({
  id,
  items,
  label,
  groceryAddedIds = new Set(),
  groceryFailedId,
  groceryNames = [],
  groceryPendingId,
  pendingId,
  onAddToGroceries,
  onRemove,
  onUpdate,
}: PantryGroupProps) {
  const t = useTranslations("groceries.pantry");
  const tGroceries = useTranslations("groceries");
  const headingId = `pantry-${id}-heading`;

  return (
    <section aria-labelledby={headingId}>
      <h3
        className="text-default-500 mb-2 text-xs font-semibold tracking-wide uppercase"
        id={headingId}
      >
        {label}
      </h3>
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const isStale = isPantryIngredientStale(item);
          const isPending = pendingId === item.id;
          const nextStatus = item.status === "on_hand" ? "low" : "on_hand";
          const isQueued =
            groceryAddedIds.has(item.id) || isPantryIngredientQueued(item, groceryNames);

          return (
            <li
              key={item.id}
              className="bg-surface border-default-200/60 flex min-h-12 items-center gap-2 rounded-lg border px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium">{item.name}</span>
                  {item.isStaple ? (
                    <span className="bg-primary/10 text-primary shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium">
                      {t("staple")}
                    </span>
                  ) : null}
                </div>
                {isStale ? (
                  <button
                    className="text-warning-700 mt-0.5 inline-flex min-h-9 touch-manipulation items-center py-1 text-left text-xs hover:underline disabled:opacity-50"
                    disabled={isPending}
                    type="button"
                    onClick={() => void onUpdate(item.id, { confirm: true })}
                  >
                    {t("checkStock")}
                  </button>
                ) : null}
                {groceryFailedId === item.id ? (
                  <p className="text-danger mt-0.5 text-xs" role="alert">
                    {t("addAnywayFailed")}
                  </p>
                ) : null}
              </div>

              {item.status === "low" && onAddToGroceries ? (
                <Tooltip
                  content={isQueued ? t("added") : tGroceries("addToGroceries")}
                  placement="top"
                >
                  <Button
                    isIconOnly
                    aria-label={`${tGroceries("addToGroceries")}: ${item.name}`}
                    className={`h-10 w-10 min-w-10 touch-manipulation sm:h-8 sm:w-8 sm:min-w-8 ${isQueued ? "text-success" : ""}`}
                    isDisabled={pendingId !== null || groceryPendingId !== null || isQueued}
                    isPending={groceryPendingId === item.id}
                    size="sm"
                    variant="tertiary"
                    onPress={() => void onAddToGroceries(item)}
                  >
                    {isQueued ? (
                      <CheckCircleIcon className="h-4 w-4" />
                    ) : (
                      <ShoppingCartIcon className="h-4 w-4" />
                    )}
                  </Button>
                </Tooltip>
              ) : null}
              <Tooltip
                content={nextStatus === "low" ? t("markLowShort") : t("markOnHandShort")}
                placement="top"
              >
                <Button
                  isIconOnly
                  aria-label={
                    nextStatus === "low"
                      ? t("markLow", { name: item.name })
                      : t("markOnHand", { name: item.name })
                  }
                  className="h-10 w-10 min-w-10 touch-manipulation sm:h-8 sm:w-8 sm:min-w-8"
                  isDisabled={pendingId !== null}
                  isPending={isPending}
                  size="sm"
                  variant="tertiary"
                  onPress={() => void onUpdate(item.id, { status: nextStatus, confirm: true })}
                >
                  {nextStatus === "low" ? (
                    <ArrowTrendingDownIcon className="h-4 w-4" />
                  ) : (
                    <CheckCircleIcon className="h-4 w-4" />
                  )}
                </Button>
              </Tooltip>
              <Tooltip
                content={item.isStaple ? t("removeStapleShort") : t("makeStapleShort")}
                placement="top"
              >
                <Button
                  isIconOnly
                  aria-label={
                    item.isStaple
                      ? t("removeStaple", { name: item.name })
                      : t("makeStaple", { name: item.name })
                  }
                  className={`h-10 w-10 min-w-10 touch-manipulation sm:h-8 sm:w-8 sm:min-w-8 ${item.isStaple ? "text-primary" : ""}`}
                  isDisabled={pendingId !== null}
                  size="sm"
                  variant="tertiary"
                  onPress={() =>
                    void onUpdate(item.id, { isStaple: !item.isStaple, confirm: true })
                  }
                >
                  <StarIcon className="h-4 w-4" />
                </Button>
              </Tooltip>
              <Tooltip content={t("removeShort")} placement="top">
                <Button
                  isIconOnly
                  aria-label={t("remove", { name: item.name })}
                  className="h-10 w-10 min-w-10 touch-manipulation sm:h-8 sm:w-8 sm:min-w-8"
                  isDisabled={pendingId !== null}
                  size="sm"
                  variant="tertiary"
                  onPress={() => void onRemove(item.id).catch(() => undefined)}
                >
                  <XMarkIcon className="h-4 w-4" />
                </Button>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
