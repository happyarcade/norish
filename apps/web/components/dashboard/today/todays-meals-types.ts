import type { PlannerSlotItemResult } from "@/hooks/planner";

export type TodayMealSlotCardProps = {
  slotKey: string;
  slotLabel: string;
  items: PlannerSlotItemResult[];
  onPlan: (slotKey: string) => void;
  isDisabled?: boolean;
};
