"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { usePermissionsContext } from "@/context/permissions-context";
import { useRecipesMutations } from "@/hooks/recipes";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { addToast } from "@/lib/ui/toast";
import { ArrowDownTrayIcon, SparklesIcon } from "@heroicons/react/16/solid";
import { InputGroup, Label, Modal, TextField, useOverlayState } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

import { MAX_RECIPE_PASTE_CHARS } from "@norish/shared/contracts/uploads";

interface ImportFromPasteModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImportFromPasteModal({ isOpen, onOpenChange }: ImportFromPasteModalProps) {
  const t = useTranslations("common.import.paste");
  const tErrors = useTranslations("common.errors");
  const tActions = useTranslations("common.actions");
  const router = useRouter();
  const { isAIEnabled } = usePermissionsContext();
  const { importRecipeFromPaste, importRecipeFromPasteWithAI } = useRecipesMutations();
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalState = useOverlayState({ isOpen, onOpenChange });

  const handleImport = useCallback(() => {
    const trimmed = text.trim();

    if (!trimmed) return;

    if (trimmed.length > MAX_RECIPE_PASTE_CHARS) {
      addToast({
        title: t("tooLarge"),
        description: t("maxCharacters", { max: MAX_RECIPE_PASTE_CHARS.toLocaleString() }),
        color: "warning",
      });

      return;
    }

    setIsSubmitting(true);

    try {
      importRecipeFromPaste(trimmed);

      addToast({
        severity: "default",
        title: t("importing"),
        description: t("inProgress"),
        shouldShowTimeoutProgress: true,
        radius: "full",
      });

      onOpenChange(false);
      setText("");
      router.push("/");
    } catch (error) {
      showSafeErrorToast({
        title: t("failed"),
        description: tErrors("technicalDetails"),
        color: "danger",
        error,
        context: "import-from-paste-modal:import",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [importRecipeFromPaste, onOpenChange, router, t, tErrors, text]);

  const handleAIImport = useCallback(() => {
    const trimmed = text.trim();

    if (!trimmed) return;

    if (trimmed.length > MAX_RECIPE_PASTE_CHARS) {
      addToast({
        title: t("tooLarge"),
        description: t("maxCharacters", { max: MAX_RECIPE_PASTE_CHARS.toLocaleString() }),
        color: "warning",
      });

      return;
    }

    setIsSubmitting(true);

    try {
      importRecipeFromPasteWithAI(trimmed);

      addToast({
        severity: "default",
        title: t("importingWithAI"),
        description: t("inProgress"),
        shouldShowTimeoutProgress: true,
        radius: "full",
      });

      onOpenChange(false);
      setText("");
      router.push("/");
    } catch (error) {
      showSafeErrorToast({
        title: t("failed"),
        description: tErrors("technicalDetails"),
        color: "danger",
        error,
        context: "import-from-paste-modal:import-ai",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [importRecipeFromPasteWithAI, onOpenChange, router, t, tErrors, text]);

  const _handleClose = useCallback(() => {
    onOpenChange(false);
    setText("");
  }, [onOpenChange]);

  return (
    <Modal state={modalState}>
      <Modal.Backdrop className="z-[1099]" variant="blur">
        <Modal.Container className="z-[1100]" placement="center" scroll="inside" size="lg">
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label={tActions("cancel")} />
            <Modal.Header>
              <Modal.Heading>{t("title")}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <TextField fullWidth value={text} onChange={setText}>
                <Label>{t("label")}</Label>
                <InputGroup fullWidth variant="secondary">
                  <InputGroup.TextArea
                    className="max-h-[28rem] min-h-48 resize-y"
                    placeholder={t("placeholder")}
                    rows={8}
                  />
                </InputGroup>
              </TextField>
              <p className="text-default-500 text-xs">
                {t("characters", {
                  count: text.length.toLocaleString(),
                  max: MAX_RECIPE_PASTE_CHARS.toLocaleString(),
                })}
              </p>
            </Modal.Body>
            <Modal.Footer>
              {isAIEnabled && (
                <Button
                  className="bg-gradient-to-r from-rose-400 via-fuchsia-500 to-indigo-500 text-white hover:brightness-110"
                  isDisabled={text.trim().length === 0}
                  isLoading={isSubmitting}
                  startContent={!isSubmitting && <SparklesIcon className="h-4 w-4" />}
                  onPress={handleAIImport}
                >
                  {tActions("aiImport")}
                </Button>
              )}
              <Button
                color="primary"
                isDisabled={text.trim().length === 0}
                isLoading={isSubmitting}
                startContent={!isSubmitting && <ArrowDownTrayIcon className="h-4 w-4" />}
                onPress={handleImport}
              >
                {tActions("import")}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
