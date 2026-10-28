"use client";

import { DropdownButtonTrigger } from "@/components/ui/overlay-button-trigger";
import { useLocaleCookie } from "@/hooks/user/use-locale-cookie";
import { GlobeAltIcon } from "@heroicons/react/16/solid";
import { Dropdown, Label, Skeleton } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

import type { Locale } from "@norish/i18n/config";
import { isValidLocale } from "@norish/i18n/config";

/**
 * Language selector for auth pages (login/signup)
 *
 * Uses cookie-based locale storage since user is not authenticated.
 * Fetches enabled locales from the public API.
 */
export function AuthLanguageSelector() {
  const t = useTranslations("common.language");
  const { locale, changeLocale, isChanging, isLoadingConfig, enabledLocales } = useLocaleCookie();

  // Show skeleton while loading config
  if (isLoadingConfig) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  // Don't render if only one locale is enabled (no choice to make)
  if (enabledLocales.length <= 1) {
    return null;
  }

  return (
    <Dropdown>
      <DropdownButtonTrigger
        isIconOnly
        aria-label={t("title")}
        isPending={isChanging}
        size="sm"
        variant="tertiary"
      >
        <GlobeAltIcon className="size-5" />
      </DropdownButtonTrigger>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu
          aria-label={t("title")}
          selectedKeys={new Set([locale])}
          selectionMode="single"
          onSelectionChange={(keys) => {
            if (keys === "all") return;

            const selected = [...keys][0];

            if (typeof selected === "string" && isValidLocale(selected)) {
              changeLocale(selected as Locale);
            }
          }}
        >
          {enabledLocales.map((loc) => (
            <Dropdown.Item key={loc.code} id={loc.code} textValue={loc.name}>
              <Label>{loc.name}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

export default AuthLanguageSelector;
