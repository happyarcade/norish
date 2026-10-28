"use client";

import type { FullRecipeDTO, RecipeDashboardDTO } from "@norish/shared/contracts";

import { GlobeAltIcon } from "@heroicons/react/16/solid";

type RecipeSource = NonNullable<FullRecipeDTO["source"] | RecipeDashboardDTO["source"]>;

type RecipeSourceMetaProps = {
  source?: RecipeSource | null;
  fallbackUrl?: string | null;
  className?: string;
};

function getDomainFromUrl(url: string | null | undefined) {
  if (!url) return null;

  try {
    return new URL(url).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

export function RecipeSourceMeta({ source, fallbackUrl, className }: RecipeSourceMetaProps) {
  const label = source?.siteName || source?.sourceDomain || getDomainFromUrl(fallbackUrl);
  const href = source?.sourceUrl || fallbackUrl || null;

  if (!label) return null;

  const content = (
    <>
      <GlobeAltIcon className="h-4 w-4" />
      <span>Source: {label}</span>
    </>
  );

  const classes = `text-default-500 flex w-fit items-center gap-1 text-sm ${className ?? ""}`;

  if (href) {
    return (
      <a className={`${classes} hover:text-primary hover:underline`} href={href} rel="noopener noreferrer" target="_blank">
        {content}
      </a>
    );
  }

  return <div className={classes}>{content}</div>;
}
