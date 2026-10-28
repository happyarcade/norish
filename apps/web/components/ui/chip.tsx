"use client";

import type { ComponentProps, ElementType, ReactNode } from "react";
import { Children, isValidElement } from "react";
import { Chip as HeroChip } from "@heroui-v3/react";

import { cx } from "./classnames";

type LegacyChipColor =
  | "accent"
  | "danger"
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning";
type LegacyChipVariant =
  | ComponentProps<typeof HeroChip>["variant"]
  | "bordered"
  | "flat"
  | "light"
  | "solid";

type ChipProps = Omit<
  ComponentProps<typeof HeroChip>,
  "as" | "children" | "color" | "title" | "variant"
> & {
  as?: ElementType;
  children?: ReactNode;
  color?: LegacyChipColor;
  endContent?: ReactNode;
  radius?: "none" | "sm" | "md" | "lg" | "full";
  startContent?: ReactNode;
  title?: string;
  variant?: LegacyChipVariant;
};

function resolveColor(color: LegacyChipColor | undefined) {
  if (color === "primary") return "accent" as const;
  if (color === "secondary") return "default" as const;
  return color;
}

function resolveVariant(variant: LegacyChipVariant | undefined) {
  if (variant === "bordered") return "secondary" as const;
  if (variant === "flat") return "soft" as const;
  if (variant === "light") return "tertiary" as const;
  if (variant === "solid") return "primary" as const;
  return variant;
}

function radiusClass(radius: ChipProps["radius"]) {
  if (radius === "none") return "rounded-none";
  if (radius === "sm") return "rounded-sm";
  if (radius === "md") return "rounded-md";
  if (radius === "lg") return "rounded-lg";
  if (radius === "full") return "rounded-full";
  return undefined;
}

function ChipRoot({
  as: Component,
  children,
  className,
  color,
  endContent,
  radius,
  startContent,
  variant,
  ...props
}: ChipProps) {
  const hasCompoundLabel = Children.toArray(children).some(
    (child) => isValidElement(child) && child.type === HeroChip.Label
  );

  const content = hasCompoundLabel ? (
    children
  ) : (
    <HeroChip.Label className="flex items-center gap-1.5">
      {startContent}
      {children}
      {endContent}
    </HeroChip.Label>
  );

  if (Component) {
    return (
      <Component
        {...props}
        className={cx(
          "inline-flex items-center justify-center gap-1.5 rounded-full border px-2 py-0.5",
          radiusClass(radius),
          className
        )}
      >
        {startContent}
        {children}
        {endContent}
      </Component>
    );
  }

  return (
    <HeroChip
      {...props}
      className={cx(radiusClass(radius), className)}
      color={resolveColor(color)}
      variant={resolveVariant(variant)}
    >
      {content}
    </HeroChip>
  );
}

export const Chip = Object.assign(ChipRoot, { Label: HeroChip.Label });
