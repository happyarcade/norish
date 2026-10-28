"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { ShieldCheckIcon, UserMinusIcon } from "@heroicons/react/16/solid";
import { UserGroupIcon } from "@heroicons/react/24/outline";
import { Modal, Table, toast, useOverlayState } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

import { useHouseholdSettingsContext } from "../context";

export default function MembersCard() {
  const t = useTranslations("settings.household.members");
  const tErrors = useTranslations("common.errors");
  const ti = useTranslations("settings.household.info");
  const tActions = useTranslations("common.actions");
  const { household, currentUserId, kickUser, transferAdmin } = useHouseholdSettingsContext();
  const [showKickModal, setShowKickModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [userToKick, setUserToKick] = useState<{ id: string; name: string } | null>(null);
  const [userToTransfer, setUserToTransfer] = useState<{ id: string; name: string } | null>(null);
  const kickModalState = useOverlayState({
    isOpen: showKickModal,
    onOpenChange: setShowKickModal,
  });
  const transferModalState = useOverlayState({
    isOpen: showTransferModal,
    onOpenChange: setShowTransferModal,
  });

  if (!household) return null;

  // Check if current user is admin
  const currentUserData = currentUserId
    ? household.users.find((u) => u.id === currentUserId)
    : null;
  const isAdmin = currentUserData?.isAdmin === true;

  const handleKickUser = async () => {
    if (!userToKick) return;

    try {
      await kickUser(household.id, userToKick.id);
    } catch (error) {
      showSafeErrorToast({
        title: t("toasts.kickFailed"),
        description: tErrors("technicalDetails"),
        color: "danger",
        error,
        context: "household-members:kick",
      });
    } finally {
      setShowKickModal(false);
      setUserToKick(null);
    }
  };

  const handleTransferAdmin = async () => {
    if (!userToTransfer) return;

    try {
      await transferAdmin(household.id, userToTransfer.id);
      toast.success(t("toasts.transferSuccess", { name: userToTransfer.name }));
    } catch (error) {
      showSafeErrorToast({
        title: t("toasts.transferFailed"),
        description: tErrors("technicalDetails"),
        color: "danger",
        error,
        context: "household-members:transfer-admin",
      });
    } finally {
      setShowTransferModal(false);
      setUserToTransfer(null);
    }
  };

  return (
    <>
      <Card>
        <Card.Header>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <UserGroupIcon className="h-5 w-5" />
            {t("title")}
          </h2>
        </Card.Header>
        <Card.Content>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label={t("title")}>
                <Table.Header>
                  <Table.Column isRowHeader>{t("tableHeaders.name")}</Table.Column>
                  <Table.Column>{t("tableHeaders.role")}</Table.Column>
                  <Table.Column>{t("tableHeaders.actions")}</Table.Column>
                </Table.Header>
                <Table.Body>
                  {household.users.map((user) => {
                    const isSelf = user.id === currentUserId;
                    const isUserAdmin = user.isAdmin === true;

                    return (
                      <Table.Row key={user.id} id={user.id}>
                        <Table.Cell>
                          <div className="flex items-center gap-2">
                            {user.name}
                            {isSelf && (
                              <Chip color="default" size="sm" variant="soft">
                                <Chip.Label>{t("you")}</Chip.Label>
                              </Chip>
                            )}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip color={isUserAdmin ? "accent" : "default"} size="sm" variant="soft">
                            <Chip.Label>{isUserAdmin ? ti("admin") : ti("member")}</Chip.Label>
                          </Chip>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex gap-2">
                            {isAdmin && !isSelf && (
                              <>
                                <Button
                                  size="sm"
                                  variant="danger-soft"
                                  onPress={() => {
                                    setUserToKick({ id: user.id, name: user.name || "Unknown" });
                                    setShowKickModal(true);
                                  }}
                                >
                                  <UserMinusIcon className="h-4 w-4" />
                                  {t("kickButton")}
                                </Button>
                                {!isUserAdmin && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onPress={() => {
                                      setUserToTransfer({
                                        id: user.id,
                                        name: user.name || "Unknown",
                                      });
                                      setShowTransferModal(true);
                                    }}
                                  >
                                    <ShieldCheckIcon className="h-4 w-4" />
                                    {t("makeAdminButton")}
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Card.Content>
      </Card>

      {/* Kick User Modal */}
      <Modal state={kickModalState}>
        <Modal.Backdrop className="z-[1099]" variant="blur">
          <Modal.Container className="z-[1100]" placement="center">
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label={tActions("cancel")} />
              <Modal.Header>
                <Modal.Heading>{t("kickModal.title")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p>{t("kickModal.confirmMessage", { name: userToKick?.name ?? "" })}</p>
                <p className="text-default-600 mt-2 text-base">{t("kickModal.warning")}</p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="tertiary" onPress={kickModalState.close}>
                  {tActions("cancel")}
                </Button>
                <Button variant="danger" onPress={handleKickUser}>
                  {t("kickModal.confirmButton")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Transfer Admin Modal */}
      <Modal state={transferModalState}>
        <Modal.Backdrop className="z-[1099]" variant="blur">
          <Modal.Container className="z-[1100]" placement="center">
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label={tActions("cancel")} />
              <Modal.Header>
                <Modal.Heading>{t("transferModal.title")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p>{t("transferModal.confirmMessage", { name: userToTransfer?.name ?? "" })}</p>
                <p className="text-default-600 mt-2 text-base">{t("transferModal.warning")}</p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="tertiary" onPress={transferModalState.close}>
                  {tActions("cancel")}
                </Button>
                <Button variant="primary" onPress={handleTransferAdmin}>
                  {t("transferModal.confirmButton")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
