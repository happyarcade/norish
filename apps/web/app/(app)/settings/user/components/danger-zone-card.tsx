"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrashIcon } from "@heroicons/react/16/solid";
import { Modal, useOverlayState } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

import { useUserSettingsContext } from "../context";

export default function DangerZoneCard() {
  const t = useTranslations("settings.user.dangerZone");
  const tActions = useTranslations("common.actions");
  const { deleteAccount } = useUserSettingsContext();
  const [showAccountDeleteModal, setShowAccountDeleteModal] = useState(false);
  const accountDeleteModalState = useOverlayState({
    isOpen: showAccountDeleteModal,
    onOpenChange: setShowAccountDeleteModal,
  });

  const handleDeleteAccount = async () => {
    await deleteAccount();
  };

  return (
    <>
      <Card className="border-danger-200 dark:border-danger-900">
        <Card.Header>
          <h2 className="text-danger text-lg font-semibold">{t("title")}</h2>
        </Card.Header>
        <Card.Content className="gap-4">
          <p className="text-default-600 text-base">{t("description")}</p>
          <div className="flex justify-end">
            <Button variant="danger-soft" onPress={() => setShowAccountDeleteModal(true)}>
              <TrashIcon className="h-4 w-4" />
              {t("deleteButton")}
            </Button>
          </div>
        </Card.Content>
      </Card>

      {/* Delete Account Confirmation */}
      <Modal state={accountDeleteModalState}>
        <Modal.Backdrop className="z-[1099]" variant="blur">
          <Modal.Container className="z-[1100]" placement="center">
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label={tActions("cancel")} />
              <Modal.Header className="text-danger">
                <Modal.Heading>{t("deleteModal.title")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-danger mb-2 font-semibold">
                  {t("deleteModal.permanentWarning")}
                </p>
                <p>{t("deleteModal.dataWarning")}</p>
                <p className="mt-2">{t("deleteModal.recipesNote")}</p>
                <p className="mt-2">{t("deleteModal.adminNote")}</p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="tertiary" onPress={accountDeleteModalState.close}>
                  {tActions("cancel")}
                </Button>
                <Button variant="danger" onPress={handleDeleteAccount}>
                  {t("deleteModal.confirmButton")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
