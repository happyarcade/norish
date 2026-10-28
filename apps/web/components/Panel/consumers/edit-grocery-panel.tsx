"use client";

import { useEffect, useState } from "react";
import { RecurrenceSuggestion } from "@/app/(app)/groceries/components/recurrence-suggestion";
import { StoreSelector } from "@/components/groceries/store-selector";
import { RecurrencePanel } from "@/components/Panel/consumers/recurrence-panel";
import Panel, { PANEL_HEIGHT_COMPACT } from "@/components/Panel/Panel";
import { useIsDesktop } from "@/components/planner/use-is-desktop";
import { Button } from "@/components/ui/button";
import { useRecurrenceDetection } from "@/hooks/use-recurrence-detection";
import { InputGroup, Modal, TextField, useOverlayState } from "@heroui-v3/react";
import { AnimatePresence } from "motion/react";
import { useTranslations } from "next-intl";

import type { GroceryDto, RecurringGroceryDto, StoreDto } from "@norish/shared/contracts";
import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";
import { useGroceryFormState } from "@norish/shared-react/hooks";

type EditGroceryPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grocery: GroceryDto;
  recurringGrocery: RecurringGroceryDto | null;
  stores: StoreDto[];
  onSave: (itemName: string, pattern: RecurrencePattern | null) => void;
  onAssignToStore: (storeId: string | null, savePreference?: boolean) => void;
  onDelete: () => void;
};

export default function EditGroceryPanel({
  open,
  onOpenChange,
  grocery,
  recurringGrocery,
  stores,
  onSave,
  onAssignToStore,
  onDelete,
}: EditGroceryPanelProps) {
  const t = useTranslations("groceries.panel");
  const tActions = useTranslations("common.actions");
  const isDesktop = useIsDesktop();
  const [recurrencePanelOpen, setRecurrencePanelOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [hasStoreChanged, setHasStoreChanged] = useState(false);
  const modalState = useOverlayState({
    isOpen: open && !recurrencePanelOpen,
    onOpenChange,
  });

  const {
    itemName,
    setItemName,
    confirmedPattern,
    setConfirmedPattern,
    handleConfirmPattern,
    handleRemovePattern,
    reset,
  } = useGroceryFormState();

  const { detectedPattern } = useRecurrenceDetection({
    itemName,
    enabled: open && !recurrencePanelOpen,
  });

  // Initialize form with grocery data when opening
  useEffect(() => {
    if (open) {
      const text = [grocery.amount, grocery.unit, grocery.name].filter(Boolean).join(" ");

      setItemName(text);
      setSelectedStoreId(grocery.storeId ?? null);
      setHasStoreChanged(false);

      if (recurringGrocery) {
        setConfirmedPattern({
          rule: recurringGrocery.recurrenceRule as "day" | "week" | "month",
          interval: recurringGrocery.recurrenceInterval,
          weekday: recurringGrocery.recurrenceWeekday ?? undefined,
        });
      } else {
        setConfirmedPattern(null);
      }
    } else {
      reset();
    }
  }, [open, grocery, recurringGrocery, setItemName, setConfirmedPattern, reset]);

  const handleStoreChange = (storeId: string | null) => {
    setSelectedStoreId(storeId);
    setHasStoreChanged(storeId !== (grocery.storeId ?? null));
  };

  const handleSubmit = () => {
    const trimmed = itemName.trim();

    if (!trimmed) return;

    onSave(trimmed, confirmedPattern);

    // If store changed, save that too (with preference)
    if (hasStoreChanged) {
      onAssignToStore(selectedStoreId, true);
    }

    onOpenChange(false);
  };

  const handleRecurrenceSave = (pattern: RecurrencePattern | null) => {
    setConfirmedPattern(pattern);
    setRecurrencePanelOpen(false);
  };

  const content = (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <div className="space-y-3">
          <TextField fullWidth value={itemName} onChange={setItemName}>
            <InputGroup
              fullWidth
              className="border-primary-200 dark:border-primary-800"
              variant="secondary"
            >
              <InputGroup.Input
                className="text-base font-medium"
                placeholder={t("editPlaceholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
            </InputGroup>
          </TextField>

          <StoreSelector
            showWhenEmpty
            label={t("selectStore")}
            selectedStoreId={selectedStoreId}
            stores={stores}
            onSelectionChange={handleStoreChange}
          />

          <AnimatePresence mode="popLayout">
            <div className="flex flex-wrap items-center gap-2">
              {detectedPattern && (
                <RecurrenceSuggestion
                  key="detected"
                  itemName={itemName}
                  pattern={detectedPattern.pattern}
                  type="detected"
                  onReplace={() => handleConfirmPattern(detectedPattern)}
                />
              )}

              {confirmedPattern && (
                <RecurrenceSuggestion
                  key="confirmed"
                  itemName={itemName}
                  pattern={confirmedPattern}
                  type="confirmed"
                  onEdit={() => setRecurrencePanelOpen(true)}
                  onRemove={handleRemovePattern}
                />
              )}
            </div>
          </AnimatePresence>

          {!confirmedPattern && !detectedPattern ? (
            <Button
              className="-mt-1 font-medium"
              size="sm"
              variant="tertiary"
              onPress={() => setRecurrencePanelOpen(true)}
            >
              {t("addRepeat")}
            </Button>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <Button className="min-w-16" size="sm" variant="danger" onPress={onDelete}>
            {tActions("delete")}
          </Button>
          <Button
            className="min-w-16"
            isDisabled={!itemName.trim()}
            size="sm"
            variant="primary"
            onPress={handleSubmit}
          >
            {tActions("save")}
          </Button>
        </div>
      </form>
    </div>
  );

  return (
    <>
      {isDesktop ? (
        <Modal state={modalState}>
          <Modal.Backdrop variant="blur">
            <Modal.Container placement="center" size="md">
              <Modal.Dialog className="max-w-md">
                <Modal.CloseTrigger aria-label={tActions("close")} />
                <Modal.Header>
                  <Modal.Heading>{t("editTitle")}</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="pb-6">{content}</Modal.Body>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      ) : (
        <Panel
          height={PANEL_HEIGHT_COMPACT}
          open={open && !recurrencePanelOpen}
          title={t("editTitle")}
          onOpenChange={onOpenChange}
        >
          {content}
        </Panel>
      )}

      {/* Recurrence Panel */}
      <RecurrencePanel
        initialPattern={confirmedPattern}
        open={recurrencePanelOpen}
        returnToPreviousPanel={() => setRecurrencePanelOpen(false)}
        onOpenChange={setRecurrencePanelOpen}
        onSave={handleRecurrenceSave}
      />
    </>
  );
}
