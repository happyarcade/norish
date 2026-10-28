"use client";

import { Button } from "@/components/ui/button";
import { Modal, useOverlayState } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

interface DeleteRecipeModalProps {
  isOpen: boolean;
  recipeName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteRecipeModal({
  isOpen,
  recipeName,
  onClose,
  onConfirm,
}: DeleteRecipeModalProps) {
  const t = useTranslations("recipes.deleteModal");
  const tActions = useTranslations("common.actions");
  const modalState = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
  });

  return (
    <Modal state={modalState}>
      <Modal.Backdrop className="z-[1099]" variant="blur">
        <Modal.Container className="z-[1100]" placement="center">
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label={tActions("cancel")} />
            <Modal.Header>
              <Modal.Heading className="text-danger">{t("title")}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-danger mb-2 font-semibold">{t("warning")}</p>
              <p>{t("confirmMessage", { recipeName })}</p>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={modalState.close}>
                {tActions("cancel")}
              </Button>
              <Button variant="danger" onPress={onConfirm}>
                {tActions("delete")}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
