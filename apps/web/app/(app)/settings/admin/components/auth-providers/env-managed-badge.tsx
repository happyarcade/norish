"use client";

import { Chip } from "@/components/ui/chip";
import { useTranslations } from "next-intl";

interface EnvManagedBadgeProps {
  isOverridden?: boolean;
}

export function EnvManagedBadge({ isOverridden }: EnvManagedBadgeProps) {
  const t = useTranslations("settings.admin.authProviders.envBadge");

  if (isOverridden === undefined) return null;

  return (
    <Chip color={isOverridden ? "success" : "warning"} size="sm" variant="soft">
      <Chip.Label>{isOverridden ? t("db") : t("env")}</Chip.Label>
    </Chip>
  );
}
