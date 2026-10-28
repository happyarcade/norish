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

import type { StoreDto } from "@norish/shared/contracts";
import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";
import { useGroceryFormState } from "@norish/shared-react/hooks";

type AddGroceryPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stores: StoreDto[];
  onCreate: (itemName: string, storeId?: string | null) => void;
  onCreateRecurring: (
    itemName: string,
    pattern: RecurrencePattern,
    storeId?: string | null
  ) => void;
};

export default function AddGroceryPanel({
  open,
  onOpenChange,
  stores,
  onCreate,
  onCreateRecurring,
}: AddGroceryPanelProps) {
  const t = useTranslations("groceries.panel");
  const tActions = useTranslations("common.actions");
  const isDesktop = useIsDesktop();
  const [recurrencePanelOpen, setRecurrencePanelOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
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

  // Reset form when panel closes
  useEffect(() => {
    if (!open) {
      reset();
      setSelectedStoreId(null);
    }
  }, [open, reset]);

  const handleSubmit = () => {
    const trimmed = itemName.trim();

    if (!trimmed) return;

    if (confirmedPattern) {
      onCreateRecurring(trimmed, confirmedPattern, selectedStoreId);
    } else {
      onCreate(trimmed, selectedStoreId);
    }

    // Reset form but keep panel open for batch adding
    reset();
    // Keep the store selection for batch adding to same store
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
                placeholder={t("placeholder")}
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
            label={t("storeOptional")}
            noStoreDescription={t("autoDetectFromHistory")}
            placeholder={t("autoDetectOrSelect")}
            selectedStoreId={selectedStoreId}
            size="sm"
            stores={stores}
            onSelectionChange={setSelectedStoreId}
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
              className="font-medium"
              size="sm"
              variant="tertiary"
              onPress={() => setRecurrencePanelOpen(true)}
            >
              {t("addRepeat")}
            </Button>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            className="min-w-16"
            isDisabled={!itemName.trim()}
            size="sm"
            variant="primary"
            onPress={handleSubmit}
          >
            {tActions("add")}
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
                  <Modal.Heading>{t("addTitle")}</Modal.Heading>
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
          title={t("addTitle")}
          onOpenChange={onOpenChange}
        >
          {content}
        </Panel>
      )}

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
