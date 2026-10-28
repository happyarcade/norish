"use client";

import { Chip } from "@/components/ui/chip";
import { MealIcon } from "@/lib/meal-icon";

import { getSlotIconSlot } from "./todays-meals-constants";

type TodaysMealsSlotChipProps = {
  slotKey: string;
  slotLabel: string;
  className?: string;
};

export default function TodaysMealsSlotChip({
  slotKey,
  slotLabel,
  className,
}: TodaysMealsSlotChipProps) {
  return (
    <Chip
      className={`inline-flex w-fit max-w-full min-w-0 shrink-0 justify-start ${className ?? ""}`}
      radius="full"
      size="sm"
      startContent={<MealIcon className="h-3.5 w-3.5 shrink-0" slot={getSlotIconSlot(slotKey)} />}
      variant="flat"
    >
      <span className="min-w-0 truncate">{slotLabel}</span>
    </Chip>
  );
}
