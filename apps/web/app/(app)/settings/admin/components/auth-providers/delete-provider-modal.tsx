"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import { Modal, useOverlayState } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

interface DeleteProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  providerName: string;
}

export function DeleteProviderModal({
  isOpen,
  onClose,
  onConfirm,
  providerName,
}: DeleteProviderModalProps) {
  const t = useTranslations("settings.admin.authProviders.form");
  const tActions = useTranslations("common.actions");
  const [isDeleting, setIsDeleting] = useState(false);
  const modalState = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
  });

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal state={modalState}>
      <Modal.Backdrop className="z-[1099]" variant="blur">
        <Modal.Container className="z-[1100]" placement="center">
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label={tActions("cancel")} />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <ExclamationTriangleIcon className="text-danger h-5 w-5" />
                {t("removeTitle", { provider: providerName })}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p>{t("removeConfirm")}</p>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={onClose}>
                {tActions("cancel")}
              </Button>
              <Button isPending={isDeleting} variant="danger" onPress={handleConfirm}>
                {tActions("remove")}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
