"use client";

import type { ComponentProps, ElementType, ReactNode } from "react";
import { buttonVariants, Button as HeroUIButton, Spinner } from "@heroui-v3/react";

import { cx } from "./classnames";

type HeroUIButtonProps = ComponentProps<typeof HeroUIButton>;
type HeroUIButtonVariant = HeroUIButtonProps["variant"];

type LegacyButtonColor = "default" | "primary" | "secondary" | "success" | "warning" | "danger";
type LegacyButtonRadius = "none" | "sm" | "md" | "lg" | "full";
type LegacyButtonVariant =
  | HeroUIButtonVariant
  | "bordered"
  | "flat"
  | "light"
  | "solid"
  | "success-soft"
  | "warning-soft";

export interface ButtonProps extends Omit<HeroUIButtonProps, "children" | "className" | "variant"> {
  as?: ElementType;
  children?: ReactNode;
  className?: string;
  color?: LegacyButtonColor;
  disabled?: boolean;
  endContent?: ReactNode;
  href?: string;
  isLoading?: boolean;
  radius?: LegacyButtonRadius;
  startContent?: ReactNode;
  title?: string;
  variant?: LegacyButtonVariant;
}

function resolveVariant(
  variant: LegacyButtonVariant | undefined,
  color: LegacyButtonColor | undefined
): HeroUIButtonVariant {
  if (color === "danger") return variant === "flat" ? "danger-soft" : "danger";
  if (variant === "light") return "ghost";
  if (variant === "bordered") return "outline";
  if (variant === "flat") return "secondary";
  if (variant === "solid") return color === "primary" ? "primary" : "secondary";
  if (variant === "success-soft" || variant === "warning-soft") return "secondary";
  if (variant) return variant;
  if (color === "primary") return "primary";

  return "secondary";
}

function radiusClass(radius: LegacyButtonRadius | undefined): string | undefined {
  switch (radius) {
    case "none":
      return "rounded-none";
    case "sm":
      return "rounded-sm";
    case "md":
      return "rounded-md";
    case "lg":
      return "rounded-lg";
    case "full":
      return "rounded-full";
    default:
      return undefined;
  }
}

function colorClass(color: LegacyButtonColor | undefined): string | undefined {
  switch (color) {
    case "success":
      return "bg-success text-success-foreground hover:bg-success/90";
    case "warning":
      return "bg-warning text-warning-foreground hover:bg-warning/90";
    default:
      return undefined;
  }
}

function legacyVariantClass(variant: LegacyButtonVariant | undefined): string | undefined {
  if (variant === "success-soft") return "bg-success/15 text-success hover:bg-success/25";
  if (variant === "warning-soft") return "bg-warning/15 text-warning hover:bg-warning/25";
  return undefined;
}

export function Button({
  as: Component,
  children,
  className,
  color,
  disabled,
  endContent,
  href,
  isDisabled,
  isLoading = false,
  radius,
  startContent,
  variant,
  ...props
}: ButtonProps) {
  const resolvedVariant = resolveVariant(variant, color);
  const resolvedClassName = cx(
    radiusClass(radius),
    colorClass(color),
    legacyVariantClass(variant),
    className
  );
  const content = (
    <>
      {isLoading ? <Spinner size="sm" /> : startContent}
      {children}
      {!isLoading && endContent}
    </>
  );

  if (Component) {
    return (
      <Component
        {...props}
        className={cx(
          buttonVariants({
            fullWidth: props.fullWidth,
            isIconOnly: props.isIconOnly,
            size: props.size,
            variant: resolvedVariant,
          }),
          resolvedClassName
        )}
        href={href}
      >
        {content}
      </Component>
    );
  }

  return (
    <HeroUIButton
      {...props}
      className={resolvedClassName}
      isDisabled={isDisabled || disabled || isLoading}
      variant={resolvedVariant}
    >
      {content}
    </HeroUIButton>
  );
}
