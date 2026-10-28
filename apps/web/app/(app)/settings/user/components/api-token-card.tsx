"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import {
  ClipboardDocumentIcon,
  KeyIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { InputGroup, Label, Modal, Table, TextField, useOverlayState } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

import { useUserSettingsContext } from "../context";

export default function ApiKeyCard() {
  const t = useTranslations("settings.user.apiKeys");
  const tActions = useTranslations("common.actions");
  const { apiKeys, generateApiKey, deleteApiKey, toggleApiKey } = useUserSettingsContext();
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const tokenModalState = useOverlayState({
    isOpen: showTokenModal,
    onOpenChange: setShowTokenModal,
  });
  const deleteModalState = useOverlayState({
    isOpen: showDeleteModal,
    onOpenChange: setShowDeleteModal,
  });

  const handleGenerateKey = async () => {
    setGeneratingKey(true);
    try {
      const { key } = await generateApiKey(newKeyName || undefined);

      setGeneratedKey(key);
      setShowTokenModal(true);
      setNewKeyName("");
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleCopyKey = () => {
    if (generatedKey) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(generatedKey);
      }
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    deleteApiKey(keyId);
    setShowDeleteModal(false);
    setKeyToDelete(null);
  };

  return (
    <>
      <Card>
        <Card.Header>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <KeyIcon className="h-5 w-5" />
            {t("title")}
          </h2>
        </Card.Header>
        <Card.Content className="gap-4">
          <p className="text-default-600 text-base">{t("description")}</p>

          {/* Create new key section */}
          <div className="flex flex-col gap-3">
            <TextField fullWidth value={newKeyName} onChange={setNewKeyName}>
              <Label>{t("keyNameLabel")}</Label>
              <InputGroup fullWidth variant="secondary">
                <InputGroup.Input placeholder={t("keyNamePlaceholder")} />
              </InputGroup>
            </TextField>
            <div className="flex justify-end">
              <Button isPending={generatingKey} variant="primary" onPress={handleGenerateKey}>
                <PlusIcon className="h-4 w-4" />
                {t("createKey")}
              </Button>
            </div>
          </div>

          {/* Existing keys list */}
          {apiKeys.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-base font-medium">{t("yourKeys")}</h3>
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label={t("title")}>
                    <Table.Header>
                      <Table.Column isRowHeader>{t("tableHeaders.name")}</Table.Column>
                      <Table.Column>{t("tableHeaders.keyPrefix")}</Table.Column>
                      <Table.Column>{t("tableHeaders.created")}</Table.Column>
                      <Table.Column>{t("tableHeaders.status")}</Table.Column>
                      <Table.Column>{t("tableHeaders.actions")}</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {apiKeys.map((key) => (
                        <Table.Row key={key.id} id={key.id}>
                          <Table.Cell>{key.name || t("unnamed")}</Table.Cell>
                          <Table.Cell>
                            <code className="bg-default-100 rounded px-2 py-1 text-xs">
                              {key.start || "***"}...
                            </code>
                          </Table.Cell>
                          <Table.Cell>{new Date(key.createdAt).toLocaleDateString()}</Table.Cell>
                          <Table.Cell>
                            <Chip
                              color={key.enabled ? "success" : "danger"}
                              size="sm"
                              variant="soft"
                            >
                              <Chip.Label>{key.enabled ? t("active") : t("disabled")}</Chip.Label>
                            </Chip>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="flex gap-1">
                              <Button
                                isIconOnly
                                aria-label={key.enabled ? t("disableKey") : t("enableKey")}
                                size="sm"
                                title={key.enabled ? t("disableKey") : t("enableKey")}
                                variant={key.enabled ? "warning-soft" : "success-soft"}
                                onPress={() => toggleApiKey(key.id, !key.enabled)}
                              >
                                {key.enabled ? (
                                  <PauseIcon className="h-4 w-4" />
                                ) : (
                                  <PlayIcon className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                isIconOnly
                                aria-label={t("deleteKey")}
                                size="sm"
                                title={t("deleteKey")}
                                variant="danger-soft"
                                onPress={() => {
                                  setKeyToDelete(key.id);
                                  setShowDeleteModal(true);
                                }}
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </div>
          )}

          {apiKeys.length === 0 && <p className="text-default-500 py-4 text-base">{t("noKeys")}</p>}
        </Card.Content>
      </Card>

      {/* Key Generation Modal */}
      <Modal state={tokenModalState}>
        <Modal.Backdrop className="z-[1099]" isDismissable={false} variant="blur">
          <Modal.Container className="z-[1100]" placement="center">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{t("generatedModal.title")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-warning mb-4 text-base">{t("generatedModal.warning")}</p>
                <div className="flex gap-2">
                  <TextField fullWidth isReadOnly value={generatedKey || ""}>
                    <InputGroup fullWidth variant="secondary">
                      <InputGroup.Input className="font-mono text-xs" />
                    </InputGroup>
                  </TextField>
                  <Button
                    isIconOnly
                    aria-label={t("generatedModal.confirmButton")}
                    onPress={handleCopyKey}
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-default-500 mt-2 text-xs">
                  {t.rich("generatedModal.hint", {
                    code: (chunks) => <code className="bg-default-100 rounded px-1">{chunks}</code>,
                  })}
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="primary"
                  onPress={() => {
                    setGeneratedKey(null);
                    tokenModalState.close();
                  }}
                >
                  {t("generatedModal.confirmButton")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Delete Key Confirmation */}
      <Modal state={deleteModalState}>
        <Modal.Backdrop className="z-[1099]" variant="blur">
          <Modal.Container className="z-[1100]" placement="center">
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label={tActions("cancel")} />
              <Modal.Header>
                <Modal.Heading>{t("deleteModal.title")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p>{t("deleteModal.message")}</p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="tertiary" onPress={deleteModalState.close}>
                  {tActions("cancel")}
                </Button>
                <Button
                  variant="danger"
                  onPress={() => keyToDelete && handleDeleteKey(keyToDelete)}
                >
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
