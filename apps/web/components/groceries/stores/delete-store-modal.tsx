"use client";

import { useEffect, useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { Button } from "@/components/ui/button";
import { Description, Label, Modal, Radio, RadioGroup, useOverlayState } from "@heroui-v3/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

interface DeleteStoreModalProps {
  isOpen: boolean;
  storeId: string | null;
  storeName: string;
  onClose: () => void;
  onConfirm: (storeId: string, deleteGroceries: boolean) => void;
}

export function DeleteStoreModal({
  isOpen,
  storeId,
  storeName,
  onClose,
  onConfirm,
}: DeleteStoreModalProps) {
  const [deleteOption, setDeleteOption] = useState<"keep" | "delete">("keep");
  const trpc = useTRPC();
  const t = useTranslations("groceries.storeManager");
  const tActions = useTranslations("common.actions");
  const modalState = useOverlayState({
    isOpen,
    onOpenChange: (nextOpen) => {
      if (!nextOpen) onClose();
    },
  });

  // Fetch grocery count for this store
  const { data: groceryCount } = useQuery({
    ...trpc.stores.getGroceryCount.queryOptions({ storeId: storeId ?? "" }),
    enabled: isOpen && !!storeId,
  });

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDeleteOption("keep");
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (!storeId) return;
    onConfirm(storeId, deleteOption === "delete");
    onClose();
  };

  const itemCount = groceryCount ?? 0;

  return (
    <Modal state={modalState}>
      <Modal.Backdrop className="z-[1100]" variant="blur">
        <Modal.Container placement="center" size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label={tActions("close")} />
            <Modal.Header>
              <Modal.Heading>{t("deleteStore")}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="gap-4">
              <p className="text-default-600 text-base">{t("confirmDelete", { storeName })}</p>

              {itemCount > 0 && (
                <div>
                  <p className="text-danger mb-3 text-sm font-medium">
                    {itemCount === 1
                      ? t("hasItems", { count: itemCount })
                      : t("hasItemsPlural", { count: itemCount })}{" "}
                    {t("whatToDo")}
                  </p>

                  <RadioGroup
                    className="gap-3"
                    value={deleteOption}
                    variant="secondary"
                    onChange={(value) => setDeleteOption(value as "keep" | "delete")}
                  >
                    <Radio value="keep">
                      <Radio.Content>
                        <Radio.Control>
                          <Radio.Indicator />
                        </Radio.Control>
                        <Label>{t("keepItems")}</Label>
                      </Radio.Content>
                      <Description className="pl-7 text-xs">
                        {t("keepItemsDescription")}
                      </Description>
                    </Radio>
                    <Radio value="delete">
                      <Radio.Content>
                        <Radio.Control>
                          <Radio.Indicator />
                        </Radio.Control>
                        <Label>{t("deleteItems")}</Label>
                      </Radio.Content>
                      <Description className="pl-7 text-xs">
                        {t("deleteItemsDescription")}
                      </Description>
                    </Radio>
                  </RadioGroup>
                </div>
              )}

              {itemCount === 0 && <p className="text-default-500 text-sm">{t("noItems")}</p>}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={onClose}>
                {tActions("cancel")}
              </Button>
              <Button variant="danger" onPress={handleConfirm}>
                {t("deleteStore")}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
