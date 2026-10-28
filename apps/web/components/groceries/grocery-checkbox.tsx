"use client";

import { Checkbox } from "@heroui-v3/react";

type GroceryCheckboxProps = {
  ariaLabel: string;
  className?: string;
  isDisabled?: boolean;
  isIndeterminate?: boolean;
  isSelected: boolean;
  onChange?: (selected: boolean) => void;
};

export function GroceryCheckbox({
  ariaLabel,
  className,
  isDisabled = false,
  isIndeterminate = false,
  isSelected,
  onChange,
}: GroceryCheckboxProps) {
  return (
    <Checkbox
      aria-label={ariaLabel}
      className={className}
      isDisabled={isDisabled}
      isIndeterminate={isIndeterminate}
      isSelected={isSelected}
      variant="secondary"
      onChange={onChange}
    >
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
      </Checkbox.Content>
    </Checkbox>
  );
}
