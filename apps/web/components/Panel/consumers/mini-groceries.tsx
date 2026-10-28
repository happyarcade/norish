"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Panel from "@/components/Panel/Panel";
import { useIsDesktop } from "@/components/planner/use-is-desktop";
import { Button } from "@/components/ui/button";
import { useUnitsQuery } from "@/hooks/config";
import { useGroceriesMutations } from "@/hooks/groceries";
import { usePantryQuery } from "@/hooks/pantry";
import { useRecipeIngredients } from "@/hooks/recipes/use-recipe-ingredients";
import { MinusIcon, PlusIcon } from "@heroicons/react/16/solid";
import {
  Checkbox,
  InputGroup,
  Modal,
  Separator,
  TextField,
  toast,
  useOverlayState,
} from "@heroui-v3/react";
import { useTranslations } from "next-intl";

import { formatServings, useServingsScaler } from "@norish/shared-react/hooks";
import { pantryIngredientOnHandFor } from "@norish/shared/lib/pantry";

type MiniGroceriesProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
  initialServings?: number;
  originalServings?: number;
};

function getIngredientRowKey(
  item: {
    id?: string | null;
    ingredientId?: string | null;
  },
  index: number
) {
  return item.id ?? `${item.ingredientId ?? "ingredient"}-${index}`;
}

