"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCalendarContext } from "@/app/(app)/calendar/context";
import { PlannedItemThumbnail } from "@/components/calendar/planned-item-thumbnail";
import { Panel, PANEL_HEIGHT_COMPACT } from "@/components/Panel/Panel";
import { Button } from "@/components/ui/button";
import { ArrowTopRightOnSquareIcon, TrashIcon } from "@heroicons/react/16/solid";
import { Calendar, DatePicker, Label, ListBox, Select } from "@heroui-v3/react";
import { DateInputGroup } from "@heroui-v3/react/date-input-group";
import { parseDate } from "@internationalized/date";
import { useTranslations } from "next-intl";

import { Slot } from "@norish/shared/contracts";

const SLOTS: Slot[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

type EditPlannedRecipePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  recipeName: string;
  recipeImage: string | null;
  recipeId: string;
  date: string;
  slot: Slot;
};

export function EditPlannedRecipePanel({
  open,
  onOpenChange,
  itemId,
  recipeName,
  recipeImage,
  recipeId,
  date,
  slot,
}: EditPlannedRecipePanelProps) {
  const { deletePlanned, moveItem, planMeal } = useCalendarContext();
  const [selectedDate, setSelectedDate] = useState(parseDate(date));
  const [selectedSlot, setSelectedSlot] = useState<Slot>(slot);

  const t = useTranslations("calendar.editPlannedRecipe");
  const tSlots = useTranslations("common.slots");
  const tActions = useTranslations("common.actions");
  const tTimeline = useTranslations("calendar.timeline");

  useEffect(() => {
    if (open) {
      setSelectedDate(parseDate(date));
      setSelectedSlot(slot);
    }
  }, [open, date, slot]);

  const handleSave = () => {
    const newDateStr = selectedDate.toString();
    const locationChanged = newDateStr !== date || selectedSlot !== slot;

    if (locationChanged) {
      moveItem(itemId, newDateStr, selectedSlot, 0);
    }

    onOpenChange(false);
  };

  const handleDelete = () => {
    deletePlanned(itemId);
    onOpenChange(false);
  };

  const handleDuplicate = () => {
    planMeal(selectedDate.toString(), selectedSlot, recipeId);
  };

  return (
    <Panel height={PANEL_HEIGHT_COMPACT} open={open} title={t("title")} onOpenChange={onOpenChange}>
      <div className="flex flex-col gap-4">
        {/* Recipe preview */}
        <Link
          className="flex items-center gap-3 rounded-lg"
          href={`/recipes/${recipeId}`}
          onClick={() => onOpenChange(false)}
        >
          <PlannedItemThumbnail alt={recipeName} image={recipeImage} itemType="recipe" size="md" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-foreground truncate text-base font-medium">{recipeName}</span>
            <span className="text-primary flex items-center gap-1 text-sm">
              {tTimeline("goToRecipe")}
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
            </span>
          </div>
        </Link>

        <div className="flex gap-3">
          <DatePicker
            isRequired
            className="flex-1"
            value={selectedDate}
            onChange={(d) => d && setSelectedDate(d)}
          >
            <Label>{t("date")}</Label>
            <DateInputGroup fullWidth variant="secondary">
              <DateInputGroup.Input>
                {(segment) => <DateInputGroup.Segment segment={segment} />}
              </DateInputGroup.Input>
              <DateInputGroup.Suffix>
                <DatePicker.Trigger aria-label={t("date")}>
                  <DatePicker.TriggerIndicator />
                </DatePicker.Trigger>
              </DateInputGroup.Suffix>
            </DateInputGroup>
            <DatePicker.Popover>
              <Calendar>
                <Calendar.Header>
                  <Calendar.NavButton slot="previous" />
                  <Calendar.Heading />
                  <Calendar.NavButton slot="next" />
                </Calendar.Header>
                <Calendar.Grid>
                  <Calendar.GridHeader>
                    {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                  </Calendar.GridHeader>
                  <Calendar.GridBody>
                    {(calendarDate) => <Calendar.Cell date={calendarDate} />}
                  </Calendar.GridBody>
                </Calendar.Grid>
              </Calendar>
            </DatePicker.Popover>
          </DatePicker>
          <Select
            fullWidth
            className="flex-1"
            selectedKey={selectedSlot}
            variant="secondary"
            onSelectionChange={(key) => {
              if (typeof key === "string") setSelectedSlot(key as Slot);
            }}
          >
            <Label>{t("slot")}</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox aria-label={t("slot")}>
                {SLOTS.map((s) => (
                  <ListBox.Item key={s} id={s} textValue={tSlots(s.toLowerCase())}>
                    {tSlots(s.toLowerCase())}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button
            isIconOnly
            aria-label={tActions("delete")}
            size="sm"
            variant="danger"
            onPress={handleDelete}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
          <Button className="min-w-16" size="sm" variant="secondary" onPress={handleDuplicate}>
            {tActions("duplicate")}
          </Button>
          <Button className="min-w-16" size="sm" variant="primary" onPress={handleSave}>
            {tActions("save")}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
