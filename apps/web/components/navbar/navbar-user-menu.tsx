"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import ImportRecipeModal from "@/components/shared/import-recipe-modal";
import { Button } from "@/components/ui/button";
import { useUserContext } from "@/context/user-context";
import { useVersionQuery } from "@/hooks/config";
import { useLanguageSwitch } from "@/hooks/user/use-language-switch";
import {
  ArrowDownTrayIcon,
  ArrowLeftStartOnRectangleIcon,
  Cog6ToothIcon,
  EllipsisVerticalIcon,
  PlusIcon,
} from "@heroicons/react/16/solid";
import { Avatar, Dropdown, Header, Label, Separator } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

import { useUserAvatar } from "@norish/shared-react/hooks";

import { useThemeSwitch } from "./theme-switch";

type TriggerVariant = "avatar" | "ellipsis";

interface NavbarUserMenuProps {
  trigger?: TriggerVariant;
}

export default function NavbarUserMenu({ trigger = "avatar" }: NavbarUserMenuProps) {
  const t = useTranslations("navbar.userMenu");
  const { user, userMenuOpen: _userMenuOpen, setUserMenuOpen, signOut } = useUserContext();
  const router = useRouter();
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { currentVersion, latestVersion, updateAvailable, releaseUrl } = useVersionQuery();
  const tLanguage = useTranslations("common.language");
  const tStatus = useTranslations("common.status");
  const tTheme = useTranslations("navbar.theme");
  const language = useLanguageSwitch();
  const theme = useThemeSwitch();
  const { avatarSrc, fallbackStyle } = useUserAvatar({
    image: user?.image,
    fallbackSeed: user?.id || user?.email || user?.name || "U",
    disabled: imageError,
  });

  const handleImageError = () => {
    setImageError(true);
  };

  if (!user) return null;

  const userLabel = user.name || user.email || "U";
  const userInitial = userLabel.charAt(0).toUpperCase();
  const themeLabel =
    theme.theme === "system" ? tTheme("system") : theme.isDark ? tTheme("dark") : tTheme("light");

  return (
    <>
      <Dropdown onOpenChange={setUserMenuOpen}>
        {trigger === "avatar" ? (
          <Button
            isIconOnly
            aria-label="Open user menu"
            className="relative h-auto min-h-0 w-auto min-w-0 overflow-visible rounded-full bg-transparent p-0"
            variant="ghost"
          >
            <Avatar
              className={`h-13 w-13 cursor-pointer border border-black/30 text-lg font-semibold dark:border-white/25 ${avatarSrc ? "bg-white dark:bg-black" : ""}`}
              size="lg"
            >
              {avatarSrc ? (
                <Avatar.Image alt={userLabel} src={avatarSrc} onError={handleImageError} />
              ) : null}
              <Avatar.Fallback style={fallbackStyle}>{userInitial}</Avatar.Fallback>
            </Avatar>
            {updateAvailable && (
              <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                <span className="bg-primary relative inline-flex h-3 w-3 rounded-full" />
              </span>
            )}
          </Button>
        ) : (
          <Button
            isIconOnly
            aria-label="Open user menu"
            className="text-foreground"
            size="sm"
            variant="tertiary"
          >
            <EllipsisVerticalIcon className="size-5" />
          </Button>
        )}

        <Dropdown.Popover className="min-w-[280px]" placement="bottom end">
          <Dropdown.Menu aria-label="User menu">
            <Dropdown.Section>
              <Header className="px-3 py-2">
                <span className="text-foreground block text-sm font-semibold">{user.name}</span>
                <span className="text-default-500 block text-xs font-normal">{user.email}</span>
              </Header>

              <Dropdown.Item
                id="language"
                isDisabled={!language.mounted || language.isChanging}
                textValue={tLanguage("title")}
                onAction={language.cycleLocale}
              >
                <span className="text-default-500">{language.icon}</span>
                <div className="flex flex-col items-start">
                  <Label>{tLanguage("title")}</Label>
                  <span className="text-default-500 text-xs leading-tight">
                    {language.isChanging ? tStatus("changing") : language.label}
                  </span>
                </div>
              </Dropdown.Item>

              <Dropdown.Item
                id="create-recipe"
                textValue={t("newRecipe.title")}
                onAction={() => {
                  setUserMenuOpen(false);
                  router.push("/recipes/new");
                }}
              >
                <PlusIcon className="text-default-500 size-5" />
                <div className="flex flex-col items-start">
                  <Label>{t("newRecipe.title")}</Label>
                  <span className="text-default-500 text-xs leading-tight">
                    {t("newRecipe.description")}
                  </span>
                </div>
              </Dropdown.Item>

              <Dropdown.Item
                id="import-url"
                textValue={t("importUrl.title")}
                onAction={() => {
                  setUserMenuOpen(false);
                  setShowUrlModal(true);
                }}
              >
                <ArrowDownTrayIcon className="text-default-500 size-5" />
                <div className="flex flex-col items-start">
                  <Label>{t("importUrl.title")}</Label>
                  <span className="text-default-500 text-xs leading-tight">
                    {t("importUrl.description")}
                  </span>
                </div>
              </Dropdown.Item>

              <Dropdown.Item
                id="theme"
                isDisabled={!theme.mounted}
                textValue={tTheme("title")}
                onAction={theme.cycleTheme}
              >
                <span className="text-default-500">{theme.icon}</span>
                <div className="flex flex-col items-start">
                  <Label>{tTheme("title")}</Label>
                  <span className="text-default-500 text-xs leading-tight">{themeLabel}</span>
                </div>
              </Dropdown.Item>

              <Dropdown.Item
                id="settings"
                textValue={t("settings.title")}
                onAction={() => {
                  setUserMenuOpen(false);
                  router.push("/settings?tab=user");
                }}
              >
                <Cog6ToothIcon className="text-default-500 size-5" />
                <div className="flex flex-col items-start">
                  <Label>{t("settings.title")}</Label>
                  <span className="text-default-500 text-xs leading-tight">
                    {t("settings.description")}
                  </span>
                </div>
              </Dropdown.Item>

              <Dropdown.Item
                id="logout"
                textValue={t("logout")}
                variant="danger"
                onAction={() => {
                  setUserMenuOpen(false);
                  signOut();
                }}
              >
                <ArrowLeftStartOnRectangleIcon className="size-5" />
                <Label>{t("logout")}</Label>
              </Dropdown.Item>
            </Dropdown.Section>

            <Separator />

            <Dropdown.Item
              id="version"
              isDisabled={!updateAvailable || !releaseUrl}
              textValue="Version"
              onAction={() => {
                if (releaseUrl) window.open(releaseUrl, "_blank", "noopener,noreferrer");
              }}
            >
              <div className="text-default-500 flex w-full items-center justify-end gap-2 text-xs">
                {updateAvailable && latestVersion ? (
                  <span className="text-primary">
                    {t("version.updateAvailable", { version: latestVersion })}
                  </span>
                ) : null}
                <span>v{currentVersion ?? "..."}</span>
              </div>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      {/* Import from URL Modal */}
      <ImportRecipeModal isOpen={showUrlModal} onOpenChange={setShowUrlModal} />
    </>
  );
}
