"use client";

import { CheckCircleIcon } from "@heroicons/react/16/solid";

function formatCookCount(count: number): string {
  return `${count} ${count === 1 ? "time" : "times"}`;
}

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatCookHistory(
  lastCookedAt: Date | string | null | undefined,
  cookCount: number | null | undefined
): string | null {
  if (!cookCount || cookCount <= 0) return null;

  const countLabel = formatCookCount(cookCount);

  if (!lastCookedAt) return `Cooked ${countLabel}`;

  return `Cooked ${countLabel} - last ${formatDate(lastCookedAt)}`;
}

export function formatCookHistoryShort(
  lastCookedAt: Date | string | null | undefined,
  cookCount: number | null | undefined
): string | null {
  if (!cookCount || cookCount <= 0) return null;

  if (!lastCookedAt) return `Cooked ${formatCookCount(cookCount)}`;

  return `Last cooked ${formatDate(lastCookedAt)}`;
}

export function CookHistoryMeta({
  lastCookedAt,
  cookCount,
  className = "",
}: {
  lastCookedAt?: Date | string | null;
  cookCount?: number | null;
  className?: string;
}) {
  const label = formatCookHistory(lastCookedAt, cookCount);

  if (!label) return null;

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <CheckCircleIcon className="h-4 w-4" />
      {label}
    </span>
  );
}
