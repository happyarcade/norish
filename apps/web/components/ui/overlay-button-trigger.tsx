"use client";

import type { ReactNode } from "react";
import { Dropdown, Popover, Spinner } from "@heroui-v3/react";

import type { ButtonProps } from "./button";
import { getButtonClassName } from "./button";

type OverlayButtonTriggerProps = Omit<ButtonProps, "as" | "href">;

function triggerContent(
  children: ReactNode,
  startContent: ReactNode,
  endContent: ReactNode,
  isPending: boolean
) {
  return (
    <>
      {isPending ? <Spinner size="sm" /> : startContent}
      {children}
      {!isPending && endContent}
    </>
  );
}

export function DropdownButtonTrigger({
  children,
  className,
  color,
  disabled,
  endContent,
  fullWidth,
  isDisabled,
  isIconOnly,
  isLoading = false,
  isPending = false,
  radius,
  size,
  startContent,
  variant,
  ...props
}: OverlayButtonTriggerProps) {
  const pending = isLoading || isPending;

  return (
    <Dropdown.Trigger
      {...props}
      aria-busy={pending || undefined}
      className={getButtonClassName({
        className,
        color,
        fullWidth,
        isIconOnly,
        radius,
        size,
        variant,
      })}
      isDisabled={isDisabled || disabled || pending}
    >
      {triggerContent(children, startContent, endContent, pending)}
    </Dropdown.Trigger>
  );
}

export function PopoverButtonTrigger({
  children,
  className,
  color,
  disabled,
  endContent,
  fullWidth,
  isDisabled,
  isIconOnly,
  isLoading = false,
  isPending = false,
  radius,
  size,
  startContent,
  variant,
  ...props
}: OverlayButtonTriggerProps) {
  const pending = isLoading || isPending;

  return (
    <Popover.Trigger
      {...props}
      aria-busy={pending || undefined}
      aria-disabled={isDisabled || disabled || pending || undefined}
      className={getButtonClassName({
        className,
        color,
        fullWidth,
        isIconOnly,
        radius,
        size,
        variant,
      })}
    >
      {triggerContent(children, startContent, endContent, pending)}
    </Popover.Trigger>
  );
}
