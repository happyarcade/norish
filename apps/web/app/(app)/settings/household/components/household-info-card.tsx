"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { ArrowLeftStartOnRectangleIcon } from "@heroicons/react/16/solid";
import { HomeIcon } from "@heroicons/react/24/outline";
import { Modal, Separator, useOverlayState } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

import { useHouseholdSettingsContext } from "../context";

export default function HouseholdInfoCard() {
  const t = useTranslations("settings.household.info");
  const tActions = useTranslations("common.actions");
  const { household, currentUserId, leaveHousehold } = useHouseholdSettingsContext();
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const leaveModalState = useOverlayState({
    isOpen: showLeaveModal,
    onOpenChange: setShowLeaveModal,
  });

  if (!household) return null;

  // Check if current user is admin
  const currentUserData = currentUserId
    ? household.users.find((u) => u.id === currentUserId)
    : null;
  const isAdmin = currentUserData?.isAdmin === true;
  const otherMembers = household.users.filter((u) => u.id !== currentUserId);

  const handleLeaveHousehold = async () => {
    await leaveHousehold(household.id);
    setShowLeaveModal(false);
  };

  return (
    <>
      <Card>
        <Card.Header>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <HomeIcon className="h-5 w-5" />
            {household.name}
          </h2>
        </Card.Header>
        <Card.Content className="gap-4">
          <div className="flex items-center justify-between">
            <span className="text-default-600 text-base">{t("yourRole")}</span>
            <Chip color={isAdmin ? "accent" : "default"} size="sm" variant="soft">
              <Chip.Label>{isAdmin ? t("admin") : t("member")}</Chip.Label>
            </Chip>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-default-600 text-base">{t("members")}</span>
            <span className="text-base font-medium">{household.users.length}</span>
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button variant="danger-soft" onPress={() => setShowLeaveModal(true)}>
              <ArrowLeftStartOnRectangleIcon className="h-4 w-4" />
              {t("leaveButton")}
            </Button>
          </div>
        </Card.Content>
      </Card>

      {/* Leave Household Modal */}
      <Modal state={leaveModalState}>
        <Modal.Backdrop className="z-[1099]" variant="blur">
          <Modal.Container className="z-[1100]" placement="center">
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label={tActions("cancel")} />
              <Modal.Header>
                <Modal.Heading>{t("leaveModal.title")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p>{t("leaveModal.confirmMessage", { name: household.name })}</p>
                {isAdmin && otherMembers.length > 0 && (
                  <p className="text-warning mt-2">{t("leaveModal.adminWarning")}</p>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="tertiary" onPress={leaveModalState.close}>
                  {tActions("cancel")}
                </Button>
                <Button variant="danger" onPress={handleLeaveHousehold}>
                  {t("leaveModal.confirmButton")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
