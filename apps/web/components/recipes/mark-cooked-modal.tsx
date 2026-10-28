"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePantryMutations, usePantryQuery } from "@/hooks/pantry";
import { useRecipeIngredients } from "@/hooks/recipes";
import { HomeIcon } from "@heroicons/react/16/solid";
import {
  ButtonGroup,
  Calendar,
  DatePicker,
  Label,
  Modal,
  Spinner,
  useOverlayState,
} from "@heroui-v3/react";
import { DateInputGroup } from "@heroui-v3/react/date-input-group";
import { parseDate } from "@internationalized/date";
import { useTranslations } from "next-intl";

import { dateKey } from "@norish/shared/lib/helpers";

import type { PantryUsageOutcome } from "./pantry-usage";
import { buildPantryReconciliation, buildPantryUsageCandidates } from "./pantry-usage";

type CookedDateValue = ReturnType<typeof parseDate>;

type MarkCookedModalProps = {
  defaultDate?: string | null;
  ingredientNames?: string[];
  isLoadingIngredients?: boolean;
  isOpen: boolean;
  isSaving?: boolean;
  recipeId?: string | null;
  recipeName?: string | null;
  onConfirm: (cookedAt: Date) => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
};

function fallbackDateKey() {
  return dateKey(new Date());
}

function dateValueToDate(value: CookedDateValue) {
  return new Date(`${value.toString()}T12:00:00`);
}

