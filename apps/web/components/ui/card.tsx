"use client";

import type { ComponentProps } from "react";
import { Card as HeroCard } from "@heroui-v3/react";

import { cx } from "./classnames";

type CardRadius = "none" | "sm" | "md" | "lg" | "full";
type CardShadow = "none" | "sm" | "md" | "lg";

type CardProps = ComponentProps<typeof HeroCard> & {
  radius?: CardRadius;
  shadow?: CardShadow;
};

function radiusClass(radius: CardRadius | undefined) {
  if (radius === "none") return "rounded-none";
  if (radius === "sm") return "rounded-sm";
  if (radius === "md") return "rounded-md";
  if (radius === "lg") return "rounded-lg";
  if (radius === "full") return "rounded-full";
  return undefined;
}

function shadowClass(shadow: CardShadow | undefined) {
  if (shadow === "none") return "shadow-none";
  if (shadow === "sm") return "shadow-sm";
  if (shadow === "md") return "shadow-md";
  if (shadow === "lg") return "shadow-lg";
  return undefined;
}

function CardRoot({ className, radius, shadow, ...props }: CardProps) {
  return (
    <HeroCard {...props} className={cx(radiusClass(radius), shadowClass(shadow), className)} />
  );
}

export const Card = Object.assign(CardRoot, {
  Content: HeroCard.Content,
  Description: HeroCard.Description,
  Footer: HeroCard.Footer,
  Header: HeroCard.Header,
  Title: HeroCard.Title,
});
