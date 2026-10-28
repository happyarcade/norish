"use client";

import Panel from "@/components/Panel/Panel";
import { useIsDesktop } from "@/components/planner/use-is-desktop";
import { Modal, useOverlayState } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

import { PantryContent } from "./pantry-content";

type PantryPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PantryPanel({ open, onOpenChange }: PantryPanelProps) {
  const t = useTranslations("groceries.pantry");
  const tActions = useTranslations("common.actions");
  const isDesktop = useIsDesktop();
  const modalState = useOverlayState({ isOpen: open, onOpenChange });
  const content = open ? <PantryContent open={open} /> : null;

  if (isDesktop) {
    return (
      <Modal state={modalState}>
        <Modal.Backdrop variant="blur">
          <Modal.Container placement="center" scroll="inside" size="lg">
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label={tActions("close")} />
              <Modal.Header>
                <Modal.Heading>{t("title")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="max-h-[70vh] min-h-80 pb-6">{content}</Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    );
  }

  return (
    <Panel open={open} title={t("title")} onOpenChange={onOpenChange}>
      {content}
    </Panel>
  );
}
