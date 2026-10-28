"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal, Switch, useOverlayState } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

interface DeleteCalDavModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteEvents: boolean) => Promise<void>;
}

export default function DeleteCalDavModal({ isOpen, onClose, onConfirm }: DeleteCalDavModalProps) {
  const t = useTranslations("settings.caldav.deleteModal");
  const tActions = useTranslations("common.actions");
  const [deleteEvents, setDeleteEvents] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const modalState = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
  });

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm(deleteEvents);
      setDeleteEvents(false);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal state={modalState}>
      <Modal.Backdrop className="z-[1099]" variant="blur">
        <Modal.Container className="z-[1100]" placement="center">
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label={tActions("cancel")} />
            <Modal.Header>
              <Modal.Heading>{t("title")}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-default-600 text-base">{t("confirmMessage")}</p>
              <div className="mt-4">
                <Switch
                  aria-label={t("deleteEventsLabel")}
                  isSelected={deleteEvents}
                  onChange={setDeleteEvents}
                >
                  <Switch.Content>
                    <div>
                      <p className="text-base font-medium">{t("deleteEventsLabel")}</p>
                      <p className="text-default-500 text-xs">{t("deleteEventsDescription")}</p>
                    </div>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Content>
                </Switch>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={onClose}>
                {tActions("cancel")}
              </Button>
              <Button isPending={deleting} variant="danger" onPress={handleConfirm}>
                {t("confirmButton")}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
