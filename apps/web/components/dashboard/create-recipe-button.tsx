"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import ImportFromImageModal from "@/components/shared/import-from-image-modal";
import ImportFromPasteModal from "@/components/shared/import-from-paste-modal";
import ImportRecipeModal from "@/components/shared/import-recipe-modal";
import { Button } from "@/components/ui/button";
import { usePermissionsContext } from "@/context/permissions-context";
import {
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  HeartIcon,
  PhotoIcon,
  PlusIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/16/solid";
import { Dropdown } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

export default function CreateRecipeButton() {
  const router = useRouter();
  const { isAIEnabled } = usePermissionsContext();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const t = useTranslations("recipes.dashboard");
  const tCommon = useTranslations("common.actions");

  const menuItems = (
    <>
      <Dropdown.Item id="import" onAction={() => setShowImportModal(true)}>
        <ArrowDownTrayIcon className="h-4 w-4" />
        <span>{t("importFromUrl")}</span>
      </Dropdown.Item>
      <Dropdown.Item id="paste" onAction={() => setShowPasteModal(true)}>
        <ClipboardDocumentIcon className="h-4 w-4" />
        <span>{t("importFromPaste")}</span>
      </Dropdown.Item>
      {isAIEnabled ? (
        <Dropdown.Item id="image" onAction={() => setShowImageModal(true)}>
          <PhotoIcon className="h-4 w-4" />
          <span>{t("importFromImage")}</span>
        </Dropdown.Item>
      ) : null}
      <Dropdown.Item id="create" onAction={() => router.push("/recipes/new")}>
        <PlusIcon className="h-4 w-4" />
        <span>{tCommon("create")}</span>
      </Dropdown.Item>
      <Dropdown.Item id="review-metadata" onAction={() => router.push("/recipes/review")}>
        <WrenchScrewdriverIcon className="h-4 w-4" />
        <span>{t("reviewMetadata")}</span>
      </Dropdown.Item>
      <Dropdown.Item
        id="review-nutrition"
        onAction={() => router.push("/recipes/review/nutrition")}
      >
        <HeartIcon className="h-4 w-4" />
        <span>Review nutrition</span>
      </Dropdown.Item>
    </>
  );

  return (
    <>
      {/* Desktop */}
      <Dropdown>
        <Button
          className="hidden font-medium md:flex"
          color="primary"
          id="create-recipe-menu-trigger-desktop"
          radius="full"
          size="md"
          startContent={<PlusIcon className="h-5 w-5" />}
        >
          {t("addRecipe")}
        </Button>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu aria-label="Add recipe options">{menuItems}</Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      {/* Mobile */}
      <Dropdown>
        <Button
          isIconOnly
          aria-label={t("addRecipe")}
          className="mx-2 md:hidden"
          color="primary"
          id="create-recipe-menu-trigger-mobile"
          radius="full"
          size="md"
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu aria-label="Add recipe options">{menuItems}</Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <ImportRecipeModal isOpen={showImportModal} onOpenChange={setShowImportModal} />
      <ImportFromPasteModal isOpen={showPasteModal} onOpenChange={setShowPasteModal} />
      {isAIEnabled && (
        <ImportFromImageModal isOpen={showImageModal} onOpenChange={setShowImageModal} />
      )}
    </>
  );
}
