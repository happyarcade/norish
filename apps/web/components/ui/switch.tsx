"use client";

import type { ComponentProps, ReactNode } from "react";
import { Switch as HeroUISwitch, Label } from "@heroui-v3/react";

type HeroUISwitchProps = ComponentProps<typeof HeroUISwitch>;

interface SwitchProps extends Omit<HeroUISwitchProps, "children" | "onChange"> {
  children?: ReactNode;
  color?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
  onValueChange?: (selected: boolean) => void;
}

/** Compact HeroUI v3 switch with the app's established controlled-value API. */
export function Switch({ children, color: _color, onValueChange, ...props }: SwitchProps) {
  return (
    <HeroUISwitch {...props} onChange={onValueChange}>
      <HeroUISwitch.Content>
        <HeroUISwitch.Control>
          <HeroUISwitch.Thumb />
        </HeroUISwitch.Control>
        {children ? <Label>{children}</Label> : null}
      </HeroUISwitch.Content>
    </HeroUISwitch>
  );
}
