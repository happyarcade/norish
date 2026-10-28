"use client";

import { Chip } from "@/components/ui/chip";
import { useTranslations } from "next-intl";

export function UnsavedChangesChip() {
  const t = useTranslations("settings.admin");

  return (
    <Chip color="warning" size="sm" variant="soft">
      <Chip.Label>{t("unsavedChanges")}</Chip.Label>
    </Chip>
  );
}
