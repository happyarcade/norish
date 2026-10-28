"use client";

import { Chip } from "@/components/ui/chip";
import { useTranslations } from "next-intl";

export default function NewFeatureChip() {
  const tCommon = useTranslations("common");

  return (
    <Chip
      className="border-small border-white/50 bg-linear-to-br from-indigo-500 to-pink-500 text-white shadow-lg shadow-pink-500/30"
      color="accent"
      size="sm"
      variant="primary"
    >
      <Chip.Label>{tCommon("badges.new")}</Chip.Label>
    </Chip>
  );
}
