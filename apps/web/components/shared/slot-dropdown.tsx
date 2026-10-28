import type { ReactNode } from "react";
import { Dropdown, Label } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

import type { Slot } from "@norish/shared/contracts";

type SlotDropdownProps = {
  children: ReactNode;
  onSelectSlot: (slot: Slot) => void;
  ariaLabel?: string;
};

export function SlotDropdown({ children, onSelectSlot, ariaLabel }: SlotDropdownProps) {
  const t = useTranslations("common.slots");

  return (
    <Dropdown>
      {children}
      <Dropdown.Popover>
        <Dropdown.Menu
          aria-label={ariaLabel ?? t("chooseSlot")}
          onAction={(slot) => onSelectSlot(slot as Slot)}
        >
          <Dropdown.Item id="Breakfast" textValue={t("breakfast")}>
            <Label>{t("breakfast")}</Label>
          </Dropdown.Item>
          <Dropdown.Item id="Lunch" textValue={t("lunch")}>
            <Label>{t("lunch")}</Label>
          </Dropdown.Item>
          <Dropdown.Item id="Dinner" textValue={t("dinner")}>
            <Label>{t("dinner")}</Label>
          </Dropdown.Item>
          <Dropdown.Item id="Snack" textValue={t("snack")}>
            <Label>{t("snack")}</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
