"use client";

import type { ComponentProps, ReactNode } from "react";
import { Accordion as HeroAccordion } from "@heroui-v3/react";

type AccordionProps = Omit<
  ComponentProps<typeof HeroAccordion>,
  "allowsMultipleExpanded" | "variant"
> & {
  selectionMode?: "single" | "multiple";
  variant?: "bordered" | "default" | "surface";
};

export function Accordion({ selectionMode, variant = "default", ...props }: AccordionProps) {
  return (
    <HeroAccordion
      allowsMultipleExpanded={selectionMode === "multiple"}
      variant={variant === "bordered" ? "surface" : variant}
      {...props}
    />
  );
}

type AccordionItemProps = Omit<ComponentProps<typeof HeroAccordion.Item>, "children" | "id"> & {
  children: ReactNode;
  id: string;
  subtitle?: ReactNode;
  title: ReactNode;
};

export function AccordionItem({ children, id, subtitle, title, ...props }: AccordionItemProps) {
  return (
    <HeroAccordion.Item id={id} {...props}>
      <HeroAccordion.Heading>
        <HeroAccordion.Trigger>
          <span className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left">
            <span className="font-medium">{title}</span>
            {subtitle ? <span className="text-default-500 text-sm">{subtitle}</span> : null}
          </span>
          <HeroAccordion.Indicator />
        </HeroAccordion.Trigger>
      </HeroAccordion.Heading>
      <HeroAccordion.Panel>
        <HeroAccordion.Body>{children}</HeroAccordion.Body>
      </HeroAccordion.Panel>
    </HeroAccordion.Item>
  );
}