function MiniGroceriesContent({
  recipeId,
  onOpenChange,
  initialServings = 1,
  originalServings = 1,
}: {
  recipeId: string;
  onOpenChange: (open: boolean) => void;
  initialServings: number;
  originalServings: number;
}) {
  const t = useTranslations("groceries.panel");
  const { createGroceriesFromData } = useGroceriesMutations();

  const { ingredients: rawIngredients, isLoading } = useRecipeIngredients(recipeId);
  const { items: pantryItems, isLoading: pantryLoading } = usePantryQuery();
  const { units: _units } = useUnitsQuery();

  // Filter out headings and recipe links - memoized to prevent infinite loops
  const ingredients = useMemo(() => {
    return rawIngredients.filter((i) => {
      const name = i.ingredientName?.trim() ?? "";

      // Skip headings, recipe links, and empty names
      return (
        !name.startsWith("#") &&
        !name.includes("(id:") &&
        !name.includes("/recipe:") &&
        name &&
        i.ingredientId
      );
    });
  }, [rawIngredients]);

  const { servings, scaledIngredients, incrementServings, decrementServings } = useServingsScaler(
    ingredients,
    originalServings,
    initialServings
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const hasInitialized = useRef(false);

  const ingredientRows = useMemo(
    () =>
      scaledIngredients.map((item, index) => ({
        item,
        rowKey: getIngredientRowKey(item, index),
        inPantry: pantryIngredientOnHandFor(pantryItems, item.ingredientName) !== null,
      })),
    [pantryItems, scaledIngredients]
  );

  const groceryRows = ingredientRows.filter((row) => !row.inPantry);
  const pantryRows = ingredientRows.filter((row) => row.inPantry);

  // Update selected IDs only once when ingredients first load
  useEffect(() => {
    if (!isLoading && !pantryLoading && ingredientRows.length > 0 && !hasInitialized.current) {
      setSelectedIds(ingredientRows.filter((row) => !row.inPantry).map((row) => row.rowKey));
      hasInitialized.current = true;
    }
  }, [ingredientRows, isLoading, pantryLoading]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleEditStart = (id: string, item: (typeof scaledIngredients)[number]) => {
    setEditingId(id);
    const text = [item.amount, item.unit, item.ingredientName].filter(Boolean).join(" ");

    setEditValue(text);
  };

  const handleEditSubmit = () => {
    // For now, we don't support editing since it would require
    // maintaining separate edited state alongside scaled ingredients
    setEditingId(null);
  };

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleConfirm = () => {
    const selectedIngredients = scaledIngredients
      .filter((g, index) => selectedIds.includes(getIngredientRowKey(g, index)))
      .map((ri) => ({
        name: ri.ingredientName,
        amount: ri.amount ? parseFloat(String(ri.amount)) : null,
        unit: ri.unit ?? null,
        isDone: false,
        recipeIngredientId: ri.id,
      }));

    createGroceriesFromData(selectedIngredients)
      .then(() => {
        close();
        toast.success(t("ingredientsAdded"));
      })
      .catch(() => {
        toast.warning(t("ingredientsFailed"));
      });
  };

  if (isLoading || pantryLoading) {
    return <div className="text-default-500 p-4 text-base">{t("loadingIngredients")}</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Servings Control */}
      <div className="mb-3 flex items-center justify-between px-2">
        <span className="text-default-700 text-sm font-medium">{t("servings")}</span>
        <div className="inline-flex items-center gap-2">
          <Button
            isIconOnly
            aria-label="Decrease servings"
            className="bg-content2"
            size="sm"
            variant="tertiary"
            onPress={decrementServings}
          >
            <MinusIcon className="h-4 w-4" />
          </Button>
          <span className="min-w-8 text-center text-sm font-semibold">
            {formatServings(servings)}
          </span>
          <Button
            isIconOnly
            aria-label="Increase servings"
            className="bg-content2"
            size="sm"
            variant="tertiary"
            onPress={incrementServings}
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Separator className="bg-default-200/40 mb-2" />

      {scaledIngredients.length === 0 ? (
        <div className="text-default-500 flex flex-1 items-center justify-center text-base">
          {t("noIngredients")}
        </div>
      ) : (
        <div className="flex flex-col overflow-y-auto">
          <div className="divide-default-200/40 flex flex-col divide-y">
            {groceryRows.map(({ item, rowKey }) => {
              const isEditing = editingId === rowKey;

              return (
                <div
                  key={rowKey}
                  className="flex cursor-pointer items-start px-2 py-2"
                  role="button"
                  tabIndex={0}
                  onClick={() => !isEditing && handleEditStart(rowKey, item)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !isEditing) {
                      e.preventDefault();
                      handleEditStart(rowKey, item);
                    }
                  }}
                >
                  <Checkbox
                    aria-label={`Add ${item.ingredientName}`}
                    className="mt-[-4px]"
                    isSelected={selectedIds.includes(rowKey)}
                    onChange={() => toggleSelect(rowKey)}
                  >
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Content>
                  </Checkbox>
                  <div className="ml-2 flex min-w-0 flex-1 flex-col">
                    {isEditing ? (
                      <TextField fullWidth value={editValue} onChange={setEditValue}>
                        <InputGroup fullWidth variant="secondary">
                          <InputGroup.Input
                            className="text-base"
                            onBlur={handleEditSubmit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleEditSubmit();
                              if (e.key === "Escape") setEditingId(null);
                            }}
                          />
                        </InputGroup>
                      </TextField>
                    ) : (
                      <>
                        <span className="truncate text-base font-semibold">
                          {item.ingredientName}
                        </span>
                        {item.amount && (
                          <span className="text-primary mt-[-3px] text-xs font-medium">
                            {item.amount} {item.unit ?? ""}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {pantryRows.length > 0 && (
            <div className="mt-4">
              <div className="text-default-400 mb-1 px-2 text-[11px] font-semibold tracking-[0.18em] uppercase">
                {t("inYourPantry")}
              </div>
              <div className="divide-default-200/40 bg-default-100/50 flex flex-col divide-y rounded-lg">
                {pantryRows.map(({ item, rowKey }) => {
                  const isEditing = editingId === rowKey;

                  return (
                    <div
                      key={rowKey}
                      className="flex cursor-pointer items-start px-2 py-2"
                      role="button"
                      tabIndex={0}
                      onClick={() => !isEditing && handleEditStart(rowKey, item)}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && !isEditing) {
                          e.preventDefault();
                          handleEditStart(rowKey, item);
                        }
                      }}
                    >
                      <Checkbox
                        aria-label={`Add ${item.ingredientName}`}
                        className="mt-[-4px]"
                        isSelected={selectedIds.includes(rowKey)}
                        onChange={() => toggleSelect(rowKey)}
                      >
                        <Checkbox.Content>
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                        </Checkbox.Content>
                      </Checkbox>
                      <div className="ml-2 flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-base font-semibold">
                          {item.ingredientName}
                        </span>
                        {item.amount && (
                          <span className="text-default-500 mt-[-3px] text-xs font-medium">
                            {item.amount} {item.unit ?? ""}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {scaledIngredients.length > 0 && (
        <div className="mt-4">
          <Separator className="bg-default-200/40 my-2" />
          <Button fullWidth size="sm" variant="primary" onPress={handleConfirm}>
            {t("addSelectedToGroceries")}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function MiniGroceries({
  open,
  onOpenChange,
  recipeId,
  initialServings = 1,
  originalServings = 1,
}: MiniGroceriesProps) {
  const t = useTranslations("groceries.panel");
  const isDesktop = useIsDesktop();
  const modalState = useOverlayState({ isOpen: open, onOpenChange });
  const content = open ? (
    <MiniGroceriesContent
      initialServings={initialServings}
      originalServings={originalServings}
      recipeId={recipeId}
      onOpenChange={onOpenChange}
    />
  ) : null;

  if (isDesktop) {
    return (
      <Modal state={modalState}>
        <Modal.Backdrop variant="blur">
          <Modal.Container placement="center" scroll="inside" size="lg">
            <Modal.Dialog className="max-w-lg">
              <Modal.CloseTrigger aria-label="Close groceries" />
              <Modal.Header>
                <Modal.Heading>{t("addToGroceries")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="max-h-[72vh] overflow-y-auto pb-6">{content}</Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    );
  }

  return (
    <Panel open={open} title={t("addToGroceries")} onOpenChange={onOpenChange}>
      {content}
    </Panel>
  );
}
