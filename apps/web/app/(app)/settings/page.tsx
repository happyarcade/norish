"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import SettingsSkeleton from "@/components/skeleton/settings-skeleton";
import { useUserRoleQuery } from "@/hooks/admin";
import {
  HomeIcon as HomeIconSolid,
  ServerIcon as ServerIconSolid,
  ShieldCheckIcon as ShieldCheckIconSolid,
  UserCircleIcon as UserCircleIconSolid,
} from "@heroicons/react/20/solid";
import {
  HomeIcon as HomeIconOutline,
  ServerIcon as ServerIconOutline,
  ShieldCheckIcon as ShieldCheckIconOutline,
  UserCircleIcon as UserCircleIconOutline,
} from "@heroicons/react/24/outline";
import { Tabs } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

const UserSettingsTab = dynamic(() => import("./user/components/user-settings-content"), {
  loading: () => <SettingsSkeleton />,
});

const HouseholdSettingsTab = dynamic(
  () => import("./household/components/household-settings-content"),
  {
    loading: () => <SettingsSkeleton />,
  }
);

const CalDavSettingsTab = dynamic(() => import("./caldav/components/caldav-settings-content"), {
  loading: () => <SettingsSkeleton />,
});

const AdminSettingsTab = dynamic(() => import("./admin/components/admin-settings-content"), {
  loading: () => <SettingsSkeleton />,
});

function SettingsContent() {
  const t = useTranslations("settings");
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "user";
  const { isServerAdmin, isLoading: isLoadingRole } = useUserRoleQuery();

  const handleTabChange = (key: React.Key) => {
    router.push(`/settings?tab=${String(key)}`);
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("page.title")}</h1>

      <Tabs selectedKey={currentTab} variant="secondary" onSelectionChange={handleTabChange}>
        <Tabs.ListContainer className="overflow-x-auto">
          <Tabs.List aria-label={t("page.ariaLabel")} className="min-w-max">
            <Tabs.Tab className="h-12" id="user">
              <Tabs.Indicator />
              <div className="flex items-center gap-2">
                {currentTab === "user" ? (
                  <UserCircleIconSolid className="h-5 w-5" />
                ) : (
                  <UserCircleIconOutline className="h-5 w-5" />
                )}
                <span>{t("tabs.user")}</span>
              </div>
            </Tabs.Tab>

            <Tabs.Tab className="h-12" id="household">
              <Tabs.Indicator />
              <div className="flex items-center gap-2">
                {currentTab === "household" ? (
                  <HomeIconSolid className="h-5 w-5" />
                ) : (
                  <HomeIconOutline className="h-5 w-5" />
                )}
                <span>{t("tabs.household")}</span>
              </div>
            </Tabs.Tab>

            <Tabs.Tab className="h-12" id="caldav">
              <Tabs.Indicator />
              <div className="flex items-center gap-2">
                {currentTab === "caldav" ? (
                  <ServerIconSolid className="h-5 w-5" />
                ) : (
                  <ServerIconOutline className="h-5 w-5" />
                )}
                <span>{t("tabs.caldav")}</span>
              </div>
            </Tabs.Tab>

            {!isLoadingRole && isServerAdmin ? (
              <Tabs.Tab className="h-12" id="admin">
                <Tabs.Indicator />
                <div className="flex items-center gap-2">
                  {currentTab === "admin" ? (
                    <ShieldCheckIconSolid className="h-5 w-5" />
                  ) : (
                    <ShieldCheckIconOutline className="h-5 w-5" />
                  )}
                  <span>{t("tabs.admin")}</span>
                </div>
              </Tabs.Tab>
            ) : null}
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel className="py-4" id="user">
          <UserSettingsTab />
        </Tabs.Panel>
        <Tabs.Panel className="py-4" id="household">
          <HouseholdSettingsTab />
        </Tabs.Panel>
        <Tabs.Panel className="py-4" id="caldav">
          <CalDavSettingsTab />
        </Tabs.Panel>
        {!isLoadingRole && isServerAdmin ? (
          <Tabs.Panel className="py-4" id="admin">
            <AdminSettingsTab />
          </Tabs.Panel>
        ) : null}
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  const t = useTranslations("settings");

  return (
    <Suspense fallback={<div>{t("page.loading")}</div>}>
      <SettingsContent />
    </Suspense>
  );
}
