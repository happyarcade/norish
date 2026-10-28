"use client";

import type { ComponentProps, ReactNode } from "react";
import { Tooltip as HeroTooltip } from "@heroui-v3/react";

type TooltipProps = Omit<ComponentProps<typeof HeroTooltip>, "children"> & {
  children: ReactNode;
  content: ReactNode;
  placement?: ComponentProps<typeof HeroTooltip.Content>["placement"];
};

export function Tooltip({ children, content, placement, ...props }: TooltipProps) {
  return (
    <HeroTooltip {...props}>
      <HeroTooltip.Trigger>{children}</HeroTooltip.Trigger>
      <HeroTooltip.Content placement={placement}>{content}</HeroTooltip.Content>
    </HeroTooltip>
  );
}
