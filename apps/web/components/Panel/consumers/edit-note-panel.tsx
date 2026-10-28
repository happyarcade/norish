"use client";

import { useEffect, useState } from "react";
import { useCalendarContext } from "@/app/(app)/calendar/context";
import { Panel, PANEL_HEIGHT_COMPACT } from "@/components/Panel/Panel";
import { Button } from "@/components/ui/button";
import { TrashIcon } from "@heroicons/react/16/solid";
import {
  Calendar,
  DatePicker,
  InputGroup,
  Label,
  ListBox,
  Select,
  TextField,
} from "@heroui-v3/react";
import { DateInputGroup } from "@heroui-v3/react/date-input-group";
import { parseDate } from "@internationalized/date";
import { useTranslations } from "next-intl";

import { Slot } from "@norish/shared/contracts";

const SLOTS: Slot[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

type EditNotePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  initialTitle: string;
  date: string;
  slot: Slot;
};

export function EditNotePanel({
  open,
  onOpenChange,
  noteId,
  initialTitle,
  date,
  slot,
}: EditNotePanelProps) {
  const { deletePlanned, moveItem, updateItem, planNote } = useCalendarContext();
  const [title, setTitle] = useState(initialTitle);
  const [selectedDate, setSelectedDate] = useState(parseDate(date));
  const [selectedSlot, setSelectedSlot] = useState<Slot>(slot);

  const t = useTranslations("calendar.editNote");
  const tSlots = useTranslations("common.slots");
  const tActions = useTranslations("common.actions");

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setSelectedDate(parseDate(date));
      setSelectedSlot(slot);
    }
  }, [open, initialTitle, date, slot]);

  const handleSave = () => {
    if (!title.trim()) return;

    const newDateStr = selectedDate.toString();
    const titleChanged = title.trim() !== initialTitle;
    const locationChanged = newDateStr !== date || selectedSlot !== slot;

    if (titleChanged) {
      updateItem(noteId, title.trim());
    }

    if (locationChanged) {
      moveItem(noteId, newDateStr, selectedSlot, 0);
    }

    onOpenChange(false);
  };

  const handleDelete = () => {
    deletePlanned(noteId);
    onOpenChange(false);
  };

  const handleDuplicate = () => {
    if (!title.trim()) return;
    planNote(selectedDate.toString(), selectedSlot, title.trim());
  };

  return (
    <Panel height={PANEL_HEIGHT_COMPACT} open={open} title={t("title")} onOpenChange={onOpenChange}>
      <div className="flex flex-col gap-4">
        <TextField fullWidth value={title} onChange={setTitle}>
          <Label>{t("noteLabel")}</Label>
          <InputGroup fullWidth variant="secondary">
            <InputGroup.Input
              placeholder={t("notePlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </InputGroup>
        </TextField>

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
          <Button size="sm" variant="secondary" onPress={handleDuplicate}>
            {tActions("duplicate")}
          </Button>
          <Button size="sm" variant="primary" onPress={handleSave}>
            {tActions("save")}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