export function MarkCookedModal({
  defaultDate,
  ingredientNames,
  isLoadingIngredients,
  isOpen,
  isSaving = false,
  recipeId,
  recipeName,
  onConfirm,
  onOpenChange,
}: MarkCookedModalProps) {
  const t = useTranslations("groceries.pantryUsage");
  const [cookedDate, setCookedDate] = useState<CookedDateValue>(() =>
    parseDate(defaultDate ?? fallbackDateKey())
  );
  const [step, setStep] = useState<"date" | "pantry">("date");
  const [pantryOutcomes, setPantryOutcomes] = useState<Map<string, PantryUsageOutcome>>(
    () => new Map()
  );
  const [pantryError, setPantryError] = useState<string | null>(null);
  const { ingredients: fetchedIngredients, isLoading: isLoadingFetchedIngredients } =
    useRecipeIngredients(recipeId ?? null);
  const { items: pantryItems, isLoading: isLoadingPantry } = usePantryQuery();
  const { reconcilePantryIngredients, isReconciling } = usePantryMutations();
  const modalState = useOverlayState({ isOpen, onOpenChange });
  const effectiveIngredientNames = useMemo(
    () =>
      ingredientNames ??
      fetchedIngredients
        .map((ingredient) => ingredient.ingredientName?.trim() ?? "")
        .filter(Boolean),
    [fetchedIngredients, ingredientNames]
  );
  const pantryCandidates = useMemo(
    () => buildPantryUsageCandidates(effectiveIngredientNames, pantryItems),
    [effectiveIngredientNames, pantryItems]
  );
  const isLoadingPantryReview =
    isLoadingPantry || (isLoadingIngredients ?? isLoadingFetchedIngredients);

  useEffect(() => {
    if (!isOpen) return;

    setCookedDate(parseDate(defaultDate ?? fallbackDateKey()));
    setStep("date");
    setPantryOutcomes(new Map());
    setPantryError(null);
  }, [defaultDate, isOpen]);

  useEffect(() => {
    if (isOpen && step === "pantry" && !isLoadingPantryReview && pantryCandidates.length === 0) {
      onOpenChange(false);
    }
  }, [isLoadingPantryReview, isOpen, onOpenChange, pantryCandidates.length, step]);

  const handleMarkCooked = async () => {
    try {
      await onConfirm(dateValueToDate(cookedDate));

      if (isLoadingPantryReview || pantryCandidates.length > 0) {
        setStep("pantry");
      } else {
        onOpenChange(false);
      }
    } catch {
      // Caller owns the user-facing cooking-history error toast.
    }
  };

  const handlePantryOutcome = (id: string, outcome: PantryUsageOutcome) => {
    setPantryOutcomes((current) => new Map(current).set(id, outcome));
  };

  const handleReconcilePantry = async () => {
    if (pantryCandidates.length === 0 || isReconciling) return;

    setPantryError(null);

    try {
      await reconcilePantryIngredients(buildPantryReconciliation(pantryCandidates, pantryOutcomes));
      onOpenChange(false);
    } catch {
      setPantryError(t("failed"));
    }
  };

  return (
    <Modal state={modalState}>
      <Modal.Backdrop isDismissable={!isSaving && !isReconciling} variant="blur">
        <Modal.Container placement="center" scroll="inside" size="sm">
          <Modal.Dialog className="max-h-[calc(100dvh-1rem)] w-full max-w-md sm:max-h-[90vh]">
            <Modal.CloseTrigger aria-label="Cancel" isDisabled={isSaving || isReconciling} />
            <Modal.Header>
              <Modal.Heading>{step === "date" ? "Mark cooked" : t("title")}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="min-h-0 gap-4 overflow-y-auto">
              {step === "date" ? (
                <>
                  {recipeName ? (
                    <div className="text-default-500 text-sm">
                      Record when you cooked{" "}
                      <span className="text-foreground font-medium">{recipeName}</span>.
                    </div>
                  ) : null}
                  <DatePicker
                    isRequired
                    value={cookedDate}
                    onChange={(value) => {
                      if (value) setCookedDate(value);
                    }}
                  >
                    <Label>Cooked date</Label>
                    <DateInputGroup fullWidth variant="secondary">
                      <DateInputGroup.Input>
                        {(segment) => <DateInputGroup.Segment segment={segment} />}
                      </DateInputGroup.Input>
                      <DateInputGroup.Suffix>
                        <DatePicker.Trigger aria-label="Open cooked date picker">
                          <DatePicker.TriggerIndicator />
                        </DatePicker.Trigger>
                      </DateInputGroup.Suffix>
                    </DateInputGroup>
                    <DatePicker.Popover>
                      <Calendar>
                        <Calendar.Header>
                          <Calendar.NavButton slot="previous" />
                          <Calendar.Heading />
                          <Calendar.NavButton slot="next" />
                        </Calendar.Header>
                        <Calendar.Grid>
                          <Calendar.GridHeader>
                            {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                          </Calendar.GridHeader>
                          <Calendar.GridBody>
                            {(calendarDate) => <Calendar.Cell date={calendarDate} />}
                          </Calendar.GridBody>
                        </Calendar.Grid>
                      </Calendar>
                    </DatePicker.Popover>
                  </DatePicker>
                </>
              ) : isLoadingPantryReview ? (
                <div
                  aria-live="polite"
                  className="flex min-h-36 items-center justify-center"
                  role="status"
                >
                  <div className="flex items-center gap-2">
                    <Spinner />
                    <span className="text-default-500 text-sm">{t("loading")}</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-default-100/70 flex items-start gap-3 rounded-lg px-4 py-3">
                    <HomeIcon className="text-primary mt-0.5 h-5 w-5 shrink-0" />
                    <p className="text-default-600 text-sm leading-5">{t("description")}</p>
                  </div>

                  <div className="flex flex-col gap-3">
                    {pantryCandidates.map((item) => {
                      const outcome = pantryOutcomes.get(item.id) ?? item.status;

                      return (
                        <fieldset
                          key={item.id}
                          className="border-default-200 bg-surface flex flex-col gap-2 rounded-lg border p-3"
                        >
                          <legend className="px-1 text-sm font-medium">{item.name}</legend>
                          <ButtonGroup
                            fullWidth
                            aria-label={t("statusFor", { name: item.name })}
                            isDisabled={isReconciling}
                            size="sm"
                          >
                            {(["on_hand", "low", "used_up"] as const).map((nextOutcome) => {
                              const isSelected = outcome === nextOutcome;
                              const label =
                                nextOutcome === "on_hand"
                                  ? t("onHand")
                                  : nextOutcome === "low"
                                    ? t("runningLow")
                                    : t("usedUp");

                              return (
                                <Button
                                  key={nextOutcome}
                                  aria-pressed={isSelected}
                                  className="h-auto min-h-11 min-w-0 flex-1 touch-manipulation px-2 py-1.5 text-center text-xs leading-tight whitespace-normal sm:min-h-9 sm:text-sm"
                                  variant={
                                    isSelected
                                      ? nextOutcome === "used_up"
                                        ? "danger-soft"
                                        : "primary"
                                      : "tertiary"
                                  }
                                  onPress={() => handlePantryOutcome(item.id, nextOutcome)}
                                >
                                  {label}
                                </Button>
                              );
                            })}
                          </ButtonGroup>
                        </fieldset>
                      );
                    })}
                  </div>

                  <p className="text-default-500 text-xs">{t("nothingAutomatic")}</p>
                  {pantryError ? (
                    <p className="text-danger text-sm" role="alert">
                      {pantryError}
                    </p>
                  ) : null}
                </>
              )}
            </Modal.Body>
            <Modal.Footer className="flex-col-reverse gap-2 sm:flex-row">
              {step === "date" ? (
                <>
                  <Button
                    className="w-full sm:w-auto"
                    radius="full"
                    variant="flat"
                    onPress={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    color="primary"
                    className="w-full sm:w-auto"
                    isLoading={isSaving}
                    radius="full"
                    onPress={handleMarkCooked}
                  >
                    Mark cooked
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    isDisabled={isReconciling}
                    className="w-full sm:w-auto"
                    radius="full"
                    variant="flat"
                    onPress={() => onOpenChange(false)}
                  >
                    {t("keepUnchanged")}
                  </Button>
                  <Button
                    color="primary"
                    className="w-full sm:w-auto"
                    isDisabled={pantryCandidates.length === 0 || isLoadingPantryReview}
                    isLoading={isReconciling}
                    radius="full"
                    onPress={handleReconcilePantry}
                  >
                    {t("title")}
                  </Button>
                </>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
