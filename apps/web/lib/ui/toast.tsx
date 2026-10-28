"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";
import { isValidElement } from "react";
import { Button, toast } from "@heroui-v3/react";

type LegacyToastColor = "default" | "primary" | "secondary" | "success" | "warning" | "danger";

interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  color?: LegacyToastColor;
  endContent?: ReactNode;
  timeout?: number;
  shouldShowTimeoutProgress?: boolean;
  radius?: string;
  hideIcon?: boolean;
  severity?: LegacyToastColor;
  classNames?: Record<string, string>;
}

type ToastActionProps = ComponentProps<typeof Button>;

function getActionProps(endContent: ReactNode): ToastActionProps | undefined {
  if (!isValidElement(endContent)) return undefined;

  return (endContent as ReactElement<ToastActionProps>).props;
}

/**
 * Keeps the app's existing notification call sites small while routing them
 * through HeroUI v3's toast queue.
 */
export function addToast({
  title,
  description,
  color = "default",
  endContent,
  timeout,
  severity,
}: ToastOptions): string {
  const resolvedColor = severity ?? color;
  const options = {
    actionProps: getActionProps(endContent),
    description,
    timeout,
  };

  switch (resolvedColor) {
    case "success":
      return toast.success(title, options);
    case "warning":
      return toast.warning(title, options);
    case "danger":
      return toast.danger(title, options);
    case "primary":
    case "secondary":
      return toast(title, { ...options, variant: "accent" });
    default:
      return toast(title, options);
  }
}

export function closeToast(key: string): void {
  toast.close(key);
}
