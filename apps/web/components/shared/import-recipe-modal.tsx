"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePermissionsContext } from "@/context/permissions-context";
import { useRecipesContext } from "@/context/recipes-context";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { ArrowDownTrayIcon, SparklesIcon } from "@heroicons/react/16/solid";
import { InputGroup, Label, Modal, TextField, useOverlayState } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

interface ImportRecipeModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImportRecipeModal({ isOpen, onOpenChange }: ImportRecipeModalProps) {
  const t = useTranslations("common.import.url");
  const tErrors = useTranslations("common.errors");
  const tActions = useTranslations("common.actions");
  const { importRecipe, importRecipeWithAI } = useRecipesContext();
  const { isAIEnabled } = usePermissionsContext();
  const [importUrl, setImportUrl] = useState("");
  const modalState = useOverlayState({ isOpen, onOpenChange });

  useEffect(() => {
    if (!isOpen || typeof navigator === "undefined" || !navigator.clipboard?.readText) {
      return;
    }

    let isCancelled = false;

    async function fillUrlFromClipboard() {
      try {
        const clipboardText = (await navigator.clipboard.readText()).trim();

        if (!clipboardText) {
          return;
        }

        const parsedUrl = new URL(clipboardText);
        const isHttpUrl = parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";

        if (isHttpUrl && !isCancelled) {
          setImportUrl((currentValue) =>
            currentValue.trim() === "" ? clipboardText : currentValue
          );
        }
      } catch {}
    }

    void fillUrlFromClipboard();

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  async function handleImportFromUrl() {
    if (importUrl.trim() === "") return;

    try {
      await importRecipe(importUrl);
      onOpenChange(false);
      setImportUrl("");
    } catch (e) {
      onOpenChange(false);
      setImportUrl("");
      showSafeErrorToast({
        title: t("failed"),
        description: tErrors("technicalDetails"),
        color: "danger",
        error: e,
        context: "import-recipe-modal:import",
      });
    }
  }

  async function handleAIImport() {
    if (importUrl.trim() === "") return;

    try {
      await importRecipeWithAI(importUrl);
      onOpenChange(false);
      setImportUrl("");
    } catch (e) {
      onOpenChange(false);
      setImportUrl("");
      showSafeErrorToast({
        title: t("failedWithAI"),
        description: tErrors("technicalDetails"),
        color: "danger",
        error: e,
        context: "import-recipe-modal:import-ai",
      });
    }
  }

  return (
    <Modal state={modalState}>
      <Modal.Backdrop className="z-[1100]" variant="blur">
        <Modal.Container placement="center" size="md">
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label={tActions("close")} />
            <Modal.Header>
              <Modal.Heading>{t("title")}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <TextField fullWidth value={importUrl} onChange={setImportUrl}>
                <Label>{t("label")}</Label>
                <InputGroup fullWidth variant="secondary">
                  <InputGroup.Input placeholder={t("placeholder")} type="url" />
                </InputGroup>
              </TextField>
            </Modal.Body>
            <Modal.Footer>
              {isAIEnabled && (
                <Button
                  className="bg-gradient-to-r from-rose-400 via-fuchsia-500 to-indigo-500 text-white hover:brightness-110"
                  isDisabled={importUrl.trim() === ""}
                  variant="secondary"
                  onPress={handleAIImport}
                >
                  <SparklesIcon className="h-4 w-4" />
                  {tActions("aiImport")}
                </Button>
              )}
              <Button
                isDisabled={importUrl.trim() === ""}
                variant="primary"
                onPress={handleImportFromUrl}
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                {tActions("import")}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
