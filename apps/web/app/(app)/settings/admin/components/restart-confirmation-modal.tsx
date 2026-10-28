"use client";

import { Button } from "@/components/ui/button";
import { ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import { Modal, useOverlayState } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

type RestartConfirmationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function RestartConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
}: RestartConfirmationModalProps) {
  const t = useTranslations("settings.admin.restart");
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
              <Modal.Heading className="flex items-center gap-2">
                <ExclamationTriangleIcon className="text-warning h-5 w-5" />
                {t("title")}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p>{t("confirmMessage")}</p>
              <div className="bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800 mt-2 rounded-lg border p-4">
                <p className="text-warning-700 dark:text-warning-300 text-base font-medium">
                  {t("importantTitle")}
                </p>
                <ul className="text-warning-600 dark:text-warning-400 mt-2 list-inside list-disc space-y-1 text-base">
                  <li>{t("warning1")}</li>
                  <li>{t("warning2")}</li>
                  <li>
                    {t.rich("warning3", {
                      code: (chunks) => (
                        <code className="bg-warning-100 dark:bg-warning-800 rounded px-1">
                          {chunks}
                        </code>
                      ),
                    })}
                  </li>
                </ul>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={modalState.close}>
                {tActions("cancel")}
              </Button>
              <Button color="warning" onPress={onConfirm}>
                {t("confirmButton")}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
